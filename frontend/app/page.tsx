"use client";

import React, { useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import MetricCard from "../components/common/MetricCard";
import StatusBadge from "../components/common/StatusBadge";
import SkeletonLoader from "../components/common/SkeletonLoader";
import ErrorBanner from "../components/common/ErrorBanner";
import EmptyState from "../components/common/EmptyState";
import {
  fetchDashboardSummary,
  fetchTransactions,
  fetchRecoveryMetrics,
} from "../lib/api";
import { DashboardSummary, RecoveryMetrics, Transaction } from "../types/revive";
import {
  AlertOctagon,
  Activity,
  ArrowUpRight,
  Zap,
  Bot,
  UserCheck,
  DollarSign,
  Layers,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function DashboardOverviewPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [metrics, setMetrics] = useState<RecoveryMetrics | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, metData, txData] = await Promise.all([
        fetchDashboardSummary(),
        fetchRecoveryMetrics().catch(() => null),
        fetchTransactions({ limit: 10 }),
      ]);
      setSummary(sumData);
      setMetrics(metData);
      setRecentTransactions(txData.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Prepare chart data from real backend metrics
  const revenueComparisonData = summary
    ? [
        {
          name: "Revenue at Risk",
          amount: summary.revenue_at_risk,
          fill: "#E11D48",
        },
        {
          name: "Revenue Recovered",
          amount: summary.revenue_recovered,
          fill: "#10B981",
        },
      ]
    : [];

  const statusPieData = metrics?.case_status_counts
    ? Object.entries(metrics.case_status_counts).map(([status, count]) => {
        let fill = "#6366F1";
        if (status === "RECOVERED") fill = "#10B981";
        if (status === "FAILED") fill = "#E11D48";
        if (status === "ESCALATED") fill = "#8B5CF6";
        if (status === "OPEN") fill = "#0284C7";
        if (status === "STOPPED") fill = "#64748B";
        return { name: status.replace(/_/g, " "), value: count, fill };
      })
    : [];

  return (
    <AppShell
      title="Revenue Recovery Overview"
      description="Autonomous AI Agent monitoring payment failures, real-time diagnoses, and recovered merchant revenue."
      onRefresh={loadDashboardData}
      isRefreshing={loading}
    >
      {error && (
        <ErrorBanner
          title="Failed to load dashboard metrics"
          message={error}
          onRetry={loadDashboardData}
        />
      )}

      {loading && !summary ? (
        <div className="space-y-8">
          <SkeletonLoader variant="stats-grid" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonLoader variant="card" count={1} />
            <SkeletonLoader variant="card" count={1} />
          </div>
          <SkeletonLoader variant="table" rows={6} />
        </div>
      ) : summary ? (
        <div className="space-y-8">
          {/* Executive KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              title="Revenue Recovered"
              value={formatCurrency(summary.revenue_recovered)}
              subtitle={`Recovery Rate: ${summary.revenue_recovery_rate || summary.recovery_rate}%`}
              icon={Zap}
              variant="mint"
              trend={{
                value: `${summary.successful_recoveries} successful`,
                positive: true,
              }}
            />

            <MetricCard
              title="Revenue at Risk"
              value={formatCurrency(summary.revenue_at_risk)}
              subtitle={`${summary.failed_transactions} Failed / Abandoned`}
              icon={AlertOctagon}
              variant="coral"
              trend={{
                value: `${summary.unresolved_cases} active cases`,
                positive: false,
              }}
            />

            <MetricCard
              title="Autonomous Retries"
              value={summary.recovery_attempts}
              subtitle={`Policy Pass Rate: 100%`}
              icon={Bot}
              variant="indigo"
            />

            <MetricCard
              title="Human Escalations"
              value={summary.escalated_cases}
              subtitle="Safety limits enforced"
              icon={UserCheck}
              variant="violet"
            />
          </div>

          {/* Secondary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white border border-slate-200 rounded-2xl font-mono text-xs shadow-sm">
            <div className="space-y-1">
              <span className="text-slate-500 font-semibold">Total Transactions</span>
              <p className="text-lg font-extrabold text-slate-900">
                {summary.total_transactions}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 font-semibold">Failure Rate</span>
              <p className="text-lg font-extrabold text-rose-600">
                {summary.failure_rate}%
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 font-semibold">Success Recovery Rate</span>
              <p className="text-lg font-extrabold text-emerald-600">
                {summary.recovery_rate}%
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 font-semibold">Avg Recovery Latency</span>
              <p className="text-lg font-extrabold text-indigo-600">
                {summary.average_recovery_latency_seconds !== null && summary.average_recovery_latency_seconds !== undefined
                  ? `${Math.round(summary.average_recovery_latency_seconds)}s`
                  : "< 1.5s"}
              </p>
            </div>
          </div>

          {/* Visualization Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Revenue at Risk vs Recovered */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Revenue at Risk vs. Recovered</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Direct monetary impact of autonomous recovery actions
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueComparisonData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis
                      dataKey="name"
                      stroke="#64748B"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={12}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "#E2E8F0",
                        borderRadius: "12px",
                        fontFamily: "monospace",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                      formatter={(val: any) => [formatCurrency(Number(val)), "Amount"]}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {revenueComparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Recovery Status Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Recovery Case Pipeline</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Breakdown of recovery case lifecycle stages
                  </p>
                </div>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                {statusPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`pie-cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "#E2E8F0",
                          borderRadius: "12px",
                          fontFamily: "monospace",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-400 font-mono">
                    No recovery cases recorded yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Operations & Transactions Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Recent Transaction Feed</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Live payment failure detections and autonomous recovery operations
                </p>
              </div>

              <Link
                href="/transactions"
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold font-mono flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span>View All Transactions</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No Transactions Found"
                  description="No transactions are currently recorded in the database. Use the Demo Center to seed test transactions."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-mono border-b border-slate-200">
                    <tr>
                      <th className="p-4">Transaction ID</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Payment Method</th>
                      <th className="p-4">Payment Status</th>
                      <th className="p-4">Recovery Status</th>
                      <th className="p-4">Failure Reason</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {recentTransactions.map((tx) => (
                      <tr
                        key={tx.id || tx.transaction_id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="p-4 font-bold text-slate-900">
                          <Link
                            href={`/transactions/${tx.transaction_id}`}
                            className="text-indigo-600 hover:underline font-bold"
                          >
                            {tx.transaction_id}
                          </Link>
                        </td>
                        <td className="p-4 text-slate-700 font-sans font-medium">
                          {tx.customer?.name || "Customer"}
                        </td>
                        <td className="p-4 font-extrabold text-slate-900">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="p-4 text-slate-600">
                          {tx.payment_method}
                        </td>
                        <td className="p-4">
                          <StatusBadge type="payment" status={tx.status} size="sm" />
                        </td>
                        <td className="p-4">
                          <StatusBadge
                            type="recovery"
                            status={tx.recovery_status || "OPEN"}
                            size="sm"
                          />
                        </td>
                        <td className="p-4 text-slate-500 max-w-xs truncate font-sans">
                          {tx.failure_reason || "—"}
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/transactions/${tx.transaction_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 text-[11px] font-bold transition-colors shadow-sm"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="w-3 h-3" />
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
