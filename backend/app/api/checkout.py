import datetime
import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    ActionStatus,
    Customer,
    CustomerPreference,
    CustomerStatus,
    EscalationCase,
    EscalationStatus,
    PaymentAttempt,
    PaymentStatus,
    RecoveryAction,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
)
from app.schemas.revive import DiagnosisResult
from app.services.agent_service import _rule_based_diagnosis
from app.services.audit_service import record_audit_event
from app.services.decision_service import generate_recovery_decision
from app.services.diagnosis_service import store_diagnosis
from app.services.policy_service import validate_recovery_policy
from app.services.product_service import (
    ELECTRICAL_PRODUCTS,
    calculate_risk_level,
    get_product_by_id,
    list_products,
)
from app.services.risk_service import ensure_recovery_case
from app.services.serializers import transaction_dict

router = APIRouter(prefix="/checkout", tags=["Customer Checkout"])


class CustomerInput(BaseModel):
    name: str = "Arun Kumar"
    email: str = "arun.kumar@example.com"
    phone: str = "+91 98765 43210"
    address: str = "42 Green Meadows, Indiranagar, Bengaluru, KA 560038"


class InitiateCheckoutRequest(BaseModel):
    product_id: str = "prod_smart_fan_05"
    quantity: int = 1
    customer: CustomerInput = Field(default_factory=CustomerInput)


class AbandonCheckoutRequest(BaseModel):
    product_id: str = "prod_mixer_grinder_09"
    quantity: int = 1
    amount: float = 6999.00
    currency: str = "INR"
    last_stage: str = "PAYMENT_METHOD_SELECTION"
    customer: CustomerInput = Field(default_factory=CustomerInput)


class ProcessPaymentRequest(BaseModel):
    order_id: str | None = None
    transaction_id: str | None = None
    product_id: str = "prod_smart_fan_05"
    quantity: int = 1
    amount: float = 7499.00
    currency: str = "INR"
    payment_method: str = "UPI"  # UPI, CARD, NET_BANKING
    customer: CustomerInput = Field(default_factory=CustomerInput)
    simulation_scenario: str = "NETWORK_ERROR"  # NETWORK_ERROR, TIMEOUT, AUTH_FAILURE, DECLINE, SUCCESS


class RetryPaymentRequest(BaseModel):
    transaction_id: str
    order_id: str | None = None
    token: str | None = None
    retry_outcome: str = "SUCCESS"  # SUCCESS, FAILED


def _generate_ids() -> tuple[str, str, str]:
    now_str = datetime.datetime.utcnow().strftime("%Y%m%d")
    rand_suffix = uuid.uuid4().hex[:6].upper()
    order_id = f"ORD-{now_str}-{rand_suffix}"
    transaction_id = f"TX-{now_str}-{rand_suffix}"
    customer_id = f"CUST-{rand_suffix}"
    return order_id, transaction_id, customer_id


@router.get("/products")
def get_products(
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
):
    """Returns all electrical products with optional category and search filtering."""
    items = list_products(category=category, search=search)
    return {"data": items, "count": len(items)}


@router.get("/products/{product_id}")
def get_single_product(product_id: str):
    """Returns a single product by ID."""
    prod = get_product_by_id(product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"data": prod}


@router.post("/initiate")
def initiate_checkout(payload: InitiateCheckoutRequest, db: Session = Depends(get_db)):
    """Creates an order context and logs the CHECKOUT_STARTED event."""
    product = get_product_by_id(payload.product_id) or ELECTRICAL_PRODUCTS[0]
    order_id, transaction_id, customer_id = _generate_ids()
    total_amount = float(product["price"]) * max(payload.quantity, 1)

    record_audit_event(
        db,
        event_type="CHECKOUT_STARTED",
        event_message=f"Customer initiated checkout for {product['name']} (Qty: {payload.quantity})",
        actor="customer",
        metadata={
            "order_id": order_id,
            "product_id": product["id"],
            "product_name": product["name"],
            "quantity": payload.quantity,
            "amount": total_amount,
            "currency": "INR",
            "customer_name": payload.customer.name,
            "customer_email": payload.customer.email,
        },
    )
    db.commit()

    return {
        "order_id": order_id,
        "transaction_id": transaction_id,
        "customer_id": customer_id,
        "product": product,
        "quantity": payload.quantity,
        "total_amount": total_amount,
        "currency": "INR",
    }


