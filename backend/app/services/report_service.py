import datetime
import io
from decimal import Decimal
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Customer,
    EscalationCase,
    EscalationStatus,
    PaymentAttempt,
    PaymentStatus,
    RecoveryAction,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
)

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import (
        HRFlowable,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )
    _REPORTLAB_AVAILABLE = True
except ImportError:
    _REPORTLAB_AVAILABLE = False

try:
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    _OPENPYXL_AVAILABLE = True
except ImportError:
    _OPENPYXL_AVAILABLE = False


def get_report_data(
    db: Session,
    date_from: str | None = None,
    date_to: str | None = None,
    status: str | None = None,
    failure_type: str | None = None,
    recovery_method: str | None = None,
) -> dict[str, Any]:
    """
    Calculates dynamic revenue recovery report metrics directly from database transactions.
    """
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.customer),
            joinedload(Transaction.recovery_cases).joinedload(RecoveryCase.recovery_actions),
            joinedload(Transaction.escalation_cases),
            joinedload(Transaction.payment_attempts),
        )
        .order_by(desc(Transaction.created_at))
    )

    all_txs = db.scalars(query).unique().all()

    # Filter transactions
    filtered_txs: list[Transaction] = []
    for tx in all_txs:
        # Date filtering
        if date_from and tx.created_at:
            try:
                dt_from = datetime.datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                if tx.created_at.astimezone(datetime.timezone.utc) < dt_from.astimezone(datetime.timezone.utc):
                    continue
            except Exception:
                pass

        if date_to and tx.created_at:
            try:
                dt_to = datetime.datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                if tx.created_at.astimezone(datetime.timezone.utc) > dt_to.astimezone(datetime.timezone.utc):
                    continue
            except Exception:
                pass

        # Status filtering
        if status and status.upper() != "ALL":
            if tx.status.value != status.upper() and tx.status.name != status.upper():
                continue

        # Failure Type filtering
        reason_comb = f"{tx.failure_reason or ''} {tx.gateway_response or ''}".lower()
        if failure_type and failure_type.upper() != "ALL":
            f_upper = failure_type.upper()
            if f_upper == "NETWORK_ERROR" and "network" not in reason_comb and "tcp rst" not in reason_comb:
                continue
            if f_upper == "PAYMENT_TIMEOUT" and "timeout" not in reason_comb:
                continue
            if f_upper in {"AUTH_FAILURE", "AUTHENTICATION_FAILURE"} and "auth" not in reason_comb and "otp" not in reason_comb and "3ds" not in reason_comb:
                continue
            if f_upper == "BANK_DECLINE" and "decline" not in reason_comb and "balance" not in reason_comb:
                continue
            if f_upper == "ABANDONMENT" and tx.status != PaymentStatus.ABANDONED:
                continue

        # Recovery Method filtering
        is_human = (
            getattr(tx, "customer_response", "") == "RECOVERED_BY_HUMAN"
            or tx.escalation_status in {EscalationStatus.OPEN, EscalationStatus.IN_REVIEW, EscalationStatus.RESOLVED}
            or tx.recovery_status == RecoveryStatus.ESCALATED
        )
        if recovery_method and recovery_method.upper() != "ALL":
            m_upper = recovery_method.upper()
            if m_upper == "AI" and is_human:
                continue
            if m_upper == "HUMAN" and not is_human:
                continue

        filtered_txs.append(tx)

    # 1. Summary Metrics
    total_orders = len(filtered_txs)
    successful_payments = sum(1 for tx in filtered_txs if tx.status == PaymentStatus.SUCCESS)
    failed_payments = sum(1 for tx in filtered_txs if tx.status == PaymentStatus.FAILED)
    abandoned_payments = sum(1 for tx in filtered_txs if tx.status == PaymentStatus.ABANDONED)

    # Recoverable = FAILED or ABANDONED or UNRESOLVED, not already recovered or stopped
    recoverable_txs = [
        tx
        for tx in filtered_txs
        if tx.status in {PaymentStatus.FAILED, PaymentStatus.ABANDONED, PaymentStatus.UNRESOLVED}
        and tx.recovery_status not in {RecoveryStatus.RECOVERED, RecoveryStatus.STOPPED}
    ]
    revenue_at_risk = sum((Decimal(tx.amount or 0) for tx in recoverable_txs), Decimal("0.00"))

    # Recovery Attribution
    ai_recovered = Decimal("0.00")
    human_recovered = Decimal("0.00")
    ai_recovery_cases = 0
    human_recovery_cases = 0

    for tx in filtered_txs:
        if tx.status == PaymentStatus.SUCCESS and tx.recovered_amount and tx.recovered_amount > 0:
            if getattr(tx, "customer_response", "") == "RECOVERED_BY_HUMAN":
                human_recovered += Decimal(tx.recovered_amount)
                human_recovery_cases += 1
            else:
                ai_recovered += Decimal(tx.recovered_amount)
                ai_recovery_cases += 1
        elif tx.recovery_status == RecoveryStatus.OPEN:
            ai_recovery_cases += 1
        elif tx.recovery_status == RecoveryStatus.ESCALATED or bool(tx.escalation_cases):
            human_recovery_cases += 1

    total_recovered = ai_recovered + human_recovered
    base_recovery_pool = revenue_at_risk + total_recovered
    recovery_rate = (
        round((float(total_recovered) / float(base_recovery_pool) * 100), 1)
        if base_recovery_pool > 0
        else 0.0
    )

    # 2. Failure Analysis
    network_errors = 0
    payment_timeouts = 0
    authentication_failures = 0
    abandonments = abandoned_payments
    other_failures = 0

    for tx in filtered_txs:
        comb = f"{tx.failure_reason or ''} {tx.gateway_response or ''}".lower()
        if "network" in comb or "tcp rst" in comb or "connection" in comb:
            network_errors += 1
        elif "timeout" in comb or "504" in comb:
            payment_timeouts += 1
        elif "auth" in comb or "3ds" in comb or "otp" in comb:
            authentication_failures += 1
        elif tx.status == PaymentStatus.FAILED:
            other_failures += 1

    # 3. Recovery Analysis
    high_risk_cases = sum(1 for tx in recoverable_txs if float(tx.amount or 0) >= 10000.0)
    unresolved_cases = len(recoverable_txs)

    # 4. Executive Findings
    findings: list[str] = []
    if total_orders == 0:
        findings.append("No transactions or revenue events recorded in the current system period.")
        findings.append("Operational baseline is reset. Ready to ingest new checkout transactions.")
    else:
        findings.append(
            f"Total monitored volume is {total_orders} transactions with ₹{float(revenue_at_risk):,.2f} currently at risk."
        )
        findings.append(
            f"Autonomous AI & Human recovery recovered ₹{float(total_recovered):,.2f} representing a {recovery_rate}% recovery success rate."
        )
        if unresolved_cases > 0:
            findings.append(
                f"{unresolved_cases} active unresolved case(s) requiring automated retry sequence or human associate review."
            )
        else:
            findings.append("Zero unresolved cases remaining. All identified revenue risks have been resolved or stopped.")

        if network_errors > 0 or payment_timeouts > 0:
            top_tech = "Network Drops (TCP RST)" if network_errors >= payment_timeouts else "Gateway Timeouts (504)"
            findings.append(
                f"Primary technical failure driver: {top_tech} with {max(network_errors, payment_timeouts)} occurrences."
            )

        if float(total_recovered) > 0:
            ai_share = round((float(ai_recovered) / float(total_recovered) * 100), 1) if float(total_recovered) > 0 else 0
            human_share = round((float(human_recovered) / float(total_recovered) * 100), 1) if float(total_recovered) > 0 else 0
            findings.append(
                f"Recovery Contribution Breakdown: AI Autonomous Retries contributed {ai_share}%, Human Associates contributed {human_share}%."
            )

    # 5. Transaction Details List
    details: list[dict[str, Any]] = []
    for tx in filtered_txs:
        rec_case = tx.recovery_cases[0] if tx.recovery_cases else None
        rec_action = rec_case.recovery_actions[0] if rec_case and rec_case.recovery_actions else None
        
        # Diagnosis
        diagnosis = rec_case.root_cause if rec_case and rec_case.root_cause else (
            "Network Connection Interrupted" if "network" in (tx.failure_reason or "").lower() else (
                "Gateway Handshake Timeout" if "timeout" in (tx.failure_reason or "").lower() else (
                    "Authentication Handshake Failed" if "auth" in (tx.failure_reason or "").lower() else (
                        "Standard Authorization" if tx.status == PaymentStatus.SUCCESS else "Payment Failure"
                    )
                )
            )
        )

        # Recovery Action & Method
        rec_method = (
            "Human Associate" if getattr(tx, "customer_response", "") == "RECOVERED_BY_HUMAN" or tx.escalation_status != EscalationStatus.NONE
            else ("AI Autonomous Agent" if tx.status != PaymentStatus.SUCCESS or tx.recovered_amount > 0 else "Direct Authorization")
        )
        
        action_name = (
            rec_action.action_type if rec_action else (
                "Automated Smart Retry" if tx.status == PaymentStatus.FAILED and "network" in (tx.failure_reason or "").lower()
                else ("Customer Recovery Link" if tx.status == PaymentStatus.ABANDONED else "Immediate Capture")
            )
        )

        details.append({
            "transaction_id": tx.transaction_id,
            "order_id": tx.order_id,
            "amount": float(tx.amount or 0),
            "currency": tx.currency or "INR",
            "status": tx.status.value if hasattr(tx.status, "value") else str(tx.status),
            "failure_type": tx.failure_reason or ("Checkout Abandonment" if tx.status == PaymentStatus.ABANDONED else "None"),
            "diagnosis": diagnosis,
            "recovery_action": action_name,
            "recovery_method": rec_method,
            "recovery_status": tx.recovery_status.value if hasattr(tx.recovery_status, "value") else str(tx.recovery_status),
            "recovered_amount": float(tx.recovered_amount or 0),
            "created_date": tx.created_at.isoformat() if tx.created_at else None,
            "updated_date": tx.updated_at.isoformat() if tx.updated_at else None,
        })

    return {
        "summary": {
            "total_orders": total_orders,
            "successful_payments": successful_payments,
            "failed_payments": failed_payments,
            "abandoned_payments": abandoned_payments,
            "revenue_at_risk": float(revenue_at_risk),
            "ai_recovered": float(ai_recovered),
            "human_recovered": float(human_recovered),
            "total_recovered": float(total_recovered),
            "recovery_rate": recovery_rate,
        },
        "failure_analysis": {
            "network_errors": network_errors,
            "payment_timeouts": payment_timeouts,
            "authentication_failures": authentication_failures,
            "abandonments": abandonments,
            "other_failures": other_failures,
        },
        "recovery_analysis": {
            "ai_recovery_cases": ai_recovery_cases,
            "human_recovery_cases": human_recovery_cases,
            "high_risk_cases": high_risk_cases,
            "unresolved_cases": unresolved_cases,
        },
        "executive_findings": findings,
        "transactions": details,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "filters": {
            "date_from": date_from,
            "date_to": date_to,
            "status": status,
            "failure_type": failure_type,
            "recovery_method": recovery_method,
        },
    }


