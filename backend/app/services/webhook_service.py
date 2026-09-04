import datetime
import json
import logging
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
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
from app.services.agent_service import _rule_based_diagnosis
from app.services.audit_service import record_audit_event
from app.services.decision_service import generate_recovery_decision
from app.services.diagnosis_service import store_diagnosis
from app.services.email_service import email_service
from app.services.invoice_service import invoice_service
from app.services.policy_service import validate_recovery_policy
from app.services.product_service import deduct_product_stock
from app.services.razorpay_service import razorpay_service
from app.services.retry_token_service import retry_token_service
from app.services.risk_service import ensure_recovery_case

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
        if signature:
            is_valid = razorpay_service.verify_webhook_signature(raw_body, signature)
            if not is_valid:
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
            logger.info(f"Webhook event {event_id} already processed. Returning idempotent response.")
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
            received_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(webhook_rec)
        db.flush()

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
            webhook_rec.processed_at = datetime.datetime.now(datetime.timezone.utc)
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
        order.updated_at = datetime.datetime.now(datetime.timezone.utc)

        # Update transaction if present
        txn = None
        recovery_case = None
        if order.transaction_id:
            txn = db.scalar(select(Transaction).where(Transaction.id == order.transaction_id))
        if not txn and order.id:
            txn = db.scalar(select(Transaction).where(Transaction.order_id == order.id))

        if txn:
            txn.status = PaymentStatus.SUCCESS
            txn.recovered_amount = txn.amount
            txn.recovery_status = RecoveryStatus.RECOVERED
            txn.failure_reason = None
            txn.gateway_response = "Payment captured via Razorpay webhook"

            # Resolve recovery case if active
            recovery_case = db.scalar(
                select(RecoveryCase)
                .where(RecoveryCase.transaction_id == txn.id)
                .order_by(RecoveryCase.created_at.desc())
            )
            if recovery_case:
                recovery_case.recovery_status = RecoveryStatus.RECOVERED
                recovery_case.recovered_amount = txn.amount
                recovery_case.success_timestamp = datetime.datetime.now(datetime.timezone.utc)

            # Record success audit events
            record_audit_event(
                db,
                event_type="PAYMENT_SUCCESS",
                event_message=f"Razorpay webhook confirmed payment capture for Order {order.id}",
                actor="razorpay-webhook",
                transaction_id=txn.id,
                recovery_case_id=recovery_case.id if recovery_case else None,
                metadata={
                    "razorpay_payment_id": razorpay_payment_id,
                    "razorpay_order_id": razorpay_order_id,
                    "amount": float(txn.amount),
                },
            )

            record_audit_event(
                db,
                event_type="ORDER_CONFIRMED",
                event_message=f"Order {order.id} confirmed and verified",
                actor="system",
                transaction_id=txn.id,
                metadata={"order_id": order.id, "amount": float(txn.amount)},
            )

            record_audit_event(
                db,
                event_type="REVENUE_RECOVERED",
                event_message=f"Revenue verified: {txn.currency} {float(txn.amount):,.2f}",
                actor="reviveai-agent",
                transaction_id=txn.id,
                recovery_case_id=recovery_case.id if recovery_case else None,
                metadata={"recovered_amount": float(txn.amount), "transaction_id": txn.transaction_id},
            )

            record_audit_event(
                db,
                event_type="RECOVERY_STOPPED",
                event_message="Recovery stopped on verified payment",
                actor="reviveai-agent",
                transaction_id=txn.id,
                recovery_case_id=recovery_case.id if recovery_case else None,
                metadata={"stop_reason": "PAYMENT_SUCCESS"},
            )

        # Deduct product stock
        deduct_product_stock(order.product_id, order.quantity, db)

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
                transaction_id=txn.id if txn else None,
                recovery_case_id=recovery_case.id if recovery_case else None,
            )

        db.flush()
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
        order.updated_at = datetime.datetime.now(datetime.timezone.utc)

        error_desc = payment_entity.get("error_description") or "Card / Bank Network Failure"
        error_code = payment_entity.get("error_code") or "BAD_REQUEST_ERROR"

        cust = db.scalar(select(Customer).where(Customer.id == order.customer_id))
        cust_name = cust.name if cust else "Valued Customer"
        cust_email = cust.email if cust else "customer@voltstore.in"

        # Update or create transaction for ReviveAI recovery
        txn = None
        if order.transaction_id:
            txn = db.scalar(select(Transaction).where(Transaction.id == order.transaction_id))
        if not txn:
            txn = db.scalar(select(Transaction).where(Transaction.order_id == order.id))

        if not txn and cust:
            # Create transaction record
            txn = Transaction(
                transaction_id=f"TX-{uuid.uuid4().hex[:8].upper()}",
                customer_id=cust.id,
                order_id=order.id,
                amount=order.total_amount,
                currency=order.currency or "INR",
                payment_method=payment_entity.get("method", "ONLINE_CHECKOUT").upper(),
                status=PaymentStatus.FAILED,
                failure_reason=error_desc,
                gateway_response=f"Razorpay error: {error_code} - {error_desc}",
                retry_count=0,
                recovery_status=RecoveryStatus.OPEN,
                recovered_amount=Decimal("0.00"),
            )
            db.add(txn)
            db.flush()
            order.transaction_id = txn.id

        if txn:
            txn.status = PaymentStatus.FAILED
            txn.failure_reason = error_desc
            txn.gateway_response = f"Razorpay error: {error_code} - {error_desc}"

            # Add payment attempt record
            attempt = PaymentAttempt(
                transaction_id=txn.id,
                attempt_number=len(txn.payment_attempts) + 1 if txn.payment_attempts else 1,
                status=PaymentStatus.FAILED,
                gateway_response=f"{error_code}: {error_desc}",
            )
            db.add(attempt)
            db.flush()

            # Record PAYMENT_FAILED audit event
            record_audit_event(
                db,
                event_type="PAYMENT_FAILED",
                event_message=f"Payment failure received via Razorpay webhook for Order {order.id}: {error_desc}",
                actor="razorpay-webhook",
                transaction_id=txn.id,
                metadata={
                    "order_id": order.id,
                    "razorpay_payment_id": razorpay_payment_id,
                    "error_code": error_code,
                    "error_description": error_desc,
                    "amount": float(txn.amount),
                },
            )

            # Trigger ReviveAI Recovery Pipeline
            recovery_case = ensure_recovery_case(db, txn)

            # AI Diagnosis & Policy
            diag_result = _rule_based_diagnosis(txn)
            store_diagnosis(diag_result)

            diag_dict = {
                "root_cause": diag_result.root_cause.value if hasattr(diag_result.root_cause, "value") else str(diag_result.root_cause),
                "confidence": float(diag_result.confidence),
                "requires_human_review": diag_result.requires_human_review,
            }
            tx_context = {
                "status": "failed",
                "retry_count": txn.retry_count,
                "amount": float(txn.amount),
                "customer_opted_out": False,
            }
            decision_data = generate_recovery_decision(diag_dict, tx_context)
            policy_res = validate_recovery_policy(decision_data, tx_context)

            record_audit_event(
                db,
                event_type="AI_RECOVERY_STARTED",
                event_message="ReviveAI autonomous recovery workflow triggered on webhook failure",
                actor="reviveai-agent",
                transaction_id=txn.id,
                recovery_case_id=recovery_case.id if recovery_case else None,
                metadata={"diagnosis": diag_dict, "decision": decision_data},
            )

            record_audit_event(
                db,
                event_type="RECOVERY_DECISION_CREATED",
                event_message=f"Recovery strategy selected: {decision_data.get('decision', 'controlled_retry')}",
                actor="reviveai-agent",
                transaction_id=txn.id,
                recovery_case_id=recovery_case.id if recovery_case else None,
                metadata=decision_data,
            )

            # Generate Secure Retry Token & Link
            if cust:
                token_rec, retry_url = retry_token_service.create_secure_retry_token(
                    db,
                    transaction=txn,
                    customer=cust,
                    order=order,
                    recovery_case=recovery_case,
                )

                # Send Real Transactional Email via Resend
                if cust_email:
                    email_service.send_payment_failed_recovery(
                        to_email=cust_email,
                        order_data={
                            "order_id": order.id,
                            "customer_name": cust_name,
                            "product_name": order.product_name,
                            "total_amount": float(order.total_amount),
                        },
                        retry_url=retry_url,
                        failure_reason=error_desc,
                        db=db,
                        customer_id=cust.id,
                        transaction_id=txn.id,
                        recovery_case_id=recovery_case.id if recovery_case else None,
                    )

        db.flush()
        logger.info(f"Successfully processed payment failure for order {order.id}")


webhook_service = WebhookService()
