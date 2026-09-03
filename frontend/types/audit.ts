export type AuditEventType =
  | "TRANSACTION_INGESTED"
  | "TRANSACTION_UPDATED"
  | "REVENUE_RISK_DETECTED"
  | "AI_DIAGNOSIS_COMPLETED"
  | "RECOVERY_DECISION_CREATED"
  | "POLICY_VALIDATION_COMPLETED"
  | "POLICY_BLOCKED_ACTION"
  | "RECOVERY_STARTED"
  | "RECOVERY_SUCCEEDED"
  | "REVENUE_RECOVERED"
  | "RECOVERY_FAILED"
  | "RECOVERY_STOPPED"
  | "HUMAN_ESCALATION_CREATED"
  | "HUMAN_ESCALATION_RESOLVED"
  | "CUSTOMER_OPT_OUT"
  | "RECOVERY_MESSAGE_CREATED"
  | "DUPLICATE_RECOVERY_REQUEST";

export interface AuditLogEvent {
  id: string;
  transaction_id: string;
  recovery_case_id: string | null;
  event_type: AuditEventType | string;
  event_message: string;
  actor: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface TransactionAuditResponse {
  transaction_id: string;
  events: AuditLogEvent[];
  count: number;
}

export interface GlobalAuditResponse {
  data: AuditLogEvent[];
  pagination: {
    limit: number;
    offset: number;
    returned: number;
    next_offset: number | null;
  };
}