@router.post("/abandon")
def record_checkout_abandonment(payload: AbandonCheckoutRequest, db: Session = Depends(get_db)):
    """
    Scenario 3: Tracks customers who reach checkout / payment page but leave without completing payment.
    Records checkout abandonment, generates dynamic payment continuation link,
    triggers AI diagnosis & customer recovery message.
    """
    order_id, transaction_id, customer_id = _generate_ids()
    product = get_product_by_id(payload.product_id) or ELECTRICAL_PRODUCTS[0]
    amount_dec = Decimal(str(payload.amount or product["price"]))
    recovery_token = f"tok_abn_{uuid.uuid4().hex[:10]}"

    # 1. Ensure customer in DB
    customer_rec = db.query(Customer).filter(Customer.email == payload.customer.email).first()
    if not customer_rec:
        customer_rec = Customer(
            name=payload.customer.name,
            email=payload.customer.email,
            phone=payload.customer.phone,
            status=CustomerStatus.ACTIVE,
        )
        db.add(customer_rec)
        db.flush()
        db.add(CustomerPreference(customer_id=customer_rec.id, opted_out=False))
        db.flush()

    # 2. Record Transaction with ABANDONED status
    tx = Transaction(
        transaction_id=transaction_id,
        customer_id=customer_rec.id,
        order_id=order_id,
        amount=amount_dec,
        currency=payload.currency,
        payment_method="ONLINE_CHECKOUT",
        status=PaymentStatus.ABANDONED,
        failure_reason=f"Checkout Abandoned at {payload.last_stage}",
        gateway_response="Customer exited checkout session prior to payment capture",
        retry_count=0,
        recovery_status=RecoveryStatus.OPEN,
        recovered_amount=Decimal("0.00"),
        customer_response=recovery_token,  # store token
    )
    db.add(tx)
    db.flush()

    # 3. Record Audit Trail
    record_audit_event(
        db,
        event_type="CHECKOUT_ABANDONED",
        event_message=f"Customer abandoned checkout for {product['name']} at {payload.last_stage}",
        actor="customer",
        transaction_id=tx.id,
        metadata={
            "order_id": order_id,
            "transaction_id": transaction_id,
            "product_id": product["id"],
            "product_name": product["name"],
            "amount": float(amount_dec),
            "last_stage": payload.last_stage,
            "recovery_token": recovery_token,
        },
    )

    # 4. Trigger Autonomous AI Revenue Risk Detection
    recovery_case = ensure_recovery_case(db, tx)

    # 5. Autonomous Customer Message & Payment Link
    recovery_link = f"/pay/recover/{recovery_token}"
    customer_message = (
        f"Hi {payload.customer.name},\n\n"
        f"We noticed you left your order for {product['name']} (₹{float(amount_dec):,.2f}) before completing checkout.\n"
        f"Your items have been safely reserved. Please complete your order securely using the link below:\n\n"
        f"{recovery_link}"
    )

    record_audit_event(
        db,
        event_type="CUSTOMER_MESSAGE_SENT",
        event_message=f"Automatic payment continuation message sent to {payload.customer.name}",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "recipient": payload.customer.email,
            "message": customer_message,
            "channel": "EMAIL_SMS_PUSH",
            "recovery_token": recovery_token,
        },
    )

    record_audit_event(
        db,
        event_type="PAYMENT_LINK_GENERATED",
        event_message=f"Dynamic payment continuation link generated: {recovery_link}",
        actor="reviveai-executor",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={"payment_link": recovery_link, "token": recovery_token, "expires_in_hours": 24},
    )

    db.commit()

    return {
        "status": "CHECKOUT_ABANDONED",
        "order_id": order_id,
        "transaction_id": transaction_id,
        "product_name": product["name"],
        "amount": float(amount_dec),
        "currency": payload.currency,
        "revenue_at_risk": float(amount_dec),
        "recovery_token": recovery_token,
        "payment_link": recovery_link,
        "customer_message": customer_message,
    }


