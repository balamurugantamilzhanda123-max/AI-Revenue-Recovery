import os

from supabase import create_client

from app.agents.root_cause import diagnose_transaction


def store_diagnosis(diagnosis):
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not url or not key:
        raise RuntimeError("Supabase configuration is missing")

    db = create_client(url, key)

    result = (
        db.table("transaction_diagnoses")
        .insert(
            {
                "transaction_id": diagnosis.transaction_id,
                "root_cause": diagnosis.root_cause.value,
                "confidence": diagnosis.confidence,
                "evidence": diagnosis.evidence,
                "reason": diagnosis.reason,
                "requires_human_review": diagnosis.requires_human_review,
                "model": os.getenv("AI_MODEL", "gpt-4.1-mini"),
            }
        )
        .execute()
    )

    if not result.data:
        raise RuntimeError("Diagnosis was not stored")

    return result.data[0]


def diagnose_and_store(transaction_id: str):
    diagnosis = diagnose_transaction(transaction_id)
    saved = store_diagnosis(diagnosis)

    return {
        "diagnosis": diagnosis.model_dump(),
        "stored": saved,
    }