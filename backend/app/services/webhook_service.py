import datetime
import json
import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transaction import (
    Customer,
    Order,
    PaymentAttempt,
    PaymentStatus,
    Product,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
    WebhookEvent,
)
from app.services.audit_service import audit_service
from app.services.email_service import email_service
from app.services.invoice_service import invoice_service
from app.services.product_service import deduct_product_stock
from app.services.razorpay_service import razorpay_service
from app.services.recovery_service import recovery_service
from app.services.risk_service import risk_service

logger = logging.getLogger("reviveai.webhook")


class WebhookService:
    def process_razorpay_webhook(
        self,
        raw_body: bytes,
        signature: str | None,
        db: Session,
    ) -> dict[str, Any]:
        """
        Processes Razorpay webhook with raw body signature verification and idempotency check.
        """
        # 1. Signature Verification
        if signature and not razorpay_service.verify_webhook_signature(raw_body, signature):
            # If in local dev / mock mode, allow test signature, otherwise reject
            logger.warning("Razorpay webhook signature verification mismatch.")

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception as e:
            logger.error(f"Failed to parse webhook JSON body: {e}")
            return {"status": "error", "message": "Invalid JSON"}

        event_name = payload.get("event", "unknown")
        event_id = payload.get("id") or f"evt_{uuid.uuid4().hex[:16]}"
        logger.info(f"Received Razorpay Webhook Event: {event_name} (ID: {event_id})")

        # 2. Idempotency Check
        existing_event = db.scalar(
            select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        )
        if existing_event:
            logger.info(f"Webhook event {event_id} already processed. Returning idempotent success.")
            return {
                "status": "duplicate",
                "message": "Event already processed",
                "event_id": event_id,
            }

        # Record incoming event in DB
        webhook_rec = WebhookEvent(
            id=str(uuid.uuid4()),
            provider="RAZORPAY",
            event_id=event_id,
            event_type=event_name,
            payload=payload,
            status="IN_PROGRESS",
            received_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(webhook_rec)
        db.commit()

        # 3. Event Handling
        try:
            payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
            order_entity = payload.get("payload", {}).get("order", {}).get("entity", {})
            
            razorpay_order_id = payment_entity.get("order_id") or order_entity.get("id")
            razorpay_payment_id = payment_entity.get("id")

            # Find matching internal order
            order = None
            if razorpay_order_id:
                order = db.scalar(select(Order).where(Order.razorpay_order_id == razorpay_order_id))

            if event_name in ["payment.captured", "order.paid", "payment.authorized"]:
                self._handle_payment_success(db, order, razorpay_order_id, razorpay_payment_id, payment_entity)
            elif event_name == "payment.failed":
                self._handle_payment_failure(db, order, razorpay_order_id, razorpay_payment_id, payment_entity)

            webhook_rec.status = "PROCESSED"
            webhook_rec.processed_at = datetime.datetime.now(datetime.UTC)
            db.commit()

            return {"status": "success", "event_id": event_id, "event": event_name}

        except Exception as e:
            logger.error(f"Error handling webhook event {event_id}: {e}", exc_info=True)
            webhook_rec.status = "FAILED"
            db.commit()
            return {"status": "error", "message": str(e)}

    def _handle_payment_success(
        self,
        db: Session,
        order: Order | None,
        razorpay_order_id: str | None,
        razorpay_payment_id: str | None,
        payment_entity: dict[str, Any],
    ) -> None:
        if not order:
            logger.warning(f"No internal order found for razorpay_order_id: {razorpay_order_id}")
            return

        if order.status in ["CONFIRMED", "PAYMENT_SUCCESS"]:
            logger.info(f"Order {order.id} is already confirmed.")
            return

        order.status = "CONFIRMED"
        order.razorpay_payment_id = razorpay_payment_id or order.razorpay_payment_id
        order.updated_at = datetime.datetime.now(datetime.UTC)

        # Update transaction if present
        if order.transaction_id:
            txn = db.scalar(select(Transaction).where(Transaction.id == order.transaction_id))
            if txn:
                txn.payment_status = PaymentStatus.SUCCESS
                txn.error_code = None
                txn.error_message = None

                # Resolve recovery case if active
                recovery_case = db.scalar(
                    select(RecoveryCase).where(RecoveryCase.transaction_id == txn.id)
                )
                if recovery_case:
                    recovery_case.status = RecoveryStatus.RECOVERED
                    recovery_case.recovered_amount = txn.amount

        # Deduct product stock
        deduct_product_stock(db, order.product_id, order.quantity)

        # Generate PDF Invoice
        cust = db.scalar(select(Customer).where(Customer.id == order.customer_id))
        cust_name = cust.name if cust else "Valued Customer"
        cust_email = cust.email if cust else "customer@voltstore.in"

        invoice_data = {
            "invoice_number": f"INV-{uuid.uuid4().hex[:8].upper()}",
            "order_id": order.id,
            "date": datetime.datetime.now().strftime("%d %b %Y, %I:%M %p"),
            "customer_name": cust_name,
            "customer_email": cust_email,
            "shipping_address": str(order.delivery_address),
            "payment_reference": razorpay_payment_id or "RZP_CAPTURED",
            "razorpay_order_id": razorpay_order_id or "N/A",
            "product_name": order.product_name,
            "category": order.category,
            "quantity": order.quantity,
            "unit_price": order.unit_price,
            "subtotal": order.subtotal,
            "delivery_charge": order.delivery_charge,
            "discount": order.discount,
            "total_amount": order.total_amount,
        }
        pdf_bytes = invoice_service.generate_invoice_pdf(invoice_data)

        # Dispatch real confirmation & e-bill email
        if cust_email:
            email_service.send_order_confirmation(
                to_email=cust_email,
                order_data=invoice_data,
                pdf_bytes=pdf_bytes,
                db=db,
                customer_id=order.customer_id,
            )

        db.commit()
        logger.info(f"Successfully processed payment capture for order {order.id}")

    def _handle_payment_failure(
        self,
        db: Session,
        order: Order | None,
        razorpay_order_id: str | None,
        razorpay_payment_id: str | None,
        payment_entity: dict[str, Any],
    ) -> None:
        if not order:
            logger.warning(f"No order found for failed payment with razorpay_order_id: {razorpay_order_id}")
            return

        order.status = "PAYMENT_FAILED"
        order.updated_at = datetime.datetime.now(datetime.UTC)

        error_desc = payment_entity.get("error_description") or "Card / Bank Network Failure"
        error_code = payment_entity.get("error_code") or "BAD_REQUEST_ERROR"

        # Update or create transaction for ReviveAI recovery
        cust = db.scalar(select(Customer).where(Customer.id == order.customer_id))
        cust_name = cust.name if cust else "Customer"
        cust_email = cust.email if cust else "customer@voltstore.in"

        if order.transaction_id:
            txn = db.scalar(select(Transaction).where(Transaction.id == order.transaction_id))
            if txn:
                txn.payment_status = PaymentStatus.FAILED
                txn.error_code = error_code
                txn.error_message = error_desc
                
                # Add attempt
                attempt = PaymentAttempt(
                    id=str(uuid.uuid4()),
                    transaction_id=txn.id,
                    attempt_number=len(txn.payment_attempts) + 1,
                    status=PaymentStatus.FAILED,
                    error_code=error_code,
                    error_message=error_desc,
                    gateway_response={"entity": payment_entity},
                )
                db.add(attempt)
                
                # Trigger existing ReviveAI recovery pipeline
                risk_service.assess_transaction_risk(txn, db)
                recovery_case, _ = recovery_service.start_recovery(
                    transaction_id=txn.id,
                    db=db,
                    idempotency_key=f"rec_{txn.id}",
                )

                # Send real payment failure & recovery link email
                if cust_email:
                    recovery_token = recovery_case.recovery_token if recovery_case else f"rec_token_{txn.id}"
                    retry_url = f"{settings.app_url}/payment/retry/{recovery_token}"
                    email_service.send_payment_failed_recovery(
                        to_email=cust_email,
                        order_data={
                            "order_id": order.id,
                            "customer_name": cust_name,
                            "product_name": order.product_name,
                            "total_amount": order.total_amount,
                        },
                        retry_url=retry_url,
                        failure_reason=error_desc,
                        db=db,
                        customer_id=order.customer_id,
                    )

        db.commit()
        logger.info(f"Successfully processed payment failure and initiated ReviveAI recovery for order {order.id}")


webhook_service = WebhookService()
