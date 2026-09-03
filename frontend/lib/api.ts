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
