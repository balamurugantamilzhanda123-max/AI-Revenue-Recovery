import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

from app.schemas.diagnosis import RootCauseDiagnosis


# -------------------------------------------------
# Environment
# -------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE, override=True)


# -------------------------------------------------
# Supabase
# -------------------------------------------------

def get_transaction_context(
    transaction_id: str,
) -> dict[str, Any]:
    # 1. Try SQLAlchemy database (local / configured DB)
    try:
        from app.database import SessionLocal
        from app.models.transaction import Transaction

        with SessionLocal() as session:
            txn = (
                session.query(Transaction)
                .filter(
                    (Transaction.transaction_id == transaction_id)
                    | (Transaction.id == transaction_id)
                )
                .first()
            )
            if txn is not None:
                return {
                    "id": txn.transaction_id or str(txn.id),
                    "transaction_id": txn.transaction_id,
                    "customer_id": str(txn.customer_id),
                    "payment_method": txn.payment_method,
                    "amount": float(txn.amount) if txn.amount is not None else 0.0,
                    "currency": txn.currency,
                    "status": txn.status.value if hasattr(txn.status, "value") else str(txn.status),
                    "failure_reason": txn.failure_reason,
                    "gateway_response": txn.gateway_response,
                    "retry_count": int(txn.retry_count or 0),
                    "created_at": str(txn.created_at),
                }
    except Exception:
        pass

    # 2. Try Supabase if configured
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if url and key:
        try:
            import uuid
            db = create_client(url, key)
            query = db.table("transactions").select("*")
            try:
                uuid.UUID(str(transaction_id))
                result = query.or_(f"id.eq.{transaction_id},transaction_id.eq.{transaction_id}").limit(1).execute()
            except ValueError:
                result = query.eq("transaction_id", transaction_id).limit(1).execute()

            if result.data:
                row = result.data[0]
                if "id" not in row or not row["id"]:
                    row["id"] = transaction_id
                return row
        except Exception:
            pass

    raise ValueError(f"Transaction not found: {transaction_id}")



# -------------------------------------------------
# Demo diagnosis
# -------------------------------------------------

def _mock_diagnosis(
    transaction: dict[str, Any],
) -> RootCauseDiagnosis:

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
            "Timeout-related evidence was found "
            "in the transaction."
        )

    elif (
        "decline" in failure
        or "declined" in gateway
    ):
        root_cause = "bank_decline"
        confidence = 0.90
        reason = (
            "Decline-related evidence was found "
            "in the transaction."
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
            "There is not enough evidence for a "
            "specific root cause."
        )

    evidence = []

    if transaction.get("failure_reason"):
        evidence.append(
            "Failure reason: "
            + str(transaction["failure_reason"])
        )

    if transaction.get("gateway_response"):
        evidence.append(
            "Gateway response: "
            + str(transaction["gateway_response"])
        )

    evidence.append(
        "Payment method: "
        + str(transaction.get("payment_method"))
    )

    evidence.append(
        "Retry count: "
        + str(retry_count)
    )

    return RootCauseDiagnosis(
        transaction_id=str(transaction["id"]),
        root_cause=root_cause,
        confidence=confidence,
        evidence=evidence[:5],
        reason=reason,
        requires_human_review=(
            confidence < 0.70
        ),
    )


# -------------------------------------------------
# Real OpenAI diagnosis
# -------------------------------------------------

def _real_ai_diagnosis(
    transaction: dict[str, Any],
) -> RootCauseDiagnosis:

    api_key = os.getenv(
        "AI_API_KEY",
        "",
    ).strip()

    if not api_key:
        raise RuntimeError(
            "AI_API_KEY is missing"
        )

    client = OpenAI(
        api_key=api_key
    )

    model = os.getenv(
        "AI_MODEL",
        "gpt-4.1-mini",
    ).strip()

    prompt = f"""
You are ReviveAI's payment-failure diagnosis engine.

Analyze only the supplied transaction evidence.

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

Return JSON only:

{{
  "transaction_id": "{transaction['id']}",
  "root_cause": "unknown",
  "confidence": 0.0,
  "evidence": ["evidence"],
  "reason": "short explanation",
  "requires_human_review": true
}}

Do not invent facts.
Do not recommend recovery actions.
Do not perform payment actions.

Transaction:
{json.dumps(transaction, default=str, indent=2)}
""".strip()

    response = client.chat.completions.create(
        model=model,
        temperature=0,
        response_format={
            "type": "json_object"
        },
        messages=[
            {
                "role": "system",
                "content": (
                    "Return valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
    )

    content = response.choices[0].message.content

    if not content:
        raise RuntimeError(
            "OpenAI returned an empty response"
        )

    data = json.loads(content)

    diagnosis = RootCauseDiagnosis.model_validate(
        data
    )

    if diagnosis.transaction_id != str(
        transaction["id"]
    ):
        raise ValueError(
            "AI returned incorrect transaction ID"
        )

    return diagnosis


# -------------------------------------------------
# REQUIRED FUNCTION
# -------------------------------------------------

def diagnose_transaction(
    transaction_id: str,
) -> RootCauseDiagnosis:

    transaction = get_transaction_context(
        transaction_id
    )

    mock_mode = (
        os.getenv(
            "AI_MOCK_MODE",
            "true",
        ).strip().lower()
        == "true"
    )

    if mock_mode:
        return _mock_diagnosis(transaction)

    try:
        return _real_ai_diagnosis(transaction)
    except Exception as exc:
        print(f"[ReviveAI Agent] External AI diagnosis unavailable ({repr(exc)}). Using resilient deterministic diagnosis fallback.")
        return _mock_diagnosis(transaction)

