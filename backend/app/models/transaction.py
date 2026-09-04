import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid_string() -> str:
    return str(uuid.uuid4())


class CustomerStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    OPTED_OUT = "OPTED_OUT"
    BLOCKED = "BLOCKED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    FAILED = "FAILED"
    SUCCESS = "SUCCESS"
    ABANDONED = "ABANDONED"
    UNRESOLVED = "UNRESOLVED"


class RecoveryStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    OPEN = "OPEN"
    DIAGNOSED = "DIAGNOSED"
    IN_PROGRESS = "IN_PROGRESS"
    RECOVERED = "RECOVERED"
    FAILED = "FAILED"
    UNRESOLVED = "UNRESOLVED"
    ESCALATED = "ESCALATED"
    STOPPED = "STOPPED"


class ActionStatus(str, enum.Enum):
    PENDING = "PENDING"
    POLICY_APPROVED = "POLICY_APPROVED"
    POLICY_BLOCKED = "POLICY_BLOCKED"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class EscalationStatus(str, enum.Enum):
    NONE = "NONE"
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"


class RootCause(str, enum.Enum):
    PAYMENT_TIMEOUT = "payment_timeout"
    BANK_DECLINE = "bank_decline"
    AUTHENTICATION_FAILURE = "authentication_failure"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    PAYMENT_METHOD_ISSUE = "payment_method_issue"
    CUSTOMER_ABANDONMENT = "customer_abandonment"
    TECHNICAL_FAILURE = "technical_failure"
    REPEATED_PAYMENT_FAILURE = "repeated_payment_failure"
    UNKNOWN = "unknown"


class RecommendedAction(str, enum.Enum):
    CONTROLLED_RETRY = "controlled_retry"
    RECOVERY_REMINDER = "recovery_reminder"
    RETRY_AUTHENTICATION = "retry_authentication"
    ESCALATE_HUMAN = "escalate_human"
    STOP_RECOVERY = "stop_recovery"
    NO_ACTION = "no_action"


class PolicyResult(str, enum.Enum):
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    ESCALATE = "ESCALATE"


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uuid_string)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[CustomerStatus] = mapped_column(
        SAEnum(CustomerStatus, native_enum=False),
        nullable=False,
        default=CustomerStatus.ACTIVE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    preferences: Mapped["CustomerPreference | None"] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
        uselist=False,
    )


