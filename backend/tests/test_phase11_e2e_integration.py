import pytest


def test_01_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert "service" in res.json()


def test_02_transaction_creation(client):
    payload = {
        "transaction_id": "TX-TEST-001",
        "customer_id": "CUST-TEST-001",
        "customer_name": "Integration Customer",
        "customer_email": "integration@test.com",
        "order_id": "ORDER-TEST-001",
        "amount": "2500.00",
        "currency": "INR",
        "payment_method": "UPI",
        "status": "FAILED",
        "failure_reason": "TIMEOUT",
        "gateway_response": "Gateway timeout response",
    }
    res = client.post("/api/transactions", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["transaction_id"] == "TX-TEST-001"
    assert data["status"] == "FAILED"
    assert data["amount"] == 2500.0


def test_03_transaction_retrieval_and_listing(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-TEST-002",
            "customer_id": "CUST-TEST-002",
            "customer_name": "Listing Customer",
            "order_id": "ORDER-TEST-002",
            "amount": "1999.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
        },
    )
    # Retrieve list
    list_res = client.get("/api/transactions?limit=10")
    assert list_res.status_code == 200
    assert len(list_res.json()["data"]) >= 1

    # Retrieve specific transaction
    tx_res = client.get("/api/transactions/TX-TEST-002")
    assert tx_res.status_code == 200
    assert tx_res.json()["transaction_id"] == "TX-TEST-002"


def test_04_revenue_risk_detection_and_summary(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-RISK-001",
            "customer_id": "CUST-RISK-001",
            "customer_name": "Risk Customer",
            "order_id": "ORDER-RISK-001",
            "amount": "3500.00",
            "currency": "INR",
            "payment_method": "CARD",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
        },
    )
    risk_list = client.get("/api/revenue-risk")
    assert risk_list.status_code == 200
    assert isinstance(risk_list.json(), list)
    assert len(risk_list.json()) >= 1

    summary = client.get("/api/revenue-risk/summary")
    assert summary.status_code == 200
    data = summary.json()
    assert data["revenue_at_risk"] >= 3500.0
    assert data["total_transactions"] >= 1


def test_05_diagnosis_endpoint(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-DIAG-001",
            "customer_id": "CUST-DIAG-001",
            "customer_name": "Diag Customer",
            "order_id": "ORDER-DIAG-001",
            "amount": "5999.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
            "gateway_response": "UPI collect request timed out at gateway",
        },
    )
    res = client.post("/api/agent/diagnose/TX-DIAG-001")
    assert res.status_code == 200
    data = res.json()
    assert "diagnosis" in data
    diag = data["diagnosis"]
    assert diag["transaction_id"] == "TX-DIAG-001"
    assert diag["root_cause"] == "payment_timeout"
    assert diag["confidence"] >= 0.70
    assert isinstance(diag["evidence"], list)
    assert len(diag["evidence"]) > 0


def test_06_decision_endpoint(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-DECIDE-001",
            "customer_id": "CUST-DECIDE-001",
            "customer_name": "Decide Customer",
            "order_id": "ORDER-DECIDE-001",
            "amount": "5999.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
            "gateway_response": "UPI collect request timed out",
        },
    )
    # First diagnose
    client.post("/api/agent/diagnose/TX-DECIDE-001")

    # Then decide
    res = client.post("/api/agent/decide/TX-DECIDE-001")
    assert res.status_code == 200
    data = res.json()
    assert data["transaction_id"] == "TX-DECIDE-001"
    assert data["decision"] in {"controlled_retry", "retry"}
    assert data["allowed"] is True


def test_07_policy_validation_approval(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-POL-001",
            "customer_id": "CUST-POL-001",
            "customer_name": "Policy Customer",
            "order_id": "ORDER-POL-001",
            "amount": "4500.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
        },
    )
    client.post("/api/agent/diagnose/TX-POL-001")
    res = client.post("/api/agent/decide/TX-POL-001")
    assert res.status_code == 200
    data = res.json()
    assert data["policy"] in {"ALLOW", "APPROVED"}
    assert data["allowed"] is True