@router.post("/process-payment")
def process_checkout_payment(payload: ProcessPaymentRequest, db: Session = Depends(get_db)):
    """
    Simulates customer payment attempt in test/sandbox.
    Automatically ingests transaction, records technical failures (e.g. NETWORK_ERROR),
    detects revenue at risk, triggers AI root cause diagnosis, policy validation,
    and dispatches the automatic customer recovery message with dynamic payment continuation link.
    """
    now_str = datetime.datetime.utcnow().strftime("%Y%m%d")
    order_id = payload.order_id or f"ORD-{now_str}-{uuid.uuid4().hex[:6].upper()}"
    transaction_id = payload.transaction_id or f"TX-{now_str}-{uuid.uuid4().hex[:6].upper()}"
    product = get_product_by_id(payload.product_id) or ELECTRICAL_PRODUCTS[0]
    amount_dec = Decimal(str(payload.amount or product["price"]))
    recovery_token = f"tok_{uuid.uuid4().hex[:10]}"

    # 1. Record PAYMENT_INITIATED audit event
    record_audit_event(
        db,
        event_type="PAYMENT_INITIATED",
        event_message=f"Payment initiated via {payload.payment_method} for amount ₹{float(amount_dec):,.2f}",
        actor="customer",
        metadata={
            "order_id": order_id,
            "transaction_id": transaction_id,
            "product_id": product["id"],
            "product_name": product["name"],
            "payment_method": payload.payment_method,
            "amount": float(amount_dec),
            "currency": payload.currency,
            "simulation_scenario": payload.simulation_scenario,
        },
    )

    # 2. Ensure customer in DB
    customer_rec = db.query(Customer).filter(Customer.email == payload.customer.email).first()
    if not customer_rec:
        customer_rec = Customer(
            name=payload.customer.name,
            email=payload.customer.email,
            phone=payload.customer.phone,
            status=CustomerStatus.ACTIVE,
        )
        db.add(customer_rec)
        db.flush()
        db.add(CustomerPreference(customer_id=customer_rec.id, opted_out=False))
        db.flush()

    scenario = (payload.simulation_scenario or "NETWORK_ERROR").upper()

    # 3. DIRECT SUCCESS SCENARIO
    if scenario == "SUCCESS":
        tx = Transaction(
            transaction_id=transaction_id,
            customer_id=customer_rec.id,
            order_id=order_id,
            amount=amount_dec,
            currency=payload.currency,
            payment_method=payload.payment_method,
            status=PaymentStatus.SUCCESS,
            failure_reason=None,
            gateway_response="Gateway capture successful (Sandbox)",
            retry_count=0,
            recovery_status=RecoveryStatus.NOT_STARTED,
            recovered_amount=Decimal("0.00"),
            customer_response=recovery_token,
        )
        db.add(tx)
        db.flush()

        db.add(
            PaymentAttempt(
                transaction_id=tx.id,
                attempt_number=1,
                status=PaymentStatus.SUCCESS,
                gateway_response="Payment captured successfully (Sandbox)",
            )
        )

        record_audit_event(
            db,
            event_type="PAYMENT_SUCCESS",
            event_message=f"Payment captured successfully for Order {order_id}",
            actor="payment-gateway",
            transaction_id=tx.id,
            metadata={
                "order_id": order_id,
                "transaction_id": transaction_id,
                "product_name": product["name"],
                "amount": float(amount_dec),
            },
        )
        db.commit()

        return {
            "success": True,
            "status": "SUCCESS",
            "order_id": order_id,
            "transaction_id": transaction_id,
            "order_status": "CONFIRMED",
            "message": "Payment successful! Your order has been placed.",
            "product_name": product["name"],
            "amount": float(amount_dec),
            "currency": payload.currency,
        }

    # 4. PAYMENT FAILURE MAPPINGS
    failure_mapping = {
        "NETWORK_ERROR": (
            "Network Error: Connection Reset During Payment (TCP RST)",
            "Acquiring gateway connection dropped during 3DS auth handshake with issuer switch",
            "technical_failure",
            0.94,
        ),
        "TIMEOUT": (
            "Payment Gateway Timeout (HTTP 504 Gateway Timeout)",
            "Bank network connection timed out after 30000ms while processing payment token",
            "payment_timeout",
            0.92,
        ),
        "AUTH_FAILURE": (
            "Authentication Handshake Failure (OTP Timeout / 3DS Error)",
            "Customer 3DS auth token expired before verification completed",
            "authentication_failure",
            0.85,
        ),
        "DECLINE": (
            "Issuer Bank Decline (Do Not Honor)",
            "Bank declined transaction: insufficient balance or daily transaction limit exceeded",
            "bank_decline",
            0.88,
        ),
    }

    reason, gw_msg, root_cause_str, confidence = failure_mapping.get(
        scenario, failure_mapping["NETWORK_ERROR"]
    )

    tx = Transaction(
        transaction_id=transaction_id,
        customer_id=customer_rec.id,
        order_id=order_id,
        amount=amount_dec,
        currency=payload.currency,
        payment_method=payload.payment_method,
        status=PaymentStatus.FAILED,
        failure_reason=reason,
        gateway_response=gw_msg,
        retry_count=0,
        recovery_status=RecoveryStatus.OPEN,
        recovered_amount=Decimal("0.00"),
        customer_response=recovery_token,
    )
    db.add(tx)
    db.flush()

    db.add(
        PaymentAttempt(
            transaction_id=tx.id,
            attempt_number=1,
            status=PaymentStatus.FAILED,
            gateway_response=gw_msg,
        )
    )

    # Event: PAYMENT_FAILED / NETWORK_ERROR
    is_network = "network" in scenario.lower() or "network" in reason.lower()
    event_type = "NETWORK_ERROR" if is_network else "PAYMENT_FAILED"

    record_audit_event(
        db,
        event_type=event_type,
        event_message=f"{event_type.replace('_', ' ').title()} for Order {order_id}: {reason}",
        actor="payment-gateway",
        transaction_id=tx.id,
        metadata={
            "order_id": order_id,
            "transaction_id": transaction_id,
            "failure_reason": reason,
            "gateway_response": gw_msg,
            "payment_method": payload.payment_method,
            "amount": float(amount_dec),
            "product_name": product["name"],
        },
    )

    # 5. ReviveAI AUTOMATIC TRIGGER: Ensure Recovery Case & Detect Revenue at Risk
    recovery_case = ensure_recovery_case(db, tx)

    # 6. ReviveAI Multi-Vector AI Diagnosis
    diag_result = _rule_based_diagnosis(tx)
    store_diagnosis(diag_result)

    # 7. AI Decision & Policy Guardrail
    diag_dict = {
        "root_cause": diag_result.root_cause.value if hasattr(diag_result.root_cause, "value") else str(diag_result.root_cause),
        "confidence": float(diag_result.confidence),
        "requires_human_review": diag_result.requires_human_review,
    }
    tx_context = {
        "status": "failed",
        "retry_count": tx.retry_count,
        "amount": float(tx.amount),
        "customer_opted_out": False,
    }
    decision_data = generate_recovery_decision(diag_dict, tx_context)
    policy_res = validate_recovery_policy(decision_data, tx_context)

    if recovery_case:
        recovery_case.recommended_action = decision_data.get("decision", "controlled_retry")
        recovery_case.policy_result = policy_res
        recovery_case.action_status = (
            ActionStatus.POLICY_APPROVED if policy_res.get("allowed") else ActionStatus.POLICY_BLOCKED
        )
        recovery_case.recovery_status = RecoveryStatus.OPEN

    record_audit_event(
        db,
        event_type="POLICY_VALIDATED",
        event_message=f"Safety policy validation: {policy_res.get('result', 'APPROVED')}",
        actor="reviveai-safety-engine",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "policy_result": policy_res,
            "decision": decision_data.get("decision"),
            "max_allowed_retries": 1,
            "current_retries": tx.retry_count,
        },
    )

    # 8. AUTOMATIC CUSTOMER RECOVERY MESSAGE (Core Requirement)
    recovery_link = f"/pay/recover/{recovery_token}"
    auto_msg = (
        f"Hi {payload.customer.name},\n\n"
        f"Your payment for {product['name']} (₹{float(amount_dec):,.2f}) could not be completed due to a temporary payment issue.\n\n"
        f"Your order is still available.\n\n"
        f"Please complete your payment using the secure payment link below:\n\n"
        f"{recovery_link}\n\n"
        f"[Complete Payment]"
    )

    record_audit_event(
        db,
        event_type="CUSTOMER_MESSAGE_SENT",
        event_message=f"Automatic customer recovery message dispatched to {payload.customer.name}",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "recipient": payload.customer.email,
            "customer_name": payload.customer.name,
            "message": auto_msg,
            "recovery_token": recovery_token,
        },
    )

    record_audit_event(
        db,
        event_type="PAYMENT_LINK_GENERATED",
        event_message=f"Dynamic payment link created for Order {order_id}",
        actor="reviveai-executor",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "link": recovery_link,
            "token": recovery_token,
            "expires_in_hours": 24,
        },
    )

    db.commit()

    # Customer-safe response (does not expose internal seller scores or AI chain of thought)
    return {
        "success": False,
        "status": "FAILED",
        "order_id": order_id,
        "transaction_id": transaction_id,
        "order_status": "PAYMENT_FAILED",
        "customer_message": f"Your payment for {product['name']} could not be completed due to a temporary issue. Your order has been safely saved.",
        "product_name": product["name"],
        "amount": float(amount_dec),
        "currency": payload.currency,
        "retry_available": True,
        "recovery_token": recovery_token,
        "payment_link": recovery_link,
        "automated_message_preview": auto_msg,
    }


