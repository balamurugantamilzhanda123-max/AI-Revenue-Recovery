import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client


# --------------------------------------------------
# Exact backend environment file
# --------------------------------------------------

BACKEND = Path(
    r"C:\Users\Bala Murugan\Downloads\Razorpay hackthon\backend"
)

ENV_FILE = BACKEND / ".env"

load_dotenv(ENV_FILE, override=True)


# --------------------------------------------------
# Configuration
# --------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
).strip()

import getpass

AI_API_KEY = os.getenv("AI_API_KEY", "").strip()

if not AI_API_KEY:
    AI_API_KEY = getpass.getpass(
        "Paste your NEW OpenAI API key: "
    ).strip()

if not AI_API_KEY:
    raise RuntimeError(
        "No OpenAI API key was provided."
    )

AI_MODEL = os.getenv(
    "AI_MODEL",
    "gpt-4.1-mini",
).strip()


TRANSACTION_ID = (
    "94260551-89a0-4d86-bde3-6e8ac90b1ab5"
)


# --------------------------------------------------
# Validate configuration
# --------------------------------------------------

print()
print("=" * 60)
print("REVIVEAI - PHASE 6 FINAL TEST")
print("=" * 60)
print()

print("ENV file exists:", ENV_FILE.exists())
print("AI key loaded:", bool(AI_API_KEY))
print("AI model:", AI_MODEL)

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing")

if not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY is missing"
    )

if not AI_API_KEY:
    raise RuntimeError(
        "AI_API_KEY is missing from backend/.env"
    )


# --------------------------------------------------
# Supabase
# --------------------------------------------------

db = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
)

print()
print("✅ Supabase client created")


# --------------------------------------------------
# Retrieve transaction
# --------------------------------------------------

result = (
    db
    .table("transactions")
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
    .eq(
        "id",
        TRANSACTION_ID,
    )
    .limit(1)
    .execute()
)

if not result.data:
    raise RuntimeError(
        f"Transaction not found: {TRANSACTION_ID}"
    )

transaction = result.data[0]

print("✅ Transaction context retrieved")
print(
    "Transaction:",
    transaction["id"],
)
print(
    "Status:",
    transaction["status"],
)


# --------------------------------------------------
# OpenAI
# --------------------------------------------------

client = OpenAI(
    api_key=AI_API_KEY
)


schema = {
    "type": "object",
    "properties": {
        "transaction_id": {
            "type": "string",
        },
        "root_cause": {
            "type": "string",
            "enum": [
                "payment_timeout",
                "bank_decline",
                "authentication_failure",
                "insufficient_funds",
                "payment_method_issue",
                "customer_abandonment",
                "technical_failure",
                "repeated_payment_failure",
                "unknown",
            ],
        },
        "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
        },
        "evidence": {
            "type": "array",
            "items": {
                "type": "string",
            },
            "minItems": 1,
            "maxItems": 5,
        },
        "reason": {
            "type": "string",
        },
        "requires_human_review": {
            "type": "boolean",
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
You are ReviveAI's payment-failure diagnosis engine.

Analyze ONLY the transaction below.

TRANSACTION:
{json.dumps(transaction, default=str, indent=2)}

Allowed root causes:
payment_timeout
bank_decline
authentication_failure
insufficient_funds
payment_method_issue
customer_abandonment
technical_failure
repeated_payment_failure
unknown

Rules:
- Use only supplied transaction evidence.
- Never invent facts.
- Confidence must be between 0 and 1.
- Evidence must contain 1 to 5 concrete facts.
- Give a concise explanation.
- Set requires_human_review=true when evidence is weak,
  conflicting, or insufficient.
- Do not recommend a recovery action.
- Do not execute a payment.
- Do not modify the transaction.
- Do not expose private reasoning.

Return only the structured diagnosis.
"""


print()
print("Calling REAL OpenAI...")
print()


response = client.responses.create(
    model=AI_MODEL,
    input=prompt,
    text={
        "format": {
            "type": "json_schema",
            "name": "reviveai_root_cause",
            "strict": True,
            "schema": schema,
        },
    },
)


if not response.output_text:
    raise RuntimeError(
        "OpenAI returned empty output"
    )


diagnosis = json.loads(
    response.output_text
)


# --------------------------------------------------
# Validate
# --------------------------------------------------

if diagnosis["transaction_id"] != transaction["id"]:
    raise RuntimeError(
        "Validation failed: incorrect transaction ID"
    )

if not (
    0 <= diagnosis["confidence"] <= 1
):
    raise RuntimeError(
        "Validation failed: confidence"
    )

if not (
    1 <= len(diagnosis["evidence"]) <= 5
):
    raise RuntimeError(
        "Validation failed: evidence"
    )

if not diagnosis["reason"].strip():
    raise RuntimeError(
        "Validation failed: reason"
    )


print("✅ REAL OPENAI DIAGNOSIS RECEIVED")
print()


print("Root cause:")
print(
    diagnosis["root_cause"]
)

print()
print("Confidence:")
print(
    diagnosis["confidence"]
)

print()
print("Evidence:")

for item in diagnosis["evidence"]:
    print(
        "-",
        item,
    )

print()
print("Reason:")
print(
    diagnosis["reason"]
)

print()
print("Requires human review:")
print(
    diagnosis["requires_human_review"]
)


# --------------------------------------------------
# Store diagnosis
# --------------------------------------------------

stored = (
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
            "model": AI_MODEL,
        }
    )
    .execute()
)


if not stored.data:
    raise RuntimeError(
        "Diagnosis was not stored"
    )


print()
print("✅ DIAGNOSIS STORED")
print(
    "Diagnosis ID:",
    stored.data[0]["id"],
)


print()
print("=" * 60)
print("✅ PHASE 6 REAL AI CORE PASSED")
print("=" * 60)
print()