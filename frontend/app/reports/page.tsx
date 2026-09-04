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
  fetchReportPdfBlob,
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
  Eye,
  ExternalLink,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const loadReport = async (filterParams: ReportFilters = activeFilters, showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReportData(filterParams);
      setReportData(data);
      if (showToast) {
        setToastMessage("Report Generated Successfully ✓");
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(activeFilters, false);
  }, [activeFilters]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilters({ ...filters });
    loadReport(filters, true);
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
    loadReport(emptyFilters, true);
  };

  const handlePreviewPdf = async () => {
    setPreviewLoading(true);
    try {
      const blob = await fetchReportPdfBlob(activeFilters);
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (err: any) {
      alert(`PDF preview generation failed: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadReportPdf(activeFilters);
      setToastMessage("PDF report downloaded successfully.");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert(`Unable to generate PDF. Please try again: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      await downloadReportExcel(activeFilters);
      setToastMessage("Excel report downloaded successfully.");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert(`Unable to generate Excel. Please try again: ${err.message}`);
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
    pending_payments: 0,
    abandoned_payments: 0,
    revenue_at_risk: 0,
    ai_recovered: 0,
    human_recovered: 0,
    total_recovered: 0,
    recovery_rate: 0,
    unresolved_revenue: 0,
    high_risk_cases: 0,
  };

  const failAnalysis = reportData?.failure_analysis || {
    network_errors: 0,
    payment_timeouts: 0,
    authentication_failures: 0,
    abandonments: 0,
    other_failures: 0,
    breakdown_table: [],
  };

  const recAnalysis = reportData?.recovery_analysis || {
    ai_recovery_cases: 0,
    human_recovery_cases: 0,
    high_risk_cases: 0,
    unresolved_cases: 0,
    unresolved_revenue: 0,
  };

  const findings = reportData?.executive_findings || [];
  const recommendations = reportData?.recommendations || [];
  const transactions = reportData?.transactions || [];

  return (
    <AppShell
      title="Revenue Recovery Report"
      description="Real-time financial intelligence, autonomous recovery audits, failure diagnostics, and multi-format compliance exports."
      onRefresh={() => loadReport(activeFilters, true)}
      isRefreshing={loading}
    >
      {error && (
        <ErrorBanner
          title="Report Generation Error"
          message={error}
          onRetry={() => loadReport(activeFilters, true)}
        />
      )}

      {toastMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 font-mono text-xs flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white text-sm">
            &times;
          </button>
        </div>
      )}

      {/* Top Banner & Export Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                Real-Time Database Source
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {reportData?.generated_at
                  ? `Generated: ${new Date(reportData.generated_at).toLocaleString("en-IN")}`
                  : "Live Calculation"}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              REVIVE<span className="text-emerald-400">AI</span> Revenue Recovery Reports
            </h2>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Real-time audit reporting with executive summaries, technical failure root causes, channel recovery attributions, and certified exports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Generate / Refresh */}
            <button
              onClick={() => loadReport(activeFilters, true)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
              <span>Generate Report</span>
            </button>

            {/* Preview PDF */}
            <button
              onClick={handlePreviewPdf}
              disabled={previewLoading || loading}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-md disabled:opacity-50 active:scale-95 border border-slate-600"
            >
              <Eye className={`w-4 h-4 ${previewLoading ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
              <span>{previewLoading ? "Opening Preview..." : "Preview PDF"}</span>
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || loading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/30 disabled:opacity-50 active:scale-95"
            >
              <FileText className={`w-4 h-4 ${downloadingPdf ? "animate-pulse" : ""}`} />
              <span>{downloadingPdf ? "Generating PDF..." : "Download PDF"}</span>
            </button>

            {/* Download Excel */}
            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel || loading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/30 disabled:opacity-50 active:scale-95"
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
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-wider">
                Real-Time Query Filters
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Filters dynamically restrict both PDF & Excel calculations
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Date From */}
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filters.date_from || ""}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filters.date_to || ""}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
                <option value="ABANDONED">Abandoned</option>
                <option value="UNRESOLVED">Unresolved</option>
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Failures</option>
                <option value="NETWORK_ERROR">Network Error (TCP RST)</option>
                <option value="PAYMENT_TIMEOUT">Payment Timeout (504)</option>
                <option value="AUTHENTICATION_FAILED">Authentication (3DS/OTP)</option>
                <option value="BANK_DECLINE">Bank Decline</option>
                <option value="ABANDONED">Abandoned Checkout</option>
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Methods</option>
                <option value="AI">AI Autonomous Recovery</option>
                <option value="HUMAN">Human Associate Queue</option>
                <option value="NONE">Direct / None</option>
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
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Apply Filters & Generate</span>
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
          {/* SECTION 1: EXECUTIVE SUMMARY */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-extrabold tracking-tight text-slate-900 font-mono uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Executive Summary & Financial Metrics</span>
              </h3>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Overall Recovery Rate: {summary.recovery_rate}%
              </span>
            </div>

            {/* 10 KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Orders"
                value={summary.total_orders.toLocaleString()}
                subtitle={`${summary.successful_payments} confirmed / ${summary.failed_payments} failed`}
                icon={Layers}
                variant="cyan"
              />

              <MetricCard
                title="Revenue at Risk"
                value={formatCurrency(summary.revenue_at_risk)}
                subtitle={`${summary.failed_payments + summary.abandoned_payments} Drop-offs Monitored`}
                icon={AlertOctagon}
                variant="coral"
              />

              <MetricCard
                title="Total Recovered"
                value={formatCurrency(summary.total_recovered)}
                subtitle={`Recovery Rate: ${summary.recovery_rate}%`}
                icon={Zap}
                variant="mint"
              />

              <MetricCard
                title="Unresolved Revenue"
                value={formatCurrency(summary.unresolved_revenue || summary.revenue_at_risk)}
                subtitle={`${recAnalysis.unresolved_cases} Active Open Cases`}
                icon={Clock}
                variant="amber"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white border border-slate-200 rounded-2xl font-mono text-xs shadow-sm">
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">AI Recovered</span>
                <p className="text-xl font-extrabold text-emerald-600">{formatCurrency(summary.ai_recovered)}</p>
                <span className="text-[10px] text-slate-400">{recAnalysis.ai_recovery_cases} autonomous cases</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Human Recovered</span>
                <p className="text-xl font-extrabold text-purple-600">{formatCurrency(summary.human_recovered)}</p>
                <span className="text-[10px] text-slate-400">{recAnalysis.human_recovery_cases} specialist cases</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">High Risk Cases</span>
                <p className="text-xl font-extrabold text-rose-600">{summary.high_risk_cases || 0}</p>
                <span className="text-[10px] text-slate-400">&ge; ₹10,000 threshold</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Successful Payments</span>
                <p className="text-xl font-extrabold text-slate-900">{summary.successful_payments}</p>
                <span className="text-[10px] text-slate-400">Captured in full</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: FAILURE ANALYSIS TABLE */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Failure Analysis & Root Cause Telemetry</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {summary.failed_payments + summary.abandoned_payments} total failure events
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Failure Category</th>
                    <th className="py-3 px-3">Cases</th>
                    <th className="py-3 px-3 text-rose-600">Revenue at Risk</th>
                    <th className="py-3 px-3 text-emerald-600">Recovered</th>
                    <th className="py-3 px-3">Unresolved</th>
                    <th className="py-3 px-4 text-right">Recovery Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {failAnalysis.breakdown_table && failAnalysis.breakdown_table.length > 0 ? (
                    failAnalysis.breakdown_table.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.failure_type}</td>
                        <td className="py-3.5 px-3">{row.cases}</td>
                        <td className="py-3.5 px-3 font-semibold text-rose-600">{formatCurrency(row.revenue_at_risk)}</td>
                        <td className="py-3.5 px-3 font-semibold text-emerald-600">{formatCurrency(row.recovered)}</td>
                        <td className="py-3.5 px-3 font-semibold">{formatCurrency(row.unresolved)}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">{row.recovery_rate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No failure records recorded for the selected parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: RECOVERY PERFORMANCE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wide flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600" />
                  <span>Recovery Channel Attribution</span>
                </h3>
                <span className="text-[11px] font-mono text-emerald-600 font-bold">
                  {formatCurrency(summary.total_recovered)}
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-emerald-950 font-bold block">Autonomous AI Engine</span>
                    <span className="text-emerald-700 text-[11px]">{recAnalysis.ai_recovery_cases} automated retry workflows</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-950 font-extrabold text-sm block">{formatCurrency(summary.ai_recovered)}</span>
                    <span className="text-emerald-700 text-[10px]">
                      {summary.total_recovered > 0 ? ((summary.ai_recovered / summary.total_recovered) * 100).toFixed(1) : 0}% share
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 flex items-center justify-between">
                  <div>
                    <span className="text-purple-950 font-bold block">Human Associate Queue</span>
                    <span className="text-purple-700 text-[11px]">{recAnalysis.human_recovery_cases} specialist consultations</span>
                  </div>
                  <div className="text-right">
                    <span className="text-purple-950 font-extrabold text-sm block">{formatCurrency(summary.human_recovered)}</span>
                    <span className="text-purple-700 text-[10px]">
                      {summary.total_recovered > 0 ? ((summary.human_recovered / summary.total_recovered) * 100).toFixed(1) : 0}% share
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Executive Findings & Recommendations */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wide flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>AI Recovery Findings & Recommendations</span>
                </h3>
              </div>

              <div className="space-y-3 font-mono text-xs max-h-56 overflow-y-auto">
                <div className="space-y-1.5">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Key Findings:</span>
                  {findings.length > 0 ? (
                    findings.map((f, idx) => (
                      <p key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 leading-relaxed">
                        • {f}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-400">No findings available.</p>
                  )}
                </div>

                {recommendations.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-emerald-700 font-bold block text-[10px] uppercase tracking-wider">Strategic Recommendations:</span>
                    {recommendations.map((r, idx) => (
                      <p key={idx} className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-900 leading-relaxed">
                        <b>{idx + 1}.</b> {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: TRANSACTIONS LIST */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-700" />
                  <span>Transaction Ledger & Recovery State</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Showing {transactions.length} filtered transactions with individual certificate access.
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border">
                {transactions.length} Records
              </span>
            </div>

            {transactions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Transactions Available"
                description="There are no transactions recorded matching the selected filter criteria or the baseline has been reset."
                actionLabel="Reset Filters"
                onAction={handleClearFilters}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Transaction ID</th>
                      <th className="py-3 px-3">Order ID</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Failure Reason</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3">Recovery Status</th>
                      <th className="py-3 px-4 text-right">Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {transactions.slice(0, 50).map((t) => (
                      <tr key={t.transaction_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <Link
                            href={`/transactions/${t.transaction_id}`}
                            className="hover:text-emerald-600 transition-colors flex items-center gap-1"
                          >
                            <span>{t.transaction_id}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{t.order_id || "—"}</td>
                        <td className="py-3 px-3 font-semibold">{formatCurrency(t.amount)}</td>
                        <td className="py-3 px-3">
                          <StatusBadge type="payment" status={t.status as any} />
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-500">
                          {t.failure_type}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 border text-slate-700">
                            {t.recovery_method}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge type="recovery" status={t.recovery_status as any} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/transactions/${t.transaction_id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                          >
                            <span>View</span>
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
      )}

      {/* Interactive PDF Preview Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClosePreview}></div>
          <div className="relative w-full max-w-5xl h-[90vh] bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden z-10 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white font-mono">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm">ReviveAI Revenue Recovery PDF Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={handleClosePreview}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PDF Embed Frame */}
            <div className="flex-1 bg-slate-800 p-2">
              <iframe
                src={previewPdfUrl}
                className="w-full h-full rounded-2xl border-0 shadow-inner bg-white"
                title="ReviveAI PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
