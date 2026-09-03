import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MetricCard from "../components/common/MetricCard";
import { Zap } from "lucide-react";

describe("MetricCard Component", () => {
  it("renders metric title, value, and subtitle", () => {
    render(
      <MetricCard
        title="Revenue Recovered"
        value="₹174,000"
        subtitle="Recovery Rate: 70.7%"
        icon={Zap}
        variant="mint"
      />
    );
    expect(screen.getByText("Revenue Recovered")).toBeInTheDocument();
    expect(screen.getByText("₹174,000")).toBeInTheDocument();
    expect(screen.getByText("Recovery Rate: 70.7%")).toBeInTheDocument();
  });
});
