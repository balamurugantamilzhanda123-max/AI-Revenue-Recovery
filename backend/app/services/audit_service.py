import logging
from enum import StrEnum
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog

logger = logging.getLogger(__name__)

# Sensitive keys that should never be stored in audit metadata
SENSITIVE_KEYS = {
    "api_key",
    "apikey",
    "secret",
    "secret_key",
    "password",
    "pass",
    "token",
    "auth_token",
    "access_token",
    "refresh_token",
    "authorization",
    "card_number",
    "pan",
    "cvv",
    "cvc",
    "pin",
    "client_secret",
    "private_key",
}


class AuditEventType(StrEnum):
    TRANSACTION_INGESTED = "TRANSACTION_INGESTED"
    TRANSACTION_UPDATED = "TRANSACTION_UPDATED"
    REVENUE_RISK_DETECTED = "REVENUE_RISK_DETECTED"
    AI_DIAGNOSIS_COMPLETED = "AI_DIAGNOSIS_COMPLETED"
    RECOVERY_DECISION_CREATED = "RECOVERY_DECISION_CREATED"
    AI_DECISION_COMPLETED = "AI_DECISION_COMPLETED"
    POLICY_VALIDATION_COMPLETED = "POLICY_VALIDATION_COMPLETED"
    POLICY_BLOCKED_ACTION = "POLICY_BLOCKED_ACTION"
    RECOVERY_STARTED = "RECOVERY_STARTED"
    RECOVERY_SUCCEEDED = "RECOVERY_SUCCEEDED"
    REVENUE_RECOVERED = "REVENUE_RECOVERED"
    RECOVERY_FAILED = "RECOVERY_FAILED"
    RECOVERY_RETRY_FAILED = "RECOVERY_RETRY_FAILED"
    RECOVERY_STOPPED = "RECOVERY_STOPPED"
    HUMAN_ESCALATION_CREATED = "HUMAN_ESCALATION_CREATED"
    HUMAN_ESCALATION_RESOLVED = "HUMAN_ESCALATION_RESOLVED"
    CUSTOMER_OPT_OUT = "CUSTOMER_OPT_OUT"
    RECOVERY_MESSAGE_CREATED = "RECOVERY_MESSAGE_CREATED"
    DUPLICATE_RECOVERY_REQUEST = "DUPLICATE_RECOVERY_REQUEST"


def _sanitize_value(val: Any) -> Any:
    if isinstance(val, dict):
        return {
            k: ("[REDACTED]" if k.lower() in SENSITIVE_KEYS else _sanitize_value(v))
            for k, v in val.items()
        }
    if isinstance(val, list):
        return [_sanitize_value(item) for item in val]
    if isinstance(val, str) and ("Bearer " in val or "sk-" in val):
        return "[REDACTED]"
    return val


def sanitize_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    if not metadata:
        return {}
    return _sanitize_value(metadata)


def record_audit_event(
    db: Session,
    *,
    event_type: str | AuditEventType,
    event_message: str,
    actor: str = "SYSTEM",
    transaction_id: str | None = None,
    recovery_case_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    """
    Centralized function to safely record audit events.
    Validates input, strips sensitive credentials, logs failures appropriately,
    and never silently swallows critical database errors.
    """
    if not event_type or not str(event_type).strip():
        raise ValueError("Audit event_type cannot be empty")
    if not event_message or not str(event_message).strip():
        raise ValueError("Audit event_message cannot be empty")

    type_str = event_type.value if hasattr(event_type, "value") else str(event_type).strip()
    safe_metadata = sanitize_metadata(metadata)

    try:
        log = AuditLog(
            transaction_id=transaction_id,
            recovery_case_id=recovery_case_id,
            event_type=type_str,
            event_message=event_message,
            actor=actor,
            metadata_json=safe_metadata,
        )
        db.add(log)
        db.flush()
        return log
    except Exception as exc:
        logger.error(
            "Failed to record audit event: type=%s, message=%s, error=%s",
            type_str,
            event_message,
            repr(exc),
        )
        raise
