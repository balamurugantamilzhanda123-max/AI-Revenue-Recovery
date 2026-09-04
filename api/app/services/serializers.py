from datetime import datetime
from decimal import Decimal
from typing import Any

from app.models import AuditLog, EscalationCase, RecoveryAction, RecoveryCase, Transaction


def value_of(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    return value


def customer_dict(customer) -> dict[str, Any] | None:
    if customer is None:
        return None
    return {
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "status": value_of(customer.status),
        "created_at": value_of(customer.created_at),
    }


def payment_attempt_dict(attempt) -> dict[str, Any]:
    return {
        "id": attempt.id,
        "transaction_id": attempt.transaction_id,
        "attempt_number": attempt.attempt_number,
        "status": value_of(attempt.status),
        "gateway_response": attempt.gateway_response,
        "created_at": value_of(attempt.created_at),
    }


def recovery_action_dict(action: RecoveryAction) -> dict[str, Any]:
    return {
        "id": action.id,
        "recovery_case_id": action.recovery_case_id,
        "action_type": action.action_type,
        "action_reason": action.action_reason,
        "policy_result": action.policy_result or {},
        "execution_result": action.execution_result,
        "status": value_of(action.status),
        "idempotency_key": action.idempotency_key,
        "created_at": value_of(action.created_at),
    }


def recovery_case_dict(case: RecoveryCase, include_actions: bool = False) -> dict[str, Any]:
    data = {
        "id": case.id,
        "transaction_id": case.transaction_id,
        "risk_amount": value_of(case.risk_amount),
        "root_cause": case.root_cause,
        "confidence": float(case.confidence) if case.confidence is not None else None,
        "evidence": case.evidence or [],
        "recommended_action": case.recommended_action,
        "action_status": value_of(case.action_status),
        "recovery_status": value_of(case.recovery_status),
        "recovered_amount": value_of(case.recovered_amount),
        "policy_result": case.policy_result,
        "detection_timestamp": value_of(case.detection_timestamp),
        "success_timestamp": value_of(case.success_timestamp),
        "created_at": value_of(case.created_at),
        "updated_at": value_of(case.updated_at),
    }
    if include_actions:
        data["recovery_actions"] = [
            recovery_action_dict(action)
            for action in case.recovery_actions
        ]
    return data


def transaction_dict(transaction: Transaction, include_detail: bool = False) -> dict[str, Any]:
    data = {
        "id": transaction.id,
        "transaction_id": transaction.transaction_id,
        "customer_id": transaction.customer_id,
        "order_id": transaction.order_id,
        "amount": value_of(transaction.amount),
        "currency": transaction.currency,
        "payment_method": transaction.payment_method,
        "status": value_of(transaction.status),
        "failure_reason": transaction.failure_reason,
        "gateway_response": transaction.gateway_response,
        "retry_count": transaction.retry_count,
        "customer_response": transaction.customer_response,
        "recovery_status": value_of(transaction.recovery_status),
        "recovered_amount": value_of(transaction.recovered_amount),
        "escalation_status": value_of(transaction.escalation_status),
        "created_at": value_of(transaction.created_at),
        "updated_at": value_of(transaction.updated_at),
        "customer": customer_dict(transaction.customer),
    }
    if include_detail:
        data["payment_attempts"] = [
            payment_attempt_dict(attempt)
            for attempt in transaction.payment_attempts
        ]
        data["recovery_cases"] = [
            recovery_case_dict(case, include_actions=True)
            for case in transaction.recovery_cases
        ]
    return data


def audit_log_dict(log: AuditLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "transaction_id": log.transaction_id,
        "recovery_case_id": log.recovery_case_id,
        "event_type": log.event_type,
        "event_message": log.event_message,
        "actor": log.actor,
        "metadata": log.metadata_json or {},
        "created_at": value_of(log.created_at),
    }


def escalation_dict(case: EscalationCase) -> dict[str, Any]:
    return {
        "id": case.id,
        "transaction_id": case.transaction_id,
        "recovery_case_id": case.recovery_case_id,
        "reason": case.reason,
        "priority": case.priority,
        "status": value_of(case.status),
        "ai_recommendation": case.ai_recommendation,
        "action_history": case.action_history or [],
        "created_at": value_of(case.created_at),
        "resolved_at": value_of(case.resolved_at),
        "transaction": transaction_dict(case.transaction) if case.transaction else None,
    }
