from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models import AuditLog, Transaction
from app.services.serializers import audit_log_dict
from app.services.transaction_service import get_transaction_or_404


router = APIRouter(tags=["Audit"])


@router.get("/audit")
def get_audit_logs(
    transaction_id: str | None = None,
    event_type: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if transaction_id:
        transaction = db.scalars(
            select(Transaction).where(
                or_(Transaction.id == transaction_id, Transaction.transaction_id == transaction_id)
            )
        ).first()
        query = query.where(AuditLog.transaction_id == (transaction.id if transaction else transaction_id))
    if event_type:
        query = query.where(AuditLog.event_type == event_type)

    paginated_query = query.offset(offset).limit(limit)
    logs = db.scalars(paginated_query).all()
    return {
        "data": [audit_log_dict(log) for log in logs],
        "pagination": {
            "limit": limit,
            "offset": offset,
            "returned": len(logs),
            "next_offset": offset + limit if len(logs) == limit else None,
        },
    }


@router.get("/audit/{transaction_id}")
def get_transaction_audit(
    transaction_id: str,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    transaction = get_transaction_or_404(db, transaction_id)
    logs = db.scalars(
        select(AuditLog)
        .where(AuditLog.transaction_id == transaction.id)
        .order_by(AuditLog.created_at.asc())
    ).all()
    events = [audit_log_dict(log) for log in logs]
    return {
        "transaction_id": transaction.transaction_id,
        "events": events,
        "count": len(events),
    }
