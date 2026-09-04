import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.models import (
    ActionStatus,
    CustomerPreference,
    PaymentAttempt,
    PaymentStatus,
    RecommendedAction,
    RecoveryAction,
    RecoveryStatus,
)
from app.policies.engine import validate_recovery_policy
from app.schemas.revive import DecisionResult
from app.services.agent_service import decide_recovery_action
from app.services.audit_service import record_audit_event
from app.services.escalation_service import create_escalation
from app.services.idempotency_service import begin_idempotent_request, finish_idempotent_request
from app.services.risk_service import ensure_recovery_case
from app.services.serializers import recovery_case_dict
from app.services.transaction_service import get_transaction_or_404


def _new_key(prefix: str, transaction_id: str) -> str:
    return f"{prefix}:{transaction_id}:{uuid.uuid4()}"


def _simulated_payment_result(transaction, force_result: str | None) -> tuple[PaymentStatus, str]:
    if force_result:
        result = PaymentStatus(force_result)
        message = "Forced demo payment result"
        return result, message

    text = " ".join(
        [
            transaction.transaction_id,
            transaction.failure_reason or "",
            transaction.gateway_response or "",
        ]
    ).lower()

    if "tx-demo-002" in text or "hard_fail" in text or "hard decline" in text:
        return PaymentStatus.FAILED, "Sandbox retry failed by demo scenario"
    if "timeout" in text or "temporary" in text or "gateway" in text or "technical" in text:
        return PaymentStatus.SUCCESS, "Sandbox retry succeeded after transient failure"
    return PaymentStatus.FAILED, "Sandbox retry could not recover the payment"


def _record_recovery_action(
    db: Session,
    *,
    recovery_case,
    action_type: str,
    action_reason: str,
    policy_result: dict,
    status: ActionStatus,
    idempotency_key: str | None,
    execution_result: dict | None = None,
) -> RecoveryAction:
    action = RecoveryAction(
        recovery_case_id=recovery_case.id,
        action_type=action_type,
        action_reason=action_reason,
        policy_result=policy_result,
        execution_result=execution_result,
        status=status,
        idempotency_key=idempotency_key,
    )
    db.add(action)
    db.flush()
    return action


