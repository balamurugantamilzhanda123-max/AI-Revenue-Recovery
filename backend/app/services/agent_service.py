from decimal import Decimal

from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    ActionStatus,
    PaymentStatus,
    RecommendedAction,
    RecoveryStatus,
    RootCause,
)
from app.schemas.revive import DecisionResult, DiagnosisResult
from app.services.audit_service import record_audit_event
from app.services.risk_service import current_revenue_at_risk, ensure_recovery_case
from app.services.serializers import recovery_case_dict
from app.services.transaction_service import get_transaction_or_404


def _evidence(*items: str | None) -> list[str]:
    return [item for item in items if item][:5] or ["Insufficient gateway evidence available"]


def _rule_based_diagnosis(transaction) -> DiagnosisResult:
    status = transaction.status
    failure_text = " ".join(
        [
            transaction.failure_reason or "",
            transaction.gateway_response or "",
            transaction.payment_method or "",
        ]
    ).lower()

    if status == PaymentStatus.SUCCESS:
        return DiagnosisResult(
            transaction_id=transaction.transaction_id,
            revenue_at_risk=Decimal("0.00"),
            root_cause=RootCause.UNKNOWN,
            confidence=0.99,
            evidence=["Payment status is SUCCESS"],
            reason="Payment is already successful, so recovery must stop.",
            requires_human_review=False,
        )

    if transaction.retry_count >= settings.max_automatic_retries and transaction.retry_count > 0:
        root_cause = RootCause.REPEATED_PAYMENT_FAILURE
        confidence = 0.88
        reason = "Retry count reached the automatic retry threshold."
    elif status == PaymentStatus.ABANDONED or "abandon" in failure_text:
        root_cause = RootCause.CUSTOMER_ABANDONMENT
        confidence = 0.84
        reason = "Checkout was abandoned before payment completion."
    elif "timeout" in failure_text or "timed out" in failure_text:
        root_cause = RootCause.PAYMENT_TIMEOUT
        confidence = 0.91
        reason = "Gateway evidence indicates a temporary timeout."
    elif "auth" in failure_text or "otp" in failure_text or "3ds" in failure_text:
        root_cause = RootCause.AUTHENTICATION_FAILURE
        confidence = 0.86
        reason = "Gateway evidence indicates authentication did not complete."
    elif "insufficient" in failure_text or "fund" in failure_text:
        root_cause = RootCause.INSUFFICIENT_FUNDS
        confidence = 0.89
        reason = "Gateway evidence indicates insufficient funds."
    elif "decline" in failure_text or "bank" in failure_text:
        root_cause = RootCause.BANK_DECLINE
        confidence = 0.81
        reason = "Gateway evidence indicates the bank declined the transaction."
    elif "method" in failure_text or "expired" in failure_text or "invalid card" in failure_text:
        root_cause = RootCause.PAYMENT_METHOD_ISSUE
        confidence = 0.79
        reason = "Payment method evidence suggests the instrument needs correction."
    elif "gateway" in failure_text or "technical" in failure_text or "server" in failure_text:
        root_cause = RootCause.TECHNICAL_FAILURE
        confidence = 0.78
        reason = "Gateway evidence indicates a temporary technical failure."
    else:
        root_cause = RootCause.UNKNOWN
        confidence = 0.35
        reason = "The available evidence is insufficient for a reliable diagnosis."

    return DiagnosisResult(
        transaction_id=transaction.transaction_id,
        revenue_at_risk=current_revenue_at_risk(transaction),
        root_cause=root_cause,
        confidence=confidence,
        evidence=_evidence(
            f"Payment method: {transaction.payment_method}",
            f"Payment status: {transaction.status.value}",
            f"Failure reason: {transaction.failure_reason}" if transaction.failure_reason else None,
            f"Gateway response: {transaction.gateway_response}" if transaction.gateway_response else None,
            f"Previous retry count: {transaction.retry_count}",
        ),
        reason=reason,
        requires_human_review=confidence < settings.min_ai_confidence_for_automation,
    )