def generate_report_pdf(report_data: dict[str, Any]) -> bytes:
    """
    Generates a PDF Revenue Recovery Report using ReportLab.
    """
    buffer = io.BytesIO()

    if not _REPORTLAB_AVAILABLE:
        buffer.write(b"%PDF-1.4\n% ReviveAI PDF Fallback\n")
        buffer.seek(0)
        return buffer.getvalue()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    normal_style = styles["Normal"]

    brand_title_style = ParagraphStyle(
        "BrandTitle",
        parent=normal_style,
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#065F46"),
        fontName="Helvetica-Bold",
    )

    doc_subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=normal_style,
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )

    section_hdr_style = ParagraphStyle(
        "SectionHdr",
        parent=normal_style,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#065F46"),
        fontName="Helvetica-Bold",
        spaceBefore=8,
        spaceAfter=4,
    )

    meta_style = ParagraphStyle(
        "Meta",
        parent=normal_style,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748B"),
    )

    cell_style = ParagraphStyle(
        "Cell",
        parent=normal_style,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1E293B"),
    )

    cell_bold_style = ParagraphStyle(
        "CellBold",
        parent=normal_style,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
        fontName="Helvetica-Bold",
    )

    elements = []

    # 1. Header
    gen_time = report_data.get("generated_at", datetime.datetime.now(datetime.timezone.utc).isoformat())
    header_data = [
        [
            Paragraph("<b>REVIVEAI</b><br/><font size=9 color='#047857'>Autonomous Revenue Recovery</font>", brand_title_style),
            Paragraph(
                f"<b>Revenue Recovery Report</b><br/>"
                f"<font size=8 color='#64748B'>Generated: {gen_time[:19].replace('T', ' ')} UTC</font>",
                doc_subtitle_style,
            ),
        ]
    ]
    hdr_table = Table(header_data, colWidths=[300, 240])
    hdr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(hdr_table)
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=10))

    summary = report_data.get("summary", {})

    # 2. Executive Summary
    elements.append(Paragraph("EXECUTIVE SUMMARY", section_hdr_style))
    summary_data = [
        [
            Paragraph("Total Orders", cell_bold_style),
            Paragraph(str(summary.get("total_orders", 0)), cell_style),
            Paragraph("Revenue at Risk", cell_bold_style),
            Paragraph(f"INR {summary.get('revenue_at_risk', 0):,.2f}", cell_style),
        ],
        [
            Paragraph("Successful Payments", cell_bold_style),
            Paragraph(str(summary.get("successful_payments", 0)), cell_style),
            Paragraph("AI Recovered", cell_bold_style),
            Paragraph(f"INR {summary.get('ai_recovered', 0):,.2f}", cell_style),
        ],
        [
            Paragraph("Failed Payments", cell_bold_style),
            Paragraph(str(summary.get("failed_payments", 0)), cell_style),
            Paragraph("Human Recovered", cell_bold_style),
            Paragraph(f"INR {summary.get('human_recovered', 0):,.2f}", cell_style),
        ],
        [
            Paragraph("Abandoned Payments", cell_bold_style),
            Paragraph(str(summary.get("abandoned_payments", 0)), cell_style),
            Paragraph("Total Recovered", cell_bold_style),
            Paragraph(f"INR {summary.get('total_recovered', 0):,.2f}", cell_style),
        ],
        [
            Paragraph("Recovery Rate", cell_bold_style),
            Paragraph(f"<b>{summary.get('recovery_rate', 0)}%</b>", cell_bold_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[130, 140, 130, 140])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 8))

    # 3. Failure & Recovery Analysis side-by-side
    fail = report_data.get("failure_analysis", {})
    rec = report_data.get("recovery_analysis", {})

    elements.append(Paragraph("FAILURE & RECOVERY ANALYSIS", section_hdr_style))
    analysis_data = [
        [
            Paragraph("Network Errors (TCP RST)", cell_bold_style),
            Paragraph(str(fail.get("network_errors", 0)), cell_style),
            Paragraph("AI Recovery Cases", cell_bold_style),
            Paragraph(str(rec.get("ai_recovery_cases", 0)), cell_style),
        ],
        [
            Paragraph("Payment Timeouts (504)", cell_bold_style),
            Paragraph(str(fail.get("payment_timeouts", 0)), cell_style),
            Paragraph("Human Recovery Cases", cell_bold_style),
            Paragraph(str(rec.get("human_recovery_cases", 0)), cell_style),
        ],
        [
            Paragraph("Authentication Failures (3DS/OTP)", cell_bold_style),
            Paragraph(str(fail.get("authentication_failures", 0)), cell_style),
            Paragraph("High Risk Cases (>= 10k)", cell_bold_style),
            Paragraph(str(rec.get("high_risk_cases", 0)), cell_style),
        ],
        [
            Paragraph("Checkout Abandonments", cell_bold_style),
            Paragraph(str(fail.get("abandonments", 0)), cell_style),
            Paragraph("Unresolved Cases", cell_bold_style),
            Paragraph(str(rec.get("unresolved_cases", 0)), cell_style),
        ],
    ]
    analysis_table = Table(analysis_data, colWidths=[140, 130, 140, 130])
    analysis_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(analysis_table)
    elements.append(Spacer(1, 8))

    # 4. Executive Findings
    findings = report_data.get("executive_findings", [])
    if findings:
        elements.append(Paragraph("EXECUTIVE FINDINGS", section_hdr_style))
        findings_rows = []
        for item in findings:
            findings_rows.append([Paragraph("•", cell_bold_style), Paragraph(item, cell_style)])
        findings_table = Table(findings_rows, colWidths=[15, 525])
        findings_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        elements.append(findings_table)
        elements.append(Spacer(1, 8))

    # 5. Transaction Details Table
    elements.append(Paragraph("TRANSACTION DETAILS", section_hdr_style))
    tx_list = report_data.get("transactions", [])
    if not tx_list:
        elements.append(Paragraph("<i>No transactions available.</i>", cell_style))
    else:
        tx_header = [
            Paragraph("Txn ID", cell_bold_style),
            Paragraph("Amount", cell_bold_style),
            Paragraph("Status", cell_bold_style),
            Paragraph("Failure Type", cell_bold_style),
            Paragraph("Recovery Action", cell_bold_style),
            Paragraph("Method", cell_bold_style),
            Paragraph("Recovery Status", cell_bold_style),
        ]
        tx_rows = [tx_header]
        for t in tx_list[:30]:  # Limit to 30 rows in single document
            tx_rows.append([
                Paragraph(t.get("transaction_id", "")[:14], cell_style),
                Paragraph(f"INR {t.get('amount', 0):,.0f}", cell_style),
                Paragraph(t.get("status", ""), cell_style),
                Paragraph(t.get("failure_type", "")[:20], cell_style),
                Paragraph(t.get("recovery_action", "")[:20], cell_style),
                Paragraph(t.get("recovery_method", "")[:15], cell_style),
                Paragraph(t.get("recovery_status", ""), cell_style),
            ])
        tx_table = Table(tx_rows, colWidths=[85, 65, 65, 105, 105, 65, 50])
        tx_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#065F46")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(tx_table)

    # 6. Footer
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0"), spaceAfter=6))
    footer_p = Paragraph(
        "<b>Generated by ReviveAI</b> • Autonomous Revenue Recovery & Safety Guardrails System<br/>"
        "Confidential operational financial intelligence report.",
        meta_style,
    )
    elements.append(footer_p)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


