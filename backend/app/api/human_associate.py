from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.services.human_associate_service import (
    complete_human_payment_recovery,
    list_human_cases,
    log_human_contact,
    send_human_payment_link,
)

router = APIRouter(prefix="/human-associate", tags=["Human Associate Workspace"])


class ContactCustomerRequest(BaseModel):
    channel: str = "PHONE"  # PHONE, WHATSAPP, EMAIL
    notes: str = Field(min_length=2, max_length=1000)
    agent_name: str = "Priya Sharma (Human Associate)"


class SendHumanLinkRequest(BaseModel):
    custom_message: str | None = None
    discount_percent: float = 0.0
    agent_name: str = "Priya Sharma (Human Associate)"


class ResolveHumanCaseRequest(BaseModel):
    notes: str = "Customer completed payment successfully via Human Associate support."


@router.get("/cases")
def get_human_cases(
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Returns all cases forwarded to the Human Associate workspace."""
    return list_human_cases(db=db, status_filter=status, priority_filter=priority)


@router.post("/cases/{case_id}/contact")
def contact_customer_endpoint(
    case_id: str,
    payload: ContactCustomerRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Records human contact with customer (call, WhatsApp, email) and adds note."""
    return log_human_contact(
        db=db,
        case_id=case_id,
        channel=payload.channel,
        notes=payload.notes,
        agent_name=payload.agent_name,
    )


@router.post("/cases/{case_id}/send-link")
def send_human_link_endpoint(
    case_id: str,
    payload: SendHumanLinkRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Generates and sends an approved payment link directly from the Human Associate."""
    return send_human_payment_link(
        db=db,
        case_id=case_id,
        custom_message=payload.custom_message,
        discount_percent=payload.discount_percent,
        agent_name=payload.agent_name,
    )


@router.post("/cases/{case_id}/complete-payment")
def complete_human_payment_endpoint(
    case_id: str,
    payload: ResolveHumanCaseRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """
    Simulates customer completing payment after Human Associate intervention.
    Attributes revenue to Human Recoveries and marks case RESOLVED.
    """
    return complete_human_payment_recovery(
        db=db,
        case_id=case_id,
        notes=payload.notes,
    )