def execute_controlled_retry(
    db: Session,
    *,
    transaction,
    recovery_case,
    decision: DecisionResult,
    policy: dict,
    idempotency_key: str,
    force_result: str | None = None,
) -> dict:
    recovery_case.action_status = ActionStatus.POLICY_APPROVED
    recovery_case.recovery_status = RecoveryStatus.IN_PROGRESS
    transaction.recovery_status = RecoveryStatus.IN_PROGRESS

    # Event 5: Recovery Execution Audit
    record_audit_event(
        db,
        event_type="RECOVERY_STARTED",
        event_message="Recovery workflow started",
        actor="reviveai-executor",
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id,
        metadata={
            "action_type": decision.recommended_action.value,
            "transaction_id": transaction.transaction_id,
            "recovery_case_id": recovery_case.id,
            "attempt_number": transaction.retry_count + 1,
            "idempotency_key": idempotency_key,
        },
    )

    transaction.retry_count += 1
    retry_status, gateway_message = _simulated_payment_result(transaction, force_result)

    attempt = PaymentAttempt(
        transaction_id=transaction.id,
        attempt_number=transaction.retry_count + 1,
        status=retry_status,
        gateway_response=gateway_message,
    )
    db.add(attempt)

    execution_result = {
        "payment_status": retry_status.value,
        "gateway_response": gateway_message,
        "attempt_number": attempt.attempt_number,
    }

    if retry_status == PaymentStatus.SUCCESS:
        transaction.status = PaymentStatus.SUCCESS
        transaction.recovery_status = RecoveryStatus.RECOVERED
        transaction.recovered_amount = transaction.amount
        transaction.failure_reason = None
        recovery_case.recovery_status = RecoveryStatus.RECOVERED
        recovery_case.recovered_amount = transaction.amount
        recovery_case.success_timestamp = datetime.utcnow()
        action_status = ActionStatus.EXECUTED

        action = _record_recovery_action(
            db,
            recovery_case=recovery_case,
            action_type=decision.recommended_action.value,
            action_reason=decision.reason,
            policy_result=policy,
            status=action_status,
            idempotency_key=idempotency_key,
            execution_result=execution_result,
        )

        # Event 6: Success Audit
        record_audit_event(
            db,
            event_type="RECOVERY_SUCCEEDED",
            event_message="Payment retry succeeded",
            actor="reviveai-executor",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id,
            metadata={
                "payment_status": retry_status.value,
                "recovered_amount": float(transaction.amount),
                "currency": transaction.currency,
                "attempt_number": attempt.attempt_number,
                "gateway_response": gateway_message,
            },
        )
        record_audit_event(
            db,
            event_type="REVENUE_RECOVERED",
            event_message=f"Revenue recovered: {transaction.currency} {float(transaction.amount):,.2f}",
            actor="reviveai-agent",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id,
            metadata={
                "recovered_amount": float(transaction.amount),
                "currency": transaction.currency,
                "transaction_id": transaction.transaction_id,
            },
        )
        # Event 9: Stopping Audit (Success)
        record_audit_event(
            db,
            event_type="RECOVERY_STOPPED",
            event_message="Recovery workflow stopped",
            actor="reviveai-agent",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id,
            metadata={
                "stop_reason": "PAYMENT_SUCCESS",
                "transaction_status": transaction.status.value,
                "recovery_status": transaction.recovery_status.value,
                "retry_count": transaction.retry_count,
            },
        )
    else:
        transaction.status = PaymentStatus.FAILED
        transaction.failure_reason = gateway_message
        transaction.recovery_status = RecoveryStatus.FAILED
        recovery_case.recovery_status = RecoveryStatus.FAILED
        action_status = ActionStatus.FAILED

        action = _record_recovery_action(
            db,
            recovery_case=recovery_case,
            action_type=decision.recommended_action.value,
            action_reason=decision.reason,
            policy_result=policy,
            status=action_status,
            idempotency_key=idempotency_key,
            execution_result=execution_result,
        )

        # Event 7: Failure Audit
        record_audit_event(
            db,
            event_type="RECOVERY_FAILED",
            event_message="Payment retry failed",
            actor="reviveai-executor",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id,
            metadata={
                "payment_status": retry_status.value,
                "failure_reason": gateway_message,
                "attempt_number": attempt.attempt_number,
                "retry_limit": policy.get("max_automatic_retries", 1),
            },
        )

        if transaction.retry_count >= policy.get("max_automatic_retries", 1):
            # Event 9: Stopping Audit (Retry limit)
            record_audit_event(
                db,
                event_type="RECOVERY_STOPPED",
                event_message="Recovery workflow stopped",
                actor="reviveai-agent",
                transaction_id=transaction.id,
                recovery_case_id=recovery_case.id,
                metadata={
                    "stop_reason": "RETRY_LIMIT_REACHED",
                    "retry_count": transaction.retry_count,
                    "retry_limit": policy.get("max_automatic_retries", 1),
                },
            )
            # Event 8: Escalation Audit
            escalation = create_escalation(
                db,
                transaction=transaction,
                recovery_case=recovery_case,
                reason="Automatic retry failed and retry limit was reached.",
                priority="HIGH",
                ai_recommendation=decision.reason,
            )
            execution_result["escalation_id"] = escalation.id

    db.flush()
    return {
        "transaction_id": transaction.transaction_id,
        "recovery_case": recovery_case_dict(recovery_case, include_actions=True),
        "action_id": action.id,
        "policy": policy,
        "execution_result": execution_result,
    }


