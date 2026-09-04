# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db

from app.models.transaction import Transaction, RecoveryCase

from app.services.diagnosis_service import diagnose_and_store
from app.services.decision_service import generate_recovery_decision
from app.services.policy_service import validate_recovery_policy
from app.services.escalation_service import create_escalation

from app.schemas.decision import RecoveryDecisionResult


router = APIRouter(
    prefix="/agent",
    tags=["AI Agent"],
)


# =========================================================
# PHASE 6 — AI DIAGNOSIS
# =========================================================

@router.post("/diagnose/{transaction_id}")
def diagnose_transaction_endpoint(
    transaction_id: str,
    current_user=Depends(get_current_user),
):
    try:
        return diagnose_and_store(transaction_id)

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    except Exception as exc:
        print(
            "Diagnosis API error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Diagnosis failed",
        )


# =========================================================
# PHASE 7 — RECOVERY DECISION
# =========================================================

@router.post(
    "/decide/{transaction_id}",
    response_model=RecoveryDecisionResult,
)
def decide_recovery_endpoint(
    transaction_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Phase 7 Recovery Decision Engine.

    Flow:
        transaction
            ↓
        stored diagnosis
            ↓
        decision logic
            ↓
        policy validation
            ↓
        human escalation when required
            ↓
        structured result

    This endpoint DOES NOT execute payment/recovery actions.
    """

    try:
        # -------------------------------------------------
        # 1. Find transaction
        # -------------------------------------------------

        transaction = (
            db.query(Transaction)
            .filter(
                Transaction.transaction_id == transaction_id
            )
            .first()
        )

        if transaction is None:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found",
            )

        # -------------------------------------------------
        # 2. Find latest stored diagnosis / recovery case
        # -------------------------------------------------

        recovery_case = (
            db.query(RecoveryCase)
            .filter(
                (RecoveryCase.transaction_id == transaction.id)
                | (RecoveryCase.transaction_id == transaction.transaction_id)
            )
            .order_by(
                RecoveryCase.created_at.desc()
            )
            .first()
        )

        if recovery_case is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Diagnosis not found. "
                    "Run POST /agent/diagnose/"
                    f"{transaction_id} first."
                ),
            )

        # -------------------------------------------------
        # 3. Build transaction context
        # -------------------------------------------------

        transaction_status = getattr(
            transaction,
            "status",
            "",
        )

        if hasattr(
            transaction_status,
            "value",
        ):
            transaction_status = (
                transaction_status.value
            )

        transaction_data = {
            "transaction_id": transaction_id,
            "status": str(
                transaction_status
            ).lower(),
            "retry_count": int(
                getattr(
                    transaction,
                    "retry_count",
                    0,
                )
                or 0
            ),
            "customer_opted_out": bool(
                getattr(
                    transaction,
                    "customer_opted_out",
                    False,
                )
            ),
        }

        # -------------------------------------------------
        # 4. Build diagnosis context
        # -------------------------------------------------

        root_cause = getattr(
            recovery_case,
            "root_cause",
            "unknown",
        )

        confidence = float(
            getattr(
                recovery_case,
                "confidence",
                0.0,
            )
            or 0.0
        )

        diagnosis_data = {
            "transaction_id": transaction_id,
            "root_cause": str(
                root_cause or "unknown"
            ),
            "confidence": confidence,
        }

        # -------------------------------------------------
        # 5. Generate recovery decision
        # -------------------------------------------------

        decision = generate_recovery_decision(
            diagnosis_data,
            transaction_data,
        )

        # -------------------------------------------------
        # 6. Validate decision against policy
        # -------------------------------------------------

        policy = validate_recovery_policy(
            {
                "decision": decision.get(
                    "decision",
                    "escalate_to_human",
                ),
                "confidence": confidence,
            },
            transaction_data,
        )

        # -------------------------------------------------
        # 7. Escalate when policy requires human review
        # -------------------------------------------------

        escalation_id = None

        should_escalate = (
            policy.get("policy") == "ESCALATE"
            or policy.get("action")
            == "escalate_to_human"
        )

        if should_escalate:

            escalation = create_escalation(
                db,
                transaction=transaction,
                recovery_case=recovery_case,
                reason=policy.get(
                    "reason",
                    "Human review required",
                ),
                priority="HIGH",
                ai_recommendation=decision.get(
                    "decision"
                ),
            )

            if escalation is not None:
                escalation_id = str(
                    getattr(
                        escalation,
                        "id",
                        "",
                    )
                ) or None

        # -------------------------------------------------
        # 8. Return structured decision result
        # -------------------------------------------------

        final_action = policy.get(
            "action"
        )

        if not final_action:
            final_action = decision.get(
                "decision",
                "escalate_to_human",
            )

        requires_human_review = (
            should_escalate
            or bool(
                decision.get(
                    "requires_human_review",
                    False,
                )
            )
        )

        from app.services.audit_service import record_audit_event
        record_audit_event(
            db,
            event_type="RECOVERY_DECISION_CREATED",
            event_message=f"Recovery strategy selected: {str(final_action).replace('_', ' ')}",
            actor="AI_AGENT",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={
                "recommended_action": str(final_action),
                "reason": str(policy.get("reason", decision.get("reason", ""))),
                "confidence": confidence,
                "requires_human_review": requires_human_review,
            },
        )
        db.commit()

        return RecoveryDecisionResult(
            transaction_id=transaction_id,
            root_cause=str(
                diagnosis_data["root_cause"]
            ),
            confidence=confidence,
            decision=str(
                final_action
            ),
            policy=str(
                policy.get(
                    "policy",
                    "REJECT",
                )
            ),
            allowed=bool(
                policy.get(
                    "allowed",
                    False,
                )
            ),
            reason=str(
                policy.get(
                    "reason",
                    decision.get(
                        "reason",
                        "",
                    ),
                )
            ),
            requires_human_review=(
                requires_human_review
            ),
            escalation_id=escalation_id,
        )

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "Decision API error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Recovery decision failed",
        )