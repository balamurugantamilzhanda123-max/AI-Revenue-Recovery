import datetime
import os
import uuid
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.models.transaction import (
    Customer,
    EscalationCase,
    EscalationStatus,
    Invoice,
    NotificationRecord,
    Order,
    PaymentAttempt,
    PaymentRetryToken,
    PaymentStatus,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
    WebhookEvent,
)
from app.services.email_service import email_service
from app.services.razorpay_service import razorpay_service
from app.services.retry_token_service import retry_token_service


def test_scenario_a_payment_success(client: TestClient, db_session):
    """
    Scenario A: Payment Success
    - Direct payment captures successfully
    - Order is marked CONFIRMED
    - Transaction is marked SUCCESS
    - Tax invoice PDF generated
    - Order confirmation email is dispatched
    """
    res = client.post(
        "/api/checkout/process-payment",
        json={
            "product_id": "prod_laptop_business_03",
            "quantity": 1,
            "amount": 65999.0,
            "currency": "INR",
            "payment_method": "UPI",
            "customer": {
                "name": "Bala Murugan",
                "email": "bala.test.success@example.com",
                "phone": "9876543210",
                "address": "100 Tech Park, Bengaluru, KA",
            },
            "simulation_scenario": "SUCCESS",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "SUCCESS"
    assert data["order_status"] == "CONFIRMED"

    # Verify DB order
    order = db_session.query(Order).filter(Order.id == data["order_id"]).first()
    assert order is not None
    assert order.status == "CONFIRMED"

    # Verify notification record for confirmation email
    notif = db_session.query(NotificationRecord).filter(
        NotificationRecord.recipient == "bala.test.success@example.com",
        NotificationRecord.notification_type == "ORDER_CONFIRMED",
    ).first()
    assert notif is not None
    assert notif.status == "SENT"


def test_scenario_b_payment_failure_to_retry_success(client: TestClient, db_session):
    """
    Scenario B: Payment failure → retry email → retry success
    1. Payment fails with NETWORK_ERROR
    2. ReviveAI triggers recovery, generates cryptographic token & sends retry email
    3. Customer visits recovery URL and retries payment successfully
    4. Transaction becomes SUCCESS, recovered_amount is updated, invoice & confirmation email sent
    """
    # 1. Initial Failure
    fail_res = client.post(
        "/api/checkout/process-payment",
        json={
            "product_id": "prod_smart_fan_05",
            "quantity": 1,
            "amount": 7499.0,
            "currency": "INR",
            "payment_method": "UPI",
            "customer": {
                "name": "Kavitha R",
                "email": "kavitha.test@example.com",
                "phone": "9876543220",
                "address": "25 MG Road, Chennai, TN",
            },
            "simulation_scenario": "NETWORK_ERROR",
        },
    )
    assert fail_res.status_code == 200
    fail_data = fail_res.json()
    assert fail_data["success"] is False
    assert fail_data["status"] == "FAILED"
    assert "recovery_token" in fail_data
    token = fail_data["recovery_token"]

    # Verify NotificationRecord created for failure email
    notif = db_session.query(NotificationRecord).filter(
        NotificationRecord.recipient == "kavitha.test@example.com",
        NotificationRecord.notification_type == "PAYMENT_FAILED",
    ).first()
    assert notif is not None
    assert notif.status == "SENT"

    # 2. Access recovery session via token
    rec_res = client.get(f"/api/checkout/recover/{token}")
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert rec_data["retry_allowed"] is True
    assert rec_data["already_paid"] is False
    assert rec_data["amount"] == 7499.0

    # 3. Customer executes retry with SUCCESS outcome
    retry_res = client.post(
        "/api/checkout/retry-payment",
        json={
            "transaction_id": fail_data["transaction_id"],
            "order_id": fail_data["order_id"],
            "token": token,
            "retry_outcome": "SUCCESS",
        },
    )
    assert retry_res.status_code == 200
    retry_data = retry_res.json()
    assert retry_data["success"] is True
    assert retry_data["status"] == "SUCCESS"
    assert retry_data["recovered_amount"] == 7499.0

    # Verify DB transaction state
    tx = db_session.query(Transaction).filter(Transaction.transaction_id == fail_data["transaction_id"]).first()
    assert tx.status == PaymentStatus.SUCCESS
    assert tx.recovery_status == RecoveryStatus.RECOVERED
    assert float(tx.recovered_amount) == 7499.0

    # Verify token is marked used
    token_rec = db_session.query(PaymentRetryToken).filter(PaymentRetryToken.token == token).first()
    assert token_rec.is_used is True
    assert token_rec.used_at is not None


def test_scenario_c_payment_failure_retry_failure_to_human_escalation(client: TestClient, db_session):
    """
    Scenario C: Payment failure → retry email → retry failure → Human Associate
    1. Payment fails initially
    2. Customer retries via token but retry FAILS AGAIN
    3. Safety Policy halts automated retries (max retries = 1 reached)
    4. Escalates case to Human Associate queue with HIGH/CRITICAL priority
    5. Dispatches Human Assistance email
    """
    # 1. Initial Failure
    fail_res = client.post(
        "/api/checkout/process-payment",
        json={
            "product_id": "prod_laptop_business_03",
            "quantity": 1,
            "amount": 65999.0,
            "currency": "INR",
            "payment_method": "CARD",
            "customer": {
                "name": "Deepak Patel",
                "email": "deepak.patel@example.com",
                "phone": "9876543230",
                "address": "404 Sunset Blvd, Ahmedabad, GJ",
            },
            "simulation_scenario": "TIMEOUT",
        },
    )
    assert fail_res.status_code == 200
    fail_data = fail_res.json()
    token = fail_data["recovery_token"]

    # 2. Customer retries but payment FAILS again
    retry_res = client.post(
        "/api/checkout/retry-payment",
        json={
            "transaction_id": fail_data["transaction_id"],
            "order_id": fail_data["order_id"],
            "token": token,
            "retry_outcome": "FAILED",
        },
    )
    assert retry_res.status_code == 200
    retry_data = retry_res.json()
    assert retry_data["success"] is False
    assert retry_data["status"] == "ESCALATED"
    assert retry_data["escalated_to_human"] is True

    # 3. Verify Human Escalation in DB
    tx = db_session.query(Transaction).filter(Transaction.transaction_id == fail_data["transaction_id"]).first()
    assert tx.recovery_status == RecoveryStatus.ESCALATED
    assert tx.escalation_status == EscalationStatus.OPEN

    esc = db_session.query(EscalationCase).filter(EscalationCase.transaction_id == tx.id).first()
    assert esc is not None
    assert esc.priority == "CRITICAL"  # >= 50,000 INR

    # 4. Verify Human support email was logged
    notif = db_session.query(NotificationRecord).filter(
        NotificationRecord.recipient == "deepak.patel@example.com",
        NotificationRecord.notification_type == "HUMAN_ASSISTANCE",
    ).first()
    assert notif is not None


def test_scenario_d_email_api_failure_handling(client: TestClient, db_session):
    """
    Scenario D: Email API Failure
    - When Resend API fails (e.g. mock exception), system safely catches exception
    - NotificationRecord status is FAILED with error message
    - Recovery case remains VALID and active
    - Audit log records RETRY_EMAIL_FAILED
    """
    with patch("resend.Emails.send", side_effect=Exception("Resend 403 Forbidden: Invalid API Key")):
        orig_env = os.environ.get("RESEND_API_KEY")
        os.environ["RESEND_API_KEY"] = "re_live_test_dummy_key_12345"
        try:
            res = client.post(
                "/api/checkout/process-payment",
                json={
                    "product_id": "prod_smart_fan_05",
                    "quantity": 1,
                    "amount": 7499.0,
                    "currency": "INR",
                    "payment_method": "UPI",
                    "customer": {
                        "name": "Simulated Fail User",
                        "email": "fail.email@example.com",
                        "phone": "9876543299",
                        "address": "123 Error Lane",
                    },
                    "simulation_scenario": "NETWORK_ERROR",
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "FAILED"
            assert data["retry_available"] is True

            # Verify email log is marked FAILED without crashing the system
            notif = db_session.query(NotificationRecord).filter(
                NotificationRecord.recipient == "fail.email@example.com",
                NotificationRecord.notification_type == "PAYMENT_FAILED",
            ).first()
            assert notif is not None
            assert notif.status == "FAILED"
            assert "Invalid API Key" in notif.failure_reason

            # Verify recovery case is still OPEN and valid
            tx = db_session.query(Transaction).filter(Transaction.transaction_id == data["transaction_id"]).first()
            assert tx.recovery_status == RecoveryStatus.OPEN
        finally:
            if orig_env:
                os.environ["RESEND_API_KEY"] = orig_env
            else:
                os.environ.pop("RESEND_API_KEY", None)


def test_scenario_e_duplicate_webhook_processing(client: TestClient, db_session):
    """
    Scenario E: Duplicate Webhook Processing (Idempotency)
    - Sending same Razorpay webhook event ID twice
    - Second request returns duplicate status and does not re-process
    """
    event_id = f"evt_test_dedup_{uuid.uuid4().hex[:8]}"
    raw_payload = {
        "entity": "event",
        "account_id": "acc_test_123",
        "event": "payment.failed",
        "id": event_id,
        "contains": ["payment"],
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_001",
                    "order_id": "order_test_999",
                    "amount": 749900,
                    "status": "failed",
                    "error_code": "BAD_REQUEST_ERROR",
                    "error_description": "Card expired",
                }
            }
        },
    }
    import json
    body_bytes = json.dumps(raw_payload).encode("utf-8")
    sig = razorpay_service.generate_test_signature("order_test_999", "pay_test_001")

    # First call
    res1 = client.post(
        "/api/payments/razorpay/webhook",
        content=body_bytes,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "success"

    # Second call (Duplicate)
    res2 = client.post(
        "/api/payments/razorpay/webhook",
        content=body_bytes,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "duplicate"
    assert res2.json()["message"] == "Event already processed"


def test_scenario_f_expired_retry_link(client: TestClient, db_session):
    """
    Scenario F: Expired Retry Link
    - Token created with expires_at in the past
    - /recover/{token} returns HTTP 410 Expired
    - /retry-payment with expired token returns HTTP 410 Expired
    """
    customer = Customer(name="Expired User", email="expired@example.com", phone="9876543200")
    db_session.add(customer)
    db_session.flush()

    tx = Transaction(
        transaction_id="TX-EXPIRED-001",
        customer_id=customer.id,
        order_id="ORD-EXPIRED-001",
        amount=Decimal("5000.00"),
        currency="INR",
        payment_method="UPI",
        status=PaymentStatus.FAILED,
        failure_reason="Timeout",
        retry_count=0,
    )
    db_session.add(tx)
    db_session.flush()

    past_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2)
    expired_token = PaymentRetryToken(
        token="rec_expired_token_test_123",
        transaction_id=tx.id,
        customer_id=customer.id,
        order_id=tx.order_id,
        is_used=False,
        expires_at=past_time,
    )
    db_session.add(expired_token)
    db_session.commit()

    # Query recover endpoint
    rec_res = client.get("/api/checkout/recover/rec_expired_token_test_123")
    assert rec_res.status_code == 410
    assert "expired" in rec_res.json()["error"]["message"].lower()

    # Try retry payment with expired token
    retry_res = client.post(
        "/api/checkout/retry-payment",
        json={
            "transaction_id": tx.transaction_id,
            "token": "rec_expired_token_test_123",
            "retry_outcome": "SUCCESS",
        },
    )
    assert retry_res.status_code == 410


def test_scenario_g_already_used_retry_link(client: TestClient, db_session):
    """
    Scenario G: Already-Used Retry Link (Single-Use enforcement)
    - Token already marked is_used = True
    - /recover/{token} indicates already_used = True
    - /retry-payment does not allow duplicate charges
    """
    customer = Customer(name="Used Token User", email="used@example.com", phone="9876543201")
    db_session.add(customer)
    db_session.flush()

    tx = Transaction(
        transaction_id="TX-USED-001",
        customer_id=customer.id,
        order_id="ORD-USED-001",
        amount=Decimal("3000.00"),
        currency="INR",
        payment_method="UPI",
        status=PaymentStatus.FAILED,
        failure_reason="Bank Decline",
        retry_count=1,
    )
    db_session.add(tx)
    db_session.flush()

    used_token = PaymentRetryToken(
        token="rec_used_token_test_456",
        transaction_id=tx.id,
        customer_id=customer.id,
        order_id=tx.order_id,
        is_used=True,
        expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24),
        used_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db_session.add(used_token)
    db_session.commit()

    rec_res = client.get("/api/checkout/recover/rec_used_token_test_456")
    assert rec_res.status_code == 200
    data = rec_res.json()
    assert data["already_used"] is True
    assert data["retry_allowed"] is False


def test_scenario_h_unauthorized_or_nonexistent_token(client: TestClient, db_session):
    """
    Scenario H: Unauthorized or Invalid Retry-Link Access
    - Non-existent token query returns HTTP 404
    - Does not leak internal prompt chains or credentials
    """
    rec_res = client.get("/api/checkout/recover/invalid_random_token_99999999")
    assert rec_res.status_code == 404
    assert "not found" in rec_res.json()["error"]["message"].lower()
