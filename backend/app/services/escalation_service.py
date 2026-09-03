from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import EscalationCase, EscalationStatus, RecoveryCase, RecoveryStatus, Transaction
from app.services.audit_service import record_audit_event
from app.services.serializers import escalation_dict


def create_escalation(
    db: Session,
    *,
    transaction: Transaction,
    recovery_case: RecoveryCase | None,
    reason: str,
    priority: str = "HIGH",
    ai_recommendation: str | None = None,
) -> EscalationCase:
    existing = db.scalars(
        select(EscalationCase)
        .where(EscalationCase.transaction_id == transaction.id)
        .where(EscalationCase.status.in_([EscalationStatus.OPEN, EscalationStatus.IN_REVIEW]))
        .order_by(EscalationCase.created_at.desc())
    ).first()
    if existing:
        return existing

    escalation = EscalationCase(
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        reason=reason,
        priority=priority,
        status=EscalationStatus.OPEN,
        ai_recommendation=ai_recommendation,
        action_history=[],
    )
    db.add(escalation)

    transaction.escalation_status = EscalationStatus.OPEN
    if recovery_case:
        recovery_case.recovery_status = RecoveryStatus.ESCALATED

    db.flush()
    record_audit_event(
        db,
        event_type="HUMAN_ESCALATION_CREATED",
        event_message=f"Human escalation created for {transaction.transaction_id}",
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "reason": reason,
            "priority": priority,
            "ai_recommendation": ai_recommendation,
        },
    )
    return escalation


def list_escalations(db: Session) -> list[dict]:
    cases = db.scalars(
        select(EscalationCase)
        .options(joinedload(EscalationCase.transaction))
        .order_by(EscalationCase.created_at.desc())
    ).all()
    return [escalation_dict(case) for case in cases]


def resolve_escalation(db: Session, escalation_id: str, resolution: str) -> dict:
    escalation = db.get(EscalationCase, escalation_id)
    if escalation is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Escalation case not found")

    escalation.status = EscalationStatus.RESOLVED
    escalation.resolved_at = datetime.utcnow()
    escalation.action_history = [
        *(escalation.action_history or []),
        {"event": "resolved", "resolution": resolution, "at": datetime.utcnow().isoformat()},
    ]
    transaction = escalation.transaction
    if transaction:
        transaction.escalation_status = EscalationStatus.RESOLVED

    record_audit_event(
        db,
        event_type="HUMAN_ESCALATION_RESOLVED",
        event_message="Human escalation resolved",
        transaction_id=escalation.transaction_id,
        recovery_case_id=escalation.recovery_case_id,
        metadata={"resolution": resolution},
    )
    db.commit()
    return escalation_dict(escalation)
