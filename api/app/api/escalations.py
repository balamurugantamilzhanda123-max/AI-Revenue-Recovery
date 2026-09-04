from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import require_recovery_operator
from app.database import get_db
from app.services.escalation_service import list_escalations, resolve_escalation


class EscalationResolveRequest(BaseModel):
    resolution: str = Field(min_length=2, max_length=500)


router = APIRouter(tags=["Escalations"])


@router.get("/escalations")
def list_escalations_endpoint(
    db: Session = Depends(get_db),
    _current_user=Depends(require_recovery_operator),
) -> list[dict]:
    return list_escalations(db)


@router.patch("/escalations/{escalation_id}/resolve")
def resolve_escalation_endpoint(
    escalation_id: str,
    payload: EscalationResolveRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_recovery_operator),
) -> dict:
    return resolve_escalation(db, escalation_id, payload.resolution)
