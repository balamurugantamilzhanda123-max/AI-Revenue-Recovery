"use client";

import React, { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import MetricCard from "../../components/common/MetricCard";
import StatusBadge from "../../components/common/StatusBadge";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import ErrorBanner from "../../components/common/ErrorBanner";
import EmptyState from "../../components/common/EmptyState";
import {
  fetchReportData,
  downloadReportPdf,
  downloadReportExcel,
  ReportData,
  ReportFilters,
} from "../../lib/api";
import {
  FileText,
  Download,
  Filter,
  RefreshCw,
  Zap,
  AlertOctagon,
  Bot,
  UserCheck,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Search,
} from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Filters
  const [filters, setFilters] = useState<ReportFilters>({
    date_from: "",
    date_to: "",
    status: "",
    failure_type: "",
    recovery_method: "",
  });

  const [activeFilters, setActiveFilters] = useState<ReportFilters>({
    date_from: "",
    date_to: "",
    status: "",
    failure_type: "",
    recovery_method: "",
  });

  const loadReport = async (filterParams: ReportFilters = activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReportData(filterParams);
      setReportData(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(activeFilters);
  }, [activeFilters]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilters({ ...filters });
  };

  const handleClearFilters = () => {
    const emptyFilters: ReportFilters = {
      date_from: "",
      date_to: "",
      status: "",
      failure_type: "",
      recovery_method: "",
    };
    setFilters(emptyFilters);
    setActiveFilters(emptyFilters);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadReportPdf(activeFilters);
    } catch (err: any) {
      alert(`PDF download failed: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      await downloadReportExcel(activeFilters);
    } catch (err: any) {
      alert(`Excel download failed: ${err.message}`);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const summary = reportData?.summary || {
    total_orders: 0,
    successful_payments: 0,
    failed_payments: 0,
    abandoned_payments: 0,
    revenue_at_risk: 0,
    ai_recovered: 0,
    human_recovered: 0,
    total_recovered: 0,
    recovery_rate: 0,
  };

  const failAnalysis = reportData?.failure_analysis || {
    network_errors: 0,
    payment_timeouts: 0,
    authentication_failures: 0,
    abandonments: 0,
    other_failures: 0,
  };

  const recAnalysis = reportData?.recovery_analysis || {
    ai_recovery_cases: 0,
    human_recovery_cases: 0,
    high_risk_cases: 0,
    unresolved_cases: 0,
  };

  const findings = reportData?.executive_findings || [];
  const transactions = reportData?.transactions || [];

  return (
    <AppShell
      title="Revenue Recovery Report"
      description="Comprehensive financial analytics, autonomous recovery auditing, technical failure breakdown, and downloadable compliance exports."
      onRefresh={() => loadReport(activeFilters)}
      isRefreshing={loading}
    >
      {error && (
        <ErrorBanner
          title="Report Generation Error"
          message={error}
          onRetry={() => loadReport(activeFilters)}
        />
      )}

      {/* Top Banner & Export Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Official Report
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {reportData?.generated_at
                  ? `Generated: ${new Date(reportData.generated_at).toLocaleString("en-IN")}`
                  : "Live Calculation"}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              REVIVE<span className="text-emerald-400">AI</span> Revenue Recovery Report
            </h2>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Autonomous diagnostic audits, root cause telemetry, policy executions, and monetary recovery performance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Generate / Refresh */}
            <button
              onClick={() => loadReport(activeFilters)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
              <span>Generate Report</span>
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || loading}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/30 disabled:opacity-50 active:scale-95"
            >
              <FileText className={`w-4 h-4 ${downloadingPdf ? "animate-pulse" : ""}`} />
              <span>{downloadingPdf ? "Generating PDF..." : "Download PDF"}</span>
            </button>

            {/* Download Excel */}
            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel || loading}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/30 disabled:opacity-50 active:scale-95"
            >
              <FileSpreadsheet className={`w-4 h-4 ${downloadingExcel ? "animate-pulse" : ""}`} />
              <span>{downloadingExcel ? "Generating Excel..." : "Download Excel"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
        <form onSubmit={handleApplyFilters} className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold font-mono text-slate-700 uppercase tracking-wider">
              Report Filters & Parameters
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Date From */}
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={filters.date_from || ""}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={filters.date_to || ""}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1">
                Payment Status
              </label>
              <select
                value={filters.status || ""}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
                <option value="ABANDONED">ABANDONED</option>
                <option value="UNRESOLVED">UNRESOLVED</option>
              </select>
            </div>

            {/* Failure Type */}
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1">
                Failure Category
              </label>
              <select
                value={filters.failure_type || ""}
                onChange={(e) => setFilters({ ...filters, failure_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Failures</option>
                <option value="NETWORK_ERROR">Network Error (TCP RST)</option>
                <option value="PAYMENT_TIMEOUT">Gateway Timeout (504)</option>
                <option value="AUTHENTICATION_FAILED">Authentication (3DS/OTP)</option>
                <option value="BANK_DECLINE">Bank Decline</option>
                <option value="ABANDONMENT">Checkout Abandonment</option>
              </select>
            </div>

            {/* Recovery Method */}
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1">
                Recovery Method
              </label>
              <select
                value={filters.recovery_method || ""}
                onChange={(e) => setFilters({ ...filters, recovery_method: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Methods</option>
                <option value="AI">AI Autonomous Recovery</option>
                <option value="HUMAN">Human Associate Resolution</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold transition-colors"
            >
              Clear Filters
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold transition-colors shadow-sm"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {loading && !reportData ? (
        <div className="space-y-6">
          <SkeletonLoader variant="stats-grid" />
          <SkeletonLoader variant="table" rows={8} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1: SUMMARY */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-extrabold tracking-tight text-slate-900 font-mono uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Executive Summary</span>
              </h3>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Recovery Rate: {summary.recovery_rate}%
              </span>
            </div>

            {/* Financial Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <MetricCard
                title="Total Recovered"
                value={formatCurrency(summary.total_recovered)}
                subtitle={`Recovery Rate: ${summary.recovery_rate}%`}
                icon={Zap}
                variant="mint"
              />

              <MetricCard
                title="Revenue at Risk"
                value={formatCurrency(summary.revenue_at_risk)}
                subtitle={`${summary.failed_payments + summary.abandoned_payments} Failed / Abandoned`}
                icon={AlertOctagon}
                variant="coral"
              />

              <MetricCard
                title="AI Recovered"
                value={formatCurrency(summary.ai_recovered)}
                subtitle="Autonomous Agent Retries"
                icon={Bot}
                variant="indigo"
              />

              <MetricCard
                title="Human Recovered"
                value={formatCurrency(summary.human_recovered)}
                subtitle="Assisted Concessions"
                icon={UserCheck}
                variant="violet"
              />
            </div>

            {/* Volume Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white border border-slate-200 rounded-2xl font-mono text-xs shadow-sm">
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Total Orders</span>
                <p className="text-xl font-extrabold text-slate-900">{summary.total_orders}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Successful Payments</span>
                <p className="text-xl font-extrabold text-emerald-600">{summary.successful_payments}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Failed Payments</span>
                <p className="text-xl font-extrabold text-rose-600">{summary.failed_payments}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Abandoned Payments</span>
                <p className="text-xl font-extrabold text-amber-600">{summary.abandoned_payments}</p>
              </div>
            </div>
          </div>

          {/* SECTION 2 & 3: FAILURE & RECOVERY ANALYSIS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Failure Analysis */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>Failure Analysis</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  {summary.failed_payments + summary.abandoned_payments} total failure events
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Network Errors</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    {failAnalysis.network_errors}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Payment Timeouts</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    {failAnalysis.payment_timeouts}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Auth Failures (3DS/OTP)</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    {failAnalysis.authentication_failures}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Abandonments</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    {failAnalysis.abandonments}
                  </span>
                </div>
              </div>
            </div>

            {/* Recovery Analysis */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wide flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>Recovery Analysis</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  Pipeline Attribution
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">AI Recovery Cases</span>
                  <span className="text-lg font-extrabold text-indigo-700">
                    {recAnalysis.ai_recovery_cases}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Human Recovery Cases</span>
                  <span className="text-lg font-extrabold text-purple-700">
                    {recAnalysis.human_recovery_cases}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">High Risk Cases (&gt;= 10k)</span>
                  <span className="text-lg font-extrabold text-amber-600">
                    {recAnalysis.high_risk_cases}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Unresolved Cases</span>
                  <span className="text-lg font-extrabold text-rose-600">
                    {recAnalysis.unresolved_cases}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: EXECUTIVE FINDINGS */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Executive Findings & Insights</span>
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                AI Generated
              </span>
            </div>

            <div className="space-y-2.5">
              {findings.length === 0 ? (
                <p className="text-xs text-slate-400 font-mono italic">
                  No findings available for the selected period.
                </p>
              ) : (
                findings.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-mono text-slate-700"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 5: TRANSACTION DETAILS */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-slate-900 font-mono uppercase flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-700" />
                  <span>Transaction Details ({transactions.length})</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Detailed ledger of all transactions, failures, diagnoses, and recovery execution outcomes
                </p>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  title="No transactions available."
                  description="No transactions match the selected filter criteria or the database is currently empty."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-mono border-b border-slate-200">
                    <tr>
                      <th className="p-4">Transaction ID</th>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Failure Type</th>
                      <th className="p-4">Diagnosis</th>
                      <th className="p-4">Recovery Action</th>
                      <th className="p-4">Method</th>
                      <th className="p-4">Recovery Status</th>
                      <th className="p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {transactions.map((tx) => (
                      <tr
                        key={tx.transaction_id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="p-4 font-bold text-indigo-600">
                          <Link
                            href={`/transactions/${tx.transaction_id}`}
                            className="hover:underline"
                          >
                            {tx.transaction_id}
                          </Link>
                        </td>
                        <td className="p-4 text-slate-700">{tx.order_id || "—"}</td>
                        <td className="p-4 font-extrabold text-slate-900">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="p-4">
                          <StatusBadge type="payment" status={tx.status as any} size="sm" />
                        </td>
                        <td className="p-4 text-slate-600 max-w-xs truncate">
                          {tx.failure_type || "None"}
                        </td>
                        <td className="p-4 text-slate-600 max-w-xs truncate">
                          {tx.diagnosis || "—"}
                        </td>
                        <td className="p-4 text-slate-800 font-semibold">
                          {tx.recovery_action || "—"}
                        </td>
                        <td className="p-4 text-slate-600">
                          {tx.recovery_method || "—"}
                        </td>
                        <td className="p-4">
                          <StatusBadge
                            type="recovery"
                            status={tx.recovery_status as any}
                            size="sm"
                          />
                        </td>
                        <td className="p-4 text-slate-500 whitespace-nowrap">
                          {tx.created_date ? new Date(tx.created_date).toLocaleDateString("en-IN") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
