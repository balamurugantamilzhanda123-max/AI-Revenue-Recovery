import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Transaction, PaymentStatus, RecoveryStatus, EscalationCase, EscalationStatus

client = TestClient(app)


def test_electrical_products_catalog():
    """Verify products list endpoint returns realistic electrical items."""
    res = client.get("/api/checkout/products")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) >= 20
    # Check specific products exist
    names = [p["name"] for p in data]
    assert any("LED Bulb" in n for n in names)
    assert any("Ceiling Fan" in n for n in names)
    assert any("Inverter" in n for n in names)
    assert any("Mixer Grinder" in n for n in names)


def test_scenario_1_network_error_to_ai_recovery_success():
    """
    Scenario 1: Customer buys Ceiling Fan -> Network Error ->
    Automatic recovery link generated -> Customer retries -> Success!
    """
    # 1. Initiate Checkout
    init_res = client.post(
        "/api/checkout/initiate",
        json={
            "product_id": "prod_smart_fan_05",
            "quantity": 1,
            "customer": {
                "name": "Arun Demo",
                "email": "arun.demo@example.com",
                "phone": "+91 98765 00001",
                "address": "12 Richmond Road, Bengaluru",
            },
        },
    )
    assert init_res.status_code == 200
    order_data = init_res.json()
    order_id = order_data["order_id"]
    tx_id = order_data["transaction_id"]

    # 2. Process Payment with NETWORK_ERROR simulation
    pay_res = client.post(
        "/api/checkout/process-payment",
        json={
            "order_id": order_id,
            "transaction_id": tx_id,
            "product_id": "prod_smart_fan_05",
            "quantity": 1,
            "amount": 7499.00,
            "currency": "INR",
            "payment_method": "UPI",
            "customer": {
                "name": "Arun Demo",
                "email": "arun.demo@example.com",
            },
            "simulation_scenario": "NETWORK_ERROR",
        },
    )
    assert pay_res.status_code == 200
    pay_data = pay_res.json()
    assert pay_data["success"] is False
    assert pay_data["status"] == "FAILED"
    recovery_token = pay_data["recovery_token"]
    assert recovery_token is not None

    # 3. Check Seller Dashboard reflects Network Error and Revenue at Risk
    seller_dash = client.get("/api/seller/dashboard").json()
    assert seller_dash["network_errors"] >= 1
    assert seller_dash["revenue_at_risk"] >= 7499.00

    # 4. Customer accesses dynamic Recovery Session Page
    rec_page_res = client.get(f"/api/checkout/recover/{recovery_token}")
    assert rec_page_res.status_code == 200
    rec_page_data = rec_page_res.json()
    assert rec_page_data["order_id"] == order_id
    assert rec_page_data["amount"] == 7499.00
    assert rec_page_data["retry_allowed"] is True

    # 5. Customer retries payment with SUCCESS outcome
    retry_res = client.post(
        "/api/checkout/retry-payment",
        json={
            "transaction_id": tx_id,
            "order_id": order_id,
            "token": recovery_token,
            "retry_outcome": "SUCCESS",
        },
    )
    assert retry_res.status_code == 200
    retry_data = retry_res.json()
    assert retry_data["success"] is True
    assert retry_data["status"] == "SUCCESS"
    assert retry_data["recovered_amount"] == 7499.00

    # 6. Verify Seller Dashboard updated AI Recovered Revenue
    updated_dash = client.get("/api/seller/dashboard").json()
    assert updated_dash["ai_recovered_revenue"] >= 7499.00


