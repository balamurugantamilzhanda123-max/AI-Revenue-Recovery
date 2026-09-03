from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.services.diagnosis_service import diagnose_and_store


router = APIRouter(
    prefix="/agent",
    tags=["AI Agent"],
)


@router.post("/diagnose/{transaction_id}")
def diagnose_transaction_endpoint(
    transaction_id: str,
    current_user=Depends(get_current_user),
):
    try:
        result = diagnose_and_store(
            transaction_id
        )

        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    except Exception as exc:
        print(
            "Diagnosis API error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Diagnosis failed",
        )