def execute_recovery_message(
    db: Session,
    *,
    transaction,
    recovery_case,
    decision: DecisionResult,
    policy: dict,
    idempotency_key: str,
) -> dict:
    preference = transaction.customer.preferences if transaction.customer else None
    if preference is None and transaction.customer:
        preference = CustomerPreference(customer_id=transaction.customer.id)
        db.add(preference)
        db.flush()
    if preference:
        preference.recovery_message_count += 1

    message = (
        f"We could not complete payment for order {transaction.order_id}. "
        "Please continue with a verified payment method."
    )
    execution_result = {
        "message_status": "QUEUED",
        "channel": "email_or_sms_test",
        "message_preview": message,
    }
    recovery_case.recovery_status = RecoveryStatus.IN_PROGRESS
    transaction.recovery_status = RecoveryStatus.IN_PROGRESS

    action = _record_recovery_action(
        db,
        recovery_case=recovery_case,
        action_type=decision.recommended_action.value,
        action_reason=decision.reason,
        policy_result=policy,
        status=ActionStatus.EXECUTED,
        idempotency_key=idempotency_key,
        execution_result=execution_result,
    )
    record_audit_event(
        db,
        event_type="RECOVERY_MESSAGE_CREATED",
        event_message=f"Recovery message created for {transaction.transaction_id}",
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id,
        metadata=execution_result,
    )
    return {
        "transaction_id": transaction.transaction_id,
        "recovery_case": recovery_case_dict(recovery_case, include_actions=True),
        "action_id": action.id,
        "policy": policy,
        "execution_result": execution_result,
    }


