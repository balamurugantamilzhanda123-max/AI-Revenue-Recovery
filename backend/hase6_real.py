import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client


BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE, override=True)


TRANSACTION_ID = "94260551-89a0-4d86-bde3-6e8ac90b1ab5"

ROOT_CAUSES = [
    "payment_timeout",
    "bank_decline",
    "authentication_failure",
    "insufficient_funds",
    "payment_method_issue",
    "customer_abandonment",
    "technical_failure",
    "repeated_payment_failure",
    "unknown",
]


def get_supabase():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not url:
        raise RuntimeError("SUPABASE_URL is missing")

    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is missing"
        )

    return create_client(url, key)


def get_transaction(db):
    result = (
        db.table("transactions")
        .select(
            "id,"
            "external_event_id,"
            "customer_id,"
            "customer_name,"
            "payment_method,"
            "amount_minor_units,"
            "currency_minor_units,"
            "currency,"
            "status,"
            "failure_reason,"
            "gateway_response,"
            "retry_count,"
            "correlation_id,"
            "created_at,"
            "updated_at"
        )
        .eq("id", TRANSACTION_ID)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise RuntimeError(
            f"Transaction not found: {TRANSACTION_ID}"
        )

    return result.data[0]


def diagnose(transaction):
    api_key = os.getenv("AI_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError(
            "AI_API_KEY is missing from backend/.env"
        )

    model = os.getenv(
        "AI_MODEL",
        "gpt-5.6-luna",
    ).strip()

    client = OpenAI(api_key=api_key)

    schema = {
        "type": "object",
        "properties": {
            "transaction_id": {
                "type": "string"
            },
            "root_cause": {
                "type": "string",
                "enum": ROOT_CAUSES,
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
            },
            "evidence": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "minItems": 1,
                "maxItems": 5,
            },
            "reason": {
                "type": "string"
            },
            "requires_human_review": {
                "type": "boolean"
            },
        },
        "required": [
            "transaction_id",
            "root_cause",
            "confidence",
            "evidence",
            "reason",
            "requires_human_review",
        ],
        "additionalProperties": False,
    }

    prompt = f"""
You are ReviveAI's payment-failure root-cause engine.

Analyze ONLY the supplied transaction.

Transaction:
{json.dumps(transaction, default=str, indent=2)}

Choose the most likely root cause from:

{json.dumps(ROOT_CAUSES)}

Rules:
1. Use only the supplied transaction evidence.
2. Never invent facts.
3. Confidence must be between 0 and 1.
4. Provide 1 to 5 concrete evidence items.
5. Give a concise explanation.
6. Set requires_human_review=true if evidence is weak,
   conflicting, or insufficient.
7. Do not recommend a recovery action.
8. Do not execute or modify any payment.
9. Do not expose private chain-of-thought.

Return only the structured diagnosis.
"""

    response = client.responses.create(
        model=model,
        input=prompt,
        text={
            "format": {
                "type": "json_schema",
                "name": "reviveai_diagnosis",
                "strict": True,
                "schema": schema,
            }
        },
    )

    if not response.output_text:
        raise RuntimeError(
            "OpenAI returned an empty response"
        )

    diagnosis = json.loads(
        response.output_text
    )

    if diagnosis["transaction_id"] != transaction["id"]:
        raise RuntimeError(
            "Validation failed: incorrect transaction ID"
        )

    if not (
        0 <= diagnosis["confidence"] <= 1
    ):
        raise RuntimeError(
            "Validation failed: invalid confidence"
        )

    if not (
        1 <= len(diagnosis["evidence"]) <= 5
    ):
        raise RuntimeError(
            "Validation failed: invalid evidence count"
        )

    if diagnosis["root_cause"] not in ROOT_CAUSES:
        raise RuntimeError(
            "Validation failed: invalid root cause"
        )

    if not diagnosis["reason"].strip():
        raise RuntimeError(
            "Validation failed: empty reason"
        )

    return diagnosis


def store_diagnosis(db, diagnosis):
    result = (
        db
        .table("transaction_diagnoses")
        .insert(
            {
                "transaction_id": diagnosis[
                    "transaction_id"
                ],
                "root_cause": diagnosis[
                    "root_cause"
                ],
                "confidence": diagnosis[
                    "confidence"
                ],
                "evidence": diagnosis[
                    "evidence"
                ],
                "reason": diagnosis[
                    "reason"
                ],
                "requires_human_review": diagnosis[
                    "requires_human_review"
                ],
                "model": os.getenv(
                    "AI_MODEL",
                    "gpt-5.6-luna",
                ),
            }
        )
        .execute()
    )

    if not result.data:
        raise RuntimeError(
            "Diagnosis storage failed"
        )

    return result.data[0]


def main():
    print()
    print("=" * 60)
    print("           REVIVEAI PHASE 6 FINAL")
    print("=" * 60)
    print()

    print(
        "AI model:",
        os.getenv(
            "AI_MODEL",
            "gpt-5.6-luna",
        ),
    )

    print(
        "AI key loaded:",
        bool(os.getenv("AI_API_KEY")),
    )

    db = get_supabase()

    print("✅ Supabase configuration")

    transaction = get_transaction(db)

    print("✅ Transaction context retrieved")
    print(
        "Transaction:",
        transaction["id"],
    )
    print(
        "Status:",
        transaction["status"],
    )

    diagnosis = diagnose(transaction)

    print("✅ REAL OPENAI diagnosis received")
    print()
    print("Root cause:")
    print(diagnosis["root_cause"])

    print()
    print("Confidence:")
    print(diagnosis["confidence"])

    print()
    print("Evidence:")
    for item in diagnosis["evidence"]:
        print("-", item)

    print()
    print("Reason:")
    print(diagnosis["reason"])

    print()
    print(
        "Requires human review:",
        diagnosis["requires_human_review"],
    )

    stored = store_diagnosis(
        db,
        diagnosis,
    )

    print()
    print("✅ Diagnosis stored")
    print("Stored diagnosis ID:")
    print(stored["id"])

    print()
    print("=" * 60)
    print("✅ PHASE 6 FINAL PASS")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()