"use client";

import React, { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import MetricCard from "../../components/common/MetricCard";
import StatusBadge from "../../components/common/StatusBadge";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import ErrorBanner from "../../components/common/ErrorBanner";
import EmptyState from "../../components/common/EmptyState";
import { fetchRecoveryMetrics, fetchRevenueRiskCases } from "../../lib/api";
import { RecoveryMetrics, RecoveryCase } from "../../types/revive";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  XCircle,
} from "lucide-react";
import Link from "next/link";

export default function RecoveryMonitoringPage() {
  const [metrics, setMetrics] = useState<RecoveryMetrics | null>(null);
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab filter: ALL | ACTIVE | RECOVERED | FAILED | ESCALATED
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const loadMonitoringData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metData, casesData] = await Promise.all([
        fetchRecoveryMetrics(),
        fetchRevenueRiskCases(),
      ]);
      setMetrics(metData);
      setCases(casesData || []);
    } catch (err: any) {
      setError(err.message || "Failed to load recovery monitoring data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitoringData();
  }, []);

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const filteredCases = cases.filter((c) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "ACTIVE") return c.recovery_status === "IN_PROGRESS" || c.recovery_status === "OPEN";
    if (activeTab === "RECOVERED") return c.recovery_status === "RECOVERED";
    if (activeTab === "FAILED") return c.recovery_status === "FAILED" || c.recovery_status === "STOPPED";
    if (activeTab === "ESCALATED") return c.recovery_status === "ESCALATED";
    return true;
  });

  return (
    <AppShell
      title="Recovery Operations Monitoring"
      description="Live telemetry of autonomous recovery agents, real-time retry executions, and safety outcomes."
      onRefresh={loadMonitoringData}
      isRefreshing={loading}
    >
      {error && (
        <ErrorBanner
          title="Monitoring Error"
          message={error}
          onRetry={loadMonitoringData}
        />
      )}

      {loading && !metrics ? (
        <div className="space-y-8">
          <SkeletonLoader variant="stats-grid" />
          <SkeletonLoader variant="table" rows={6} />
        </div>
      ) : metrics ? (
        <div className="space-y-8">
          {/* Top Monitoring Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Recovered Volume"
              value={formatCurrency(metrics.summary.revenue_recovered)}
              subtitle={`${metrics.summary.successful_recoveries} successful`}
              icon={Zap}
              variant="mint"
            />

            <MetricCard
              title="Active Workflows"
              value={
                (metrics.case_status_counts["OPEN"] || 0) +
                (metrics.case_status_counts["IN_PROGRESS"] || 0)
              }
              subtitle="In-flight retry pipelines"
              icon={Activity}
              variant="cyan"
            />

            <MetricCard
              title="Completed Cases"
              value={metrics.case_status_counts["RECOVERED"] || 0}
              subtitle={`${metrics.summary.recovery_rate}% success rate`}
              icon={CheckCircle2}
              variant="mint"
            />

            <MetricCard
              title="Escalated to Human"
              value={metrics.case_status_counts["ESCALATED"] || 0}
              subtitle="Review limit reached"
              icon={AlertTriangle}
              variant="violet"
            />

            <MetricCard
              title="Failed / Stopped"
              value={
                (metrics.case_status_counts["FAILED"] || 0) +
                (metrics.case_status_counts["STOPPED"] || 0)
              }
              subtitle="Policy safety halts"
              icon={XCircle}
              variant="coral"
            />
          </div>

          {/* Filter Tabs & Real-Time Case Stream */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Header & Tabs */}
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Autonomous Recovery Pipeline Stream</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Continuous status updates for every detected revenue risk case
                </p>
              </div>

              {/* Status Tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs">
                {["ALL", "ACTIVE", "RECOVERED", "ESCALATED", "FAILED"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      activeTab === tab
                        ? "bg-white text-emerald-700 border border-slate-200 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Operations Table */}
            {filteredCases.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No Recovery Cases Found"
                  description="No recovery cases match the selected filter category."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-4">Transaction Ref</th>
                      <th className="p-4">Risk Amount</th>
                      <th className="p-4">Identified Cause</th>
                      <th className="p-4">Action Type</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Recovered</th>
                      <th className="p-4">Detected At</th>
                      <th className="p-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCases.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <td className="p-4 font-bold text-slate-900">
                          <Link
                            href={`/transactions/${c.transaction_id}`}
                            className="text-indigo-600 group-hover:underline font-bold"
                          >
                            {c.transaction_id}
                          </Link>
                        </td>
                        <td className="p-4 font-extrabold text-rose-600">
                          {formatCurrency(c.risk_amount)}
                        </td>
                        <td className="p-4 text-slate-800 font-medium">
                          {c.root_cause ? c.root_cause.replace(/_/g, " ") : "Pending AI"}
                        </td>
                        <td className="p-4 text-slate-700">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-bold">
                            {c.recommended_action || "controlled_retry"}
                          </span>
                        </td>
                        <td className="p-4">
                          <StatusBadge
                            type="recovery"
                            status={c.recovery_status || "OPEN"}
                            size="sm"
                          />
                        </td>
                        <td className="p-4 font-extrabold text-emerald-600">
                          {formatCurrency(c.recovered_amount)}
                        </td>
                        <td className="p-4 text-slate-500">
                          {c.created_at ? new Date(c.created_at).toLocaleTimeString() : "—"}
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/transactions/${c.transaction_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 text-xs font-bold transition-colors shadow-sm"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