def test_scenario_2_retry_failure_to_human_associate_resolution():
    """
    Scenario 2: Customer buys Inverter (₹24,999) -> Payment fails ->
    Customer retries via recovery link -> Retry fails AGAIN ->
    System stops automated recovery & escalates to Human Associate ->
    Human contacts customer & sends link -> Customer pays -> Resolved!
    """
    # 1. Process initial failure for Inverter
    pay_res = client.post(
        "/api/checkout/process-payment",
        json={
            "product_id": "prod_inverter_21",
            "quantity": 1,
            "amount": 24999.00,
            "currency": "INR",
            "payment_method": "CARD",
            "customer": {
                "name": "Rahul Demo",
                "email": "rahul.demo@example.com",
            },
            "simulation_scenario": "TIMEOUT",
        },
    )
    pay_data = pay_res.json()
    order_id = pay_data["order_id"]
    tx_id = pay_data["transaction_id"]
    token = pay_data["recovery_token"]

    # 2. Customer retries via recovery link but fails AGAIN (Attempt 2 FAILED)
    retry_fail_res = client.post(
        "/api/checkout/retry-payment",
        json={
            "transaction_id": tx_id,
            "order_id": order_id,
            "token": token,
            "retry_outcome": "FAILED",
        },
    )
    assert retry_fail_res.status_code == 200
    retry_fail_data = retry_fail_res.json()
    assert retry_fail_data["success"] is False
    assert retry_fail_data["escalated_to_human"] is True

    # 3. Check Human Associate Queue receives case
    human_cases_res = client.get("/api/human-associate/cases")
    assert human_cases_res.status_code == 200
    human_cases = human_cases_res.json()
    matched_case = next((c for c in human_cases if c["order_id"] == order_id), None)
    assert matched_case is not None
    case_id = matched_case["case_id"]
    assert matched_case["amount"] == 24999.00
    assert matched_case["priority"] in {"HIGH", "CRITICAL"}

    # 4. Human Associate logs customer contact
    contact_res = client.post(
        f"/api/human-associate/cases/{case_id}/contact",
        json={
            "channel": "PHONE",
            "notes": "Spoke to Rahul. Explained bank gateway timeout, offered UPI payment link.",
            "agent_name": "Priya Sharma (Human Associate)",
        },
    )
    assert contact_res.status_code == 200

    # 5. Human Associate sends approved payment link
    link_res = client.post(
        f"/api/human-associate/cases/{case_id}/send-link",
        json={
            "custom_message": "Hi Rahul, please complete payment for your Inverter order using this link.",
            "discount_percent": 0.0,
            "agent_name": "Priya Sharma (Human Associate)",
        },
    )
    assert link_res.status_code == 200

    # 6. Customer completes payment through human assistance
    complete_res = client.post(
        f"/api/human-associate/cases/{case_id}/complete-payment",
        json={"notes": "Customer successfully authorized payment via assisted link."},
    )
    assert complete_res.status_code == 200
    complete_data = complete_res.json()
    assert complete_data["success"] is True
    assert complete_data["status"] == "RESOLVED"
    assert complete_data["recovered_amount"] == 24999.00

    # 7. Check Seller Dashboard reflects Human Recovered Revenue
    seller_dash = client.get("/api/seller/dashboard").json()
    assert seller_dash["human_recovered_revenue"] >= 24999.00


def test_scenario_3_checkout_abandonment_recovery():
    """
    Scenario 3: Customer adds Mixer Grinder (₹6,999) -> Reaches payment ->
    Leaves without paying -> System detects abandonment -> Sends continuation link ->
    Customer returns & completes payment.
    """
    # 1. Record checkout abandonment
    abn_res = client.post(
        "/api/checkout/abandon",
        json={
            "product_id": "prod_mixer_grinder_09",
            "quantity": 1,
            "amount": 6999.00,
            "currency": "INR",
            "last_stage": "PAYMENT_METHOD_SELECTION",
            "customer": {
                "name": "Priya Demo",
                "email": "priya.demo@example.com",
            },
        },
    )
    assert abn_res.status_code == 200
    abn_data = abn_res.json()
    assert abn_data["status"] == "CHECKOUT_ABANDONED"
    assert abn_data["revenue_at_risk"] == 6999.00
    token = abn_data["recovery_token"]
    tx_id = abn_data["transaction_id"]
    order_id = abn_data["order_id"]

    # 2. Check Seller Dashboard counts checkout abandonment
    seller_dash = client.get("/api/seller/dashboard").json()
    assert seller_dash["checkout_abandonments"] >= 1

    # 3. Customer returns via recovery link and completes payment
    retry_res = client.post(
        "/api/checkout/retry-payment",
        json={
            "transaction_id": tx_id,
            "order_id": order_id,
            "token": token,
            "retry_outcome": "SUCCESS",
        },
    )
    assert retry_res.status_code == 200
    assert retry_res.json()["success"] is True
    assert retry_res.json()["recovered_amount"] == 6999.00
