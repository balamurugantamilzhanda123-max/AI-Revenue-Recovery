from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import CurrentUser, require_recovery_operator
from app.database import get_db
from app.schemas.revive import RecoveryStartRequest
from app.services.recovery_service import recovery_result, start_recovery_workflow


router = APIRouter(tags=["Recovery"])


@router.post("/recovery/start/{transaction_id}")
def start_recovery_endpoint(
    transaction_id: str,
    payload: RecoveryStartRequest | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_recovery_operator),
) -> dict:
    request = payload or RecoveryStartRequest()
    return start_recovery_workflow(
        db,
        transaction_ref=transaction_id,
        current_user=current_user,
        idempotency_key=request.idempotency_key,
        force_payment_result=request.force_payment_result,
    )


@router.get("/recovery/{transaction_id}")
def get_recovery_result_endpoint(
    transaction_id: str,
    db: Session = Depends(get_db),
    _current_user=Depends(require_recovery_operator),
) -> dict:
    return recovery_result(db, transaction_id)
