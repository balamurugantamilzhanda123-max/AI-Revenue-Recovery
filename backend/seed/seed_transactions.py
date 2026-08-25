"""
Seed 500 realistic synthetic transactions for ReviveAI.

Usage:
    cd backend
    python seed/seed_transactions.py

Requires DATABASE_URL to be set in backend/.env (see .env.example).
Idempotent: uses external_event_id as a unique key, so re-running
this script will not create duplicate rows.
"""
import os
import random
import uuid
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
import psycopg

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set. Copy .env.example to .env and fill it in.")
    sys.exit(1)

PAYMENT_METHODS = ["UPI", "CARD", "NETBANKING", "WALLET"]
FAILURE_REASONS = [
    "payment_timeout",
    "insufficient_funds",
    "card_declined",
    "authentication_failed",
    "gateway_error",
    "network_error",
]
GATEWAY_RESPONSES = {
    "payment_timeout": "timeout",
    "insufficient_funds": "insufficient_funds",
    "card_declined": "do_not_honor",
    "authentication_failed": "3ds_failed",
    "gateway_error": "internal_error",
    "network_error": "connection_reset",
}

FIRST_NAMES = ["Arjun", "Priya", "Vikram", "Ananya", "Rahul", "Sneha", "Karthik",
               "Divya", "Suresh", "Meera", "Ravi", "Kavya", "Arun", "Pooja", "Manoj"]
LAST_NAMES = ["Kumar", "Sharma", "Reddy", "Iyer", "Nair", "Gupta", "Rao", "Patel",
              "Menon", "Pillai", "Krishnan", "Verma"]


def random_customer():
    name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    cust_id = f"CUST-{uuid.uuid4().hex[:8].upper()}"
    return cust_id, name


def build_transaction(i: int):
    ext_event_id = f"EVT-SEED-{i:04d}"
    customer_id, customer_name = random_customer()
    amount = random.choice([19900, 29900, 49900, 99900, 149900, 599900, 249900])  # minor units (paise)
    method = random.choice(PAYMENT_METHODS)
    created_at = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 29),
                                                          hours=random.randint(0, 23))

    # Weighted outcome distribution: ~55% success, ~35% failed, ~10% pending/abandoned
    roll = random.random()
    if roll < 0.55:
        status = "SUCCESS"
        failure_reason = None
        gateway_response = "success"
        retry_count = 0
    elif roll < 0.90:
        status = "FAILED"
        failure_reason = random.choice(FAILURE_REASONS)
        gateway_response = GATEWAY_RESPONSES[failure_reason]
        retry_count = random.choice([0, 0, 0, 1])  # most are first-time failures
    elif roll < 0.97:
        status = "PENDING"
        failure_reason = None
        gateway_response = "pending"
        retry_count = 0
    else:
        status = "ABANDONED"
        failure_reason = "customer_abandoned"
        gateway_response = "abandoned"
        retry_count = 0

    return {
        "external_event_id": ext_event_id,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "payment_method": method,
        "amount_minor_units": amount,
        "status": status,
        "failure_reason": failure_reason,
        "gateway_response": gateway_response,
        "retry_count": retry_count,
        "created_at": created_at,
    }


# Guarantee at least one clean demo-ready failed transaction matching
# the exact numbers used in the pitch demo script (Section 18):
# TX-DEMO-001, amount = 5999.00 INR, payment_timeout, UPI, no retries yet.
DEMO_TRANSACTION = {
    "external_event_id": "EVT-DEMO-001",
    "customer_id": "CUST-DEMO001",
    "customer_name": "Demo Customer",
    "payment_method": "UPI",
    "amount_minor_units": 599900,
    "status": "FAILED",
    "failure_reason": "payment_timeout",
    "gateway_response": "timeout",
    "retry_count": 0,
    "created_at": datetime.now(timezone.utc) - timedelta(hours=2),
}


def main():
    rows = [DEMO_TRANSACTION] + [build_transaction(i) for i in range(1, 500)]

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            inserted = 0
            for row in rows:
                cur.execute(
                    """
                    insert into transactions (
                        external_event_id, customer_id, customer_name,
                        payment_method, amount_minor_units, status,
                        failure_reason, gateway_response, retry_count, created_at
                    ) values (
                        %(external_event_id)s, %(customer_id)s, %(customer_name)s,
                        %(payment_method)s, %(amount_minor_units)s, %(status)s,
                        %(failure_reason)s, %(gateway_response)s, %(retry_count)s, %(created_at)s
                    )
                    on conflict (external_event_id) do nothing
                    """,
                    row,
                )
                inserted += cur.rowcount
            conn.commit()
            print(f"Seed complete. {inserted} new transactions inserted (of {len(rows)} attempted).")


if __name__ == "__main__":
    main()
