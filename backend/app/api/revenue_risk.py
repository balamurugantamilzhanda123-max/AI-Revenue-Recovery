from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.services.risk_service import list_revenue_risk_cases, revenue_risk_summary


router = APIRouter(tags=["Revenue Risk"])


@router.get("/revenue-risk")
def get_revenue_risk(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> list[dict]:
    return list_revenue_risk_cases(db)


@router.get("/revenue-risk/summary")
def get_revenue_risk_summary(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    return revenue_risk_summary(db)
