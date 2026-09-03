import json
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


# --------------------------------------------------
# Load environment
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE, override=True)


# --------------------------------------------------
# Check configuration
# --------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
).strip()

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing")

if not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY is missing"
    )


# --------------------------------------------------
# Supabase client
# --------------------------------------------------

db = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
)


# --------------------------------------------------
# Get one FAILED transaction
# Uses ONLY columns you verified exist
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
    .eq("status", "FAILED")
    .limit(1)
    .execute()
)

if not result.data:
    raise RuntimeError(
        "No FAILED transaction was found"
    )

transaction = result.data[0]


# --------------------------------------------------
# Deterministic Phase 6 diagnosis
# --------------------------------------------------

failure = str(
    transaction.get("failure_reason") or ""
).lower()

gateway = str(
    transaction.get("gateway_response") or ""
).lower()

retry_count = int(
    transaction.get("retry_count") or 0
)


if "timeout" in failure or "timeout" in gateway:

    root_cause = "payment_timeout"
    confidence = 0.95
    reason = (
        "Timeout evidence was found in the transaction."
    )

elif (
    "decline" in failure
    or "declined" in gateway
):

    root_cause = "bank_decline"
    confidence = 0.90
    reason = (
        "Decline evidence was found in the transaction."
    )

elif (
    "auth" in failure
    or "authentication" in gateway
):

    root_cause = "authentication_failure"
    confidence = 0.90
    reason = (
        "Authentication-related evidence was found."
    )

elif (
    "insufficient" in failure
    or "insufficient" in gateway
):

    root_cause = "insufficient_funds"
    confidence = 0.90
    reason = (
        "Insufficient-funds evidence was found."
    )

elif retry_count >= 1:

    root_cause = "repeated_payment_failure"
    confidence = 0.85
    reason = (
        "Previous retry activity was found."
    )

else:

    root_cause = "unknown"
    confidence = 0.50
    reason = (
        "There is not enough evidence to determine "
        "a specific root cause."
    )


evidence = []

if transaction.get("failure_reason"):
    evidence.append(
        f"Failure reason: "
        f"{transaction['failure_reason']}"
    )

if transaction.get("gateway_response"):
    evidence.append(
        f"Gateway response: "
        f"{transaction['gateway_response']}"
    )

evidence.append(
    f"Payment method: "
    f"{transaction.get('payment_method')}"
)

evidence.append(
    f"Retry count: {retry_count}"
)

evidence = evidence[:5]

requires_human_review = confidence < 0.70


diagnosis = {
    "transaction_id": str(transaction["id"]),
    "root_cause": root_cause,
    "confidence": confidence,
    "evidence": evidence,
    "reason": reason,
    "requires_human_review": requires_human_review,
}


# --------------------------------------------------
# Store diagnosis
# --------------------------------------------------

stored = (
    db
    .table("transaction_diagnoses")
    .insert(
        {
            "transaction_id": diagnosis["transaction_id"],
            "root_cause": diagnosis["root_cause"],
            "confidence": diagnosis["confidence"],
            "evidence": diagnosis["evidence"],
            "reason": diagnosis["reason"],
            "requires_human_review": diagnosis[
                "requires_human_review"
            ],
            "model": "phase6-demo",
        }
    )
    .execute()
)

if not stored.data:
    raise RuntimeError(
        "Diagnosis was not stored"
    )


# --------------------------------------------------
# Final output
# --------------------------------------------------

print()
print("=" * 50)
print("           REVIVEAI PHASE 6")
print("=" * 50)

print()
print("Transaction ID:")
print(diagnosis["transaction_id"])

print()
print("Status:")
print(transaction["status"])

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
print("Requires human review:")
print(diagnosis["requires_human_review"])

print()
print("Stored diagnosis ID:")
print(stored.data[0]["id"])

print()
print("=" * 50)
print("✅ PHASE 6 STANDALONE TEST PASSED")
print("=" * 50)
print()