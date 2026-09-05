export type PaymentStatus = "PENDING" | "FAILED" | "SUCCESS" | "ABANDONED" | "UNRESOLVED";

export type RecoveryStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RECOVERED"
  | "FAILED"
  | "ESCALATED"
  | "STOPPED"
  | "UNRESOLVED";

export type ActionStatus =
  | "PENDING"
  | "POLICY_APPROVED"
  | "POLICY_BLOCKED"
  | "EXECUTED"
  | "FAILED";

export type EscalationStatus = "NONE" | "OPEN" | "IN_REVIEW" | "RESOLVED";

export type EscalationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RootCauseType =
  | "payment_timeout"
  | "bank_decline"
  | "authentication_failure"
  | "insufficient_funds"
  | "payment_method_issue"
  | "customer_abandonment"
  | "technical_failure"
  | "repeated_payment_failure"
  | "unknown";

export type RecommendedActionType =
  | "controlled_retry"
  | "recovery_reminder"
  | "retry_authentication"
  | "escalate_human"
  | "stop_recovery"
  | "no_action";

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at?: string | null;
}

export interface PaymentAttempt {
  id: string;
  transaction_id: string;
  attempt_number: number;
  status: PaymentStatus;
  gateway_response?: string | null;
  created_at?: string | null;
}

export interface PolicyResult {
  result?: "APPROVED" | "BLOCKED" | "ESCALATE" | "REJECT";
  allowed: boolean;
  policy?: "ALLOW" | "REJECT" | "ESCALATE";
  action?: string;
  reasons?: string[];
  reason?: string;
  max_automatic_retries?: number;
  max_recovery_messages?: number;
  current_retry_count?: number;
  current_message_count?: number;
  customer_opt_out?: boolean;
}

export interface RecoveryAction {
  id: string;
  recovery_case_id: string;
  action_type: RecommendedActionType | string;
  action_reason: string;
  policy_result: PolicyResult;
  execution_result?: Record<string, any> | null;
  status: ActionStatus;
  idempotency_key?: string | null;
  created_at?: string | null;
}

export interface RecoveryCase {
  id: string;
  transaction_id: string;
  risk_amount: number;
  root_cause?: RootCauseType | string | null;
  confidence?: number | null;
  evidence: string[];
  recommended_action?: RecommendedActionType | string | null;
  action_status: ActionStatus;
  recovery_status: RecoveryStatus;
  recovered_amount: number;
  policy_result?: PolicyResult | null;
  detection_timestamp?: string | null;
  success_timestamp?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  recovery_actions?: RecoveryAction[];
}

export interface Transaction {
  id: string;
  transaction_id: string;
  customer_id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: PaymentStatus;
  failure_reason?: string | null;
  gateway_response?: string | null;
  retry_count: number;
  customer_response?: string | null;
  recovery_status: RecoveryStatus;
  recovered_amount: number;
  escalation_status: EscalationStatus;
  created_at?: string | null;
  updated_at?: string | null;
  customer?: Customer | null;
  payment_attempts?: PaymentAttempt[];
  recovery_cases?: RecoveryCase[];
}

export interface PaginatedTransactions {
  data: Transaction[];
  pagination: {
    limit: number;
    offset: number;
    returned: number;
    next_offset: number | null;
  };
}

export interface DashboardSummary {
  total_transactions: number;
  failed_transactions: number;
  revenue_at_risk: number;
  total_risk_detected: number;
  recovery_attempts: number;
  successful_recoveries: number;
  revenue_recovered: number;
  recovery_rate: number;
  unresolved_cases: number;
  escalated_cases: number;
  failure_rate: number;
  revenue_recovery_rate: number;
  average_recovery_latency_seconds?: number | null;
  generated_at?: string;
}

export interface RecoveryMetrics {
  summary: DashboardSummary;
  case_status_counts: Record<string, number>;
}

export interface DiagnosisResult {
  transaction_id: string;
  revenue_at_risk?: number;
  root_cause: RootCauseType | string;
  confidence: number;
  evidence: string[];
  reason: string;
  requires_human_review: boolean;
}

export interface DecisionResult {
  transaction_id: string;
  root_cause: string;
  confidence: number;
  decision: RecommendedActionType | string;
  policy: string;
  allowed: boolean;
  reason: string;
  requires_human_review: boolean;
  escalation_id?: string | null;
}

export interface RecoveryStartResponse {
  transaction_id: string;
  decision?: DecisionResult | Record<string, any>;
  policy?: PolicyResult;
  recovery_case?: RecoveryCase | null;
  action_id?: string;
  execution_result?: Record<string, any>;
  escalation_id?: string;
  payment_status?: string;
  recovery_status?: string;
  recovered_amount?: number;
  transaction?: Transaction | any;
}

export interface EscalationCase {
  id: string;
  transaction_id: string;
  recovery_case_id?: string | null;
  reason: string;
  priority: EscalationPriority;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  ai_recommendation?: string | null;
  action_history: Array<{
    action?: string;
    reason?: string;
    timestamp?: string;
    [key: string]: any;
  }>;
  created_at?: string | null;
  resolved_at?: string | null;
  transaction?: Transaction | null;
}
