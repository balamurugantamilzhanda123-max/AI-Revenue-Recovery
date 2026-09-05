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
import { FALLBACK_PRODUCTS } from "./fallbackProducts";

const SYNC_STORAGE_KEY = "reviveai_synced_transactions_v2";

export function getLocalSyncedTransactions(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSyncedTransactions(txs: any[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(txs));
  } catch {}
}

export function addOrUpdateLocalTransaction(tx: any) {
  if (typeof window === "undefined" || !tx) return;
  try {
    const txs = getLocalSyncedTransactions();
    const idx = txs.findIndex(
      (t: any) =>
        (tx.transaction_id && t.transaction_id === tx.transaction_id) ||
        (tx.id && t.id === tx.id) ||
        (tx.order_id && t.order_id === tx.order_id)
    );
    if (idx >= 0) {
      txs[idx] = { ...txs[idx], ...tx };
    } else {
      txs.unshift(tx);
    }
    saveLocalSyncedTransactions(txs);
  } catch {}
}

export function clearLocalSyncedTransactions() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SYNC_STORAGE_KEY);
  } catch {}
}

export function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

  // In the browser:
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0";

    // If accessing from a deployed remote domain (e.g. Vercel), never call private localhost
    if (!isLocalhost && (raw.includes("localhost") || raw.includes("127.0.0.1") || raw.includes("0.0.0.0"))) {
      return "";
    }
    if (!raw) {
      return isLocalhost ? "http://127.0.0.1:8000" : "";
    }
    return raw;
  }

  // On server runtime:
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    if (!raw || raw.includes("localhost") || raw.includes("127.0.0.1") || raw.includes("0.0.0.0")) {
      return "";
    }
  }

  return raw || "http://127.0.0.1:8000";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    try {
      const localTxs = getLocalSyncedTransactions();
      if (localTxs && localTxs.length > 0) {
        defaultHeaders["x-reviveai-synced-txs"] = encodeURIComponent(
          JSON.stringify(localTxs.slice(0, 50))
        );
      }
    } catch {}
  }

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
      throw new Error(`Unable to connect to ReviveAI backend at ${base || "current domain"}. Ensure backend server is running.`);
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
  try {
    const res = await request<any>("/api/revenue-risk");
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.cases)) return res.cases;
    if (res && Array.isArray(res.data)) return res.data;
    return [];
  } catch {
    return [];
  }
}

