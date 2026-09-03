from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.models import (
    AuditLog,
    Customer,
    CustomerPreference,
    EscalationCase,
    IdempotencyKey,
    PaymentAttempt,
    RecoveryAction,
    RecoveryCase,
    Transaction,
)
from app.schemas.revive import TransactionCreate
from app.services.recovery_service import start_recovery_workflow
from app.services.transaction_service import create_transaction


def _clear_demo_data(db: Session) -> None:
    for model in [
        IdempotencyKey,
        AuditLog,
        RecoveryAction,
        EscalationCase,
        RecoveryCase,
        PaymentAttempt,
        Transaction,
        CustomerPreference,
        Customer,
    ]:
        db.query(model).delete()
    db.commit()


def seed_demo_data(db: Session) -> dict:
    primary = create_transaction(
        db,
        TransactionCreate(
            transaction_id="TX-DEMO-001",
            customer_id="CUST-DEMO-001",
            customer_name="Demo Customer",
            customer_email="demo.customer@example.com",
            customer_phone="+919999999999",
            order_id="ORDER-DEMO-001",
            amount="5999.00",
            currency="INR",
            payment_method="UPI",
            status="FAILED",
            failure_reason="TIMEOUT",
            gateway_response="UPI collect request timed out at gateway",
        ),
    )
    failure = create_transaction(
        db,
        TransactionCreate(
            transaction_id="TX-DEMO-002",
            customer_id="CUST-DEMO-002",
            customer_name="Retry Failure Customer",
            customer_email="retry.failure@example.com",
            customer_phone="+918888888888",
            order_id="ORDER-DEMO-002",
            amount="3499.00",
            currency="INR",
            payment_method="CARD",
            status="FAILED",
            failure_reason="TEMPORARY_PAYMENT_ERROR",
            gateway_response="Temporary gateway error; retry allowed in sandbox",
        ),
    )
    abandoned = create_transaction(
        db,
        TransactionCreate(
            transaction_id="TX-DEMO-003",
            customer_id="CUST-DEMO-003",
            customer_name="Abandoned Checkout Customer",
            customer_email="abandoned@example.com",
            order_id="ORDER-DEMO-003",
            amount="1299.00",
            currency="INR",
            payment_method="NETBANKING",
            status="ABANDONED",
            failure_reason="CUSTOMER_ABANDONMENT",
            gateway_response="Checkout session expired before payment authorization",
        ),
    )
    success = create_transaction(
        db,
        TransactionCreate(
            transaction_id="TX-DEMO-004",
            customer_id="CUST-DEMO-004",
            customer_name="Successful Customer",
            customer_email="success@example.com",
            order_id="ORDER-DEMO-004",
            amount="899.00",
            currency="INR",
            payment_method="UPI",
            status="SUCCESS",
            gateway_response="Payment captured successfully",
        ),
    )
    return {
        "transactions": [primary, failure, abandoned, success],
        "primary_demo_transaction": "TX-DEMO-001",
        "retry_failure_transaction": "TX-DEMO-002",
    }


def reset_demo_data(db: Session) -> dict:
    _clear_demo_data(db)
    seeded = seed_demo_data(db)
    return {
        "message": "Demo data reset",
        **seeded,
    }


def run_primary_demo(db: Session, current_user: CurrentUser) -> dict:
    return start_recovery_workflow(
        db,
        transaction_ref="TX-DEMO-001",
        current_user=current_user,
        idempotency_key="demo-primary-recovery",
        force_payment_result="SUCCESS",
    )


def run_retry_failure_demo(db: Session, current_user: CurrentUser) -> dict:
    return start_recovery_workflow(
        db,
        transaction_ref="TX-DEMO-002",
        current_user=current_user,
        idempotency_key="demo-retry-failure-escalation",
        force_payment_result="FAILED",
    )