@router.get("/recover/{token}")
def get_recovery_session(token: str, db: Session = Depends(get_db)):
    """
    Landing page data when customer clicks the payment link from their recovery message.
    Sanitized customer response: ONLY shows Order, Product, Amount, and status.
    NEVER exposes risk scores, seller analytics, or AI internal diagnoses.
    """
    tx = (
        db.query(Transaction)
        .filter(
            (Transaction.customer_response == token)
            | (Transaction.transaction_id == token)
            | (Transaction.order_id == token)
        )
        .first()
    )

    if not tx:
        raise HTTPException(status_code=404, detail="Payment link is invalid or expired.")

    # Match product
    matching_prod = next(
        (p for p in ELECTRICAL_PRODUCTS if abs(float(p["price"]) - float(tx.amount)) < 5.0),
        ELECTRICAL_PRODUCTS[0],
    )

    return {
        "order_id": tx.order_id,
        "transaction_id": tx.transaction_id,
        "token": token,
        "status": tx.status.value,
        "amount": float(tx.amount),
        "currency": tx.currency,
        "payment_method": tx.payment_method,
        "product": {
            "name": matching_prod["name"],
            "image_url": matching_prod["image_url"],
            "category": matching_prod["category"],
            "description": matching_prod["description"],
        },
        "customer_name": tx.customer.name if tx.customer else "Valued Customer",
        "retry_allowed": tx.retry_count < 1 and tx.status != PaymentStatus.SUCCESS,
        "already_paid": tx.status == PaymentStatus.SUCCESS,
        "escalated_to_support": tx.escalation_status in {EscalationStatus.OPEN, EscalationStatus.IN_REVIEW} or tx.retry_count >= 1,
    }


