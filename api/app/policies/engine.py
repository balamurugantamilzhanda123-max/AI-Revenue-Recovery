from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    CustomerPreference,
    CustomerStatus,
    PaymentStatus,
    PolicyResult,
    RecommendedAction,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
)
from app.schemas.revive import DecisionResult


SUPPORTED_ACTIONS = {
    RecommendedAction.CONTROLLED_RETRY,
    RecommendedAction.RECOVERY_REMINDER,
    RecommendedAction.RETRY_AUTHENTICATION,
    RecommendedAction.ESCALATE_HUMAN,
    RecommendedAction.STOP_RECOVERY,
    RecommendedAction.NO_ACTION,
}


def get_customer_preference(db: Session, transaction: Transaction) -> CustomerPreference | None:
    if transaction.customer and transaction.customer.preferences:
        return transaction.customer.preferences
    return db.query(CustomerPreference).filter(CustomerPreference.customer_id == transaction.customer_id).first()


def validate_recovery_policy(
    db: Session,
    *,
    transaction: Transaction,
    recovery_case: RecoveryCase | None,
    decision: DecisionResult,
    actor_role: str,
) -> dict:
    reasons: list[str] = []
    preference = get_customer_preference(db, transaction)
    message_count = preference.recovery_message_count if preference else 0

    if actor_role not in {"ADMIN", "ANALYST"}:
        reasons.append("User is not authorized to execute recovery actions.")

    if transaction.status == PaymentStatus.SUCCESS:
        reasons.append("Payment already succeeded; all recovery actions must stop.")

    if transaction.recovered_amount and transaction.recovered_amount > 0:
        reasons.append("Revenue already recovered for this transaction.")

    if transaction.customer and transaction.customer.status == CustomerStatus.OPTED_OUT:
        reasons.append("Customer has opted out of recovery communication.")

    if preference and preference.opted_out:
        reasons.append("Customer preference blocks recovery communication.")

    action = decision.recommended_action
    if action not in SUPPORTED_ACTIONS:
        reasons.append("Unsupported recovery action.")

    if decision.confidence < settings.min_ai_confidence_for_automation:
        reasons.append("AI confidence is below the automation threshold.")

    if action == RecommendedAction.CONTROLLED_RETRY and transaction.retry_count >= settings.max_automatic_retries:
        reasons.append("Maximum automatic retry limit reached.")

    if action in {RecommendedAction.RECOVERY_REMINDER, RecommendedAction.RETRY_AUTHENTICATION}:
        if message_count >= settings.max_recovery_messages:
            reasons.append("Maximum automated recovery communication limit reached.")

    if recovery_case and recovery_case.recovery_status in {RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED}:
        reasons.append("Recovery case is already closed.")

    if action == RecommendedAction.ESCALATE_HUMAN or decision.requires_human_review:
        return {
            "result": PolicyResult.ESCALATE.value,
            "allowed": False,
            "reasons": reasons or ["Human review required by AI decision."],
            "max_automatic_retries": settings.max_automatic_retries,
            "max_recovery_messages": settings.max_recovery_messages,
            "current_retry_count": transaction.retry_count,
            "current_message_count": message_count,
        }

    if action in {RecommendedAction.STOP_RECOVERY, RecommendedAction.NO_ACTION}:
        return {
            "result": PolicyResult.BLOCKED.value,
            "allowed": False,
            "reasons": reasons or ["No executable recovery action is required."],
            "max_automatic_retries": settings.max_automatic_retries,
            "max_recovery_messages": settings.max_recovery_messages,
            "current_retry_count": transaction.retry_count,
            "current_message_count": message_count,
        }

    if reasons:
        must_escalate = any(
            "confidence" in reason.lower()
            or "retry limit" in reason.lower()
            or "authorized" in reason.lower()
            for reason in reasons
        )
        return {
            "result": PolicyResult.ESCALATE.value if must_escalate else PolicyResult.BLOCKED.value,
            "allowed": False,
            "reasons": reasons,
            "max_automatic_retries": settings.max_automatic_retries,
            "max_recovery_messages": settings.max_recovery_messages,
            "current_retry_count": transaction.retry_count,
            "current_message_count": message_count,
        }

    return {
        "result": PolicyResult.APPROVED.value,
        "allowed": True,
        "reasons": ["Recovery action is within policy limits."],
        "max_automatic_retries": settings.max_automatic_retries,
        "max_recovery_messages": settings.max_recovery_messages,
        "current_retry_count": transaction.retry_count,
        "current_message_count": message_count,
    }
