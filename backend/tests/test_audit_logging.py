import pytest
from app.services.audit_service import AuditEventType, record_audit_event, sanitize_metadata


def test_revenue_risk_detection_creates_audit_event(client):
    """TEST 1: Revenue risk detection creates audit event."""
    client.post("/api/demo/reset")
    audit_res = client.get("/api/audit/TX-DEMO-001")
    assert audit_res.status_code == 200
    events = audit_res.json()["events"]
    risk_events = [e for e in events if e["event_type"] == "REVENUE_RISK_DETECTED"]
    assert len(risk_events) >= 1
    assert "Revenue at risk detected" in risk_events[0]["event_message"]
    assert risk_events[0]["metadata"]["risk_amount"] == 5999.0


def test_diagnosis_creates_audit_event(client):
    """TEST 2: Diagnosis creates audit event."""
    client.post("/api/demo/reset")
    diag_res = client.post("/api/agent/diagnose/TX-DEMO-001")
    assert diag_res.status_code == 200
    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    diag_events = [e for e in events if e["event_type"] == "AI_DIAGNOSIS_COMPLETED"]
    assert len(diag_events) >= 1
    assert "Root cause identified" in diag_events[-1]["event_message"]
    assert "root_cause" in diag_events[-1]["metadata"]


def test_recovery_decision_creates_audit_event(client):
    """TEST 3: Recovery decision creates audit event."""
    client.post("/api/demo/reset")
    diag_res = client.post("/api/agent/diagnose/TX-DEMO-001")
    assert diag_res.status_code == 200
    decide_res = client.post("/api/agent/decide/TX-DEMO-001")
    assert decide_res.status_code == 200
    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    decision_events = [e for e in events if e["event_type"] == "RECOVERY_DECISION_CREATED"]
    assert len(decision_events) >= 1
    assert "Recovery strategy selected" in decision_events[-1]["event_message"]
    assert "recommended_action" in decision_events[-1]["metadata"]


def test_policy_approval_creates_audit_event(client):
    """TEST 4: Policy approval creates audit event."""
    client.post("/api/demo/reset")
    recovery_res = client.post(
        "/api/recovery/start/TX-DEMO-001",
        json={"idempotency_key": "test-policy-approval", "force_payment_result": "SUCCESS"},
    )
    assert recovery_res.status_code == 200
    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    policy_events = [
        e for e in events
        if e["event_type"] == "POLICY_VALIDATION_COMPLETED" and "APPROVED" in e["event_message"]
    ]
    assert len(policy_events) >= 1
    assert policy_events[0]["metadata"]["allowed"] is True


def test_policy_rejection_creates_audit_event(client):
    """TEST 5: Policy rejection creates audit event."""
    create = client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-POLICY-REJECT-001",
            "customer_id": "CUST-POL-001",
            "customer_name": "Reject Policy Customer",
            "order_id": "ORDER-POL-001",
            "amount": "2500.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
            "customer_response": "STOP",
        },
    )
    assert create.status_code == 200

    recovery_res = client.post(
        "/api/recovery/start/TX-POLICY-REJECT-001",
        json={"idempotency_key": "test-policy-rejection"},
    )
    assert recovery_res.status_code == 200
    audit_res = client.get("/api/audit/TX-POLICY-REJECT-001")
    events = audit_res.json()["events"]
    policy_rejections = [
        e for e in events
        if e["event_type"] in {"POLICY_VALIDATION_COMPLETED", "POLICY_BLOCKED_ACTION"}
        and (e["metadata"].get("allowed") is False or "BLOCKED" in e["event_message"] or "REJECTED" in e["event_message"])
    ]
    assert len(policy_rejections) >= 1


def test_recovery_start_creates_audit_event(client):
    """TEST 6: Recovery start creates audit event."""
    client.post("/api/demo/reset")
    recovery_res = client.post(
        "/api/recovery/start/TX-DEMO-001",
        json={"idempotency_key": "test-rec-start", "force_payment_result": "SUCCESS"},
    )
    assert recovery_res.status_code == 200
    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    start_events = [e for e in events if e["event_type"] == "RECOVERY_STARTED"]
    assert len(start_events) >= 1
    assert "Recovery workflow started" in start_events[0]["event_message"]


def test_recovery_success_creates_audit_event(client):
    """TEST 7: Recovery success creates audit event."""
    client.post("/api/demo/reset")
    recovery_res = client.post(
        "/api/recovery/start/TX-DEMO-001",
        json={"idempotency_key": "test-rec-success", "force_payment_result": "SUCCESS"},
    )
    assert recovery_res.status_code == 200
    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    success_events = [e for e in events if e["event_type"] == "RECOVERY_SUCCEEDED"]
    assert len(success_events) >= 1
    assert success_events[0]["metadata"]["payment_status"] == "SUCCESS"
    assert success_events[0]["metadata"]["recovered_amount"] == 5999.0


