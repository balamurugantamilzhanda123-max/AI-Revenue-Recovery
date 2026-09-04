import io
import os
import uuid
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from app.config import settings

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    _REPORTLAB_AVAILABLE = True
except ImportError:
    _REPORTLAB_AVAILABLE = False


INVOICE_DIR = Path("invoices")
INVOICE_DIR.mkdir(parents=True, exist_ok=True)


class InvoiceService:
    def generate_invoice_pdf(self, order_info: dict[str, Any]) -> bytes:
        """
        Generates a professional PDF invoice using ReportLab.
        Returns raw PDF bytes.
        """
        buffer = io.BytesIO()

        if not _REPORTLAB_AVAILABLE:
            # Fallback simple text-based PDF header if reportlab is absent
            buffer.write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n")
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
        title_style = styles["Title"]

        brand_style = ParagraphStyle(
            "Brand",
            parent=title_style,
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#0f172a"),
            alignment=0,
        )

        h2_style = ParagraphStyle(
            "H2",
            parent=normal_style,
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#047857"),
            fontName="Helvetica-Bold",
        )

        meta_style = ParagraphStyle(
            "Meta",
            parent=normal_style,
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#475569"),
        )

        body_style = ParagraphStyle(
            "Body",
            parent=normal_style,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#1e293b"),
        )

        elements = []

        # 1. Header & Brand Title
        header_data = [
            [
                Paragraph("<b>VoltStore</b><br/><font size=8 color='#64748b'>Electronics & Computing Solutions</font>", brand_style),
                Paragraph(
                    f"<b>TAX INVOICE / E-RECEIPT</b><br/>"
                    f"<b>Invoice #:</b> {order_info.get('invoice_number', 'INV-' + uuid.uuid4().hex[:8].upper())}<br/>"
                    f"<b>Date:</b> {order_info.get('date', datetime.now().strftime('%d %b %Y, %I:%M %p'))}<br/>"
                    f"<b>Order ID:</b> {order_info.get('order_id', 'N/A')}",
                    meta_style,
                ),
            ]
        ]
        header_table = Table(header_data, colWidths=[300, 240])
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 10))

        # 2. Customer & Shipping Info
        customer_name = order_info.get("customer_name", "Valued Customer")
        customer_email = order_info.get("customer_email", "")
        customer_phone = order_info.get("customer_phone", "")
        shipping_addr = order_info.get("shipping_address", "Delivery Address on file")

        info_data = [
            [
                Paragraph("<b>Billed & Shipped To:</b>", h2_style),
                Paragraph("<b>Payment Information:</b>", h2_style),
            ],
            [
                Paragraph(
                    f"<b>{customer_name}</b><br/>"
                    f"Email: {customer_email}<br/>"
                    f"Phone: {customer_phone}<br/>"
                    f"Address: {shipping_addr}",
                    body_style,
                ),
                Paragraph(
                    f"<b>Status:</b> PAID & CONFIRMED<br/>"
                    f"<b>Gateway:</b> Razorpay Standard<br/>"
                    f"<b>Payment ID:</b> {order_info.get('payment_reference', 'N/A')}<br/>"
                    f"<b>Order Token:</b> {order_info.get('razorpay_order_id', 'N/A')}",
                    body_style,
                ),
            ],
        ]
        info_table = Table(info_data, colWidths=[270, 270])
        info_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 15))

        # 3. Items Table
        items_data = [
            [
                Paragraph("<b>Item Description</b>", meta_style),
                Paragraph("<b>Category</b>", meta_style),
                Paragraph("<b>Qty</b>", meta_style),
                Paragraph("<b>Unit Price</b>", meta_style),
                Paragraph("<b>Total (INR)</b>", meta_style),
            ]
        ]

        items = order_info.get("items", [])
        if not items:
            items = [{
                "name": order_info.get("product_name", "Electrical / Electronics Product"),
                "category": order_info.get("category", "General"),
                "quantity": order_info.get("quantity", 1),
                "unit_price": order_info.get("unit_price", order_info.get("amount", 0)),
                "subtotal": order_info.get("subtotal", order_info.get("amount", 0)),
            }]

        for item in items:
            qty = item.get("quantity", 1)
            unit_p = float(item.get("unit_price", 0))
            sub_t = float(item.get("subtotal", unit_p * qty))
            items_data.append([
                Paragraph(f"<b>{item.get('name', 'Product')}</b>", body_style),
                Paragraph(item.get("category", "Electronics"), body_style),
                Paragraph(str(qty), body_style),
                Paragraph(f"₹{unit_p:,.2f}", body_style),
                Paragraph(f"₹{sub_t:,.2f}", body_style),
            ])

        # Summary calculations
        subtotal = float(order_info.get("subtotal", 0))
        delivery = float(order_info.get("delivery_charge", 0))
        discount = float(order_info.get("discount", 0))
        total_amount = float(order_info.get("total_amount", subtotal + delivery - discount))

        items_data.append([
            "", "", "",
            Paragraph("<b>Subtotal:</b>", body_style),
            Paragraph(f"₹{subtotal:,.2f}", body_style),
        ])
        if discount > 0:
            items_data.append([
                "", "", "",
                Paragraph("<b>Discount:</b>", body_style),
                Paragraph(f"-₹{discount:,.2f}", body_style),
            ])
        items_data.append([
            "", "", "",
            Paragraph("<b>Delivery:</b>", body_style),
            Paragraph(f"₹{delivery:,.2f}" if delivery > 0 else "FREE", body_style),
        ])
        items_data.append([
            "", "", "",
            Paragraph("<b>Total Paid:</b>", h2_style),
            Paragraph(f"<b>₹{total_amount:,.2f}</b>", h2_style),
        ])

        items_table = Table(items_data, colWidths=[200, 110, 40, 95, 95])
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#047857")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, len(items)), 0.5, colors.HexColor("#e2e8f0")),
            ("LINEBELOW", (0, -1), (-1, -1), 1.5, colors.HexColor("#047857")),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 25))

        # 4. Footer & Legal
        footer_p = Paragraph(
            "<b>Thank you for shopping with VoltStore!</b><br/>"
            "This is a computer-generated electronic tax receipt verified via Razorpay Standard Checkout.<br/>"
            "For support, warranty claims, or order inquiries, contact support@voltstore.in.",
            meta_style,
        )
        elements.append(footer_p)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    def save_invoice_pdf(self, order_id: str, pdf_bytes: bytes) -> str:
        """
        Saves PDF invoice to disk and returns the relative filepath.
        """
        filename = f"VoltStore-Invoice-{order_id}.pdf"
        filepath = INVOICE_DIR / filename
        with open(filepath, "wb") as f:
            f.write(pdf_bytes)
        return str(filepath)


invoice_service = InvoiceService()
