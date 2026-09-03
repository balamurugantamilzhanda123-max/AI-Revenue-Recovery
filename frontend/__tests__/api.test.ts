import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchDashboardSummary,
  fetchTransactions,
  diagnoseTransaction,
  startRecoveryWorkflow,
} from "../lib/api";

describe("ReviveAI Centralized API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchDashboardSummary performs GET /api/dashboard/summary", async () => {
    const mockSummary = {
      total_transactions: 100,
      failed_transactions: 15,
      revenue_at_risk: 75000,
      total_risk_detected: 75000,
      recovery_attempts: 12,
      successful_recoveries: 10,
      revenue_recovered: 60000,
      recovery_rate: 83.33,
      unresolved_cases: 2,
      escalated_cases: 1,
      failure_rate: 15,
      revenue_recovery_rate: 80,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    });

    const result = await fetchDashboardSummary();
    expect(result.total_transactions).toBe(100);
    expect(result.revenue_recovered).toBe(60000);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/summary"),
      expect.any(Object)
    );
  });

  it("diagnoseTransaction performs POST /api/agent/diagnose/{id}", async () => {
    const mockDiagnosis = {
      transaction_id: "TX-DEMO-001",
      root_cause: "payment_timeout",
      confidence: 0.91,
      evidence: ["UPI gateway timeout"],
      reason: "Timeout identified",
      requires_human_review: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDiagnosis,
    });

    const result = await diagnoseTransaction("TX-DEMO-001");
    expect(result.root_cause).toBe("payment_timeout");
    expect(result.confidence).toBe(0.91);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/agent/diagnose/TX-DEMO-001"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("startRecoveryWorkflow performs POST /api/recovery/start/{id}", async () => {
    const mockRecoveryRes = {
      transaction_id: "TX-DEMO-001",
      action_id: "act-1",
      execution_result: { payment_status: "SUCCESS" },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRecoveryRes,
    });

    const result = await startRecoveryWorkflow("TX-DEMO-001");
    expect(result.transaction_id).toBe("TX-DEMO-001");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/recovery/start/TX-DEMO-001"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
