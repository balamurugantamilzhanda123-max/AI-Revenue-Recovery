from typing import Any


ALLOWED_ACTIONS = {
    "controlled_retry",
    "payment_continuation",
    "customer_auth_retry",
    "customer_payment_method_change",
    "stop_recovery",
    "escalate_to_human",
}

MAX_AUTOMATIC_RETRIES = 1
LOW_CONFIDENCE_THRESHOLD = 0.70


def validate_recovery_policy(
    decision: dict[str, Any],
    transaction: dict[str, Any],
) -> dict[str, Any]:
    """
    Deterministic policy validation.

    The AI may propose an action, but this function decides
    whether that action is allowed.

    This function never executes a payment.
    """

    action = str(
        decision.get("decision", "")
    ).strip().lower()

    confidence = float(
        decision.get("confidence", 0.0)
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
    # Rule 1: Action must be recognized
    # --------------------------------------------------

    if action not in ALLOWED_ACTIONS:
        return {
            "allowed": False,
            "policy": "REJECT",
            "reason": "Unknown or unsupported recovery action",
            "action": action,
        }

    # --------------------------------------------------
    # Rule 2: Successful payment stops recovery
    # --------------------------------------------------

    if status == "success":
        return {
            "allowed": False,
            "policy": "STOP",
            "reason": "Payment already successful",
            "action": "stop_recovery",
        }

    # --------------------------------------------------
    # Rule 3: Customer opt-out stops recovery
    # --------------------------------------------------

    if customer_opted_out:
        return {
            "allowed": False,
            "policy": "STOP",
            "reason": "Customer opted out",
            "action": "stop_recovery",
        }

    # --------------------------------------------------
    # Rule 4: Low-confidence case escalates
    # --------------------------------------------------

    if confidence < LOW_CONFIDENCE_THRESHOLD:
        return {
            "allowed": False,
            "policy": "ESCALATE",
            "reason": "Confidence below policy threshold",
            "action": "escalate_to_human",
        }

    # --------------------------------------------------
    # Rule 5: Retry limit
    # --------------------------------------------------

    if action == "controlled_retry":
        if retry_count >= MAX_AUTOMATIC_RETRIES:
            return {
                "allowed": False,
                "policy": "ESCALATE",
                "reason": "Automatic retry limit reached",
                "action": "escalate_to_human",
            }

        return {
            "allowed": True,
            "policy": "APPROVED",
            "reason": "Controlled retry is within retry limit",
            "action": "controlled_retry",
        }

    # --------------------------------------------------
    # Rule 6: Explicit human escalation
    # --------------------------------------------------

    if action == "escalate_to_human":
        return {
            "allowed": True,
            "policy": "ESCALATE",
            "reason": "Human review required",
            "action": "escalate_to_human",
        }

    # --------------------------------------------------
    # Rule 7: Explicit stop
    # --------------------------------------------------

    if action == "stop_recovery":
        return {
            "allowed": True,
            "policy": "STOP",
            "reason": "Recovery must stop",
            "action": "stop_recovery",
        }

    # --------------------------------------------------
    # Rule 8: Other safe customer/recovery actions
    # --------------------------------------------------

    return {
        "allowed": True,
        "policy": "APPROVED",
        "reason": "Action is allowed by policy",
        "action": action,
    }