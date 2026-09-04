import hashlib
import hmac
import logging
import uuid
from decimal import Decimal
from typing import Any

from app.config import settings

logger = logging.getLogger("reviveai.razorpay")

try:
    import razorpay
    _RAZORPAY_AVAILABLE = True
except ImportError:
    razorpay = None
    _RAZORPAY_AVAILABLE = False


class RazorpayService:
    def __init__(self) -> None:
        self.key_id = settings.razorpay_key_id or "rzp_test_voltstore_mock"
        self.key_secret = settings.razorpay_key_secret or "voltstore_secret_mock_key"
        self.webhook_secret = settings.razorpay_webhook_secret or "voltstore_webhook_secret_mock"
        self.client = None
        
        if _RAZORPAY_AVAILABLE and self.key_id and self.key_secret and not self.key_id.endswith("_mock"):
            try:
                self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
            except Exception as e:
                logger.warning(f"Could not initialize Razorpay client SDK: {e}")

    def create_order(
        self,
        amount_rupees: Decimal | float,
        currency: str = "INR",
        receipt: str | None = None,
        notes: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Creates a Razorpay Order server-side.
        Amount is converted to paise (1 INR = 100 paise).
        """
        amount_paise = int(round(float(amount_rupees) * 100))
        receipt_id = receipt or f"rcpt_{uuid.uuid4().hex[:12]}"
        notes_payload = notes or {}

        # If live/test Razorpay client is initialized, call gateway API
        if self.client:
            try:
                order_data = {
                    "amount": amount_paise,
                    "currency": currency.upper(),
                    "receipt": receipt_id,
                    "notes": notes_payload,
                    "payment_capture": 1,
                }
                response = self.client.order.create(data=order_data)
                logger.info(f"Razorpay order created via SDK: {response.get('id')}")
                return {
                    "id": response.get("id"),
                    "entity": "order",
                    "amount": response.get("amount", amount_paise),
                    "amount_paid": response.get("amount_paid", 0),
                    "amount_due": response.get("amount_due", amount_paise),
                    "currency": response.get("currency", currency),
                    "receipt": receipt_id,
                    "status": response.get("status", "created"),
                    "key_id": self.key_id,
                }
            except Exception as e:
                logger.error(f"Error calling Razorpay API: {e}. Falling back to test gateway.")

        # Fallback / Local Sandbox Order Generation
        generated_order_id = f"order_{uuid.uuid4().hex[:16]}"
        return {
            "id": generated_order_id,
            "entity": "order",
            "amount": amount_paise,
            "amount_paid": 0,
            "amount_due": amount_paise,
            "currency": currency.upper(),
            "receipt": receipt_id,
            "status": "created",
            "key_id": self.key_id,
            "notes": notes_payload,
        }

    def verify_payment_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> bool:
        """
        Cryptographically verifies the payment signature returned by Razorpay Checkout.
        Uses HMAC SHA256 of `order_id|payment_id` against key_secret.
        """
        if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
            return False

        # If Razorpay client SDK is active
        if self.client:
            try:
                self.client.utility.verify_payment_signature({
                    "razorpay_order_id": razorpay_order_id,
                    "razorpay_payment_id": razorpay_payment_id,
                    "razorpay_signature": razorpay_signature,
                })
                return True
            except Exception as e:
                logger.warning(f"Razorpay SDK signature verification failed: {e}")

        # Standard HMAC SHA256 verification
        try:
            msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
            secret = self.key_secret.encode("utf-8")
            expected_signature = hmac.new(secret, msg, hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected_signature, razorpay_signature)
        except Exception as e:
            logger.error(f"Signature verification error: {e}")
            return False

    def generate_test_signature(self, order_id: str, payment_id: str) -> str:
        """
        Generates a valid HMAC SHA256 signature for test cases and sandboxes.
        """
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        secret = self.key_secret.encode("utf-8")
        return hmac.new(secret, msg, hashlib.sha256).hexdigest()

    def verify_webhook_signature(self, raw_body: bytes | str, signature: str) -> bool:
        """
        Verifies Razorpay Webhook signature using the raw request body.
        """
        if not signature:
            return False
        
        body_bytes = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
        secret_bytes = self.webhook_secret.encode("utf-8")
        
        try:
            expected_signature = hmac.new(secret_bytes, body_bytes, hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected_signature, signature)
        except Exception as e:
            logger.error(f"Webhook signature verification error: {e}")
            return False


razorpay_service = RazorpayService()
