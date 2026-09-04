from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    ActionStatus,
    PaymentStatus,
    RecoveryAction,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
)
from app.services.audit_service import record_audit_event
from app.services.serializers import recovery_case_dict


RECOVERABLE_STATUSES = {
    PaymentStatus.FAILED,
    PaymentStatus.ABANDONED,
    PaymentStatus.UNRESOLVED,
}


def is_recoverable_transaction(transaction: Transaction) -> bool:
    return transaction.status in RECOVERABLE_STATUSES


def current_revenue_at_risk(transaction: Transaction) -> Decimal:
    if not is_recoverable_transaction(transaction):
        return Decimal("0.00")
    if transaction.recovery_status in {RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED}:
        return Decimal("0.00")
    return Decimal(transaction.amount or 0)


def ensure_recovery_case(db: Session, transaction: Transaction) -> RecoveryCase | None:
    if not is_recoverable_transaction(transaction):
        return None

    existing = db.scalars(
        select(RecoveryCase)
        .where(RecoveryCase.transaction_id == transaction.id)
        .where(RecoveryCase.recovery_status.notin_([RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED]))
        .order_by(RecoveryCase.created_at.desc())
    ).first()

    if existing:
        return existing

    if transaction.recovery_status in {RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED}:
        return None

    recovery_case = RecoveryCase(
        transaction_id=transaction.id,
        risk_amount=transaction.amount,
        action_status=ActionStatus.PENDING,
        recovery_status=RecoveryStatus.OPEN,
    )
    transaction.recovery_status = RecoveryStatus.OPEN
    db.add(recovery_case)
    db.flush()

    record_audit_event(
        db,
        event_type="REVENUE_RISK_DETECTED",
        event_message=f"Revenue at risk detected: {transaction.currency} {float(transaction.amount):,.2f}",
        actor="reviveai-agent",
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id,
        metadata={
            "transaction_id": transaction.transaction_id,
            "risk_amount": float(transaction.amount),
            "currency": transaction.currency,
            "status": transaction.status.value,
            "failure_reason": transaction.failure_reason,
            "payment_method": transaction.payment_method,
            "detection_source": "payment_failure_listener",
        },
    )
    return recovery_case


def list_revenue_risk_cases(db: Session) -> list[dict]:
    cases = db.scalars(
        select(RecoveryCase)
        .options(selectinload(RecoveryCase.recovery_actions))
        .order_by(RecoveryCase.created_at.desc())
    ).all()
    return [recovery_case_dict(case, include_actions=True) for case in cases]


def revenue_risk_summary(db: Session) -> dict:
    transactions = db.scalars(select(Transaction)).all()
    cases = db.scalars(select(RecoveryCase)).all()
    actions = db.scalars(select(RecoveryAction)).all()

    total_transactions = len(transactions)
    failed_transactions = sum(1 for tx in transactions if tx.status == PaymentStatus.FAILED)
    recoverable_transactions = [
        tx
        for tx in transactions
        if tx.status in RECOVERABLE_STATUSES
        and tx.recovery_status not in {RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED}
    ]
    revenue_at_risk = sum((Decimal(tx.amount or 0) for tx in recoverable_transactions), Decimal("0.00"))

    total_risk_detected = sum((Decimal(case.risk_amount or 0) for case in cases), Decimal("0.00"))
    revenue_recovered = sum((Decimal(case.recovered_amount or 0) for case in cases), Decimal("0.00"))
    recovery_attempts = sum(
        1
        for action in actions
        if action.action_type in {"controlled_retry", "recovery_reminder", "retry_authentication"}
    )
    successful_recoveries = sum(1 for case in cases if case.recovery_status == RecoveryStatus.RECOVERED)
    unresolved_cases = sum(1 for case in cases if case.recovery_status in {RecoveryStatus.OPEN, RecoveryStatus.UNRESOLVED, RecoveryStatus.FAILED})
    escalated_cases = sum(1 for case in cases if case.recovery_status == RecoveryStatus.ESCALATED)

    recovery_rate = (successful_recoveries / recovery_attempts * 100) if recovery_attempts else 0.0
    failure_rate = (failed_transactions / total_transactions * 100) if total_transactions else 0.0
    revenue_recovery_rate = (float(revenue_recovered) / float(total_risk_detected) * 100) if total_risk_detected else 0.0

    latencies: list[float] = []
    for case in cases:
        if case.success_timestamp and case.detection_timestamp:
            latencies.append((case.success_timestamp - case.detection_timestamp).total_seconds())
    average_recovery_latency_seconds = sum(latencies) / len(latencies) if latencies else None

    return {
        "total_transactions": total_transactions,
        "failed_transactions": failed_transactions,
        "revenue_at_risk": float(revenue_at_risk),
        "total_risk_detected": float(total_risk_detected),
        "recovery_attempts": recovery_attempts,
        "successful_recoveries": successful_recoveries,
        "revenue_recovered": float(revenue_recovered),
        "recovery_rate": round(recovery_rate, 2),
        "unresolved_cases": unresolved_cases,
        "escalated_cases": escalated_cases,
        "failure_rate": round(failure_rate, 2),
        "revenue_recovery_rate": round(revenue_recovery_rate, 2),
        "average_recovery_latency_seconds": average_recovery_latency_seconds,
        "generated_at": datetime.utcnow().isoformat(),
    }


def recovery_metrics(db: Session) -> dict:
    summary = revenue_risk_summary(db)
    status_counts = dict(
        db.execute(
            select(RecoveryCase.recovery_status, func.count(RecoveryCase.id))
            .group_by(RecoveryCase.recovery_status)
        ).all()
    )
    return {
        "summary": summary,
        "case_status_counts": {
            key.value if hasattr(key, "value") else str(key): count
            for key, count in status_counts.items()
        },
    }