def start_recovery_workflow(
    db: Session,
    *,
    transaction_ref: str,
    current_user: CurrentUser,
    idempotency_key: str | None,
    force_payment_result: str | None = None,
) -> dict:
    transaction = get_transaction_or_404(db, transaction_ref)
    key = idempotency_key or _new_key("recovery-start", transaction.transaction_id)
    idem, replay = begin_idempotent_request(
        db,
        key=key,
        method="POST",
        path=f"/api/recovery/start/{transaction_ref}",
        payload={"force_payment_result": force_payment_result},
        transaction_id=transaction.id,
    )
    if replay:
        return idem.response_payload or {}

    decision_payload = decide_recovery_action(db, transaction_ref, commit=False)
    decision = DecisionResult.model_validate(decision_payload["decision"])
    recovery_case = ensure_recovery_case(db, transaction)

    if recovery_case is None:
        policy = {
            "allowed": False,
            "result": "BLOCKED",
            "reasons": ["Recovery is stopped and cannot be started again."],
        }

        record_audit_event(
            db,
            event_type="POLICY_VALIDATION_COMPLETED",
            event_message="Policy validation: BLOCKED",
            actor="reviveai-safety-engine",
            transaction_id=transaction.id,
            metadata={
                "policy_result": "BLOCKED",
                "allowed": False,
                "reasons": policy["reasons"],
            },
        )
        record_audit_event(
            db,
            event_type="POLICY_BLOCKED_ACTION",
            event_message=f"Policy blocked recovery for {transaction.transaction_id}",
            actor="reviveai-safety-engine",
            transaction_id=transaction.id,
            metadata=policy,
        )

        result = {
            "transaction_id": transaction.transaction_id,
            "decision": decision.model_dump(mode="json"),
            "policy": policy,
            "recovery_case": None,
        }

        finish_idempotent_request(db, idem, response_payload=result)
        db.commit()
        return result

    policy = validate_recovery_policy(
        db,
        transaction=transaction,
        recovery_case=recovery_case,
        decision=decision,
        actor_role=current_user.role,
    )

    recovery_case.policy_result = policy

    if not policy["allowed"]:
        action = RecoveryAction(
            recovery_case_id=recovery_case.id,
            action_type="RECOVERY_BLOCKED",
            action_reason="Recovery blocked by policy",
            policy_result=policy,
            execution_result={
                "status": "NOT_EXECUTED",
                "reason": "Recovery blocked by policy",
            },
            status=ActionStatus.POLICY_BLOCKED,
            idempotency_key=key,
        )
        db.add(action)
        db.flush()
        recovery_case.action_status = ActionStatus.POLICY_BLOCKED

        # Event 4: Policy Validation Audit (REJECTED/BLOCKED)
        record_audit_event(
            db,
            event_type="POLICY_VALIDATION_COMPLETED",
            event_message=f"Policy validation: {policy.get('result', 'REJECTED')}",
            actor="reviveai-safety-engine",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id,
            metadata={
                "policy_result": policy.get("result", "REJECTED"),
                "allowed": False,
                "action_type": decision.recommended_action.value,
                "retry_count": transaction.retry_count,
                "retry_limit": policy.get("max_automatic_retries", 1),
                "reasons": policy.get("reasons", []),
            },
        )
        record_audit_event(
            db,
            event_type="POLICY_BLOCKED_ACTION",
            event_message=f"Policy blocked recovery for {transaction.transaction_id}",
            actor="reviveai-safety-engine",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id,
            metadata=policy,
        )

        if policy["result"] == "ESCALATE":
            escalation = create_escalation(
                db,
                transaction=transaction,
                recovery_case=recovery_case,
                reason="; ".join(policy["reasons"]),
                priority="HIGH",
                ai_recommendation=decision.reason,
            )
            result = {
                "transaction_id": transaction.transaction_id,
                "decision": decision.model_dump(mode="json"),
                "policy": policy,
                "escalation_id": escalation.id,
                "recovery_case": recovery_case_dict(recovery_case, include_actions=True),
            }
        else:
            recovery_case.recovery_status = RecoveryStatus.STOPPED
            transaction.recovery_status = RecoveryStatus.STOPPED
            record_audit_event(
                db,
                event_type="RECOVERY_STOPPED",
                event_message="Recovery workflow stopped",
                actor="reviveai-safety-engine",
                transaction_id=transaction.id,
                recovery_case_id=recovery_case.id,
                metadata={
                    "stop_reason": "POLICY_REJECTED",
                    "transaction_status": transaction.status.value,
                    "recovery_status": transaction.recovery_status.value,
                },
            )
            result = {
                "transaction_id": transaction.transaction_id,
                "decision": decision.model_dump(mode="json"),
                "policy": policy,
                "recovery_case": recovery_case_dict(recovery_case, include_actions=True),
            }

        finish_idempotent_request(db, idem, response_payload=result)
        db.commit()
        return result

    # Event 4: Policy Validation Audit (APPROVED)
    record_audit_event(
        db,
        event_type="POLICY_VALIDATION_COMPLETED",
        event_message="Policy validation: APPROVED",
        actor="reviveai-safety-engine",
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id,
        metadata={
            "policy_result": "APPROVED",
            "allowed": True,
            "action_type": decision.recommended_action.value,
            "retry_count": transaction.retry_count,
            "retry_limit": policy.get("max_automatic_retries", 1),
            "customer_opt_out": False,
            "reasons": policy.get("reasons", []),
        },
    )

    if decision.recommended_action == RecommendedAction.CONTROLLED_RETRY:
        result = execute_controlled_retry(
            db,
            transaction=transaction,
            recovery_case=recovery_case,
            decision=decision,
            policy=policy,
            idempotency_key=key,
            force_result=force_payment_result,
        )
    else:
        result = execute_recovery_message(
            db,
            transaction=transaction,
            recovery_case=recovery_case,
            decision=decision,
            policy=policy,
            idempotency_key=key,
        )

    result["decision"] = decision.model_dump(mode="json")
    finish_idempotent_request(db, idem, response_payload=result)
    db.commit()
    return result


