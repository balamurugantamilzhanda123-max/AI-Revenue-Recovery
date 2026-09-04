import datetime
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.schemas.revive import TransactionCreate, TransactionUpdate
from app.services.report_service import generate_transaction_pdf
from app.services.serializers import transaction_dict
from app.services.transaction_service import (
    create_transaction,
    get_transaction_or_404,
    list_transactions,
    update_transaction,
)


router = APIRouter(tags=["Transactions"])


@router.post("/transactions")
def create_transaction_endpoint(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    return create_transaction(db, payload)


@router.get("/transactions")
def list_transactions_endpoint(
    status: str | None = None,
    customer_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    return list_transactions(
        db,
        status=status,
        customer_id=customer_id,
        limit=limit,
        offset=offset,
    )


@router.get("/transactions/{transaction_id}")
def get_transaction_endpoint(
    transaction_id: str,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    transaction = get_transaction_or_404(db, transaction_id)
    return transaction_dict(transaction, include_detail=True)


@router.get("/transactions/{transaction_id}/pdf")
def download_transaction_pdf_endpoint(
    transaction_id: str,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    """
    Generates an individualized audit PDF certificate for a single transaction.
    """
    transaction = get_transaction_or_404(db, transaction_id)
    tx_data = transaction_dict(transaction, include_detail=True)
    pdf_bytes = generate_transaction_pdf(tx_data)
    filename = f"ReviveAI_Transaction_{transaction_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.patch("/transactions/{transaction_id}")
def update_transaction_endpoint(
    transaction_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    return update_transaction(db, transaction_id, payload)
