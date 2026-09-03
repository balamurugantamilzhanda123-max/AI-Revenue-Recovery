def test_primary_demo_recovers_revenue(client):
    reset = client.post("/api/demo/reset")
    assert reset.status_code == 200

    response = client.post(
        "/api/recovery/start/TX-DEMO-001",
        json={
            "idempotency_key": "test-primary-recovery",
            "force_payment_result": "SUCCESS",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["execution_result"]["payment_status"] == "SUCCESS"
    assert body["recovery_case"]["recovery_status"] == "RECOVERED"
    assert body["recovery_case"]["recovered_amount"] == 5999.0

    summary = client.get("/api/dashboard/summary").json()
    assert summary["revenue_recovered"] == 5999.0
    assert summary["successful_recoveries"] == 1


def test_idempotency_replays_original_recovery_response(client):
    client.post("/api/demo/reset")

    payload = {
        "idempotency_key": "same-request-key",
        "force_payment_result": "SUCCESS",
    }
    first = client.post("/api/recovery/start/TX-DEMO-001", json=payload)
    second = client.post("/api/recovery/start/TX-DEMO-001", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["action_id"] == first.json()["action_id"]

    detail = client.get("/api/transactions/TX-DEMO-001").json()
    actions = detail["recovery_cases"][0]["recovery_actions"]
    assert len(actions) == 1


def test_retry_failure_escalates_to_human(client):
    client.post("/api/demo/reset")

    response = client.post(
        "/api/recovery/start/TX-DEMO-002",
        json={
            "idempotency_key": "test-failed-retry",
            "force_payment_result": "FAILED",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["execution_result"]["payment_status"] == "FAILED"
    assert body["recovery_case"]["recovery_status"] == "ESCALATED"

    escalations = client.get("/api/escalations").json()
    assert len(escalations) == 1
    assert escalations[0]["status"] == "OPEN"


def test_customer_stop_blocks_recovery(client):
    create = client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-STOP-001",
            "customer_id": "CUST-STOP-001",
            "customer_name": "Opt Out Customer",
            "order_id": "ORDER-STOP-001",
            "amount": "4999.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
            "customer_response": "STOP",
        },
    )
    assert create.status_code == 200
    assert create.json()["recovery_status"] == "STOPPED"

    response = client.post(
        "/api/recovery/start/TX-STOP-001",
        json={"idempotency_key": "stop-blocks-recovery"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["policy"]["allowed"] is False
    assert body["policy"]["result"] in {"BLOCKED", "ESCALATE"}
