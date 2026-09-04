from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user, require_admin
from app.database import get_db
from app.services.reset_service import reset_operational_data

router = APIRouter(prefix="/admin", tags=["Admin & System Control"])


@router.post("/reset-dashboard")
def reset_dashboard(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> dict[str, Any]:
    """
    Destructive endpoint: Atomically purges all transactions, orders, recovery cases,
    and escalations while preserving customers, accounts, catalog, and system settings.
    Logs an immutable DASHBOARD_RESET audit log.
    """
    try:
        actor_name = current_user.email or current_user.id or "ADMIN"
        result = reset_operational_data(db, actor=actor_name)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Reset failed. No data was intentionally left in a partially reset state.",
        ) from e
