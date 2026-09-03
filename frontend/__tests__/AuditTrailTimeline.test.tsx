import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AuditTrailTimeline from "../components/AuditTrailTimeline";
import { AuditLogEvent } from "../types/audit";

describe("AuditTrailTimeline Component", () => {
  it("renders empty state when no events provided", () => {
    render(<AuditTrailTimeline events={[]} />);
    expect(screen.getByText("No audit log records found.")).toBeInTheDocument();
  });

  it("renders chronological audit events with badges", () => {
    const events: AuditLogEvent[] = [
      {
        id: "ev-1",
        transaction_id: "TX-DEMO-001",
        recovery_case_id: "rc-1",
        event_type: "REVENUE_RISK_DETECTED",
        event_message: "Revenue at risk detected: INR 5,999.00",
        actor: "reviveai-agent",
        metadata: { risk_amount: 5999, currency: "INR" },
        created_at: "2026-09-03T10:00:00Z",
      },
      {
        id: "ev-2",
        transaction_id: "TX-DEMO-001",
        recovery_case_id: "rc-1",
        event_type: "RECOVERY_SUCCEEDED",
        event_message: "Payment retry succeeded",
        actor: "reviveai-executor",
        metadata: { recovered_amount: 5999, currency: "INR" },
        created_at: "2026-09-03T10:01:00Z",
      },
    ];

    render(<AuditTrailTimeline events={events} transactionId="TX-DEMO-001" />);
    expect(screen.getByText("Revenue at risk detected: INR 5,999.00")).toBeInTheDocument();
    expect(screen.getByText("Payment retry succeeded")).toBeInTheDocument();
    expect(screen.getByText("2 Events Logged")).toBeInTheDocument();
  });
});
