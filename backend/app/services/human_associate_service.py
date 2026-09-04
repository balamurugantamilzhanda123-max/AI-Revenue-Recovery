import datetime
import uuid
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Customer,
    EscalationCase,
    EscalationStatus,
    PaymentAttempt,
    PaymentStatus,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
)
from app.services.audit_service import record_audit_event
from app.services.product_service import get_product_by_id


def list_human_cases(
    db: Session,
    status_filter: str | None = None,
    priority_filter: str | None = None,
) -> list[dict[str, Any]]:
    """Returns all cases escalated to the Human Associate workspace."""
    query = (
        select(EscalationCase)
        .options(
            joinedload(EscalationCase.transaction).joinedload(Transaction.customer),
            joinedload(EscalationCase.transaction).joinedload(Transaction.payment_attempts),
        )
        .order_by(desc(EscalationCase.created_at))
    )

    cases = db.scalars(query).unique().all()
    results: list[dict[str, Any]] = []

    for case in cases:
        tx = case.transaction
        if not tx:
            continue

        if status_filter and status_filter.upper() != "ALL":
            if case.status.value != status_filter.upper():
                continue

        if priority_filter and priority_filter.upper() != "ALL":
            if case.priority.upper() != priority_filter.upper():
                continue

        cust = tx.customer
        attempts = [
            {
                "attempt_number": pa.attempt_number,
                "status": pa.status.value if hasattr(pa.status, "value") else str(pa.status),
                "gateway_response": pa.gateway_response,
                "created_at": pa.created_at.isoformat() if pa.created_at else None,
            }
            for pa in (tx.payment_attempts or [])
        ]

        # Extract failure reason and network flag
        is_network_error = bool(
            tx.failure_reason
            and "network" in tx.failure_reason.lower()
            or (tx.gateway_response and "network" in tx.gateway_response.lower())
        )

        product_id = getattr(tx, "product_id", None) or "prod_ceiling_fan_04"
        product_info = get_product_by_id(product_id)
        product_name = getattr(tx, "product_name", None) or (product_info["name"] if product_info else "Electrical Product")

        # Determine recovery link token
        recovery_token = getattr(tx, "recovery_token", None) or f"token_{tx.transaction_id}"

        results.append(
            {
                "case_id": case.id,
                "order_id": tx.order_id,
                "transaction_id": tx.transaction_id,
                "customer": {
                    "id": cust.id if cust else None,
                    "name": cust.name if cust else "Valued Customer",
                    "email": cust.email if cust else "customer@example.com",
                    "phone": cust.phone if cust else "+91 98765 43210",
                },
                "product": {
                    "id": product_id,
                    "name": product_name,
                    "category": product_info.get("category", "Electricals") if product_info else "Electricals",
                },
                "amount": float(tx.amount),
                "currency": tx.currency,
                "payment_attempts_count": len(attempts) or (tx.retry_count + 1),
                "payment_attempts": attempts,
                "failure_reason": tx.failure_reason or "Multiple Payment Declines / Timeouts",
                "is_network_error": is_network_error,
                "ai_diagnosis": tx.gateway_response or "Transient Switch / Auth Failure",
                "ai_recommendation": case.ai_recommendation or "Customer re-engagement via alternate payment link recommended.",
                "priority": case.priority,
                "risk_level": "CRITICAL" if float(tx.amount) >= 50000 else ("HIGH" if float(tx.amount) >= 10000 else "MEDIUM"),
                "revenue_at_risk": float(tx.amount) if tx.status != PaymentStatus.SUCCESS else 0.0,
                "case_status": case.status.value if hasattr(case.status, "value") else str(case.status),
                "created_at": case.created_at.isoformat() if case.created_at else None,
                "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None,
                "action_history": case.action_history or [],
                "recovery_token": recovery_token,
            }
        )

    return results