def test_recovery_failure_creates_audit_event(client):
    """TEST 8: Recovery failure creates audit event."""
    client.post("/api/demo/reset")
    recovery_res = client.post(
        "/api/recovery/start/TX-DEMO-002",
        json={"idempotency_key": "test-rec-failure", "force_payment_result": "FAILED"},
    )
    assert recovery_res.status_code == 200
    audit_res = client.get("/api/audit/TX-DEMO-002")
    events = audit_res.json()["events"]
    fail_events = [e for e in events if e["event_type"] in {"RECOVERY_FAILED", "RECOVERY_RETRY_FAILED"}]
    assert len(fail_events) >= 1
    assert fail_events[0]["metadata"]["payment_status"] == "FAILED"


def test_human_escalation_creates_audit_event(client):
    """TEST 9: Human escalation creates audit event."""
    client.post("/api/demo/reset")
    recovery_res = client.post(
        "/api/recovery/start/TX-DEMO-002",
        json={"idempotency_key": "test-rec-escalation", "force_payment_result": "FAILED"},
    )
    assert recovery_res.status_code == 200
    audit_res = client.get("/api/audit/TX-DEMO-002")
    events = audit_res.json()["events"]
    escalation_events = [e for e in events if e["event_type"] == "HUMAN_ESCALATION_CREATED"]
    assert len(escalation_events) >= 1
    assert "Human escalation" in escalation_events[0]["event_message"]


def test_recovery_stopping_creates_audit_event(client):
    """TEST 10: Recovery stopping creates audit event."""
    client.post("/api/demo/reset")
    client.post(
        "/api/recovery/start/TX-DEMO-001",
        json={"idempotency_key": "test-rec-stopping", "force_payment_result": "SUCCESS"},
    )
    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    stop_events = [e for e in events if e["event_type"] == "RECOVERY_STOPPED"]
    assert len(stop_events) >= 1
    assert stop_events[-1]["metadata"]["stop_reason"] == "PAYMENT_SUCCESS"


def test_audit_events_are_chronologically_ordered(client):
    """TEST 11: Audit events are chronologically ordered."""
    client.post("/api/demo/reset")
    client.post(
        "/api/recovery/start/TX-DEMO-001",
        json={"idempotency_key": "test-chrono", "force_payment_result": "SUCCESS"},
    )
    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    assert len(events) >= 5
    timestamps = [e["created_at"] for e in events]
    assert timestamps == sorted(timestamps)


def test_transaction_specific_audit_endpoint(client):
    """TEST 12: Transaction-specific audit endpoint returns correct transaction events."""
    client.post("/api/demo/reset")
    res = client.get("/api/audit/TX-DEMO-001")
    assert res.status_code == 200
    data = res.json()
    assert data["transaction_id"] == "TX-DEMO-001"
    assert isinstance(data["events"], list)
    assert data["count"] == len(data["events"])


def test_global_audit_endpoint(client):
    """TEST 13: Global audit endpoint works."""
    client.post("/api/demo/reset")
    res = client.get("/api/audit?limit=10&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    assert "pagination" in data
    assert data["pagination"]["limit"] == 10
    assert len(data["data"]) <= 10


def test_duplicate_recovery_does_not_duplicate_financial_execution(client):
    """TEST 14: Duplicate recovery does not create duplicate financial execution."""
    client.post("/api/demo/reset")
    payload = {"idempotency_key": "test-idem-audit", "force_payment_result": "SUCCESS"}
    res1 = client.post("/api/recovery/start/TX-DEMO-001", json=payload)
    res2 = client.post("/api/recovery/start/TX-DEMO-001", json=payload)
    assert res1.status_code == 200
    assert res2.status_code == 200

    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    succ_events = [e for e in events if e["event_type"] == "RECOVERY_SUCCEEDED"]
    assert len(succ_events) == 1


def test_payment_success_causes_stopping_event(client):
    """TEST 15: Payment success causes recovery stopping event."""
    client.post("/api/demo/reset")
    client.post(
        "/api/recovery/start/TX-DEMO-001",
        json={"idempotency_key": "test-succ-stop", "force_payment_result": "SUCCESS"},
    )
    audit_res = client.get("/api/audit/TX-DEMO-001")
    events = audit_res.json()["events"]
    stop_events = [e for e in events if e["event_type"] == "RECOVERY_STOPPED"]
    assert any(e["metadata"].get("stop_reason") == "PAYMENT_SUCCESS" for e in stop_events)


def test_customer_stop_causes_stopping_event(client):
    """TEST 16: Customer STOP causes stopping/communication stop event."""
    create = client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-CUST-STOP-99",
            "customer_id": "CUST-STOP-99",
            "customer_name": "Customer Stop",
            "order_id": "ORDER-STOP-99",
            "amount": "1999.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "TIMEOUT",
            "customer_response": "STOP",
        },
    )
    assert create.status_code == 200
    audit_res = client.get("/api/audit/TX-CUST-STOP-99")
    events = audit_res.json()["events"]
    opt_out_events = [e for e in events if e["event_type"] == "CUSTOMER_OPT_OUT"]
    assert len(opt_out_events) >= 1
    stop_events = [e for e in events if e["event_type"] == "RECOVERY_STOPPED"]
    assert any(e["metadata"].get("stop_reason") == "CUSTOMER_OPTED_OUT" for e in stop_events)


