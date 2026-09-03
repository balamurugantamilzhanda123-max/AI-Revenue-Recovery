from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.services.risk_service import recovery_metrics, revenue_risk_summary


router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    return revenue_risk_summary(db)


@router.get("/dashboard/recovery-metrics")
def dashboard_recovery_metrics(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    return recovery_metrics(db)
