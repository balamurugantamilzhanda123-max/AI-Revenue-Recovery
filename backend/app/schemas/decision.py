from pydantic import BaseModel, Field
from typing import Optional


class RecoveryDecisionResult(BaseModel):
    transaction_id: str

    root_cause: str

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )

    decision: str

    policy: str

    allowed: bool

    reason: str

    requires_human_review: bool

    escalation_id: Optional[str] = None