def generate_report_excel(report_data: dict[str, Any]) -> bytes:
    """
    Generates a 4-sheet Excel report using openpyxl:
    Sheet 1: Summary
    Sheet 2: Transactions
    Sheet 3: Recovery Analysis
    Sheet 4: Risk Analysis
    """
    buffer = io.BytesIO()

    if not _OPENPYXL_AVAILABLE:
        # Fallback empty xlsx stream
        wb = openpyxl.Workbook()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()

    wb = openpyxl.Workbook()
    header_fill = PatternFill(start_color="065F46", end_color="065F46", fill_type="solid")
    header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    bold_font = Font(name="Arial", size=10, bold=True)
    normal_font = Font(name="Arial", size=10)
    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    summary = report_data.get("summary", {})
    tx_list = report_data.get("transactions", [])
    fail = report_data.get("failure_analysis", {})
    rec = report_data.get("recovery_analysis", {})

    # ============================================================
    # Sheet 1: Summary
    # ============================================================
    ws1 = wb.active
    ws1.title = "Summary"
    ws1.append(["Metric", "Value"])

    summary_rows = [
        ["Total Orders", summary.get("total_orders", 0)],
        ["Successful Payments", summary.get("successful_payments", 0)],
        ["Failed Payments", summary.get("failed_payments", 0)],
        ["Abandoned Payments", summary.get("abandoned_payments", 0)],
        ["Revenue at Risk", f"INR {summary.get('revenue_at_risk', 0):,.2f}"],
        ["AI Recovered", f"INR {summary.get('ai_recovered', 0):,.2f}"],
        ["Human Recovered", f"INR {summary.get('human_recovered', 0):,.2f}"],
        ["Total Recovered", f"INR {summary.get('total_recovered', 0):,.2f}"],
        ["Recovery Rate", f"{summary.get('recovery_rate', 0)}%"],
        ["Network Errors", fail.get("network_errors", 0)],
        ["Payment Timeouts", fail.get("payment_timeouts", 0)],
        ["Authentication Failures", fail.get("authentication_failures", 0)],
        ["Abandonments", fail.get("abandonments", 0)],
        ["AI Recovery Cases", rec.get("ai_recovery_cases", 0)],
        ["Human Recovery Cases", rec.get("human_recovery_cases", 0)],
        ["High Risk Cases", rec.get("high_risk_cases", 0)],
        ["Unresolved Cases", rec.get("unresolved_cases", 0)],
    ]
    for row in summary_rows:
        ws1.append(row)

    # Style sheet 1
    for col_idx in [1, 2]:
        cell = ws1.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
    ws1.column_dimensions["A"].width = 28
    ws1.column_dimensions["B"].width = 25

    # ============================================================
    # Sheet 2: Transactions
    # ============================================================
    ws2 = wb.create_sheet(title="Transactions")
    tx_headers = [
        "Transaction ID",
        "Order ID",
        "Amount",
        "Status",
        "Failure Type",
        "Diagnosis",
        "Recovery Action",
        "Recovery Method",
        "Recovery Status",
        "Created At",
        "Updated At",
    ]
    ws2.append(tx_headers)
    for col_idx in range(1, len(tx_headers) + 1):
        cell = ws2.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font

    for t in tx_list:
        ws2.append([
            t.get("transaction_id", ""),
            t.get("order_id", ""),
            t.get("amount", 0),
            t.get("status", ""),
            t.get("failure_type", ""),
            t.get("diagnosis", ""),
            t.get("recovery_action", ""),
            t.get("recovery_method", ""),
            t.get("recovery_status", ""),
            t.get("created_date", ""),
            t.get("updated_date", ""),
        ])

    for col in ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]:
        ws2.column_dimensions[col].width = 22

    # ============================================================
    # Sheet 3: Recovery Analysis
    # ============================================================
    ws3 = wb.create_sheet(title="Recovery Analysis")
    rec_headers = [
        "Recovery ID",
        "Transaction ID",
        "Amount",
        "Method",
        "Action",
        "Status",
        "AI/Human",
        "Created At",
    ]
    ws3.append(rec_headers)
    for col_idx in range(1, len(rec_headers) + 1):
        cell = ws3.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font

    for t in tx_list:
        is_human = "Human" in t.get("recovery_method", "")
        ws3.append([
            f"REC-{t.get('transaction_id', '')}",
            t.get("transaction_id", ""),
            t.get("amount", 0),
            t.get("recovery_method", ""),
            t.get("recovery_action", ""),
            t.get("recovery_status", ""),
            "Human" if is_human else "AI",
            t.get("created_date", ""),
        ])

    for col in ["A", "B", "C", "D", "E", "F", "G", "H"]:
        ws3.column_dimensions[col].width = 22

    # ============================================================
    # Sheet 4: Risk Analysis
    # ============================================================
    ws4 = wb.create_sheet(title="Risk Analysis")
    risk_headers = [
        "Transaction ID",
        "Amount",
        "Risk Level",
        "Failure Type",
        "Status",
        "Resolution",
    ]
    ws4.append(risk_headers)
    for col_idx in range(1, len(risk_headers) + 1):
        cell = ws4.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font

    for t in tx_list:
        amt = float(t.get("amount", 0))
        risk_level = "CRITICAL" if amt >= 50000 else ("HIGH" if amt >= 10000 else ("MEDIUM" if amt >= 1000 else "LOW"))
        resolution = "RECOVERED" if t.get("status") == "SUCCESS" else ("UNRESOLVED" if t.get("recovery_status") != "STOPPED" else "STOPPED")
        ws4.append([
            t.get("transaction_id", ""),
            amt,
            risk_level,
            t.get("failure_type", ""),
            t.get("status", ""),
            resolution,
        ])

    for col in ["A", "B", "C", "D", "E", "F"]:
        ws4.column_dimensions[col].width = 22

    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
