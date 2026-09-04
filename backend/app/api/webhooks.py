from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.webhook_service import webhook_service

router = APIRouter(prefix="/api/payments", tags=["Payment Gateways & Webhooks"])


@router.post("/razorpay/webhook")
async def handle_razorpay_webhook(
    request: Request,
    x_razorpay_signature: str | None = Header(None, alias="X-Razorpay-Signature"),
    db: Session = Depends(get_db),
):
    """
    Authoritative asynchronous webhook endpoint for Razorpay payment state transitions.
    Verifies raw body signature and executes idempotent order confirmation or AI recovery.
    """
    raw_body = await request.body()
    result = webhook_service.process_razorpay_webhook(
        raw_body=raw_body,
        signature=x_razorpay_signature,
        db=db,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Webhook processing error"))
    
    return result
