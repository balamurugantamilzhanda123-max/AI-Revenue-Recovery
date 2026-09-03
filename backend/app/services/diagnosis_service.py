import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

from app.agents.root_cause import diagnose_transaction


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE, override=True)


def store_diagnosis(diagnosis) -> dict:
    saved_record = {
        "transaction_id": diagnosis.transaction_id,
        "root_cause": diagnosis.root_cause.value if hasattr(diagnosis.root_cause, "value") else str(diagnosis.root_cause),
        "confidence": float(diagnosis.confidence),
        "evidence": diagnosis.evidence,
        "reason": diagnosis.reason,
        "requires_human_review": bool(diagnosis.requires_human_review),
        "model": os.getenv("AI_MODEL", "demo"),
    }

    # 1. Store in SQLAlchemy database
    try:
        from app.database import SessionLocal
        from app.models.transaction import Transaction, RecoveryCase, RecoveryStatus
        from decimal import Decimal

        with SessionLocal() as session:
            txn = (
                session.query(Transaction)
                .filter(
                    (Transaction.transaction_id == diagnosis.transaction_id)
                    | (Transaction.id == diagnosis.transaction_id)
                )
                .first()
            )
            if txn:
                recovery_case = (
                    session.query(RecoveryCase)
                    .filter(RecoveryCase.transaction_id == txn.id)
                    .order_by(RecoveryCase.created_at.desc())
                    .first()
                )
                if recovery_case is None:
                    recovery_case = RecoveryCase(
                        transaction_id=txn.id,
                        risk_amount=txn.amount or Decimal("0.00"),
                        root_cause=saved_record["root_cause"],
                        confidence=saved_record["confidence"],
                        evidence=saved_record["evidence"],
                        recovery_status=RecoveryStatus.DIAGNOSED,
                    )
                    session.add(recovery_case)
                else:
                    recovery_case.root_cause = saved_record["root_cause"]
                    recovery_case.confidence = saved_record["confidence"]
                    recovery_case.evidence = saved_record["evidence"]
                    recovery_case.recovery_status = RecoveryStatus.DIAGNOSED
                session.commit()
                saved_record["id"] = recovery_case.id
                saved_record["recovery_case_id"] = recovery_case.id

                from app.services.audit_service import record_audit_event
                record_audit_event(
                    session,
                    event_type="AI_DIAGNOSIS_COMPLETED",
                    event_message=f"Root cause identified: {saved_record['root_cause'].replace('_', ' ')}",
                    actor="AI_AGENT",
                    transaction_id=txn.id,
                    recovery_case_id=recovery_case.id,
                    metadata={
                        "root_cause": saved_record["root_cause"],
                        "confidence": saved_record["confidence"],
                        "evidence": saved_record["evidence"],
                        "requires_human_review": saved_record["requires_human_review"],
                        "model": saved_record["model"],
                    },
                )
                session.commit()
    except Exception as err:
        print("SQLAlchemy store_diagnosis note:", repr(err))

    # 2. Try Supabase if configured and available
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if url and key:
        try:
            db = create_client(url, key)
            result = db.table("transaction_diagnoses").insert(saved_record).execute()
            if result.data:
                return result.data[0]
        except Exception:
            pass

    return saved_record



def diagnose_and_store(transaction_id: str) -> dict:
    diagnosis = diagnose_transaction(transaction_id)

    saved = store_diagnosis(diagnosis)

    return {
        "diagnosis": diagnosis.model_dump(),
        "stored": saved,
    }