def log_human_contact(
    db: Session,
    case_id: str,
    channel: str,
    notes: str,
    agent_name: str = "Priya Sharma (Human Associate)",
) -> dict[str, Any]:
    """Records a customer contact event from the Human Associate."""
    case = db.get(EscalationCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Human case not found")

    now_iso = datetime.datetime.utcnow().isoformat()
    action_item = {
        "action": "CUSTOMER_CONTACTED",
        "channel": channel,
        "notes": notes,
        "agent": agent_name,
        "timestamp": now_iso,
    }

    case.action_history = [*(case.action_history or []), action_item]
    case.status = EscalationStatus.IN_REVIEW

    tx = case.transaction
    if tx:
        record_audit_event(
            db,
            event_type="HUMAN_CUSTOMER_CONTACTED",
            event_message=f"Human associate {agent_name} contacted customer via {channel}: {notes}",
            actor="human-associate",
            transaction_id=tx.id,
            recovery_case_id=case.recovery_case_id,
            metadata={"channel": channel, "notes": notes, "agent": agent_name},
        )

    db.commit()
    return {"success": True, "case_id": case_id, "action": action_item}


def send_human_payment_link(
    db: Session,
    case_id: str,
    custom_message: str | None = None,
    discount_percent: float = 0.0,
    agent_name: str = "Priya Sharma (Human Associate)",
) -> dict[str, Any]:
    """Generates and sends an approved payment link with human support notes."""
    case = db.get(EscalationCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Human case not found")

    tx = case.transaction
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found for case")

    # Generate secure recovery token
    token = getattr(tx, "recovery_token", None)
    if not token:
        token = f"tok_human_{uuid.uuid4().hex[:8]}"

    link_url = f"/pay/recover/{token}"
    now_iso = datetime.datetime.utcnow().isoformat()

    msg_body = custom_message or f"Hello! As requested by our support team, please use this dedicated link to complete your order for {tx.order_id}."
    action_item = {
        "action": "PAYMENT_LINK_SENT",
        "link_url": link_url,
        "token": token,
        "discount_percent": discount_percent,
        "message": msg_body,
        "agent": agent_name,
        "timestamp": now_iso,
    }

    case.action_history = [*(case.action_history or []), action_item]
    case.status = EscalationStatus.IN_REVIEW

    record_audit_event(
        db,
        event_type="HUMAN_PAYMENT_LINK_SENT",
        event_message=f"Human associate {agent_name} dispatched approved payment link for Order {tx.order_id}",
        actor="human-associate",
        transaction_id=tx.id,
        recovery_case_id=case.recovery_case_id,
        metadata={"link_url": link_url, "token": token, "discount_percent": discount_percent, "agent": agent_name},
    )

    db.commit()
    return {
        "success": True,
        "case_id": case_id,
        "order_id": tx.order_id,
        "payment_link": link_url,
        "token": token,
        "message": msg_body,
        "action": action_item,
    }


def complete_human_payment_recovery(
    db: Session,
    case_id: str,
    notes: str = "Customer completed payment successfully using human-assisted link.",
) -> dict[str, Any]:
    """
    Simulates customer completing payment through human-assisted flow.
    Marks transaction SUCCESS, records Human Recovered Revenue, marks case RESOLVED.
    """
    case = db.get(EscalationCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Human case not found")

    tx = case.transaction
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found for case")

    now_dt = datetime.datetime.utcnow()
    tx.status = PaymentStatus.SUCCESS
    tx.recovery_status = RecoveryStatus.RECOVERED
    tx.recovered_amount = tx.amount
    tx.failure_reason = None
    tx.gateway_response = "Payment captured successfully via Human Associate Support (Sandbox)"
    tx.escalation_status = EscalationStatus.RESOLVED

    # Mark as Human Associate recovery channel
    tx.customer_response = "RECOVERED_BY_HUMAN"

    # Add successful payment attempt
    current_attempts = len(tx.payment_attempts) if tx.payment_attempts else 1
    db.add(
        PaymentAttempt(
            transaction_id=tx.id,
            attempt_number=current_attempts + 1,
            status=PaymentStatus.SUCCESS,
            gateway_response="Payment captured successfully on human-assisted retry (Sandbox)",
        )
    )

    # Update recovery case if linked
    recovery_case = (
        db.query(RecoveryCase)
        .filter(RecoveryCase.transaction_id == tx.id)
        .order_by(RecoveryCase.created_at.desc())
        .first()
    )
    if recovery_case:
        recovery_case.recovery_status = RecoveryStatus.RECOVERED
        recovery_case.recovered_amount = tx.amount
        recovery_case.success_timestamp = now_dt

    case.status = EscalationStatus.RESOLVED
    case.resolved_at = now_dt
    case.action_history = [
        *(case.action_history or []),
        {
            "action": "CASE_RESOLVED_PAYMENT_SUCCESS",
            "notes": notes,
            "recovered_amount": float(tx.amount),
            "timestamp": now_dt.isoformat(),
        },
    ]

    record_audit_event(
        db,
        event_type="PAYMENT_SUCCESS",
        event_message=f"Payment captured successfully via Human Support for Order {tx.order_id}",
        actor="payment-gateway",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={"order_id": tx.order_id, "amount": float(tx.amount), "recovery_channel": "HUMAN_ASSOCIATE"},
    )

    record_audit_event(
        db,
        event_type="HUMAN_REVENUE_RECOVERED",
        event_message=f"Revenue recovered by Human Associate: {tx.currency} {float(tx.amount):,.2f}",
        actor="human-associate",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={"recovered_amount": float(tx.amount), "currency": tx.currency, "order_id": tx.order_id},
    )

    record_audit_event(
        db,
        event_type="HUMAN_ESCALATION_RESOLVED",
        event_message=f"Escalation case {case.id} marked RESOLVED after successful payment capture",
        actor="human-associate",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={"resolution": notes, "case_id": case.id},
    )

    db.commit()

    return {
        "success": True,
        "case_id": case.id,
        "order_id": tx.order_id,
        "transaction_id": tx.transaction_id,
        "status": "RESOLVED",
        "recovered_amount": float(tx.amount),
        "message": f"Case resolved! ₹{float(tx.amount):,.2f} recovered successfully by Human Associate.",
    }
