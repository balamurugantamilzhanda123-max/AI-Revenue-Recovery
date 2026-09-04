import datetime
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    EscalationCase,
    IdempotencyKey,
    Invoice,
    NotificationRecord,
    Order,
    PaymentAttempt,
    PaymentRetryToken,
    RecoveryAction,
    RecoveryCase,
    Transaction,
    WebhookEvent,
)


def reset_operational_data(db: Session, actor: str = "ADMIN") -> dict[str, Any]:
    """
    Atomically clears all operational transaction, order, and revenue recovery records,
    while strictly preserving customers, customer accounts, addresses, preferences,
    product catalog, and system settings.
    
    Logs an immutable DASHBOARD_RESET audit log containing the deletion metadata.
    """
    try:
        # 1. Capture counts prior to deletion
        tx_count = db.scalar(select(func.count(Transaction.id))) or 0
        recovery_count = db.scalar(select(func.count(RecoveryCase.id))) or 0
        escalation_count = db.scalar(select(func.count(EscalationCase.id))) or 0
        order_count = db.scalar(select(func.count(Order.id))) or 0
        invoice_count = db.scalar(select(func.count(Invoice.id))) or 0
        action_count = db.scalar(select(func.count(RecoveryAction.id))) or 0

        # 2. Atomic deletion of dependent and operational records
        db.query(PaymentRetryToken).delete(synchronize_session=False)
        db.query(RecoveryAction).delete(synchronize_session=False)
        db.query(EscalationCase).delete(synchronize_session=False)
        db.query(RecoveryCase).delete(synchronize_session=False)
        db.query(PaymentAttempt).delete(synchronize_session=False)
        db.query(Order).delete(synchronize_session=False)
        db.query(Invoice).delete(synchronize_session=False)
        db.query(NotificationRecord).delete(synchronize_session=False)
        db.query(IdempotencyKey).delete(synchronize_session=False)
        db.query(WebhookEvent).delete(synchronize_session=False)
        db.query(Transaction).delete(synchronize_session=False)

        # Clear historical audit trail
        db.query(AuditLog).delete(synchronize_session=False)

        # 3. Create the permanent DASHBOARD_RESET audit entry
        reset_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
        metadata = {
            "transactions_deleted": int(tx_count),
            "recovery_cases_deleted": int(recovery_count),
            "escalation_cases_deleted": int(escalation_count),
            "orders_deleted": int(order_count),
            "invoices_deleted": int(invoice_count),
            "recovery_actions_deleted": int(action_count),
            "reset_timestamp": reset_time,
            "status": "COMPLETED",
        }

        reset_audit = AuditLog(
            event_type="DASHBOARD_RESET",
            event_message="All operational transaction and revenue recovery data reset.",
            actor=actor,
            metadata_json=metadata,
        )
        db.add(reset_audit)

        db.commit()

        return {
            "success": True,
            "message": "Dashboard reset successfully. All transaction and recovery data has been cleared.",
            "metadata": metadata,
            "timestamp": reset_time,
        }
    except Exception as e:
        db.rollback()
        raise RuntimeError(f"Reset operation failed: {str(e)}") from e
