"use client";

import React, { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import MetricCard from "../../components/common/MetricCard";
import StatusBadge from "../../components/common/StatusBadge";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import ErrorBanner from "../../components/common/ErrorBanner";
import EmptyState from "../../components/common/EmptyState";
import { fetchRevenueRiskSummary, fetchTransactions } from "../../lib/api";
import { DashboardSummary, Transaction } from "../../types/revive";
import {
  AlertOctagon,
  TrendingDown,
  ShieldAlert,
  ArrowUpRight,
  Search,
  CreditCard,
  Zap,
  Bot,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

export default function RevenueRiskPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [riskTransactions, setRiskTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [filterMethod, setFilterMethod] = useState("");

  const loadRiskData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, txData] = await Promise.all([
        fetchRevenueRiskSummary(),
        fetchTransactions({ limit: 50 }),
      ]);
      setSummary(sumData);
      // Filter to recoverable or failed transactions
      const failedOrAtRisk = (txData.data || []).filter(
        (t) =>
          t.status === "FAILED" ||
          t.status === "ABANDONED" ||
          t.status === "UNRESOLVED" ||
          t.recovery_status === "OPEN" ||
          t.recovery_status === "IN_PROGRESS" ||
          t.recovery_status === "ESCALATED"
      );
      setRiskTransactions(failedOrAtRisk);
    } catch (err: any) {
      setError(err.message || "Failed to load revenue risk data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiskData();
  }, []);

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Compute breakdown for charts
  const reasonCounts: Record<string, number> = {};
  const methodCounts: Record<string, number> = {};

  riskTransactions.forEach((tx) => {
    const reason = tx.failure_reason || "UNKNOWN";
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

    const method = tx.payment_method || "OTHER";
    methodCounts[method] = (methodCounts[method] || 0) + (tx.amount || 0);
  });

  const reasonChartData = Object.entries(reasonCounts).map(([name, count]) => ({
    name: name.replace(/_/g, " "),
    count,
  }));

  const methodChartData = Object.entries(methodCounts).map(([name, total]) => ({
    name,
    amount: total,
    fill: name === "UPI" ? "#10B981" : name === "CARD" ? "#6366F1" : "#F59E0B",
  }));

  const highestRiskTx = riskTransactions.reduce<Transaction | null>(
    (max, tx) => (!max || tx.amount > max.amount ? tx : max),
    null
  );

  const filteredList = riskTransactions.filter((tx) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      tx.transaction_id.toLowerCase().includes(q) ||
      tx.customer?.name?.toLowerCase().includes(q) ||
      tx.failure_reason?.toLowerCase().includes(q);

    const matchReason = !filterReason || tx.failure_reason === filterReason;
    const matchMethod = !filterMethod || tx.payment_method === filterMethod;

    return matchQuery && matchReason && matchMethod;
  });

  return (
    <AppShell
      title="Revenue at Risk"
      description="Identify at-risk payment volume, diagnose failure bottlenecks, and deploy automated recovery."
      onRefresh={loadRiskData}
      isRefreshing={loading}
    >
      {error && (
        <ErrorBanner
          title="Failed to load revenue risk data"
          message={error}
          onRetry={loadRiskData}
        />
      )}

      {loading && !summary ? (
        <div className="space-y-8">
          <SkeletonLoader variant="stats-grid" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
          </div>
          <SkeletonLoader variant="table" rows={6} />
        </div>
      ) : summary ? (
        <div className="space-y-8">
          {/* Top Risk Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              title="Total Revenue at Risk"
              value={formatCurrency(summary.revenue_at_risk)}
              subtitle={`${summary.failed_transactions} transactions affected`}
              icon={AlertOctagon}
              variant="coral"
            />

            <MetricCard
              title="Highest-Value At Risk"
              value={highestRiskTx ? formatCurrency(highestRiskTx.amount) : "₹0"}
              subtitle={highestRiskTx ? highestRiskTx.transaction_id : "None"}
              icon={ShieldAlert}
              variant="amber"
            />

            <MetricCard
              title="Active Unresolved Cases"
              value={summary.unresolved_cases}
              subtitle="Eligible for AI Diagnosis"
              icon={Bot}
              variant="indigo"
            />

            <MetricCard
              title="Escalated Cases"
              value={summary.escalated_cases}
              subtitle="Pending Human Review"
              icon={TrendingDown}
              variant="violet"
            />
          </div>

          {/* Charts Row: Failure Reasons & Payment Method Exposure */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Failure Reason Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>Failure Reason Distribution</span>
              </h3>
              <div className="h-64 w-full">
                {reasonChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reasonChartData} layout="vertical" margin={{ left: 30, right: 30 }}>
                      <XAxis type="number" stroke="#64748B" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="#64748B" fontSize={11} width={130} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "#E2E8F0",
                          borderRadius: "12px",
                          fontFamily: "monospace",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Bar dataKey="count" fill="#E11D48" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                    No failed cases recorded.
                  </div>
                )}
              </div>
            </div>

            {/* At-Risk Volume by Payment Method */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>At-Risk Volume by Payment Method</span>
              </h3>
              <div className="h-64 w-full">
                {methodChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={methodChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                      <YAxis stroke="#64748B" fontSize={12} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "#E2E8F0",
                          borderRadius: "12px",
                          fontFamily: "monospace",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                        formatter={(val: any) => [formatCurrency(Number(val)), "At Risk Amount"]}
                      />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                        {methodChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                    No payment methods at risk.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter & Recoverable Queue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>Recoverable Transactions Queue</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Transactions with detected revenue loss pending or undergoing AI recovery
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search ID, customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">All Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                  <option value="NETBANKING">NETBANKING</option>
                </select>
              </div>
            </div>

            {filteredList.length === 0 ? (
              <EmptyState
                title="No At-Risk Transactions"
                description="All payments have been captured or no recoverable transactions match the filter criteria."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-4">Transaction ID</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Risk Amount</th>
                      <th className="p-4">Payment Method</th>
                      <th className="p-4">Failure Reason</th>
                      <th className="p-4">Recovery Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredList.map((tx) => (
                      <tr
                        key={tx.id || tx.transaction_id}
                        className="hover:bg-slate-50 transition-colors group"
                      >
                        <td className="p-4 font-bold text-slate-900">
                          <Link
                            href={`/transactions/${tx.transaction_id}`}
                            className="text-indigo-600 group-hover:underline font-bold"
                          >
                            {tx.transaction_id}
                          </Link>
                        </td>
                        <td className="p-4 text-slate-800 font-sans font-medium">
                          {tx.customer?.name || "Guest Customer"}
                        </td>
                        <td className="p-4 font-extrabold text-rose-600">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="p-4 text-slate-600">{tx.payment_method}</td>
                        <td className="p-4 text-slate-500 font-sans">{tx.failure_reason || "TIMEOUT"}</td>
                        <td className="p-4">
                          <StatusBadge
                            type="recovery"
                            status={tx.recovery_status || "OPEN"}
                            size="sm"
                          />
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/transactions/${tx.transaction_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            <span>Diagnose & Recover</span>
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
