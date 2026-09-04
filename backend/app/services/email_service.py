import base64
import datetime
import logging
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.models.transaction import NotificationRecord

logger = logging.getLogger("reviveai.email")

try:
    import resend
    _RESEND_AVAILABLE = True
except ImportError:
    resend = None
    _RESEND_AVAILABLE = False


class EmailService:
    def __init__(self) -> None:
        self.api_key = settings.resend_api_key
        self.from_email = settings.email_from or "VoltStore <orders@resend.dev>"
        self.app_url = settings.app_url or "http://localhost:3000"

        if _RESEND_AVAILABLE and self.api_key:
            resend.api_key = self.api_key

    def _log_notification(
        self,
        db: Session | None,
        recipient: str,
        subject: str,
        content: str,
        notification_type: str,
        status: str,
        customer_id: str | None = None,
        order_id: str | None = None,
        provider_message_id: str | None = None,
        failure_reason: str | None = None,
    ) -> None:
        if not db:
            return
        try:
            record = NotificationRecord(
                id=str(uuid.uuid4()),
                customer_id=customer_id,
                order_id=order_id,
                channel="EMAIL",
                notification_type=notification_type,
                recipient=recipient,
                subject=subject,
                content=content[:4000],
                status=status,
                provider_message_id=provider_message_id,
                failure_reason=failure_reason,
                sent_at=datetime.datetime.now(datetime.UTC) if status == "SENT" else None,
            )
            db.add(record)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to record notification log: {e}")
            try:
                db.rollback()
            except Exception:
                pass

    def _send_email_payload(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
        notification_type: str,
        db: Session | None = None,
        customer_id: str | None = None,
        order_id: str | None = None,
        attachments: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Dispatches email via Resend if API key is present; otherwise logs safely in mock mode.
        """
        logger.info(f"Dispatching [{notification_type}] to {to_email} | Subject: {subject}")
        provider_id = None
        status = "SENT"
        failure_msg = None

        if _RESEND_AVAILABLE and self.api_key and not self.api_key.startswith("re_placeholder"):
            try:
                params: dict[str, Any] = {
                    "from": self.from_email,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": text_content,
                }
                if attachments:
                    params["attachments"] = attachments
                
                resp = resend.Emails.send(params)
                provider_id = resp.get("id") if isinstance(resp, dict) else getattr(resp, "id", str(uuid.uuid4()))
                logger.info(f"Resend email dispatched successfully with ID: {provider_id}")
            except Exception as e:
                logger.error(f"Resend email delivery error: {e}")
                status = "FAILED"
                failure_msg = str(e)
        else:
            # Simulated / Local Test Mode
            provider_id = f"mock_msg_{uuid.uuid4().hex[:12]}"
            logger.info(f"[DEV TEST MODE] Email successfully simulated to {to_email} (MsgID: {provider_id})")

        self._log_notification(
            db=db,
            recipient=to_email,
            subject=subject,
            content=text_content,
            notification_type=notification_type,
            status=status,
            customer_id=customer_id,
            order_id=order_id,
            provider_message_id=provider_id,
            failure_reason=failure_msg,
        )

        return {
            "success": status == "SENT",
            "message_id": provider_id,
            "status": status,
            "error": failure_msg,
        }

    # ==========================================
    # 1. Welcome Email (Account Registration)
    # ==========================================
    def send_welcome_email(
        self,
        to_email: str,
        customer_name: str,
        db: Session | None = None,
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        subject = "Welcome to VoltStore"
        
        text = f"""Hi {customer_name},

Your VoltStore account has been successfully created.

You can now shop for premium electrical products, business laptops, and computer accessories.

Explore the store: {self.app_url}/store

Thank you,
The VoltStore Team
"""

        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
                <h1 style="color: #047857; margin: 0; font-size: 26px; font-weight: 800;">⚡ VoltStore</h1>
                <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Electronics & Computing Solutions</p>
            </div>
            
            <div style="padding: 24px 0;">
                <h2 style="color: #0f172a; font-size: 18px;">Welcome, {customer_name}! 👋</h2>
                <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                    Your VoltStore customer account has been successfully created. You can now browse our catalog of high-performance laptops, cooling appliances, surge protectors, and smart accessories with seamless delivery.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{self.app_url}/store" style="background: #047857; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: 700; border-radius: 8px; font-size: 14px; display: inline-block;">
                        Start Shopping Now →
                    </a>
                </div>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; color: #94a3b8; font-size: 12px; text-align: center;">
                <p>© 2026 VoltStore. All rights reserved.</p>
            </div>
        </div>
        """

        return self._send_email_payload(
            to_email=to_email,
            subject=subject,
            html_content=html,
            text_content=text,
            notification_type="ACCOUNT_CREATED",
            db=db,
            customer_id=customer_id,
        )

    # ==========================================
    # 2. Login Notification Email
    # ==========================================
    def send_login_notification(
        self,
        to_email: str,
        customer_name: str,
        login_time: str | None = None,
        db: Session | None = None,
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        time_str = login_time or datetime.datetime.now().strftime("%I:%M %p, %d %b %Y")
        subject = "New Login to Your VoltStore Account"
        
        text = f"""Hi {customer_name},

Your VoltStore account was successfully accessed.

Time: {time_str}

If this was you, no action is needed. If you did not authorize this login, please secure your account immediately.

VoltStore Security Team
"""

        html = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-top: 0;">Account Login Notification</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.5;">
                Hi <b>{customer_name}</b>, your account was accessed on <b>{time_str}</b>.
            </p>
            <p style="color: #64748b; font-size: 13px;">
                If this was not you, please contact support@voltstore.in immediately to lock your account.
            </p>
        </div>
        """

        return self._send_email_payload(
            to_email=to_email,
            subject=subject,
            html_content=html,
            text_content=text,
            notification_type="LOGIN_CONFIRMATION",
            db=db,
            customer_id=customer_id,
        )

    # ==========================================
    # 3. Order Confirmation & E-Bill Email
    # ==========================================
    def send_order_confirmation(
        self,
        to_email: str,
        order_data: dict[str, Any],
        pdf_bytes: bytes | None = None,
        db: Session | None = None,
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        order_id = order_data.get("order_id", "ORD-1001")
        customer_name = order_data.get("customer_name", "Valued Customer")
        product_name = order_data.get("product_name", "Electronics Item")
        quantity = order_data.get("quantity", 1)
        amount = float(order_data.get("total_amount", order_data.get("amount", 0)))
        delivery_addr = order_data.get("delivery_address", "Delivery address on file")
        if isinstance(delivery_addr, dict):
            delivery_addr = f"{delivery_addr.get('address_line1', '')}, {delivery_addr.get('city', '')} - {delivery_addr.get('pincode', '')}"

        subject = f"Order Confirmed — {order_id}"

        text = f"""Hi {customer_name},

Your order has been confirmed!

Order ID: {order_id}
Product: {product_name}
Quantity: {quantity}
Amount Paid: ₹{amount:,.2f}
Payment Status: PAID via Razorpay Standard Checkout

Delivery Address:
{delivery_addr}

Your official PDF tax invoice is attached to this email.

Thank you for your purchase.

The VoltStore Team
"""

        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
                <span style="background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; border: 1px solid #a7f3d0; text-transform: uppercase;">Payment Verified</span>
                <h1 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 22px;">Order Confirmed! 🎉</h1>
                <p style="color: #64748b; font-size: 14px; margin: 0;">Order Reference: <b>{order_id}</b></p>
            </div>

            <div style="padding: 20px 0;">
                <p style="color: #334155; font-size: 15px;">Hi <b>{customer_name}</b>, thank you for your order! We are preparing your items for dispatch.</p>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                        <tr>
                            <td style="color: #64748b; padding: 6px 0;">Item:</td>
                            <td style="color: #0f172a; font-weight: 700; text-align: right; padding: 6px 0;">{product_name} (x{quantity})</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; padding: 6px 0;">Total Amount:</td>
                            <td style="color: #047857; font-weight: 800; text-align: right; padding: 6px 0; font-size: 16px;">₹{amount:,.2f}</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; padding: 6px 0;">Payment:</td>
                            <td style="color: #0f172a; text-align: right; padding: 6px 0;">Paid (Razorpay Standard)</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; padding: 6px 0; vertical-align: top;">Shipping To:</td>
                            <td style="color: #0f172a; text-align: right; padding: 6px 0;">{delivery_addr}</td>
                        </tr>
                    </table>
                </div>

                <p style="color: #475569; font-size: 13px;">
                    📎 <b>Tax Invoice Attached:</b> Your PDF invoice <i>VoltStore-Invoice-{order_id}.pdf</i> is attached to this email. You can also view it in your <a href="{self.app_url}/store/orders" style="color: #047857; font-weight: 600;">Order History</a>.
                </p>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; color: #94a3b8; font-size: 12px; text-align: center;">
                <p>VoltStore • Autonomous Revenue Recovery Powered by ReviveAI</p>
            </div>
        </div>
        """

        attachments = None
        if pdf_bytes:
            encoded_pdf = base64.b64encode(pdf_bytes).decode("utf-8")
            attachments = [{
                "filename": f"VoltStore-Invoice-{order_id}.pdf",
                "content": encoded_pdf,
            }]

        return self._send_email_payload(
            to_email=to_email,
            subject=subject,
            html_content=html,
            text_content=text,
            notification_type="ORDER_CONFIRMED",
            db=db,
            customer_id=customer_id,
            order_id=order_id,
            attachments=attachments,
        )

    # ==========================================
    # 4. Payment Failure & AI Recovery Link Email
    # ==========================================
    def send_payment_failed_recovery(
        self,
        to_email: str,
        order_data: dict[str, Any],
        retry_url: str,
        failure_reason: str = "Bank / Network Error",
        db: Session | None = None,
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        order_id = order_data.get("order_id", "ORD-1001")
        customer_name = order_data.get("customer_name", "Customer")
        product_name = order_data.get("product_name", "Your Order")
        amount = float(order_data.get("total_amount", order_data.get("amount", 0)))

        subject = "Payment Failed — Complete Your VoltStore Order"

        text = f"""Hi {customer_name},

Your payment for:
{product_name}
Amount: ₹{amount:,.2f}

could not be completed due to: {failure_reason}.

Your order is reserved and ready. Please use the secure one-click payment link below to complete your order safely:

{retry_url}

If you have already paid, please ignore this email.

The VoltStore Team
"""

        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #fecaca; border-radius: 12px;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #fee2e2;">
                <span style="background: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; border: 1px solid #fecaca; text-transform: uppercase;">Payment Incomplete</span>
                <h1 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 20px;">Complete Your VoltStore Order</h1>
                <p style="color: #64748b; font-size: 14px; margin: 0;">Order: <b>{order_id}</b></p>
            </div>

            <div style="padding: 20px 0;">
                <p style="color: #334155; font-size: 15px;">Hi <b>{customer_name}</b>,</p>
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                    We noticed your payment for <b>{product_name}</b> (₹{amount:,.2f}) could not be completed (<i>{failure_reason}</i>).
                </p>
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                    Don't worry — your cart items are reserved for you. You can securely finish your payment using your preferred payment method (UPI, Cards, Netbanking) using the secure link below:
                </p>

                <div style="text-align: center; margin: 28px 0;">
                    <a href="{retry_url}" style="background: #047857; color: #ffffff; padding: 14px 32px; text-decoration: none; font-weight: 700; border-radius: 8px; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        Complete Payment Now →
                    </a>
                </div>

                <p style="color: #64748b; font-size: 12px; line-height: 1.5; text-align: center;">
                    Link not clickable? Copy and paste this URL into your browser:<br/>
                    <a href="{retry_url}" style="color: #047857; word-break: break-all;">{retry_url}</a>
                </p>
            </div>

            <div style="border-top: 1px solid #fee2e2; padding-top: 16px; color: #94a3b8; font-size: 12px; text-align: center;">
                <p>VoltStore • Autonomous Revenue Recovery Powered by ReviveAI</p>
            </div>
        </div>
        """

        return self._send_email_payload(
            to_email=to_email,
            subject=subject,
            html_content=html,
            text_content=text,
            notification_type="PAYMENT_FAILED",
            db=db,
            customer_id=customer_id,
            order_id=order_id,
        )

    # ==========================================
    # 5. Human Escalation Support Notification
    # ==========================================
    def send_human_escalation_notification(
        self,
        to_email: str,
        order_data: dict[str, Any],
        case_data: dict[str, Any],
        db: Session | None = None,
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        order_id = order_data.get("order_id", "ORD-1001")
        customer_name = order_data.get("customer_name", "Customer")
        subject = f"Support Assistance for Your Order — {order_id}"

        text = f"""Hi {customer_name},

Our priority support associate has been assigned to assist you with order {order_id}.

We will ensure your checkout is completed smoothly without any repeated charges.

VoltStore Priority Support
"""

        html = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-top: 0;">VoltStore Priority Customer Support</h2>
            <p style="color: #334155; font-size: 14px;">Hi <b>{customer_name}</b>,</p>
            <p style="color: #334155; font-size: 14px; line-height: 1.5;">
                We saw that you experienced difficulty completing payment for order <b>{order_id}</b>. A dedicated human associate has been assigned to help you resolve this issue immediately.
            </p>
        </div>
        """

        return self._send_email_payload(
            to_email=to_email,
            subject=subject,
            html_content=html,
            text_content=text,
            notification_type="HUMAN_ASSISTANCE",
            db=db,
            customer_id=customer_id,
            order_id=order_id,
        )


email_service = EmailService()
