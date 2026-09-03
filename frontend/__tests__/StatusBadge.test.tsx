import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatusBadge from "../components/common/StatusBadge";

describe("StatusBadge Component", () => {
  it("renders payment success badge correctly", () => {
    render(<StatusBadge type="payment" status="SUCCESS" />);
    expect(screen.getByText("CAPTURED")).toBeInTheDocument();
  });

  it("renders payment failed badge correctly", () => {
    render(<StatusBadge type="payment" status="FAILED" />);
    expect(screen.getByText("FAILED")).toBeInTheDocument();
  });

  it("renders recovery status RECOVERED correctly", () => {
    render(<StatusBadge type="recovery" status="RECOVERED" />);
    expect(screen.getByText("RECOVERED")).toBeInTheDocument();
  });

  it("renders policy ALLOWED badge correctly", () => {
    render(<StatusBadge type="policy" status="ALLOWED" />);
    expect(screen.getByText("POLICY APPROVED")).toBeInTheDocument();
  });

  it("renders policy REJECTED badge correctly", () => {
    render(<StatusBadge type="policy" status="REJECT" />);
    expect(screen.getByText("POLICY REJECTED")).toBeInTheDocument();
  });

  it("renders escalation OPEN badge correctly", () => {
    render(<StatusBadge type="escalation" status="OPEN" />);
    expect(screen.getByText("OPEN ESCALATION")).toBeInTheDocument();
  });
});
