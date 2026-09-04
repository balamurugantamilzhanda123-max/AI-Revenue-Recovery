import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import desc, func, select
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
from app.services.product_service import ELECTRICAL_PRODUCTS, get_product_by_id


def get_seller_dashboard_summary(db: Session) -> dict[str, Any]:
    """
    Dynamically aggregates all orders, failures, network errors, abandonments,
    revenue at risk, AI recoveries, Human recoveries, and product loss breakdown.
    """
    transactions = (
        db.scalars(
            select(Transaction)
            .options(
                joinedload(Transaction.customer),
                joinedload(Transaction.payment_attempts),
                joinedload(Transaction.escalation_cases),
            )
        )
        .unique()
        .all()
    )

    total_orders = len(transactions)
    successful_orders = sum(1 for tx in transactions if tx.status == PaymentStatus.SUCCESS)
    failed_orders = sum(1 for tx in transactions if tx.status == PaymentStatus.FAILED)
    pending_orders = sum(1 for tx in transactions if tx.status == PaymentStatus.PENDING)
    checkout_abandonments = sum(1 for tx in transactions if tx.status == PaymentStatus.ABANDONED)

    # Technical Network Errors:
    network_errors = 0
    timeouts = 0
    bank_declines = 0
    auth_failures = 0
    other_failures = 0

    for tx in transactions:
        reason_text = (tx.failure_reason or "").lower()
        gw_text = (tx.gateway_response or "").lower()
        comb = f"{reason_text} {gw_text}"

        if "network" in comb or "connection" in comb or "tcp reset" in comb:
            network_errors += 1
        elif "timeout" in comb:
            timeouts += 1
        elif "decline" in comb or "balance" in comb or "insufficient" in comb:
            bank_declines += 1
        elif "auth" in comb or "3ds" in comb or "otp" in comb:
            auth_failures += 1
        elif tx.status == PaymentStatus.FAILED:
            other_failures += 1

    # Revenue metrics calculation
    # Recoverable = FAILED or ABANDONED or UNRESOLVED, not recovered or stopped
    recoverable_txs = [
        tx
        for tx in transactions
        if tx.status in {PaymentStatus.FAILED, PaymentStatus.ABANDONED, PaymentStatus.UNRESOLVED}
        and tx.recovery_status not in {RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED}
    ]
    revenue_at_risk = sum((Decimal(tx.amount or 0) for tx in recoverable_txs), Decimal("0.00"))

    # Breakdown of Revenue at Risk
    network_error_risk = sum(
        Decimal(tx.amount or 0)
        for tx in recoverable_txs
        if "network" in ((tx.failure_reason or "") + (tx.gateway_response or "")).lower()
    )
    payment_failure_risk = sum(
        Decimal(tx.amount or 0)
        for tx in recoverable_txs
        if tx.status == PaymentStatus.FAILED and "network" not in ((tx.failure_reason or "") + (tx.gateway_response or "")).lower()
    )
    abandonment_risk = sum(
        Decimal(tx.amount or 0)
        for tx in recoverable_txs
        if tx.status == PaymentStatus.ABANDONED
    )
    human_pending_risk = sum(
        Decimal(tx.amount or 0)
        for tx in recoverable_txs
        if tx.escalation_status in {EscalationStatus.OPEN, EscalationStatus.IN_REVIEW}
        or tx.recovery_status == RecoveryStatus.ESCALATED
    )

    # Recoveries attribution (AI vs Human)
    ai_recovered_revenue = Decimal("0.00")
    human_recovered_revenue = Decimal("0.00")
    ai_recovery_cases_count = 0
    human_recovery_cases_count = 0

    for tx in transactions:
        if tx.status == PaymentStatus.SUCCESS and tx.recovered_amount and tx.recovered_amount > 0:
            if getattr(tx, "customer_response", "") == "RECOVERED_BY_HUMAN":
                human_recovered_revenue += Decimal(tx.recovered_amount)
                human_recovery_cases_count += 1
            else:
                ai_recovered_revenue += Decimal(tx.recovered_amount)
                ai_recovery_cases_count += 1

    total_recovered_revenue = ai_recovered_revenue + human_recovered_revenue
    total_recovered_cases = ai_recovery_cases_count + human_recovery_cases_count
    total_failure_events = failed_orders + checkout_abandonments

    recovery_rate = (
        (total_recovered_cases / total_failure_events * 100)
        if total_failure_events > 0
        else 0.0
    )

    # High Risk Cases (amount >= 10,000 and at risk)
    high_risk_cases_count = sum(
        1 for tx in recoverable_txs if float(tx.amount or 0) >= 10000.0
    )

    # Product-Level Revenue Loss Breakdown
    product_stats: dict[str, dict[str, Any]] = {}
    for prod in ELECTRICAL_PRODUCTS:
        product_stats[prod["id"]] = {
            "product_id": prod["id"],
            "product_name": prod["name"],
            "category": prod["category"],
            "unit_price": prod["price"],
            "orders_count": 0,
            "successful_orders": 0,
            "failed_orders": 0,
            "network_errors": 0,
            "checkout_abandonments": 0,
            "revenue_at_risk": Decimal("0.00"),
            "recovered_revenue": Decimal("0.00"),
            "recovery_rate": 0.0,
        }

    for tx in transactions:
        # Match product id or fallback to catalog
        prod_id = getattr(tx, "product_id", None)
        if not prod_id or prod_id not in product_stats:
            # Map by matching approximate amount or first item
            matching_prod = next(
                (p for p in ELECTRICAL_PRODUCTS if abs(float(p["price"]) - float(tx.amount)) < 5.0),
                ELECTRICAL_PRODUCTS[0],
            )
            prod_id = matching_prod["id"]

        stat = product_stats[prod_id]
        stat["orders_count"] += 1

        if tx.status == PaymentStatus.SUCCESS:
            stat["successful_orders"] += 1
            if tx.recovered_amount and tx.recovered_amount > 0:
                stat["recovered_revenue"] += Decimal(tx.recovered_amount)
        elif tx.status == PaymentStatus.FAILED:
            stat["failed_orders"] += 1
            if "network" in ((tx.failure_reason or "") + (tx.gateway_response or "")).lower():
                stat["network_errors"] += 1
            if tx.recovery_status not in {RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED}:
                stat["revenue_at_risk"] += Decimal(tx.amount or 0)
        elif tx.status == PaymentStatus.ABANDONED:
            stat["checkout_abandonments"] += 1
            if tx.recovery_status not in {RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED}:
                stat["revenue_at_risk"] += Decimal(tx.amount or 0)

    # Convert Decimal to float for JSON
    product_loss_list: list[dict[str, Any]] = []
    for stat in product_stats.values():
        total_p_fails = stat["failed_orders"] + stat["checkout_abandonments"]
        p_recovered = float(stat["recovered_revenue"])
        p_at_risk = float(stat["revenue_at_risk"])
        stat["revenue_at_risk"] = p_at_risk
        stat["recovered_revenue"] = p_recovered
        stat["recovery_rate"] = round(
            (p_recovered / (p_at_risk + p_recovered) * 100) if (p_at_risk + p_recovered) > 0 else 0.0,
            1,
        )
        product_loss_list.append(stat)

    # Sort products by highest revenue at risk first
    product_loss_list.sort(key=lambda x: (x["revenue_at_risk"], x["orders_count"]), reverse=True)

    # Funnel counts
    checkout_started_count = total_orders
    payment_initiated_count = total_orders - checkout_abandonments
    payment_failed_count = failed_orders
    customer_retry_count = sum(1 for tx in transactions if tx.retry_count > 0)
    escalated_to_human_count = sum(
        1
        for tx in transactions
        if tx.escalation_status in {EscalationStatus.OPEN, EscalationStatus.IN_REVIEW, EscalationStatus.RESOLVED}
        or tx.recovery_status == RecoveryStatus.ESCALATED
    )

    return {
        "total_orders": total_orders,
        "successful_orders": successful_orders,
        "failed_orders": failed_orders,
        "pending_orders": pending_orders,
        "checkout_abandonments": checkout_abandonments,
        "network_errors": network_errors,
        "payment_failures": failed_orders,
        "failure_breakdown": {
            "network_errors": network_errors,
            "timeouts": timeouts,
            "bank_declines": bank_declines,
            "auth_failures": auth_failures,
            "abandonments": checkout_abandonments,
            "other": other_failures,
        },
        "revenue_at_risk": float(revenue_at_risk),
        "revenue_risk_breakdown": {
            "network_errors": float(network_error_risk),
            "payment_failures": float(payment_failure_risk),
            "checkout_abandonments": float(abandonment_risk),
            "human_pending_cases": float(human_pending_risk),
        },
        "ai_recovery_cases": ai_recovery_cases_count,
        "ai_recovered_revenue": float(ai_recovered_revenue),
        "human_recovery_cases": human_recovery_cases_count,
        "human_recovered_revenue": float(human_recovered_revenue),
        "total_recovered_revenue": float(total_recovered_revenue),
        "unresolved_cases": len(recoverable_txs),
        "unresolved_revenue": float(revenue_at_risk),
        "high_risk_cases": high_risk_cases_count,
        "recovery_rate": round(recovery_rate, 2),
        "funnel": {
            "orders": total_orders,
            "checkout_started": checkout_started_count,
            "payment_initiated": payment_initiated_count,
            "payment_failed_or_abandoned": total_failure_events,
            "revenue_at_risk_detected": len(recoverable_txs),
            "ai_recovery_triggered": total_failure_events,
            "customer_retry_executed": customer_retry_count,
            "ai_payment_success": ai_recovery_cases_count,
            "escalated_to_human": escalated_to_human_count,
            "human_payment_success": human_recovery_cases_count,
        },
        "product_revenue_loss": product_loss_list,
        "generated_at": datetime.datetime.utcnow().isoformat(),
    }


