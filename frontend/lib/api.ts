import { GlobalAuditResponse, TransactionAuditResponse } from "../types/audit";
import {
  DashboardSummary,
  DecisionResult,
  DiagnosisResult,
  EscalationCase,
  PaginatedTransactions,
  PaymentStatus,
  RecoveryCase,
  RecoveryMetrics,
  RecoveryStartResponse,
  Transaction,
} from "../types/revive";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options?.headers as Record<string, string>),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      let errorMessage = `API Error ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          errorMessage = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
        } else if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // use default message if json parsing fails
      }
      throw new Error(errorMessage);
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(`Unable to connect to ReviveAI backend at ${API_BASE}. Ensure backend server is running.`);
    }
    throw err;
  }
}

// ==========================================
// Dashboard & Metrics
// ==========================================

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/api/dashboard/summary");
}

export async function fetchRecoveryMetrics(): Promise<RecoveryMetrics> {
  return request<RecoveryMetrics>("/api/dashboard/recovery-metrics");
}

// ==========================================
// Transactions
// ==========================================

export async function fetchTransactions(params?: {
  status?: PaymentStatus | string;
  customer_id?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedTransactions> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.customer_id) query.set("customer_id", params.customer_id);
  if (params?.limit !== undefined) query.set("limit", params.limit.toString());
  if (params?.offset !== undefined) query.set("offset", params.offset.toString());

  const queryString = query.toString();
  return request<PaginatedTransactions>(`/api/transactions${queryString ? `?${queryString}` : ""}`);
}

export async function fetchTransactionDetail(transactionId: string): Promise<Transaction> {
  return request<Transaction>(`/api/transactions/${encodeURIComponent(transactionId)}`);
}

export async function updateTransaction(
  transactionId: string,
  payload: Record<string, any>
): Promise<Transaction> {
  return request<Transaction>(`/api/transactions/${encodeURIComponent(transactionId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ==========================================
// Revenue at Risk
// ==========================================

export async function fetchRevenueRiskCases(): Promise<RecoveryCase[]> {
  return request<RecoveryCase[]>("/api/revenue-risk");
}

export async function fetchRevenueRiskSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/api/revenue-risk/summary");
}

// ==========================================
// AI Agent: Diagnosis & Decision
// ==========================================

export async function diagnoseTransaction(transactionId: string): Promise<DiagnosisResult> {
  return request<DiagnosisResult>(`/api/agent/diagnose/${encodeURIComponent(transactionId)}`, {
    method: "POST",
  });
}

export async function decideRecovery(transactionId: string): Promise<DecisionResult> {
  return request<DecisionResult>(`/api/agent/decide/${encodeURIComponent(transactionId)}`, {
    method: "POST",
  });
}

// ==========================================
// Recovery Operations & Retries
// ==========================================

export async function startRecoveryWorkflow(
  transactionId: string,
  options?: {
    idempotency_key?: string;
    force_payment_result?: "SUCCESS" | "FAILED";
  }
): Promise<RecoveryStartResponse> {
  return request<RecoveryStartResponse>(`/api/recovery/start/${encodeURIComponent(transactionId)}`, {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
}

export async function retryPayment(
  transactionId: string,
  options?: {
    idempotency_key?: string;
    force_result?: "SUCCESS" | "FAILED";
  }
): Promise<RecoveryStartResponse> {
  return request<RecoveryStartResponse>(`/api/payments/retry/${encodeURIComponent(transactionId)}`, {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
}

export async function fetchRecoveryResult(transactionId: string): Promise<{
  transaction_id: string;
  payment_status: string;
  recovery_status: string;
  recovered_amount: number;
  recovery_case?: RecoveryCase | null;
}> {
  return request(`/api/recovery/${encodeURIComponent(transactionId)}`);
}

// ==========================================
// Escalations
// ==========================================

export async function fetchEscalations(): Promise<EscalationCase[]> {
  return request<EscalationCase[]>("/api/escalations");
}

export async function resolveEscalation(
  escalationId: string,
  resolution: string
): Promise<{ message: string; escalation: EscalationCase }> {
  return request(`/api/escalations/${encodeURIComponent(escalationId)}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ resolution }),
  });
}

// ==========================================
// Audit Logs
// ==========================================

export async function fetchTransactionAudit(transactionId: string): Promise<TransactionAuditResponse> {
  return request<TransactionAuditResponse>(`/api/audit/${encodeURIComponent(transactionId)}`);
}

export async function fetchGlobalAudit(params?: {
  transaction_id?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
}): Promise<GlobalAuditResponse> {
  const query = new URLSearchParams();
  if (params?.transaction_id) query.set("transaction_id", params.transaction_id);
  if (params?.event_type) query.set("event_type", params.event_type);
  if (params?.limit !== undefined) query.set("limit", params.limit.toString());
  if (params?.offset !== undefined) query.set("offset", params.offset.toString());

  const queryString = query.toString();
  return request<GlobalAuditResponse>(`/api/audit${queryString ? `?${queryString}` : ""}`);
}

// ==========================================
// Demo Endpoints
// ==========================================

export async function resetDemoData(): Promise<any> {
  return request("/api/demo/reset", { method: "POST" });
}

export async function runPrimaryDemo(): Promise<any> {
  return request("/api/demo/run-primary", { method: "POST" });
}

export async function runRetryFailureDemo(): Promise<any> {
  return request("/api/demo/run-retry-failure", { method: "POST" });
}

// ==========================================
// Health
// ==========================================

export async function checkBackendHealth(): Promise<{ status: string }> {
  return request("/api/health");
}

// ==========================================
// Electrical Store & Customer Checkout
// ==========================================

export interface ElectricalProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  stock: number;
  in_stock: boolean;
  rating: number;
  reviews_count: number;
  badge?: string;
  image_url: string;
  description: string;
  specs?: Record<string, string>;
}

export async function fetchElectricalProducts(params?: {
  category?: string;
  search?: string;
}): Promise<{ data: ElectricalProduct[]; count: number }> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return request<{ data: ElectricalProduct[]; count: number }>(`/api/checkout/products${qs ? `?${qs}` : ""}`);
}

export async function fetchElectricalProductDetail(productId: string): Promise<{ data: ElectricalProduct }> {
  return request<{ data: ElectricalProduct }>(`/api/checkout/products/${encodeURIComponent(productId)}`);
}

export async function initiateCheckoutSession(payload: {
  product_id: string;
  quantity: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
}): Promise<any> {
  return request("/api/checkout/initiate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function processCustomerPayment(payload: {
  order_id?: string;
  transaction_id?: string;
  product_id: string;
  quantity: number;
  amount: number;
  currency?: string;
  payment_method: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  simulation_scenario: "SUCCESS" | "NETWORK_ERROR" | "TIMEOUT" | "AUTH_FAILURE" | "DECLINE";
}): Promise<any> {
  return request("/api/checkout/process-payment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function abandonCustomerCheckout(payload: {
  product_id: string;
  quantity: number;
  amount: number;
  currency?: string;
  last_stage: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
}): Promise<any> {
  return request("/api/checkout/abandon", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchRecoverySession(token: string): Promise<any> {
  return request(`/api/checkout/recover/${encodeURIComponent(token)}`);
}

export async function retryCustomerPayment(payload: {
  transaction_id: string;
  order_id?: string;
  token?: string;
  retry_outcome: "SUCCESS" | "FAILED";
}): Promise<any> {
  return request("/api/checkout/retry-payment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ==========================================
// Seller Dashboard & Analytics
// ==========================================

export interface SellerDashboardSummary {
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  pending_orders: number;
  checkout_abandonments: number;
  network_errors: number;
  payment_failures: number;
  failure_breakdown: {
    network_errors: number;
    timeouts: number;
    bank_declines: number;
    auth_failures: number;
    abandonments: number;
    other: number;
  };
  revenue_at_risk: number;
  revenue_risk_breakdown: {
    network_errors: number;
    payment_failures: number;
    checkout_abandonments: number;
    human_pending_cases: number;
  };
  ai_recovery_cases: number;
  ai_recovered_revenue: number;
  human_recovery_cases: number;
  human_recovered_revenue: number;
  total_recovered_revenue: number;
  unresolved_cases: number;
  unresolved_revenue: number;
  high_risk_cases: number;
  recovery_rate: number;
  funnel: {
    orders: number;
    checkout_started: number;
    payment_initiated: number;
    payment_failed_or_abandoned: number;
    revenue_at_risk_detected: number;
    ai_recovery_triggered: number;
    customer_retry_executed: number;
    ai_payment_success: number;
    escalated_to_human: number;
    human_payment_success: number;
  };
  product_revenue_loss: Array<{
    product_id: string;
    product_name: string;
    category: string;
    unit_price: number;
    orders_count: number;
    successful_orders: number;
    failed_orders: number;
    network_errors: number;
    checkout_abandonments: number;
    revenue_at_risk: number;
    recovered_revenue: number;
    recovery_rate: number;
  }>;
  generated_at: string;
}

export interface SellerCase {
  order_id: string;
  transaction_id: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  product_id: string;
  product_name: string;
  category: string;
  amount: number;
  currency: string;
  payment_status: string;
  failure_reason: string;
  is_network_error: boolean;
  attempts: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  revenue_at_risk: number;
  ai_status: string;
  human_status: string;
  recovery_status: string;
  recovery_token: string;
  created_at: string;
}

export async function fetchSellerDashboard(): Promise<SellerDashboardSummary> {
  return request<SellerDashboardSummary>("/api/seller/dashboard");
}

export async function fetchSellerCases(params?: {
  filter?: string;
  product_id?: string;
  risk?: string;
  status?: string;
  search?: string;
}): Promise<SellerCase[]> {
  const query = new URLSearchParams();
  if (params?.filter) query.set("filter", params.filter);
  if (params?.product_id) query.set("product_id", params.product_id);
  if (params?.risk) query.set("risk", params.risk);
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return request<SellerCase[]>(`/api/seller/cases${qs ? `?${qs}` : ""}`);
}

// ==========================================
// Human Associate Workspace
// ==========================================

export interface HumanCase {
  case_id: string;
  order_id: string;
  transaction_id: string;
  customer: {
    id?: string;
    name: string;
    email: string;
    phone: string;
  };
  product: {
    id: string;
    name: string;
    category: string;
  };
  amount: number;
  currency: string;
  payment_attempts_count: number;
  payment_attempts: Array<{
    attempt_number: number;
    status: string;
    gateway_response: string;
    created_at: string;
  }>;
  failure_reason: string;
  is_network_error: boolean;
  ai_diagnosis: string;
  ai_recommendation: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_level: string;
  revenue_at_risk: number;
  case_status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  created_at: string;
  resolved_at?: string | null;
  action_history: Array<Record<string, any>>;
  recovery_token: string;
}

export async function fetchHumanCases(params?: {
  status?: string;
  priority?: string;
}): Promise<HumanCase[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.priority) query.set("priority", params.priority);
  const qs = query.toString();
  return request<HumanCase[]>(`/api/human-associate/cases${qs ? `?${qs}` : ""}`);
}

export async function contactCustomerHuman(
  caseId: string,
  payload: {
    channel: "PHONE" | "WHATSAPP" | "EMAIL";
    notes: string;
    agent_name?: string;
  }
): Promise<any> {
  return request(`/api/human-associate/cases/${encodeURIComponent(caseId)}/contact`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendHumanPaymentLink(
  caseId: string,
  payload: {
    custom_message?: string;
    discount_percent?: number;
    agent_name?: string;
  }
): Promise<any> {
  return request(`/api/human-associate/cases/${encodeURIComponent(caseId)}/send-link`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeHumanPayment(
  caseId: string,
  payload?: { notes?: string }
): Promise<any> {
  return request(`/api/human-associate/cases/${encodeURIComponent(caseId)}/complete-payment`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}
