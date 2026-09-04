import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetDashboard, fetchReportData } from "../lib/api";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResetConfirmationModal from "../components/common/ResetConfirmationModal";

describe("ReviveAI Reset & Reports Features", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resetDashboard performs POST /api/admin/reset-dashboard", async () => {
    const mockResetRes = {
      success: true,
      message: "Dashboard reset successfully. All transaction and recovery data has been cleared.",
      metadata: { transactions_deleted: 5 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResetRes,
    });

    const result = await resetDashboard();
    expect(result.success).toBe(true);
    expect(result.message).toContain("Dashboard reset successfully");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/reset-dashboard"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("fetchReportData performs GET /api/reports with filters", async () => {
    const mockReport = {
      summary: {
        total_orders: 10,
        successful_payments: 7,
        failed_payments: 3,
        abandoned_payments: 0,
        revenue_at_risk: 15000,
        ai_recovered: 10000,
        human_recovered: 5000,
        total_recovered: 15000,
        recovery_rate: 50.0,
      },
      failure_analysis: {
        network_errors: 2,
        payment_timeouts: 1,
        authentication_failures: 0,
        abandonments: 0,
        other_failures: 0,
      },
      recovery_analysis: {
        ai_recovery_cases: 2,
        human_recovery_cases: 1,
        high_risk_cases: 1,
        unresolved_cases: 0,
      },
      executive_findings: ["Total monitored volume is 10 transactions."],
      transactions: [],
      generated_at: new Date().toISOString(),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    });

    const result = await fetchReportData({ status: "SUCCESS" });
    expect(result.summary.total_orders).toBe(10);
    expect(result.summary.recovery_rate).toBe(50.0);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/reports?status=SUCCESS"),
      expect.any(Object)
    );
  });

  it("ResetConfirmationModal renders checklist and destructive button", () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <ResetConfirmationModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    );

    expect(screen.getByText("RESET DASHBOARD")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("Revenue at Risk")).toBeInTheDocument();
    expect(screen.getByText("Reset All Data")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(handleClose).toHaveBeenCalled();
  });
});
