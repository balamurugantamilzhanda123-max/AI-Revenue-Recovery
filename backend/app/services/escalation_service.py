from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    EscalationCase,
    EscalationStatus,
    PaymentStatus,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
)
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

    now_dt = datetime.utcnow()
    escalation.status = EscalationStatus.RESOLVED
    escalation.resolved_at = now_dt
    escalation.action_history = [
        *(escalation.action_history or []),
        {"event": "resolved", "resolution": resolution, "at": now_dt.isoformat()},
    ]
    transaction = escalation.transaction
    if transaction:
        transaction.escalation_status = EscalationStatus.RESOLVED
        transaction.status = PaymentStatus.SUCCESS
        transaction.recovery_status = RecoveryStatus.RECOVERED
        transaction.recovered_amount = transaction.amount
        transaction.customer_response = "RECOVERED_BY_HUMAN"
        transaction.failure_reason = None
        transaction.gateway_response = f"Recovered via Human Associate Support: {resolution}"

        recovery_case = (
            db.query(RecoveryCase)
            .filter(RecoveryCase.transaction_id == transaction.id)
            .order_by(RecoveryCase.created_at.desc())
            .first()
        )
        if recovery_case:
            recovery_case.recovery_status = RecoveryStatus.RECOVERED
            recovery_case.recovered_amount = transaction.amount
            recovery_case.success_timestamp = now_dt

        record_audit_event(
            db,
            event_type="PAYMENT_SUCCESS",
            event_message=f"Payment captured successfully via Human Support for Order {transaction.order_id}",
            actor="payment-gateway",
            transaction_id=transaction.id,
            recovery_case_id=escalation.recovery_case_id,
            metadata={"order_id": transaction.order_id, "amount": float(transaction.amount), "recovery_channel": "HUMAN_ASSOCIATE"},
        )

        record_audit_event(
            db,
            event_type="HUMAN_REVENUE_RECOVERED",
            event_message=f"Revenue recovered by Human Associate: {transaction.currency} {float(transaction.amount):,.2f}",
            actor="human-associate",
            transaction_id=transaction.id,
            recovery_case_id=escalation.recovery_case_id,
            metadata={"recovered_amount": float(transaction.amount), "currency": transaction.currency, "order_id": transaction.order_id},
        )

    record_audit_event(
        db,
        event_type="HUMAN_ESCALATION_RESOLVED",
        event_message=f"Human escalation resolved: {resolution}",
        transaction_id=escalation.transaction_id,
        recovery_case_id=escalation.recovery_case_id,
        metadata={"resolution": resolution},
    )
    db.commit()
    return escalation_dict(escalation)
