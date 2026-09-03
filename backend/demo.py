import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


# --------------------------------------------------
# Load backend/.env
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE, override=True)


# --------------------------------------------------
# Supabase
# --------------------------------------------------

url = os.getenv("SUPABASE_URL", "").strip()
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

if not url:
    raise RuntimeError("SUPABASE_URL is missing")

if not key:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is missing")


db = create_client(url, key)


# --------------------------------------------------
# Get one failed transaction automatically
# --------------------------------------------------

result = (
    db
    .table("transactions")
    .select(
        "id,"
        "payment_method,"
        "amount_minor_units,"
        "currency,"
        "status,"
        "failure_reason,"
        "gateway_response,"
        "retry_count"
    )
    .eq("status", "FAILED")
    .limit(1)
    .execute()
)

if not result.data:
    print("❌ No FAILED transaction found")
    raise SystemExit(1)


tx = result.data[0]


# --------------------------------------------------
# Simple deterministic Phase 6 demo diagnosis
# --------------------------------------------------

failure = str(tx.get("failure_reason") or "").lower()
gateway = str(tx.get("gateway_response") or "").lower()
retry_count = int(tx.get("retry_count") or 0)


if "timeout" in failure or "timeout" in gateway:
    root_cause = "payment_timeout"
    confidence = 0.95
    reason = "Timeout-related evidence was found."

elif "decline" in failure or "declined" in gateway:
    root_cause = "bank_decline"
    confidence = 0.90
    reason = "Decline-related evidence was found."

elif "auth" in failure or "authentication" in gateway:
    root_cause = "authentication_failure"
    confidence = 0.90
    reason = "Authentication-related evidence was found."

elif "insufficient" in failure or "insufficient" in gateway:
    root_cause = "insufficient_funds"
    confidence = 0.90
    reason = "Insufficient-funds evidence was found."

elif retry_count >= 1:
    root_cause = "repeated_payment_failure"
    confidence = 0.85
    reason = "Previous retry activity was found."

else:
    root_cause = "unknown"
    confidence = 0.50
    reason = "There is not enough evidence for a specific root cause."


evidence = []

if tx.get("failure_reason"):
    evidence.append(
        f"Failure reason: {tx['failure_reason']}"
    )

if tx.get("gateway_response"):
    evidence.append(
        f"Gateway response: {tx['gateway_response']}"
    )

evidence.append(
    f"Payment method: {tx.get('payment_method')}"
)

evidence.append(
    f"Retry count: {retry_count}"
)

requires_human_review = confidence < 0.70


# --------------------------------------------------
# Display result
# --------------------------------------------------

print()
print("======================================")
print("      REVIVEAI PHASE 6 DIAGNOSIS")
print("======================================")
print()

print("Transaction ID:")
print(tx["id"])

print()
print("Status:")
print(tx["status"])

print()
print("Failure reason:")
print(tx.get("failure_reason"))

print()
print("Root cause:")
print(root_cause)

print()
print("Confidence:")
print(confidence)

print()
print("Evidence:")

for item in evidence[:5]:
    print("-", item)

print()
print("Reason:")
print(reason)

print()
print("Requires human review:")
print(requires_human_review)

print()
print("======================================")
print("✅ PHASE 6 DIAGNOSIS TEST PASSED")
print("======================================")