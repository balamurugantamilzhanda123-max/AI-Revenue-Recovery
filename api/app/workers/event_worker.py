from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.schemas.revive import TransactionCreate
from app.services.recovery_service import start_recovery_workflow
from app.services.transaction_service import create_transaction


def process_payment_event(
    db: Session,
    payload: TransactionCreate,
    current_user: CurrentUser,
) -> dict:
    transaction = create_transaction(db, payload)
    if transaction["status"] in {"FAILED", "ABANDONED", "UNRESOLVED"}:
        recovery = start_recovery_workflow(
            db,
            transaction_ref=transaction["transaction_id"],
            current_user=current_user,
            idempotency_key=f"event:{transaction['transaction_id']}",
        )
        return {"transaction": transaction, "recovery": recovery}
    return {"transaction": transaction, "recovery": None}
