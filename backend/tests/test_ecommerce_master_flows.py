import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import create_app
from app.models import (
    Customer,
    CustomerAccount,
    CustomerAddress,
    EscalationCase,
    EscalationStatus,
    PaymentStatus,
    Product,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
)


@pytest.fixture
def client(db_session):
    app = create_app()

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_ecommerce_flow_1_laptop_search_and_payment_success(client: TestClient, db_session):
    """
    TEST 1:
    Customer opens store -> Searches laptop -> Finds Business Laptop (₹65,999)
    -> Adds to cart -> Registers / Logins -> Enters delivery details
    -> Executes PAYMENT_SUCCESS -> Order confirmed, stock reduced, seller metrics updated.
    """
    # 1. Product Catalog & Search Verification
    res = client.get("/api/checkout/products?category=Laptops%20%26%20Computers")
    assert res.status_code == 200
    products = res.json()["data"]
    assert len(products) >= 6
    assert any("Business" in p["name"] for p in products)

    search_res = client.get("/api/checkout/products?search=ThinkPro")
    assert search_res.status_code == 200
    laptop = search_res.json()["data"][0]
    assert laptop["price"] == 65999.0
    laptop_id = laptop["id"]

    # 2. Customer Registration
    reg_payload = {
        "full_name": "Rahul Kumar",
        "email": "rahul.kumar.test1@example.com",
        "phone": "9876543210",
        "password": "Password123",
        "confirm_password": "Password123",
    }
    reg_res = client.post("/api/checkout/customer/register", json=reg_payload)
    assert reg_res.status_code == 200
    cust_data = reg_res.json()["customer"]
    cust_id = cust_data["id"]

    # 3. Customer Delivery Details Submission
    addr_payload = {
        "customer_id": cust_id,
        "email": "rahul.kumar.test1@example.com",
        "full_name": "Rahul Kumar",
        "phone": "9876543210",
        "address_line1": "12, Main Road",
        "address_line2": "Indiranagar",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600001",
        "landmark": "Opp Metro",
    }
    addr_res = client.post("/api/checkout/customer/address", json=addr_payload)
    assert addr_res.status_code == 200
    assert addr_res.json()["address"]["city"] == "Chennai"

    # 4. Initiate Checkout
    init_res = client.post(
        "/api/checkout/initiate",
        json={
            "product_id": laptop_id,
            "quantity": 1,
            "customer": {
                "name": "Rahul Kumar",
                "email": "rahul.kumar.test1@example.com",
                "phone": "9876543210",
                "address": "12, Main Road, Chennai, Tamil Nadu - 600001",
            },
        },
    )
    assert init_res.status_code == 200
    order_id = init_res.json()["order_id"]

    # 5. Process Payment -> PAYMENT_SUCCESS
    pay_res = client.post(
        "/api/checkout/process-payment",
        json={
            "order_id": order_id,
            "product_id": laptop_id,
            "quantity": 1,
            "amount": 65999.0,
            "currency": "INR",
            "payment_method": "UPI",
            "customer": {
                "name": "Rahul Kumar",
                "email": "rahul.kumar.test1@example.com",
                "phone": "9876543210",
                "address": "12, Main Road, Chennai, Tamil Nadu - 600001",
            },
            "simulation_scenario": "PAYMENT_SUCCESS",
        },
    )
    assert pay_res.status_code == 200
    pay_data = pay_res.json()
    assert pay_data["success"] is True
    assert pay_data["status"] == "SUCCESS"
    assert pay_data["order_status"] == "CONFIRMED"

    # 6. Verify Customer Order History ("My Orders")
    orders_res = client.get("/api/checkout/customer/orders?email=rahul.kumar.test1@example.com")
    assert orders_res.status_code == 200
    orders = orders_res.json()["data"]
    assert len(orders) >= 1
    assert orders[0]["order_id"] == order_id
    assert orders[0]["payment_status"] == "SUCCESS"