def diagnose_transaction(db: Session, transaction_ref: str, *, commit: bool = True) -> dict:
    transaction = get_transaction_or_404(db, transaction_ref)
    diagnosis = _rule_based_diagnosis(transaction)
    recovery_case = ensure_recovery_case(db, transaction)

    if recovery_case is not None:
        recovery_case.root_cause = diagnosis.root_cause.value
        recovery_case.confidence = diagnosis.confidence
        recovery_case.evidence = diagnosis.evidence
        recovery_case.recovery_status = RecoveryStatus.DIAGNOSED

    record_audit_event(
        db,
        event_type="AI_DIAGNOSIS_COMPLETED",
        event_message=f"Root cause identified: {diagnosis.root_cause.value.replace('_', ' ')}",
        actor="AI_AGENT",
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "root_cause": diagnosis.root_cause.value,
            "confidence": float(diagnosis.confidence),
            "evidence": diagnosis.evidence,
            "revenue_at_risk": float(diagnosis.revenue_at_risk),
            "requires_human_review": diagnosis.requires_human_review,
        },
    )

    if commit:
        db.commit()

    return {
        "diagnosis": diagnosis.model_dump(mode="json"),
        "recovery_case": recovery_case_dict(recovery_case) if recovery_case else None,
    }


def _action_for_root_cause(root_cause: RootCause, transaction) -> tuple[RecommendedAction, str]:
    if transaction.status == PaymentStatus.SUCCESS:
        return RecommendedAction.STOP_RECOVERY, "Payment is already successful."
    if root_cause in {RootCause.PAYMENT_TIMEOUT, RootCause.TECHNICAL_FAILURE}:
        return RecommendedAction.CONTROLLED_RETRY, "Temporary failure can be tested with one controlled retry."
    if root_cause == RootCause.AUTHENTICATION_FAILURE:
        return RecommendedAction.RETRY_AUTHENTICATION, "Customer should retry authentication before another payment attempt."
    if root_cause == RootCause.CUSTOMER_ABANDONMENT:
        return RecommendedAction.RECOVERY_REMINDER, "Customer abandoned checkout and can be reminded to continue payment."
    if root_cause == RootCause.PAYMENT_METHOD_ISSUE:
        return RecommendedAction.RECOVERY_REMINDER, "Customer should update or change the payment method."
    if root_cause in {RootCause.REPEATED_PAYMENT_FAILURE, RootCause.UNKNOWN, RootCause.BANK_DECLINE}:
        return RecommendedAction.ESCALATE_HUMAN, "Automated recovery is unsafe without human review."
    if root_cause == RootCause.INSUFFICIENT_FUNDS:
        return RecommendedAction.RECOVERY_REMINDER, "A communication-only recovery is safer than immediate retry."
    return RecommendedAction.ESCALATE_HUMAN, "No safe automated action is available."


def decide_recovery_action(db: Session, transaction_ref: str, *, commit: bool = True) -> dict:
    transaction = get_transaction_or_404(db, transaction_ref)
    diagnosis_payload = diagnose_transaction(db, transaction_ref, commit=False)
    diagnosis = DiagnosisResult.model_validate(diagnosis_payload["diagnosis"])
    recommended_action, reason = _action_for_root_cause(diagnosis.root_cause, transaction)

    if diagnosis.confidence < settings.min_ai_confidence_for_automation:
        recommended_action = RecommendedAction.ESCALATE_HUMAN
        reason = "AI confidence is below the automation threshold."

    decision = DecisionResult(
        transaction_id=transaction.transaction_id,
        revenue_at_risk=diagnosis.revenue_at_risk,
        root_cause=diagnosis.root_cause,
        confidence=diagnosis.confidence,
        recommended_action=recommended_action,
        reason=reason,
        evidence=diagnosis.evidence,
        requires_human_review=diagnosis.requires_human_review
        or recommended_action == RecommendedAction.ESCALATE_HUMAN,
    )

    recovery_case = ensure_recovery_case(db, transaction)
    if recovery_case is not None:
        recovery_case.root_cause = decision.root_cause.value
        recovery_case.confidence = decision.confidence
        recovery_case.evidence = decision.evidence
        recovery_case.recommended_action = decision.recommended_action.value
        recovery_case.action_status = ActionStatus.PENDING
        recovery_case.recovery_status = RecoveryStatus.DIAGNOSED

    record_audit_event(
        db,
        event_type="RECOVERY_DECISION_CREATED",
        event_message=f"Recovery strategy selected: {decision.recommended_action.value.replace('_', ' ')}",
        actor="AI_AGENT",
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "recommended_action": decision.recommended_action.value,
            "reason": decision.reason,
            "confidence": float(decision.confidence),
            "requires_human_review": decision.requires_human_review,
        },
    )

    if commit:
        db.commit()

    return {
        "decision": decision.model_dump(mode="json"),
        "recovery_case": recovery_case_dict(recovery_case) if recovery_case else None,
    }
