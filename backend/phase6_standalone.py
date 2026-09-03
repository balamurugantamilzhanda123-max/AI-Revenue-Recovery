import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from phase6_real import (
    get_supabase,
    get_transaction,
    diagnose,
    store_diagnosis,
)


load_dotenv()


app = FastAPI(
    title="ReviveAI Phase 6",
    version="1.0.0",
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "phase": 6,
    }


@app.post("/agent/diagnose/{transaction_id}")
def diagnose_endpoint(
    transaction_id: str,
):

    try:
        db = get_supabase()

        # Reuse the Supabase lookup but enforce
        # the requested transaction ID.
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
            .eq("id", transaction_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found",
            )

        transaction = result.data[0]

        diagnosis = diagnose(
            transaction
        )

        stored = store_diagnosis(
            db,
            diagnosis,
        )

        return {
            "diagnosis": diagnosis,
            "stored": stored,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "Phase 6 API error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )