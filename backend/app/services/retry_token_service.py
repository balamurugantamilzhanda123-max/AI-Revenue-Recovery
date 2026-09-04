import datetime
import logging
import secrets
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Customer,
    Order,
    PaymentRetryToken,
    PaymentStatus,
    RecoveryCase,
    Transaction,
)
from app.services.audit_service import record_audit_event

logger = logging.getLogger("reviveai.retry_token")


class RetryTokenService:
    def create_secure_retry_token(
        self,
        db: Session,
        *,
        transaction: Transaction,
        customer: Customer,
        order: Order | None = None,
        recovery_case: RecoveryCase | None = None,
        expiry_hours: int = 24,
    ) -> tuple[PaymentRetryToken, str]:
        """
        Generates a cryptographically secure, difficult-to-guess retry token with expiry.
        Links it to the exact transaction, customer, order, and recovery case.
        """
        # Idempotency check: check if an active, unused, unexpired token already exists
        now = datetime.datetime.now(datetime.timezone.utc)
        existing_token = db.scalar(
            select(PaymentRetryToken)
            .where(
                PaymentRetryToken.transaction_id == transaction.id,
                PaymentRetryToken.is_used == False,
                PaymentRetryToken.expires_at > now,
            )
            .order_by(PaymentRetryToken.created_at.desc())
        )

        app_base_url = (settings.app_url or "http://localhost:3000").rstrip("/")

        if existing_token:
            retry_link = f"{app_base_url}/payment/retry/{existing_token.token}"
            return existing_token, retry_link

        # Generate difficult-to-guess token
        raw_token = f"rec_{secrets.token_urlsafe(32)}"
        expires_at = now + datetime.timedelta(hours=expiry_hours)

        order_id_val = order.id if order else transaction.order_id

        token_record = PaymentRetryToken(
            token=raw_token,
            transaction_id=transaction.id,
            order_id=order_id_val,
            customer_id=customer.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            is_used=False,
            expires_at=expires_at,
        )
        db.add(token_record)
        
        # Also store token reference in transaction
        transaction.customer_response = raw_token
        db.flush()

        retry_link = f"{app_base_url}/payment/retry/{raw_token}"

        # Record Audit Event: RETRY_LINK_CREATED
        record_audit_event(
            db,
            event_type="RETRY_LINK_CREATED",
            event_message=f"Secure single-use retry payment link generated for Order {transaction.order_id}",
            actor="reviveai-executor",
            transaction_id=transaction.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={
                "order_id": transaction.order_id,
                "token_id": token_record.id,
                "expires_at": expires_at.isoformat(),
                "expiry_hours": expiry_hours,
                "retry_url": retry_link,
            },
        )

        return token_record, retry_link

    def validate_retry_token(
        self,
        db: Session,
        token_str: str,
    ) -> tuple[bool, str, PaymentRetryToken | None, Transaction | None]:
        """
        Validates the retry token state, expiry, single-use check, and payment status.
        Returns (is_valid, reason_code, token_record, transaction).
        Reason codes: 'VALID', 'NOT_FOUND', 'EXPIRED', 'ALREADY_USED', 'ALREADY_PAID'
        """
        now = datetime.datetime.now(datetime.timezone.utc)

        # 1. Search in PaymentRetryToken table
        token_rec = db.scalar(
            select(PaymentRetryToken).where(PaymentRetryToken.token == token_str)
        )

        if token_rec:
            txn = db.scalar(select(Transaction).where(Transaction.id == token_rec.transaction_id))
            if not txn:
                return False, "NOT_FOUND", token_rec, None

            if txn.status == PaymentStatus.SUCCESS:
                return False, "ALREADY_PAID", token_rec, txn

            if token_rec.is_used:
                return False, "ALREADY_USED", token_rec, txn

            # Check timezone awareness for expiry
            token_expires = token_rec.expires_at
            if token_expires.tzinfo is None:
                token_expires = token_expires.replace(tzinfo=datetime.timezone.utc)

            if token_expires < now:
                return False, "EXPIRED", token_rec, txn

            return True, "VALID", token_rec, txn

        # 2. Fallback check for backward compatibility or demo tokens
        txn = db.scalar(
            select(Transaction).where(
                (Transaction.customer_response == token_str)
                | (Transaction.transaction_id == token_str)
                | (Transaction.order_id == token_str)
            )
        )
        if not txn:
            return False, "NOT_FOUND", None, None

        if txn.status == PaymentStatus.SUCCESS:
            return False, "ALREADY_PAID", None, txn

        if txn.retry_count >= 1:
            return False, "ALREADY_USED", None, txn

        return True, "VALID", None, txn

    def mark_token_used(self, db: Session, token_str: str) -> None:
        """
        Marks the retry token as consumed/used.
        """
        token_rec = db.scalar(
            select(PaymentRetryToken).where(PaymentRetryToken.token == token_str)
        )
        if token_rec:
            token_rec.is_used = True
            token_rec.used_at = datetime.datetime.now(datetime.timezone.utc)
            db.flush()


retry_token_service = RetryTokenService()
