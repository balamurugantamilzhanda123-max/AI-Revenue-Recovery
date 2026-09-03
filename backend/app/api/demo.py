from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import CurrentUser, require_recovery_operator
from app.database import get_db
from app.services.demo_service import reset_demo_data, run_primary_demo, run_retry_failure_demo


router = APIRouter(prefix="/demo", tags=["Demo"])


@router.post("/reset")
def reset_demo_endpoint(
    db: Session = Depends(get_db),
    _current_user: CurrentUser = Depends(require_recovery_operator),
) -> dict:
    return reset_demo_data(db)


@router.post("/run-primary")
def run_primary_demo_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_recovery_operator),
) -> dict:
    return run_primary_demo(db, current_user)


@router.post("/run-retry-failure")
def run_retry_failure_demo_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_recovery_operator),
) -> dict:
    return run_retry_failure_demo(db, current_user)