@router.post("/retry-payment")
def retry_checkout_payment(payload: RetryPaymentRequest, db: Session = Depends(get_db)):
    """
    Handles Customer Retry directly from the secure payment recovery page.
    Enforces the single-retry safety policy.
    - If Attempt 2 succeeds -> PAYMENT SUCCESS, Order confirmed, Revenue Recovered. Stops recovery.
    - If Attempt 2 fails AGAIN -> Stops automated recovery, forwards order to HUMAN ASSOCIATE AGENT queue!
    """
    tx = (
        db.query(Transaction)
        .filter(
            (Transaction.transaction_id == payload.transaction_id)
            | (Transaction.order_id == payload.order_id)
            | (Transaction.customer_response == payload.token)
        )
        .first()
    )

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found for retry")

    recovery_case = (
        db.query(RecoveryCase)
        .filter(RecoveryCase.transaction_id == tx.id)
        .order_by(RecoveryCase.created_at.desc())
        .first()
    )

    # 1. Log CUSTOMER_RETRY audit event
    record_audit_event(
        db,
        event_type="CUSTOMER_RETRY",
        event_message=f"Customer clicked Retry Payment via Recovery Link for Order {tx.order_id}",
        actor="customer",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "transaction_id": tx.transaction_id,
            "order_id": tx.order_id,
            "attempt_number": tx.retry_count + 1,
            "retry_outcome": payload.retry_outcome,
        },
    )

    # 2. Check if already succeeded
    if tx.status == PaymentStatus.SUCCESS:
        return {
            "success": True,
            "status": "SUCCESS",
            "order_id": tx.order_id,
            "transaction_id": tx.transaction_id,
            "order_status": "CONFIRMED",
            "message": "Payment has already been completed successfully.",
        }

    # 3. Policy Guardrail Check: If already attempted once and failed again -> FORWARD TO HUMAN ASSOCIATE
    retry_outcome = (payload.retry_outcome or "SUCCESS").upper()

    if tx.retry_count >= 1 or retry_outcome == "FAILED":
        # ATTEMPT 2 FAILED -> AUTOMATIC RECOVERY LIMIT REACHED -> FORWARD TO HUMAN ASSOCIATE
        tx.status = PaymentStatus.FAILED
        tx.retry_count += 1
        tx.recovery_status = RecoveryStatus.ESCALATED
        tx.escalation_status = EscalationStatus.OPEN
        tx.gateway_response = "Payment retry failed on second attempt (Sandbox). Auto-recovery limit reached."

        if recovery_case:
            recovery_case.recovery_status = RecoveryStatus.ESCALATED
            recovery_case.action_status = ActionStatus.POLICY_BLOCKED

        # Add payment attempt #2 failed
        db.add(
            PaymentAttempt(
                transaction_id=tx.id,
                attempt_number=tx.retry_count + 1,
                status=PaymentStatus.FAILED,
                gateway_response="Second payment attempt failed (Sandbox)",
            )
        )

        # Create or update EscalationCase for Human Associate Workspace
        esc = (
            db.query(EscalationCase)
            .filter(EscalationCase.transaction_id == tx.id)
            .first()
        )
        if not esc:
            priority = "CRITICAL" if float(tx.amount) >= 50000 else ("HIGH" if float(tx.amount) >= 10000 else "MEDIUM")
            esc = EscalationCase(
                transaction_id=tx.id,
                recovery_case_id=recovery_case.id if recovery_case else None,
                reason="Customer payment failed twice. Automatic recovery limit reached.",
                priority=priority,
                status=EscalationStatus.OPEN,
                ai_recommendation="Contact customer directly, verify issuer switch or offer assisted payment link.",
                action_history=[
                    {
                        "action": "ESCALATED_FROM_RETRY_FAILURE",
                        "notes": "Automatic retry failed on Attempt 2. Forwarded to Human Associate.",
                        "timestamp": datetime.datetime.utcnow().isoformat(),
                    }
                ],
            )
            db.add(esc)

        record_audit_event(
            db,
            event_type="POLICY_BLOCKED",
            event_message="Automatic recovery limit reached (1/1 retries). Halting autonomous actions.",
            actor="reviveai-safety-engine",
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={"max_retries": 1, "retry_count": tx.retry_count},
        )

        record_audit_event(
            db,
            event_type="HUMAN_ESCALATION",
            event_message=f"Order {tx.order_id} forwarded to Human Associate Agent workspace",
            actor="reviveai-agent",
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={"priority": esc.priority, "reason": "Second payment retry failure"},
        )

        record_audit_event(
            db,
            event_type="RECOVERY_STOPPED",
            event_message="Automated recovery stopped and assigned to Human Support",
            actor="reviveai-agent",
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={"stop_reason": "MAX_RETRIES_EXCEEDED", "escalated_to": "HUMAN_ASSOCIATE"},
        )

        db.commit()

        return {
            "success": False,
            "status": "ESCALATED",
            "order_id": tx.order_id,
            "transaction_id": tx.transaction_id,
            "order_status": "ESCALATED_TO_SUPPORT",
            "message": "Payment retry could not be completed. Your order is safely on hold and our Human Associate specialist has been notified.",
            "escalated_to_human": True,
            "retry_available": False,
        }

    # 4. PRIMARY DEMO SCENARIO: Customer Retry Succeeds!
    tx.retry_count += 1
    tx.status = PaymentStatus.SUCCESS
    tx.recovery_status = RecoveryStatus.RECOVERED
    tx.recovered_amount = tx.amount
    tx.failure_reason = None
    tx.gateway_response = "Payment captured successfully on customer retry (Sandbox)"

    if recovery_case:
        recovery_case.recovery_status = RecoveryStatus.RECOVERED
        recovery_case.recovered_amount = tx.amount
        recovery_case.action_status = ActionStatus.EXECUTED
        recovery_case.success_timestamp = datetime.datetime.utcnow()

    db.add(
        PaymentAttempt(
            transaction_id=tx.id,
            attempt_number=tx.retry_count + 1,
            status=PaymentStatus.SUCCESS,
            gateway_response="Customer retry payment captured (Sandbox)",
        )
    )

    # Log Success & Revenue Recovered Lifecycle Events
    record_audit_event(
        db,
        event_type="PAYMENT_SUCCESS",
        event_message=f"Payment captured successfully on retry for Order {tx.order_id}",
        actor="payment-gateway",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "order_id": tx.order_id,
            "transaction_id": tx.transaction_id,
            "amount": float(tx.amount),
            "attempt_number": tx.retry_count,
        },
    )

    record_audit_event(
        db,
        event_type="REVENUE_RECOVERED",
        event_message=f"Revenue recovered autonomously by AI: {tx.currency} {float(tx.amount):,.2f}",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "recovered_amount": float(tx.amount),
            "currency": tx.currency,
            "transaction_id": tx.transaction_id,
            "recovery_channel": "AI_AUTONOMOUS",
        },
    )

    record_audit_event(
        db,
        event_type="RECOVERY_STOPPED",
        event_message="Recovery workflow completed successfully. No further action needed.",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={"stop_reason": "PAYMENT_SUCCESS", "recovery_status": "RECOVERED"},
    )

    db.commit()

    return {
        "success": True,
        "status": "SUCCESS",
        "order_id": tx.order_id,
        "transaction_id": tx.transaction_id,
        "order_status": "CONFIRMED",
        "recovered_amount": float(tx.amount),
        "currency": tx.currency,
        "message": "Payment successful! Your electrical order has been confirmed.",
    }