def payment_retry(
    db: Session,
    *,
    transaction_ref: str,
    current_user: CurrentUser,
    idempotency_key: str | None,
    force_result: str | None = None,
) -> dict:
    transaction = get_transaction_or_404(db, transaction_ref)
    key = idempotency_key or _new_key("payment-retry", transaction.transaction_id)
    idem, replay = begin_idempotent_request(
        db,
        key=key,
        method="POST",
        path=f"/api/payments/retry/{transaction_ref}",
        payload={"force_result": force_result},
        transaction_id=transaction.id,
    )
    if replay:
        return idem.response_payload or {}

    decision_payload = decide_recovery_action(db, transaction_ref, commit=False)
    decision = DecisionResult.model_validate(decision_payload["decision"])
    decision.recommended_action = RecommendedAction.CONTROLLED_RETRY
    recovery_case = ensure_recovery_case(db, transaction)
    policy = validate_recovery_policy(
        db,
        transaction=transaction,
        recovery_case=recovery_case,
        decision=decision,
        actor_role=current_user.role,
    )
    recovery_case.policy_result = policy

    if not policy["allowed"]:
        recovery_case.action_status = ActionStatus.POLICY_BLOCKED
        record_audit_event(
            db,
            event_type="POLICY_VALIDATION_COMPLETED",
            event_message=f"Policy validation: {policy.get('result', 'REJECTED')}",
            actor="reviveai-safety-engine",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id,
            metadata={
                "policy_result": policy.get("result", "REJECTED"),
                "allowed": False,
                "action_type": decision.recommended_action.value,
                "retry_count": transaction.retry_count,
                "retry_limit": policy.get("max_automatic_retries", 1),
                "reasons": policy.get("reasons", []),
            },
        )
        record_audit_event(
            db,
            event_type="POLICY_BLOCKED_ACTION",
            event_message=f"Policy blocked recovery for {transaction.transaction_id}",
            actor="reviveai-safety-engine",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id,
            metadata=policy,
        )

        escalation = None
        if policy["result"] == "ESCALATE":
            escalation = create_escalation(
                db,
                transaction=transaction,
                recovery_case=recovery_case,
                reason="; ".join(policy["reasons"]),
                priority="HIGH",
                ai_recommendation=decision.reason,
            )
        else:
            recovery_case.recovery_status = RecoveryStatus.STOPPED
            transaction.recovery_status = RecoveryStatus.STOPPED
            record_audit_event(
                db,
                event_type="RECOVERY_STOPPED",
                event_message="Recovery workflow stopped",
                actor="reviveai-safety-engine",
                transaction_id=transaction.id,
                recovery_case_id=recovery_case.id,
                metadata={
                    "stop_reason": "POLICY_REJECTED",
                    "transaction_status": transaction.status.value,
                    "recovery_status": transaction.recovery_status.value,
                },
            )

        result = {
            "transaction_id": transaction.transaction_id,
            "decision": decision.model_dump(mode="json"),
            "policy": policy,
            "escalation_id": escalation.id if escalation else None,
            "recovery_case": recovery_case_dict(recovery_case, include_actions=True),
        }
        finish_idempotent_request(db, idem, response_payload=result)
        db.commit()
        return result

    record_audit_event(
        db,
        event_type="POLICY_VALIDATION_COMPLETED",
        event_message="Policy validation: APPROVED",
        actor="reviveai-safety-engine",
        transaction_id=transaction.id,
        recovery_case_id=recovery_case.id,
        metadata={
            "policy_result": "APPROVED",
            "allowed": True,
            "action_type": decision.recommended_action.value,
            "retry_count": transaction.retry_count,
            "retry_limit": policy.get("max_automatic_retries", 1),
            "customer_opt_out": False,
            "reasons": policy.get("reasons", []),
        },
    )

    result = execute_controlled_retry(
        db,
        transaction=transaction,
        recovery_case=recovery_case,
        decision=decision,
        policy=policy,
        idempotency_key=key,
        force_result=force_result,
    )
    result["decision"] = decision.model_dump(mode="json")
    finish_idempotent_request(db, idem, response_payload=result)
    db.commit()
    return result


def recovery_result(db: Session, transaction_ref: str) -> dict:
    transaction = get_transaction_or_404(db, transaction_ref)
    recovery_case = ensure_recovery_case(db, transaction) if transaction.status != PaymentStatus.SUCCESS else None
    if recovery_case is None and transaction.recovery_cases:
        recovery_case = transaction.recovery_cases[0]
    return {
        "transaction_id": transaction.transaction_id,
        "payment_status": transaction.status.value,
        "recovery_status": transaction.recovery_status.value,
        "recovered_amount": float(transaction.recovered_amount),
        "recovery_case": recovery_case_dict(recovery_case, include_actions=True) if recovery_case else None,
    }