export async function fetchRevenueRiskSummary(): Promise<DashboardSummary> {
  try {
    const res = await request<any>("/api/revenue-risk/summary");
    if (res && res.summary) return res.summary;
    if (res && typeof res.revenue_at_risk === "number") return res;
    return {
      total_transactions: 0,
      failed_transactions: 0,
      revenue_at_risk: 0,
      total_risk_detected: 0,
      recovery_attempts: 0,
      successful_recoveries: 0,
      revenue_recovered: 0,
      recovery_rate: 0,
      unresolved_cases: 0,
      escalated_cases: 0,
      failure_rate: 0,
      revenue_recovery_rate: 0,
      average_recovery_latency_seconds: 0,
    };
  } catch {
    return {
      total_transactions: 0,
      failed_transactions: 0,
      revenue_at_risk: 0,
      total_risk_detected: 0,
      recovery_attempts: 0,
      successful_recoveries: 0,
      revenue_recovered: 0,
      recovery_rate: 0,
      unresolved_cases: 0,
      escalated_cases: 0,
      failure_rate: 0,
      revenue_recovery_rate: 0,
      average_recovery_latency_seconds: 0,
    };
  }
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
  const res = await request<RecoveryStartResponse>(`/api/recovery/start/${encodeURIComponent(transactionId)}`, {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
  if (res) {
    if ((res as any).transaction) {
      addOrUpdateLocalTransaction((res as any).transaction);
    } else {
      const isSucc = res.payment_status === "SUCCESS" || res.recovery_status === "RECOVERED";
      addOrUpdateLocalTransaction({
        transaction_id: transactionId,
        status: isSucc ? "SUCCESS" : "FAILED",
        recovery_status: res.recovery_status || (isSucc ? "RECOVERED" : "ESCALATED"),
        recovered_amount: isSucc ? (res.recovered_amount || 0) : 0,
        escalation_status: isSucc ? "NONE" : "OPEN",
        updated_at: new Date().toISOString(),
      });
    }
  }
  return res;
}

export async function retryPayment(
  transactionId: string,
  options?: {
    idempotency_key?: string;
    force_result?: "SUCCESS" | "FAILED";
  }
): Promise<RecoveryStartResponse> {
  const res = await request<RecoveryStartResponse>(`/api/payments/retry/${encodeURIComponent(transactionId)}`, {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
  if (res) {
    if ((res as any).transaction) {
      addOrUpdateLocalTransaction((res as any).transaction);
    } else {
      const isSucc = res.payment_status === "SUCCESS" || res.recovery_status === "RECOVERED";
      addOrUpdateLocalTransaction({
        transaction_id: transactionId,
        status: isSucc ? "SUCCESS" : "FAILED",
        recovery_status: res.recovery_status || (isSucc ? "RECOVERED" : "ESCALATED"),
        recovered_amount: isSucc ? (res.recovered_amount || 0) : 0,
        escalation_status: isSucc ? "NONE" : "OPEN",
        updated_at: new Date().toISOString(),
      });
    }
  }
  return res;
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
  try {
    const res = await request<any>("/api/escalations");
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.escalations)) return res.escalations;
    if (res && Array.isArray(res.data)) return res.data;
    return [];
  } catch {
    return [];
  }
}

export async function resolveEscalation(
  escalationId: string,
  resolution: string
): Promise<{ message: string; escalation: EscalationCase; transaction?: any }> {
  const res = await request<{ message: string; escalation: EscalationCase; transaction?: any }>(`/api/escalations/${encodeURIComponent(escalationId)}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ resolution }),
  });
  if (res && res.transaction) {
    addOrUpdateLocalTransaction(res.transaction);
  } else {
    const txnId = res?.escalation?.transaction_id || escalationId.replace("esc_", "");
    addOrUpdateLocalTransaction({
      transaction_id: txnId,
      escalation_status: "RESOLVED",
      updated_at: new Date().toISOString(),
    });
  }
  return res;
}

// ==========================================
// Audit Logs
// ==========================================

export async function fetchTransactionAudit(transactionId: string): Promise<TransactionAuditResponse> {
  try {
    const res = await request<any>(`/api/audit/${encodeURIComponent(transactionId)}`);
    return {
      transaction_id: transactionId,
      events: Array.isArray(res) ? res : res?.events || res?.data || [],
      count: Array.isArray(res) ? res.length : res?.count || (res?.events?.length ?? 0),
    };
  } catch {
    return { transaction_id: transactionId, events: [], count: 0 };
  }
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
  try {
    const res = await request<any>(`/api/audit${queryString ? `?${queryString}` : ""}`);
    const events = Array.isArray(res)
      ? res
      : res?.data || res?.events || [];
    return {
      data: events,
      pagination: {
        limit: params?.limit || 50,
        offset: params?.offset || 0,
        returned: events.length,
        next_offset: null,
      },
    };
  } catch {
    return {
      data: [],
      pagination: { limit: 50, offset: 0, returned: 0, next_offset: null },
    };
  }
}

// ==========================================
// Admin & Global Reset
// ==========================================

export async function resetDashboard(): Promise<{
  success: boolean;
  message: string;
  metadata?: any;
  timestamp?: string;
}> {
  clearLocalSyncedTransactions();
  return request("/api/admin/reset-dashboard", { method: "POST" });
}

// ==========================================
// Demo Endpoints
// ==========================================

export async function resetDemoData(): Promise<any> {
  clearLocalSyncedTransactions();
  return request("/api/demo/reset", { method: "POST" });
}

export async function runPrimaryDemo(): Promise<any> {
  const res = await request<any>("/api/demo/run-primary", { method: "POST" });
  if (res && res.transaction) {
    addOrUpdateLocalTransaction(res.transaction);
  }
  return res;
}

export async function runRetryFailureDemo(): Promise<any> {
  const res = await request<any>("/api/demo/run-retry-failure", { method: "POST" });
  if (res && res.transaction) {
    addOrUpdateLocalTransaction(res.transaction);
  }
  return res;
}

// ==========================================
// Health
// ==========================================

export async function checkBackendHealth(): Promise<{ status: string }> {
  return request("/api/health");
}

// ==========================================
// ==========================================
// Electrical Store & Customer Checkout
// ==========================================

export interface ElectricalProduct {
  id: string;
  productId?: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  discount?: number;
  discountPrice?: number;
  currency: string;
  stock: number;
  in_stock: boolean;
  availability?: string;
  rating: number;
  reviews_count: number;
  reviewCount?: number;
  badge?: string;
  image_url: string;
  image?: string;
  image_source?: "LOCAL" | "EXTERNAL" | "AI_GENERATED" | "FALLBACK";
  image_status?: "IMAGE_AVAILABLE" | "IMAGE_GENERATING" | "IMAGE_GENERATED" | "IMAGE_FAILED" | "IMAGE_UNAVAILABLE";
  image_prompt?: string;
  description: string;
  specs?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  saved_address?: CustomerAddressData | null;
}

export interface CustomerAddressData {
  full_name: string;
  phone: string;
  email?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface CustomerOrderData {
  order_id: string;
  transaction_id: string;
  product_name: string;
  category: string;
  image_url: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  recovery_status: string;
  recovery_token: string;
  created_at: string;
  can_retry: boolean;
  retry_link: string;
}

export async function fetchElectricalProducts(params?: {
  category?: string;
  search?: string;
}): Promise<{ data: ElectricalProduct[]; count: number }> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();

  try {
    const res = await request<{ data: ElectricalProduct[]; count: number }>(`/api/checkout/products${qs ? `?${qs}` : ""}`);
    if (res && res.data && res.data.length > 0) {
      return res;
    }
  } catch {
    // If backend is offline or starting up, use robust client fallback catalog
  }

  // Filter fallback catalog
  let list = [...FALLBACK_PRODUCTS];
  if (params?.category && params.category !== "All") {
    list = list.filter((p) => p.category.toLowerCase() === params.category!.toLowerCase());
  }
  if (params?.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(q))
    );
  }
  return { data: list, count: list.length };
}

export async function fetchElectricalProductDetail(productId: string): Promise<{ data: ElectricalProduct }> {
  try {
    const res = await request<{ data: ElectricalProduct }>(`/api/checkout/products/${encodeURIComponent(productId)}`);
    if (res && res.data) return res;
  } catch {
    // fallback
  }
  const found = FALLBACK_PRODUCTS.find((p) => p.id === productId || p.productId === productId);
  if (found) return { data: found };
  return { data: FALLBACK_PRODUCTS[0] };
}

export async function customerRegister(payload: {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
}): Promise<{ success: boolean; message: string; customer: CustomerProfile; token: string }> {
  try {
    return await request("/api/checkout/customer/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    const name = (payload.full_name || "Valued Customer").trim();
    const email = (payload.email || "customer@voltstore.in").trim().toLowerCase();
    const phone = (payload.phone || "9876543210").trim();
    const customer: CustomerProfile = {
      id: "cust_volt_" + Math.random().toString(36).substring(2, 8),
      name: name,
      email: email,
      phone: phone,
      saved_address: {
        full_name: name,
        phone: phone,
        email: email,
        address_line1: "12, Main Tech Park Road",
        address_line2: "",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
    };
    return {
      success: true,
      message: "Account created successfully.",
      customer,
      token: "cust_tok_" + Math.random().toString(36).substring(2, 12),
    };
  }
}

export async function customerLogin(payload: {
  identifier: string;
  password: string;
}): Promise<{ success: boolean; message: string; customer: CustomerProfile; token: string }> {
  try {
    return await request("/api/checkout/customer/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    const ident = (payload.identifier || "customer@voltstore.in").trim();
    const name = ident.includes("@") ? ident.split("@")[0].toUpperCase() : ident.toUpperCase();
    const customer: CustomerProfile = {
      id: "cust_volt_" + Math.random().toString(36).substring(2, 8),
      name: name,
      email: ident.includes("@") ? ident.toLowerCase() : `${ident}@voltstore.in`,
      phone: !ident.includes("@") ? ident : "9876543210",
      saved_address: {
        full_name: name,
        phone: "9876543210",
        email: ident.includes("@") ? ident.toLowerCase() : `${ident}@voltstore.in`,
        address_line1: "12, Main Tech Park Road",
        address_line2: "Near Metro Hub",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        landmark: "Opposite Tech Park",
      },
    };
    return {
      success: true,
      message: "Login successful.",
      customer,
      token: "cust_tok_" + Math.random().toString(36).substring(2, 12),
    };
  }
}

export async function fetchCustomerProfile(params?: {
  email?: string;
  phone?: string;
}): Promise<{ customer: CustomerProfile }> {
  const query = new URLSearchParams();
  if (params?.email) query.set("email", params.email);
  if (params?.phone) query.set("phone", params.phone);
  const qs = query.toString();
  return request<{ customer: CustomerProfile }>(`/api/checkout/customer/me${qs ? `?${qs}` : ""}`);
}

export async function saveCustomerAddress(
  payload: CustomerAddressData & { customer_id?: string; email?: string }
): Promise<{ success: boolean; message: string; address: CustomerAddressData }> {
  return request("/api/checkout/customer/address", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchCustomerOrders(params?: {
  email?: string;
  phone?: string;
  customer_id?: string;
}): Promise<{ data: CustomerOrderData[]; count: number }> {
  const query = new URLSearchParams();
  if (params?.email) query.set("email", params.email);
  if (params?.phone) query.set("phone", params.phone);
  if (params?.customer_id) query.set("customer_id", params.customer_id);
  const qs = query.toString();
  return request<{ data: CustomerOrderData[]; count: number }>(`/api/checkout/customer/orders${qs ? `?${qs}` : ""}`);
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
  simulation_scenario:
    | "SUCCESS"
    | "PAYMENT_SUCCESS"
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "PAYMENT_TIMEOUT"
    | "AUTH_FAILURE"
    | "AUTHENTICATION_FAILED"
    | "DECLINE"
    | "PAYMENT_FAILED";
}): Promise<any> {
  let res: any;
  try {
    res = await request("/api/checkout/process-payment", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    const isSuccess =
      payload.simulation_scenario === "SUCCESS" ||
      payload.simulation_scenario === "PAYMENT_SUCCESS";
    const orderId = payload.order_id || "ORD-" + Math.floor(100000 + Math.random() * 900000);
    const txnId = payload.transaction_id || "TXN-" + Math.floor(100000 + Math.random() * 900000);
    const recovToken = "recov_" + Math.random().toString(36).substring(2, 10);
    const scenario = payload.simulation_scenario || "NETWORK_ERROR";
    const failureReasonMap: Record<string, { reason: string; msg: string; risk: string }> = {
      NETWORK_ERROR: {
        reason: "Network Error: Connection Reset During Payment (TCP RST)",
        msg: "Your payment could not be completed due to a temporary network connection drop (TCP RST). Your order is preserved.",
        risk: "HIGH",
      },
      PAYMENT_TIMEOUT: {
        reason: "Payment Gateway Timeout (HTTP 504 Gateway Timeout)",
        msg: "The bank gateway timed out while processing your payment token (504 Gateway). Your order is preserved.",
        risk: "HIGH",
      },
      TIMEOUT: {
        reason: "Payment Gateway Timeout (HTTP 504 Gateway Timeout)",
        msg: "The bank gateway timed out while processing your payment token (504 Gateway). Your order is preserved.",
        risk: "HIGH",
      },
      AUTHENTICATION_FAILED: {
        reason: "Authentication Handshake Failure (OTP Timeout / 3DS Error)",
        msg: "Authentication handshake failed (OTP Timeout / 3DS verification). Your order is preserved.",
        risk: "MEDIUM",
      },
      AUTH_FAILURE: {
        reason: "Authentication Handshake Failure (OTP Timeout / 3DS Error)",
        msg: "Authentication handshake failed (OTP Timeout / 3DS verification). Your order is preserved.",
        risk: "MEDIUM",
      },
      PAYMENT_FAILED: {
        reason: "Issuer Bank Decline (Do Not Honor)",
        msg: "Your bank declined the transaction. Your order is preserved.",
        risk: "HIGH",
      },
    };

    const details = failureReasonMap[scenario] || failureReasonMap.NETWORK_ERROR;

    res = {
      success: isSuccess,
      status: isSuccess ? "SUCCESS" : "FAILED",
      order_id: orderId,
      transaction_id: txnId,
      payment_status: isSuccess ? "SUCCESS" : "FAILED",
      order_status: isSuccess ? "CONFIRMED" : "PAYMENT_FAILED",
      failure_reason: isSuccess ? null : details.reason,
      is_network_error: !isSuccess && (scenario === "NETWORK_ERROR" || scenario === "PAYMENT_TIMEOUT" || scenario === "TIMEOUT"),
      customer_message: isSuccess
        ? "Payment verified and order placed successfully!"
        : details.msg,
      automated_message_preview: isSuccess
        ? ""
        : `Hi ${payload.customer?.name || "Valued Customer"},\n\nYour payment for order #${orderId} could not be completed due to a temporary issue (${details.reason}).\n\nYour order is preserved.\nPlease complete your payment using the secure payment link below:\n\n/payment/retry/${recovToken}`,
      risk_level: details.risk,
      recovery_token: recovToken,
      payment_link: `/payment/retry/${recovToken}`,
      retry_link: `/payment/retry/${recovToken}`,
      message: isSuccess
        ? "Payment verified and order placed successfully!"
        : "Payment attempt failed. Autonomous ReviveAI Recovery initialized.",
    };
  }

  // Always update synced client state
  const isSucc = res.status === "SUCCESS" || res.payment_status === "SUCCESS" || res.success === true;
  const newTx = res.transaction || {
    id: "tx_" + (res.transaction_id || Math.random().toString(36).substring(2, 9)),
    transaction_id: res.transaction_id,
    order_id: res.order_id,
    customer_id: "cust_active",
    customer: payload.customer || { name: "Valued Customer", email: "customer@voltstore.in", phone: "+91 98765 43210" },
    product_id: payload.product_id || "prod_volt_01",
    product_name: res.product_name || "VoltStore Electronics",
    category: "Electronics",
    amount: payload.amount || 2499,
    currency: payload.currency || "INR",
    status: isSucc ? "SUCCESS" : "FAILED",
    payment_method: payload.payment_method || "UPI",
    failure_reason: isSucc ? null : res.failure_reason,
    gateway_response: res.customer_message || res.message,
    retry_count: 0,
    recovery_status: isSucc ? "RECOVERED" : "OPEN",
    recovered_amount: isSucc ? (payload.amount || 2499) : 0,
    escalation_status: "NONE",
    recovery_token: res.recovery_token,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  addOrUpdateLocalTransaction(newTx);

  return res;
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
  const res = await request<any>("/api/checkout/abandon", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res) {
    const abnTx = res.transaction || {
      id: "tx_abn_" + Math.random().toString(36).substring(2, 9),
      transaction_id: res.transaction_id || "TXN-" + Math.floor(100000 + Math.random() * 900000),
      order_id: res.order_id || "ORD-" + Math.floor(100000 + Math.random() * 900000),
      customer: payload.customer,
      product_id: payload.product_id,
      product_name: "VoltStore Electronics",
      amount: payload.amount,
      currency: payload.currency || "INR",
      status: "ABANDONED",
      payment_method: "NETBANKING",
      failure_reason: "Checkout session expired before payment authorization",
      recovery_status: "OPEN",
      recovered_amount: 0,
      escalation_status: "NONE",
      recovery_token: res.recovery_token,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addOrUpdateLocalTransaction(abnTx);
  }
  return res;
}

export async function fetchRecoverySession(token: string): Promise<any> {
  try {
    return await request(`/api/checkout/recover/${encodeURIComponent(token)}`);
  } catch {
    const shortTok = (token || "demo").replace(/[^a-zA-Z0-9]/g, "").substring(0, 8);
    return {
      order_id: `ORD-REC-${shortTok.toUpperCase() || "DEMO"}`,
      transaction_id: `TXN-REC-${shortTok.toUpperCase() || "DEMO"}`,
      token: token,
      amount: 65999,
      currency: "INR",
      status: "FAILED",
      payment_method: "UPI / Netbanking",
      customer_name: "Valued Customer",
      product: {
        id: "prod_laptop_biz_01",
        name: "ProBook Ultra Slim 15.6\" Business Laptop",
        category: "Laptops & Computers",
        image_url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80",
        price: 65999,
      },
      product_name: "ProBook Ultra Slim 15.6\" Business Laptop",
      already_paid: false,
      already_used: false,
      escalated_to_support: false,
      retry_allowed: true,
    };
  }
}

export async function retryCustomerPayment(payload: {
  transaction_id: string;
  order_id?: string;
  token?: string;
  retry_outcome: "SUCCESS" | "FAILED" | "RETRY_SUCCESS" | "RETRY_FAILED";
}): Promise<any> {
  let res: any;
  try {
    res = await request("/api/checkout/retry-payment", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    const isSuccess =
      payload.retry_outcome === "SUCCESS" || payload.retry_outcome === "RETRY_SUCCESS";
    res = {
      success: isSuccess,
      status: isSuccess ? "SUCCESS" : "ESCALATED",
      payment_status: isSuccess ? "SUCCESS" : "FAILED",
      recovery_status: isSuccess ? "RECOVERED" : "RETRY_FAILED",
      order_status: isSuccess ? "CONFIRMED" : "ESCALATED_TO_SUPPORT",
      escalated_to_human: !isSuccess,
      escalated_to_support: !isSuccess,
      already_paid: isSuccess,
      order_id: payload.order_id || "ORD-REC-DEMO",
      transaction_id: payload.transaction_id || "TXN-REC-DEMO",
      recovered_amount: isSuccess ? 65999 : 0,
      amount: 65999,
      currency: "INR",
      message: isSuccess
        ? "Payment retry successful! Order confirmed."
        : "Payment retry declined. Case forwarded to Human Associate.",
    };
  }

  // Update transaction record in local storage without destroying history
  const isSucc = payload.retry_outcome === "SUCCESS" || payload.retry_outcome === "RETRY_SUCCESS" || res.status === "SUCCESS";
  const updatedTx = res.transaction || {
    transaction_id: payload.transaction_id || res.transaction_id,
    order_id: payload.order_id || res.order_id,
    status: isSucc ? "SUCCESS" : "FAILED",
    recovery_status: isSucc ? "RECOVERED" : "ESCALATED",
    recovered_amount: isSucc ? (res.amount || res.recovered_amount || 65999) : 0,
    escalation_status: isSucc ? "NONE" : "OPEN",
    failure_reason: isSucc ? null : "Payment retry limit reached",
    updated_at: new Date().toISOString(),
  };
  addOrUpdateLocalTransaction(updatedTx);

  return res;
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
  const res = await request(`/api/human-associate/cases/${encodeURIComponent(caseId)}/contact`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const cleanId = caseId.replace("case_", "").replace("esc_", "");
  addOrUpdateLocalTransaction({
    transaction_id: cleanId,
    escalation_status: "IN_REVIEW",
    updated_at: new Date().toISOString(),
  });
  return res;
}

export async function sendHumanPaymentLink(
  caseId: string,
  payload: {
    custom_message?: string;
    discount_percent?: number;
    agent_name?: string;
  }
): Promise<any> {
  const res = await request<any>(`/api/human-associate/cases/${encodeURIComponent(caseId)}/send-link`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const cleanId = caseId.replace("case_", "").replace("esc_", "");
  addOrUpdateLocalTransaction({
    transaction_id: cleanId,
    escalation_status: "IN_REVIEW",
    recovery_token: res?.recovery_token || res?.token,
    updated_at: new Date().toISOString(),
  });
  return res;
}

export async function completeHumanPayment(
  caseId: string,
  payload?: { notes?: string }
): Promise<any> {
  const res = await request<any>(`/api/human-associate/cases/${encodeURIComponent(caseId)}/complete-payment`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  if (res && res.transaction) {
    addOrUpdateLocalTransaction(res.transaction);
  } else if (res && res.recovered_amount !== undefined) {
    const cleanId = caseId.replace("case_", "").replace("esc_", "");
    addOrUpdateLocalTransaction({
      transaction_id: res.transaction_id || cleanId,
      order_id: res.order_id,
      status: "SUCCESS",
      recovery_status: "RECOVERED",
      recovered_amount: res.recovered_amount,
      escalation_status: "RESOLVED",
      customer_response: "RECOVERED_BY_HUMAN",
      updated_at: new Date().toISOString(),
    });
  }
  return res;
}

// ==========================================
// Product Catalog & AI Image Studio
// ==========================================

export interface ImageStatusReport {
  total_products: number;
  local_verified_images: number;
  ai_generated_images: number;
  external_verified_images: number;
  fallback_ready: number;
  coverage_percentage: number;
  status: string;
}

export async function fetchImageStatus(): Promise<ImageStatusReport> {
  return request<ImageStatusReport>("/api/products/images/status");
}

export async function generateProductImage(
  productId: string,
  promptOverride?: string
): Promise<{
  success: boolean;
  product_id: string;
  product_name: string;
  image_url: string;
  image_source: string;
  image_status: string;
  prompt: string;
  message: string;
}> {
  return request<{
    success: boolean;
    product_id: string;
    product_name: string;
    image_url: string;
    image_source: string;
    image_status: string;
    prompt: string;
    message: string;
  }>(`/api/products/${encodeURIComponent(productId)}/generate-image`, {
    method: "POST",
    body: JSON.stringify({ product_id: productId, prompt_override: promptOverride }),
  });
}

// ==========================================
// Reporting & Analytics Exports
// ==========================================

export interface ReportFilters {
  date_from?: string;
  date_to?: string;
  status?: string;
  failure_type?: string;
  recovery_method?: string;
}

export interface ReportData {
  summary: {
    total_orders: number;
    successful_payments: number;
    failed_payments: number;
    pending_payments?: number;
    abandoned_payments: number;
    revenue_at_risk: number;
    ai_recovered: number;
    human_recovered: number;
    total_recovered: number;
    recovery_rate: number;
    unresolved_revenue?: number;
    high_risk_cases?: number;
  };
  failure_analysis: {
    network_errors: number;
    payment_timeouts: number;
    authentication_failures: number;
    abandonments: number;
    other_failures: number;
    breakdown_table?: Array<{
      failure_type: string;
      cases: number;
      revenue_at_risk: number;
      recovered: number;
      unresolved: number;
      recovery_rate: number;
    }>;
  };
  recovery_analysis: {
    ai_recovery_cases: number;
    human_recovery_cases: number;
    high_risk_cases: number;
    unresolved_cases: number;
    unresolved_revenue?: number;
  };
  executive_findings: string[];
  recommendations?: string[];
  transactions: Array<{
    transaction_id: string;
    order_id: string;
    customer_name?: string;
    customer_email?: string;
    amount: number;
    currency: string;
    status: string;
    failure_type: string;
    risk_level?: string;
    diagnosis: string;
    recovery_action: string;
    recovery_method: string;
    recovery_status: string;
    recovered_amount: number;
    created_date?: string;
    updated_date?: string;
  }>;
  audit_logs?: Array<{
    timestamp: string;
    actor: string;
    action: string;
    description: string;
    metadata?: string;
  }>;
  generated_at: string;
  filters?: ReportFilters;
}

export async function fetchReportData(filters?: ReportFilters): Promise<ReportData> {
  const query = new URLSearchParams();
  if (filters?.date_from) query.set("date_from", filters.date_from);
  if (filters?.date_to) query.set("date_to", filters.date_to);
  if (filters?.status && filters.status !== "ALL") query.set("status", filters.status);
  if (filters?.failure_type && filters.failure_type !== "ALL") query.set("failure_type", filters.failure_type);
  if (filters?.recovery_method && filters.recovery_method !== "ALL") query.set("recovery_method", filters.recovery_method);

  const qs = query.toString();
  return request<ReportData>(`/api/reports${qs ? `?${qs}` : ""}`);
}

function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("reviveai_token") || localStorage.getItem("auth_token") || null;
  }
  return null;
}

export async function fetchReportPdfBlob(filters?: ReportFilters): Promise<Blob> {
  const query = new URLSearchParams();
  if (filters?.date_from) query.set("date_from", filters.date_from);
  if (filters?.date_to) query.set("date_to", filters.date_to);
  if (filters?.status && filters.status !== "ALL") query.set("status", filters.status);
  if (filters?.failure_type && filters.failure_type !== "ALL") query.set("failure_type", filters.failure_type);
  if (filters?.recovery_method && filters.recovery_method !== "ALL") query.set("recovery_method", filters.recovery_method);

  const qs = query.toString();
  const base = getApiBase();
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${base}/api/reports/pdf${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to generate PDF report (HTTP ${res.status})`);
  }
  return await res.blob();
}

export async function downloadReportPdf(filters?: ReportFilters): Promise<void> {
  const blob = await fetchReportPdfBlob(filters);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const filename = `ReviveAI_Revenue_Recovery_Report_${year}-${month}-${day}.pdf`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function downloadReportExcel(filters?: ReportFilters): Promise<void> {
  const query = new URLSearchParams();
  if (filters?.date_from) query.set("date_from", filters.date_from);
  if (filters?.date_to) query.set("date_to", filters.date_to);
  if (filters?.status && filters.status !== "ALL") query.set("status", filters.status);
  if (filters?.failure_type && filters.failure_type !== "ALL") query.set("failure_type", filters.failure_type);
  if (filters?.recovery_method && filters.recovery_method !== "ALL") query.set("recovery_method", filters.recovery_method);

  const qs = query.toString();
  const base = getApiBase();
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${base}/api/reports/excel${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to generate Excel report (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const filename = `ReviveAI_Revenue_Recovery_Report_${year}-${month}-${day}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function downloadTransactionPdf(transactionId: string): Promise<void> {
  const base = getApiBase();
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${base}/api/transactions/${encodeURIComponent(transactionId)}/pdf`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to download transaction certificate (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const filename = `ReviveAI_Transaction_${transactionId}.pdf`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}


