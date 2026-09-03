import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

from app.schemas.diagnosis import RootCauseDiagnosis


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE, override=True)


TRANSACTION_COLUMNS = (
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


def _get_supabase():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not url:
        raise RuntimeError("SUPABASE_URL is missing")

    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is missing"
        )

    return create_client(url, key)


def get_transaction_context(
    transaction_id: str,
) -> dict[str, Any]:

    db = _get_supabase()

    result = (
        db.table("transactions")
        .select(TRANSACTION_COLUMNS)
        .eq("id", transaction_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise ValueError(
            f"Transaction not found: {transaction_id}"
        )

    return result.data[0]


def _get_openai_client() -> OpenAI:

    api_key = os.getenv(
        "AI_API_KEY",
        "",
    ).strip()

    if not api_key:
        raise RuntimeError(
            "AI_API_KEY is missing from backend/.env"
        )

    return OpenAI(api_key=api_key)


def diagnose_transaction(
    transaction_id: str,
) -> RootCauseDiagnosis:

    transaction = get_transaction_context(
        transaction_id
    )

    client = _get_openai_client()

    model = os.getenv(
        "AI_MODEL",
        "gpt-4.1-mini",
    ).strip()

    prompt = f"""
You are ReviveAI's payment-failure diagnosis engine.

Analyze ONLY the transaction evidence below.

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
- Use only supplied evidence.
- Never invent missing information.
- Confidence must be between 0 and 1.
- Give 1 to 5 evidence items.
- Give a concise reason.
- Use requires_human_review=true when evidence is weak,
  conflicting, or insufficient.
- Do not recommend a recovery action.
- Do not execute a payment.
- Do not modify the transaction.

Return JSON with exactly these fields:

{{
  "transaction_id": "{transaction_id}",
  "root_cause": "unknown",
  "confidence": 0.0,
  "evidence": ["evidence"],
  "reason": "short explanation",
  "requires_human_review": true
}}

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
                    "Return only valid JSON for a "
                    "payment-failure diagnosis."
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

    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "OpenAI returned invalid JSON"
        ) from exc

    diagnosis = RootCauseDiagnosis.model_validate(
        data
    )

    if diagnosis.transaction_id != transaction_id:
        raise ValueError(
            "AI returned an incorrect transaction ID"
        )

    return diagnosiss