def test_08_recovery_start_and_status(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-REC-001",
            "customer_id": "CUST-REC-001",
            "customer_name": "Rec Customer",
            "order_id": "ORDER-REC-001",
            "amount": "2500.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
        },
    )
    res = client.post(
        "/api/recovery/start/TX-REC-001",
        json={"idempotency_key": "recovery-key-test-01", "force_payment_result": "SUCCESS"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["execution_result"]["payment_status"] == "SUCCESS"
    assert data["recovery_case"]["recovery_status"] == "RECOVERED"

    # Verify recovery result endpoint
    status_res = client.get("/api/recovery/TX-REC-001")
    assert status_res.status_code == 200
    assert status_res.json()["recovery_status"] == "RECOVERED"
    assert status_res.json()["recovered_amount"] == 2500.0


def test_09_payments_retry_endpoint(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-RETRY-001",
            "customer_id": "CUST-RETRY-001",
            "customer_name": "Retry Customer",
            "order_id": "ORDER-RETRY-001",
            "amount": "1500.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
        },
    )
    res = client.post(
        "/api/payments/retry/TX-RETRY-001",
        json={"force_result": "SUCCESS", "idempotency_key": "payment-retry-test-01"},
    )
    assert res.status_code == 200
    assert res.json()["execution_result"]["payment_status"] == "SUCCESS"


def test_10_retry_failure_scenario_and_escalation(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-FAIL-001",
            "customer_id": "CUST-FAIL-001",
            "customer_name": "Retry Fail Customer",
            "order_id": "ORDER-FAIL-001",
            "amount": "3000.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
            "retry_count": 0,
        },
    )
    res = client.post(
        "/api/recovery/start/TX-FAIL-001",
        json={"force_payment_result": "FAILED", "idempotency_key": "fail-key-01"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["execution_result"]["payment_status"] == "FAILED"
    assert data["recovery_case"]["recovery_status"] in {"FAILED", "ESCALATED"}

    # Verify escalation was created
    escalations = client.get("/api/escalations").json()
    assert len(escalations) >= 1


def test_11_escalation_resolution(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-ESC-RESOLVE-001",
            "customer_id": "CUST-ESC-001",
            "customer_name": "Escalate Customer",
            "order_id": "ORDER-ESC-001",
            "amount": "3000.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
        },
    )
    client.post(
        "/api/recovery/start/TX-ESC-RESOLVE-001",
        json={"force_payment_result": "FAILED", "idempotency_key": "fail-key-resolve-01"},
    )

    escalations = client.get("/api/escalations").json()
    assert len(escalations) > 0
    target_esc = escalations[0]

    resolve_res = client.patch(
        f"/api/escalations/{target_esc['id']}/resolve",
        json={"resolution": "Customer provided updated billing information and new payment link was sent."},
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"



def test_12_audit_trail_complete(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-AUDIT-001",
            "customer_id": "CUST-AUDIT-001",
            "customer_name": "Audit Customer",
            "order_id": "ORDER-AUDIT-001",
            "amount": "5999.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
        },
    )
    client.post(
        "/api/recovery/start/TX-AUDIT-001",
        json={"idempotency_key": "audit-recovery-key-01", "force_payment_result": "SUCCESS"},
    )
    res = client.get("/api/audit/TX-AUDIT-001")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 3
    event_types = [ev["event_type"] for ev in data["events"]]
    assert "TRANSACTION_INGESTED" in event_types
    assert "REVENUE_RISK_DETECTED" in event_types
    assert "RECOVERY_SUCCEEDED" in event_types or "REVENUE_RECOVERED" in event_types


def test_13_idempotency_protection(client):
    client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-IDEM-001",
            "customer_id": "CUST-IDEM-001",
            "customer_name": "Idem Customer",
            "order_id": "ORDER-IDEM-001",
            "amount": "1500.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
        },
    )
    payload = {
        "idempotency_key": "idem-unique-key-100",
        "force_payment_result": "SUCCESS",
    }
    first = client.post("/api/recovery/start/TX-IDEM-001", json=payload)
    second = client.post("/api/recovery/start/TX-IDEM-001", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


def test_14_demo_reset_repeatability(client):
    for _ in range(3):
        res = client.post("/api/demo/reset")
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "Demo data reset"
        assert len(data["transactions"]) == 4


def test_15_demo_primary_and_retry_failure_flows(client):
    # Reset
    client.post("/api/demo/reset")

    # Run Primary Demo (TX-DEMO-001)
    primary = client.post("/api/demo/run-primary")
    assert primary.status_code == 200
    p_data = primary.json()
    assert p_data["transaction_id"] == "TX-DEMO-001"
    assert p_data["execution_result"]["payment_status"] == "SUCCESS"
    assert p_data["recovery_case"]["recovered_amount"] == 5999.0

    # Run Failure Demo (TX-DEMO-002)
    failure = client.post("/api/demo/run-retry-failure")
    assert failure.status_code == 200
    f_data = failure.json()
    assert f_data["transaction_id"] == "TX-DEMO-002"
    assert f_data["execution_result"]["payment_status"] == "FAILED"
    assert f_data["recovery_case"]["recovery_status"] == "ESCALATED"