class CustomerPreference(Base):
    __tablename__ = "customer_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    customer_id: Mapped[str] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    opted_out: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recovery_message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    customer: Mapped[Customer] = relationship(back_populates="preferences")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    transaction_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    customer_id: Mapped[str] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    order_id: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    payment_method: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, native_enum=False),
        nullable=False,
        default=PaymentStatus.PENDING,
    )
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    gateway_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    customer_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    recovery_status: Mapped[RecoveryStatus] = mapped_column(
        SAEnum(RecoveryStatus, native_enum=False),
        nullable=False,
        default=RecoveryStatus.NOT_STARTED,
    )
    recovered_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    escalation_status: Mapped[EscalationStatus] = mapped_column(
        SAEnum(EscalationStatus, native_enum=False),
        nullable=False,
        default=EscalationStatus.NONE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    customer: Mapped[Customer] = relationship(back_populates="transactions")
    payment_attempts: Mapped[list["PaymentAttempt"]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="PaymentAttempt.attempt_number",
    )
    recovery_cases: Mapped[list["RecoveryCase"]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="RecoveryCase.created_at.desc()",
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
    )
    escalation_cases: Mapped[list["EscalationCase"]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
    )


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"
    __table_args__ = (
        UniqueConstraint("transaction_id", "attempt_number", name="uq_payment_attempt_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, native_enum=False),
        nullable=False,
    )
    gateway_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    transaction: Mapped[Transaction] = relationship(back_populates="payment_attempts")


class RecoveryCase(Base):
    __tablename__ = "recovery_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
    )
    risk_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    root_cause: Mapped[str | None] = mapped_column(String(80), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    evidence: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    recommended_action: Mapped[str | None] = mapped_column(String(80), nullable=True)
    action_status: Mapped[ActionStatus] = mapped_column(
        SAEnum(ActionStatus, native_enum=False),
        nullable=False,
        default=ActionStatus.PENDING,
    )
    recovery_status: Mapped[RecoveryStatus] = mapped_column(
        SAEnum(RecoveryStatus, native_enum=False),
        nullable=False,
        default=RecoveryStatus.OPEN,
    )
    recovered_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    policy_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    detection_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    success_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    transaction: Mapped[Transaction] = relationship(back_populates="recovery_cases")
    recovery_actions: Mapped[list["RecoveryAction"]] = relationship(
        back_populates="recovery_case",
        cascade="all, delete-orphan",
        order_by="RecoveryAction.created_at",
    )


class RecoveryAction(Base):
    __tablename__ = "recovery_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    recovery_case_id: Mapped[str] = mapped_column(
        ForeignKey("recovery_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    action_type: Mapped[str] = mapped_column(String(80), nullable=False)
    action_reason: Mapped[str] = mapped_column(Text, nullable=False)
    policy_result: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    execution_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[ActionStatus] = mapped_column(
        SAEnum(ActionStatus, native_enum=False),
        nullable=False,
        default=ActionStatus.PENDING,
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    recovery_case: Mapped[RecoveryCase] = relationship(back_populates="recovery_actions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    transaction_id: Mapped[str | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    recovery_case_id: Mapped[str | None] = mapped_column(
        ForeignKey("recovery_cases.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    event_message: Mapped[str] = mapped_column(Text, nullable=False)
    actor: Mapped[str] = mapped_column(String(80), nullable=False, default="SYSTEM")
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    transaction: Mapped[Transaction | None] = relationship(back_populates="audit_logs")


class EscalationCase(Base):
    __tablename__ = "escalation_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
    )
    recovery_case_id: Mapped[str | None] = mapped_column(
        ForeignKey("recovery_cases.id", ondelete="SET NULL"),
        nullable=True,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM")
    status: Mapped[EscalationStatus] = mapped_column(
        SAEnum(EscalationStatus, native_enum=False),
        nullable=False,
        default=EscalationStatus.OPEN,
    )
    ai_recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_history: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    transaction: Mapped[Transaction] = relationship(back_populates="escalation_cases")


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    method: Mapped[str] = mapped_column(String(12), nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="IN_PROGRESS")
    transaction_id: Mapped[str | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    response_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False, default=4.5)
    reviews_count: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    badge: Mapped[str | None] = mapped_column(String(80), nullable=True)
    specifications: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    availability: Mapped[str] = mapped_column(String(40), nullable=False, default="IN_STOCK")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CustomerAccount(Base):
    __tablename__ = "customer_accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uuid_string)
    customer_id: Mapped[str] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CustomerAddress(Base):
    __tablename__ = "customer_addresses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uuid_string)
    customer_id: Mapped[str] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line1: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str] = mapped_column(String(20), nullable=False)
    landmark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uuid_string)
    customer_id: Mapped[str] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    transaction_id: Mapped[str | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    razorpay_order_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    razorpay_signature: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    product_id: Mapped[str] = mapped_column(String(80), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    delivery_charge: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")
    
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="PENDING_PAYMENT",
        index=True,
    )
    delivery_address: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uuid_string)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="RAZORPAY")
    event_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PROCESSED")
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class NotificationRecord(Base):
    __tablename__ = "notification_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uuid_string)
    customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    order_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="EMAIL")
    notification_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    provider_message_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uuid_string)
    invoice_number: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    order_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    transaction_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    customer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    billing_address: Mapped[str] = mapped_column(Text, nullable=False)
    shipping_address: Mapped[str] = mapped_column(Text, nullable=False)
    items: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    delivery_charge: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")
    payment_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PAID")
    payment_reference: Mapped[str] = mapped_column(String(120), nullable=False)
    pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


