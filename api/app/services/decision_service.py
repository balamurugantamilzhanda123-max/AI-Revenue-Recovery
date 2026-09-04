from typing import Any


def generate_recovery_decision(
    diagnosis: dict[str, Any],
    transaction: dict[str, Any],
) -> dict[str, Any]:
    """
    Convert a validated diagnosis + transaction context
    into a proposed recovery decision.

    This function does NOT execute any payment.
    """

    root_cause = str(
        diagnosis.get("root_cause", "unknown")
    ).strip().lower()

    confidence = float(
        diagnosis.get("confidence", 0.0)
    )

    status = str(
        transaction.get("status", "")
    ).strip().lower()

    retry_count = int(
        transaction.get("retry_count", 0) or 0
    )

    customer_opted_out = bool(
        transaction.get(
            "customer_opted_out",
            False,
        )
    )

    # --------------------------------------------------
    # Highest-priority stopping rules
    # --------------------------------------------------

    if status == "success":
        return {
            "decision": "stop_recovery",
            "reason": "Payment already successful",
            "requires_human_review": False,
        }

    if customer_opted_out:
        return {
            "decision": "stop_recovery",
            "reason": "Customer opted out",
            "requires_human_review": False,
        }

    # --------------------------------------------------
    # Repeated failure
    # --------------------------------------------------

    if (
        root_cause == "repeated_payment_failure"
        or retry_count >= 1
    ):
        return {
            "decision": "escalate_to_human",
            "reason": "Repeated failure or retry limit reached",
            "requires_human_review": True,
        }

    # --------------------------------------------------
    # Low confidence
    # --------------------------------------------------

    if confidence < 0.70:
        return {
            "decision": "escalate_to_human",
            "reason": "Diagnosis confidence is below threshold",
            "requires_human_review": True,
        }

    # --------------------------------------------------
    # Root-cause → recovery action mapping
    # --------------------------------------------------

    action_map = {
        "payment_timeout": "controlled_retry",
        "temporary_payment_error": "controlled_retry",
        "checkout_abandonment": "payment_continuation",
        "authentication_failure": "customer_auth_retry",
        "insufficient_funds": "customer_payment_method_change",
        "payment_method_issue": "customer_payment_method_change",
        "bank_decline": "customer_payment_method_change",
        "technical_failure": "controlled_retry",
        "unknown": "escalate_to_human",
    }

    action = action_map.get(
        root_cause,
        "escalate_to_human",
    )

    requires_human_review = (
        action == "escalate_to_human"
    )

    return {
        "decision": action,
        "reason": (
            f"Mapped recovery action for root cause: "
            f"{root_cause}"
        ),
        "requires_human_review": requires_human_review,
    }