def test_retry_limit_causes_stopping_and_escalation(client):
    """TEST 17: Retry limit causes stopping and escalation events."""
    client.post("/api/demo/reset")
    client.post(
        "/api/recovery/start/TX-DEMO-002",
        json={"idempotency_key": "test-limit-stop", "force_payment_result": "FAILED"},
    )
    audit_res = client.get("/api/audit/TX-DEMO-002")
    events = audit_res.json()["events"]
    stop_events = [e for e in events if e["event_type"] == "RECOVERY_STOPPED"]
    assert any(e["metadata"].get("stop_reason") == "RETRY_LIMIT_REACHED" for e in stop_events)
    escalation_events = [e for e in events if e["event_type"] == "HUMAN_ESCALATION_CREATED"]
    assert len(escalation_events) >= 1


def test_low_confidence_decision_causes_escalation(client):
    """TEST 18: Low-confidence decision causes escalation event."""
    create = client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-LOW-CONF-001",
            "customer_id": "CUST-LOW-001",
            "customer_name": "Low Confidence Customer",
            "order_id": "ORDER-LOW-001",
            "amount": "7500.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "UNRECOGNIZED_STRANGE_CODE_XYZ",
        },
    )
    assert create.status_code == 200
    diag_res = client.post("/api/agent/diagnose/TX-LOW-CONF-001")
    assert diag_res.status_code == 200

    res = client.post("/api/agent/decide/TX-LOW-CONF-001")
    assert res.status_code == 200
    data = res.json()
    assert data["requires_human_review"] is True
    audit_res = client.get("/api/audit/TX-LOW-CONF-001")
    events = audit_res.json()["events"]
    escalation_events = [e for e in events if e["event_type"] == "HUMAN_ESCALATION_CREATED"]
    assert len(escalation_events) >= 1


def test_unknown_failure_causes_appropriate_audit_and_escalation(client):
    """TEST 19: Unknown failure causes appropriate audit/escalation."""
    create = client.post(
        "/api/transactions",
        json={
            "transaction_id": "TX-UNKNOWN-001",
            "customer_id": "CUST-UNK-001",
            "customer_name": "Unknown Customer",
            "order_id": "ORDER-UNK-001",
            "amount": "3200.00",
            "currency": "INR",
            "payment_method": "UPI",
            "status": "FAILED",
            "failure_reason": "SOMETHING_MYSTERIOUS",
            "gateway_response": "SOMETHING_MYSTERIOUS",
        },
    )
    assert create.status_code == 200
    res = client.post("/api/recovery/start/TX-UNKNOWN-001")
    assert res.status_code == 200
    audit_res = client.get("/api/audit/TX-UNKNOWN-001")
    events = audit_res.json()["events"]
    assert any(e["event_type"] == "HUMAN_ESCALATION_CREATED" for e in events)


def test_invalid_transaction_handled_correctly(client):
    """TEST 20: Invalid transaction is handled correctly."""
    res = client.get("/api/audit/TX-NON-EXISTENT-XYZ")
    assert res.status_code == 404
    assert "not found" in res.text.lower()


def test_database_audit_failure_handled_without_silent_failure():
    """TEST 21: Database/audit failure is handled without silent failure."""
    with pytest.raises(ValueError):
        record_audit_event(
            None,  # type: ignore
            event_type="",
            event_message="Test empty message",
        )


def test_audit_metadata_does_not_contain_secrets():
    """TEST 22: Audit metadata does not contain secrets."""
    dirty_metadata = {
        "api_key": "sample_mock_api_key_test_value",
        "secret": "top-secret-val",
        "password": "mypassword123",
        "authorization": "Bearer sample_test_auth_token",
        "card_number": "4111111111111111",
        "cvv": "123",
        "safe_data": "visible_info",
    }
    clean = sanitize_metadata(dirty_metadata)
    assert clean["api_key"] == "[REDACTED]"
    assert clean["secret"] == "[REDACTED]"
    assert clean["password"] == "[REDACTED]"
    assert clean["authorization"] == "[REDACTED]"
    assert clean["card_number"] == "[REDACTED]"
    assert clean["cvv"] == "[REDACTED]"
    assert clean["safe_data"] == "visible_info"