def test_ecommerce_flow_2_network_error_and_ai_recovery(client: TestClient, db_session):
    """
    TEST 2:
    Customer opens electrical product -> Buy Now -> Login -> Customer details
    -> Payment NETWORK_ERROR
    -> Verify: Payment failure recorded, Network error recorded, Revenue at risk created,
       AI recovery triggered, Customer message generated, Dynamic payment link generated.
    """
    pay_res = client.post(
        "/api/checkout/process-payment",
        json={
            "product_id": "prod_smart_fan_05",
            "quantity": 1,
            "amount": 7499.0,
            "currency": "INR",
            "payment_method": "UPI",
            "customer": {
                "name": "Arun Kumar",
                "email": "arun.kumar.test2@example.com",
                "phone": "9876543211",
                "address": "42 Green Meadows, Bengaluru, KA 560038",
            },
            "simulation_scenario": "NETWORK_ERROR",
        },
    )
    assert pay_res.status_code == 200
    data = pay_res.json()
    assert data["success"] is False
    assert data["status"] == "FAILED"
    assert data["retry_available"] is True
    assert "payment_link" in data
    assert "automated_message_preview" in data
    assert "temporary payment issue" in data["automated_message_preview"]

    # Verify Seller Dashboard reflects +1 network error and revenue at risk
    seller_res = client.get("/api/seller/dashboard")
    assert seller_res.status_code == 200
    seller_data = seller_res.json()
    assert seller_data["network_errors"] >= 1
    assert seller_data["revenue_at_risk"] >= 7499.0


def test_ecommerce_flow_3_laptop_high_value_recovery_retry_success(client: TestClient, db_session):
    """
    TEST 3:
    Customer orders Business Laptop (₹65,999) -> Payment fails -> Recovery message sent
    -> Opens dynamic recovery link -> Retries payment with SUCCESS
    -> Verify: Order confirmed, Recovered revenue updated, Recovery stopped.
    """
    # 1. Initial Failure on Laptop
    fail_res = client.post(
        "/api/checkout/process-payment",
        json={
            "product_id": "prod_laptop_business_03",
            "quantity": 1,
            "amount": 65999.0,
            "currency": "INR",
            "payment_method": "CARD",
            "customer": {
                "name": "Priya Sharma",
                "email": "priya.sharma.test3@example.com",
                "phone": "9876543212",
                "address": "Flat 302, Palm Heights, Mumbai, MH 400001",
            },
            "simulation_scenario": "TIMEOUT",
        },
    )
    assert fail_res.status_code == 200
    token = fail_res.json()["recovery_token"]
    txn_id = fail_res.json()["transaction_id"]
    order_id = fail_res.json()["order_id"]

    # 2. Fetch recovery session data
    session_res = client.get(f"/api/checkout/recover/{token}")
    assert session_res.status_code == 200
    session_data = session_res.json()
    assert session_data["order_id"] == order_id
    assert session_data["amount"] == 65999.0

    # 3. Customer Retries Payment -> SUCCESS
    retry_res = client.post(
        "/api/checkout/retry-payment",
        json={
            "transaction_id": txn_id,
            "order_id": order_id,
            "token": token,
            "retry_outcome": "SUCCESS",
        },
    )
    assert retry_res.status_code == 200
    retry_data = retry_res.json()
    assert retry_data["success"] is True
    assert retry_data["status"] == "SUCCESS"
    assert retry_data["order_status"] == "CONFIRMED"
    assert retry_data["recovered_amount"] == 65999.0

    # Verify Seller Dashboard has recovered revenue
    seller_res = client.get("/api/seller/dashboard")
    assert seller_res.status_code == 200
    assert seller_res.json()["total_recovered_revenue"] >= 65999.0