def list_seller_cases(
    db: Session,
    filter_type: str | None = None,
    product_id: str | None = None,
    risk_filter: str | None = None,
    status_filter: str | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    """Returns filtered seller recovery cases."""
    txs = (
        db.scalars(
            select(Transaction)
            .options(
                joinedload(Transaction.customer),
                joinedload(Transaction.payment_attempts),
                joinedload(Transaction.escalation_cases),
            )
            .order_by(desc(Transaction.created_at))
        )
        .unique()
        .all()
    )

    cases: list[dict[str, Any]] = []

    for tx in txs:
        cust = tx.customer
        reason = tx.failure_reason or ""
        gw = tx.gateway_response or ""
        is_network = "network" in (reason + gw).lower()
        amt = float(tx.amount)

        # Risk Classification
        if amt >= 50000:
            risk = "CRITICAL"
        elif amt >= 10000:
            risk = "HIGH"
        elif amt >= 1000:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        # Match Product
        pid = getattr(tx, "product_id", None)
        p_obj = get_product_by_id(pid) if pid else None
        if not p_obj:
            p_obj = next(
                (p for p in ELECTRICAL_PRODUCTS if abs(float(p["price"]) - amt) < 5.0),
                ELECTRICAL_PRODUCTS[0],
            )
            pid = p_obj["id"]

        pname = getattr(tx, "product_name", None) or p_obj["name"]

        # Human & AI Status
        ai_status = "ACTIVE" if tx.recovery_status == RecoveryStatus.OPEN else (
            "RECOVERED" if tx.recovery_status == RecoveryStatus.RECOVERED and tx.customer_response != "RECOVERED_BY_HUMAN" else (
                "FAILED" if tx.recovery_status == RecoveryStatus.ESCALATED else tx.recovery_status.value
            )
        )

        has_escalation = bool(tx.escalation_cases)
        esc_case = tx.escalation_cases[0] if has_escalation else None
        human_status = (
            esc_case.status.value if esc_case else ("ASSIGNED" if tx.recovery_status == RecoveryStatus.ESCALATED else "-")
        )

        # Main Recovery Status for table
        if tx.status == PaymentStatus.SUCCESS:
            rec_status = "RECOVERED"
        elif tx.escalation_status in {EscalationStatus.OPEN, EscalationStatus.IN_REVIEW} or tx.recovery_status == RecoveryStatus.ESCALATED:
            rec_status = "HUMAN_REVIEW"
        elif tx.status == PaymentStatus.ABANDONED:
            rec_status = "CHECKOUT_ABANDONED"
        elif tx.recovery_status == RecoveryStatus.OPEN:
            rec_status = "AI_RECOVERY_ACTIVE"
        elif tx.status == PaymentStatus.FAILED:
            rec_status = "AT_RISK"
        else:
            rec_status = tx.status.value

        # Apply Filters
        if filter_type:
            f = filter_type.upper()
            if f == "NETWORK_ERROR" and not is_network:
                continue
            if f == "PAYMENT_FAILED" and tx.status != PaymentStatus.FAILED:
                continue
            if f == "CHECKOUT_ABANDONED" and tx.status != PaymentStatus.ABANDONED:
                continue
            if f == "AI_RECOVERY" and rec_status != "AI_RECOVERY_ACTIVE":
                continue
            if f == "HUMAN_REVIEW" and rec_status != "HUMAN_REVIEW":
                continue
            if f == "RECOVERED" and rec_status != "RECOVERED":
                continue
            if f == "UNRESOLVED" and tx.status == PaymentStatus.SUCCESS:
                continue
            if f == "HIGH_RISK" and risk not in {"HIGH", "CRITICAL"}:
                continue
            if f == "MEDIUM_RISK" and risk != "MEDIUM":
                continue
            if f == "LOW_RISK" and risk != "LOW":
                continue

        if product_id and product_id != "ALL" and pid != product_id:
            continue

        if risk_filter and risk_filter != "ALL" and risk != risk_filter.upper():
            continue

        if status_filter and status_filter != "ALL" and rec_status != status_filter.upper():
            continue

        if search:
            s = search.lower().strip()
            cust_str = f"{cust.name if cust else ''} {cust.email if cust else ''}".lower()
            if s not in tx.order_id.lower() and s not in tx.transaction_id.lower() and s not in pname.lower() and s not in cust_str:
                continue

        recovery_token = getattr(tx, "recovery_token", None) or f"token_{tx.transaction_id}"

        cases.append(
            {
                "order_id": tx.order_id,
                "transaction_id": tx.transaction_id,
                "customer": {
                    "name": cust.name if cust else "Valued Customer",
                    "email": cust.email if cust else "customer@example.com",
                    "phone": cust.phone if cust else "+91 98765 43210",
                },
                "product_id": pid,
                "product_name": pname,
                "category": p_obj.get("category", "Electricals"),
                "amount": amt,
                "currency": tx.currency,
                "payment_status": tx.status.value,
                "failure_reason": reason or ("Checkout Abandoned" if tx.status == PaymentStatus.ABANDONED else "-"),
                "is_network_error": is_network,
                "attempts": (len(tx.payment_attempts) or (tx.retry_count + 1)),
                "risk": risk,
                "revenue_at_risk": amt if tx.status != PaymentStatus.SUCCESS else 0.0,
                "ai_status": ai_status,
                "human_status": human_status,
                "recovery_status": rec_status,
                "recovery_token": recovery_token,
                "created_at": tx.created_at.isoformat() if tx.created_at else None,
            }
        )

    return cases
