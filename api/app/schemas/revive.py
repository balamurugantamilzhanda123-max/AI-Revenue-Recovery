from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    FAILED = "FAILED"
    SUCCESS = "SUCCESS"
    ABANDONED = "ABANDONED"
    UNRESOLVED = "UNRESOLVED"


class RootCause(str, Enum):
    PAYMENT_TIMEOUT = "payment_timeout"
    BANK_DECLINE = "bank_decline"
    AUTHENTICATION_FAILURE = "authentication_failure"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    PAYMENT_METHOD_ISSUE = "payment_method_issue"
    CUSTOMER_ABANDONMENT = "customer_abandonment"
    TECHNICAL_FAILURE = "technical_failure"
    REPEATED_PAYMENT_FAILURE = "repeated_payment_failure"
    UNKNOWN = "unknown"


class RecommendedAction(str, Enum):
    CONTROLLED_RETRY = "controlled_retry"
    RECOVERY_REMINDER = "recovery_reminder"
    RETRY_AUTHENTICATION = "retry_authentication"
    ESCALATE_HUMAN = "escalate_human"
    STOP_RECOVERY = "stop_recovery"
    NO_ACTION = "no_action"


class CustomerOut(BaseModel):
    id: str
    name: str
    email: str | None = None
    phone: str | None = None
    status: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TransactionCreate(BaseModel):
    transaction_id: str = Field(min_length=2, max_length=120)
    customer_id: str = Field(min_length=2, max_length=64)
    order_id: str = Field(min_length=2, max_length=120)
    amount: Decimal = Field(ge=Decimal("0.00"))
    currency: str = Field(default="INR", min_length=3, max_length=8)
    payment_method: str = Field(min_length=2, max_length=80)
    status: PaymentStatus = PaymentStatus.PENDING
    failure_reason: str | None = None
    gateway_response: str | None = None
    retry_count: int = Field(default=0, ge=0)
    customer_response: str | None = None
    customer_name: str = Field(default="Guest Customer", max_length=255)
    customer_email: str | None = Field(default=None, max_length=255)
    customer_phone: str | None = None


class TransactionUpdate(BaseModel):
    status: PaymentStatus | None = None
    failure_reason: str | None = None
    gateway_response: str | None = None
    retry_count: int | None = Field(default=None, ge=0)
    customer_response: str | None = None
    recovery_status: str | None = None
    escalation_status: str | None = None


class PaymentAttemptOut(BaseModel):
    id: str
    transaction_id: str
    attempt_number: int
    status: str
    gateway_response: str | None
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class RecoveryActionOut(BaseModel):
    id: str
    recovery_case_id: str
    action_type: str
    action_reason: str
    policy_result: dict[str, Any]
    execution_result: dict[str, Any] | None
    status: str
    idempotency_key: str | None
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class RecoveryCaseOut(BaseModel):
    id: str
    transaction_id: str
    risk_amount: Decimal
    root_cause: str | None
    confidence: float | None
    evidence: list[str]
    recommended_action: str | None
    action_status: str
    recovery_status: str
    recovered_amount: Decimal
    policy_result: dict[str, Any] | None
    detection_timestamp: datetime | None
    success_timestamp: datetime | None
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class TransactionOut(BaseModel):
    id: str
    transaction_id: str
    customer_id: str
    order_id: str
    amount: Decimal
    currency: str
    payment_method: str
    status: str
    failure_reason: str | None
    gateway_response: str | None
    retry_count: int
    customer_response: str | None
    recovery_status: str
    recovered_amount: Decimal
    escalation_status: str
    created_at: datetime | None
    updated_at: datetime | None
    customer: CustomerOut | None = None

    model_config = ConfigDict(from_attributes=True)


class TransactionDetailOut(TransactionOut):
    payment_attempts: list[PaymentAttemptOut] = []
    recovery_cases: list[RecoveryCaseOut] = []


class DiagnosisResult(BaseModel):
    transaction_id: str
    revenue_at_risk: Decimal
    root_cause: RootCause
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(min_length=1, max_length=5)
    reason: str = Field(min_length=1, max_length=500)
    requires_human_review: bool


class DecisionResult(BaseModel):
    transaction_id: str
    revenue_at_risk: Decimal
    root_cause: RootCause
    confidence: float = Field(ge=0.0, le=1.0)
    recommended_action: RecommendedAction
    reason: str = Field(min_length=1, max_length=500)
    evidence: list[str] = Field(min_length=1, max_length=5)
    requires_human_review: bool


class PolicyValidationOut(BaseModel):
    result: Literal["APPROVED", "BLOCKED", "ESCALATE"]
    allowed: bool
    reasons: list[str]
    max_automatic_retries: int
    max_recovery_messages: int
    current_retry_count: int
    current_message_count: int


class RecoveryStartRequest(BaseModel):
    idempotency_key: str | None = Field(default=None, max_length=255)
    force_payment_result: Literal["SUCCESS", "FAILED"] | None = None


class PaymentRetryRequest(BaseModel):
    idempotency_key: str | None = Field(default=None, max_length=255)
    force_result: Literal["SUCCESS", "FAILED"] | None = None


class AuditLogOut(BaseModel):
    id: str
    transaction_id: str | None
    recovery_case_id: str | None
    event_type: str
    event_message: str
    actor: str
    metadata: dict[str, Any]
    created_at: datetime | None


class EscalationOut(BaseModel):
    id: str
    transaction_id: str
    recovery_case_id: str | None
    reason: str
    priority: str
    status: str
    ai_recommendation: str | None
    action_history: list[dict[str, Any]]
    created_at: datetime | None
    resolved_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    total_transactions: int
    failed_transactions: int
    revenue_at_risk: Decimal
    recovery_attempts: int
    successful_recoveries: int
    revenue_recovered: Decimal
    recovery_rate: float
    unresolved_cases: int
    escalated_cases: int
    failure_rate: float
    revenue_recovery_rate: float
    average_recovery_latency_seconds: float | None