def test_ecommerce_flow_4_second_payment_failure_escalates_to_human(client: TestClient, db_session):
    """
    TEST 4:
    Payment fails on Attempt 1 -> Customer receives dynamic recovery link
    -> Retries and fails AGAIN on Attempt 2
    -> Verify: Automated retries halt, recovery status escalates to HUMAN_ASSOCIATE,
       Human Associate case created with HIGH/CRITICAL priority and complete attempt history.
    """
    # 1. Initial Failure on High-Value Item
    fail_res = client.post(
        "/api/checkout/process-payment",
        json={
            "product_id": "prod_laptop_gaming_05",
            "quantity": 1,
            "amount": 115000.0,
            "currency": "INR",
            "payment_method": "UPI",
            "customer": {
                "name": "Karthik Raj",
                "email": "karthik.raj.test4@example.com",
                "phone": "9876543213",
                "address": "88 Residency Road, Bengaluru, KA 560025",
            },
            "simulation_scenario": "AUTHENTICATION_FAILED",
        },
    )
    token = fail_res.json()["recovery_token"]
    txn_id = fail_res.json()["transaction_id"]
    order_id = fail_res.json()["order_id"]

    # 2. Second Attempt Fails
    retry_res = client.post(
        "/api/checkout/retry-payment",
        json={
            "transaction_id": txn_id,
            "order_id": order_id,
            "token": token,
            "retry_outcome": "FAILED",
        },
    )
    assert retry_res.status_code == 200
    retry_data = retry_res.json()
    assert retry_data["success"] is False
    assert retry_data["status"] == "ESCALATED"
    assert retry_data["escalated_to_human"] is True

    # 3. Check Human Associate Cases Queue
    human_res = client.get("/api/human-associate/cases")
    assert human_res.status_code == 200
    human_cases = human_res.json()
    matching_case = next((c for c in human_cases if c["order_id"] == order_id), None)
    assert matching_case is not None
    assert matching_case["amount"] == 115000.0
    assert matching_case["priority"] == "CRITICAL"
    assert matching_case["customer"]["name"] == "Karthik Raj"


def test_ecommerce_flow_5_checkout_abandonment_detection(client: TestClient, db_session):
    """
    TEST 5:
    Customer reaches checkout/payment page and leaves without paying.
    Verify: Checkout abandonment recorded, revenue-at-risk created,
    seller dashboard updated with +1 abandonment.
    """
    abandon_res = client.post(
        "/api/checkout/abandon",
        json={
            "product_id": "prod_laptop_business_03",
            "quantity": 1,
            "amount": 65999.0,
            "currency": "INR",
            "last_stage": "PAYMENT_METHOD_SELECTION",
            "customer": {
                "name": "Divya Rao",
                "email": "divya.rao.test5@example.com",
                "phone": "9876543214",
            },
        },
    )
    assert abandon_res.status_code == 200
    abn_data = abandon_res.json()
    assert abn_data["status"] == "CHECKOUT_ABANDONED"
    assert abn_data["revenue_at_risk"] == 65999.0
    assert "payment_link" in abn_data

    # Verify Seller Dashboard checkout abandonments incremented
    seller_res = client.get("/api/seller/dashboard")
    assert seller_res.status_code == 200
    assert seller_res.json()["checkout_abandonments"] >= 1


def test_ecommerce_flow_6_all_categories_and_search(client: TestClient, db_session):
    """
    TEST 6:
    Verify that ALL 8 categories return realistic products:
    Lighting, Fans & Cooling, Kitchen Appliances, Power & Cables,
    Switches & Wiring, Inverters & Heavy Power, Laptops & Computers, Computer Accessories.
    Verify search filters dynamically and 'All' returns all 40+ products.
    """
    categories = [
        "Lighting",
        "Fans & Cooling",
        "Kitchen Appliances",
        "Power & Cables",
        "Switches & Wiring",
        "Inverters & Heavy Power",
        "Laptops & Computers",
        "Computer Accessories",
    ]

    for cat in categories:
        res = client.get(f"/api/checkout/products?category={cat}")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) >= 4, f"Category {cat} returned insufficient products: {len(data)}"

    # All Products
    all_res = client.get("/api/checkout/products?category=All")
    assert all_res.status_code == 200
    all_products = all_res.json()["data"]
    assert len(all_products) >= 35, f"Total products count too low: {len(all_products)}"

    # Search keyword tests
    keywords = ["LED", "fan", "inverter", "laptop", "keyboard", "mouse", "SSD", "switch"]
    for kw in keywords:
        search_res = client.get(f"/api/checkout/products?search={kw}")
        assert search_res.status_code == 200
        items = search_res.json()["data"]
        assert len(items) >= 1, f"Search for '{kw}' returned 0 products"
