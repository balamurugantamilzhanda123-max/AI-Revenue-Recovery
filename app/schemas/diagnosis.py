from enum import Enum

from pydantic import BaseModel, Field


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


class RootCauseDiagnosis(BaseModel):
    transaction_id: str
    root_cause: RootCause
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str]
    reason: str
    requires_human_review: bool