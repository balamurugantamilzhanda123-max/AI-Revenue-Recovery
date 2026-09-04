from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.services.seller_service import get_seller_dashboard_summary, list_seller_cases

router = APIRouter(prefix="/seller", tags=["Seller Dashboard & Analytics"])


@router.get("/dashboard")
def get_seller_dashboard(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """
    Returns dynamically calculated seller metrics:
    Total Orders, Successful, Failed, Pending, Abandonments, Network Errors,
    Revenue at Risk (with breakdown), AI Recoveries, Human Recoveries,
    Product-level Revenue Leakage, and Recovery Funnel.
    """
    return get_seller_dashboard_summary(db)


@router.get("/cases")
def get_seller_cases(
    filter: str | None = Query(default=None),
    product_id: str | None = Query(default=None),
    risk: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> list[dict[str, Any]]:
    """
    Returns filterable seller order recovery cases.
    Filters: All, Payment Failed, Network Error, Checkout Abandoned, AI Recovery,
    Human Review, Recovered, Unresolved, High Risk, Medium Risk, Low Risk, Product, Search.
    """
    return list_seller_cases(
        db=db,
        filter_type=filter,
        product_id=product_id,
        risk_filter=risk,
        status_filter=status,
        search=search,
    )
