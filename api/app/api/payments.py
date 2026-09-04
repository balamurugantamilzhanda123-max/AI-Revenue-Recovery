from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import CurrentUser, require_recovery_operator
from app.database import get_db
from app.schemas.revive import PaymentRetryRequest
from app.services.recovery_service import payment_retry


router = APIRouter(tags=["Payment Retry"])


@router.post("/payments/retry/{transaction_id}")
def retry_payment_endpoint(
    transaction_id: str,
    payload: PaymentRetryRequest | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_recovery_operator),
) -> dict:
    request = payload or PaymentRetryRequest()
    return payment_retry(
        db,
        transaction_ref=transaction_id,
        current_user=current_user,
        idempotency_key=request.idempotency_key,
        force_result=request.force_result,
    )
