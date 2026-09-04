"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../components/layout/AppShell";
import MetricCard from "../../components/common/MetricCard";
import StatusBadge from "../../components/common/StatusBadge";
import ErrorBanner from "../../components/common/ErrorBanner";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import {
  fetchSellerDashboard,
  fetchSellerCases,
  SellerDashboardSummary,
  SellerCase,
} from "../../lib/api";
import {
  Store,
  WifiOff,
  AlertTriangle,
  UserX,
  Bot,
  UserCheck,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  Filter,
  Search,
  ExternalLink,
  Eye,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
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

export default function SellerDashboardPage() {
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [cases, setCases] = useState<SellerCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [selectedProduct, setSelectedProduct] = useState<string>("ALL");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Inspect Modal
  const [inspectedCase, setInspectedCase] = useState<SellerCase | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, caseData] = await Promise.all([
        fetchSellerDashboard(),
        fetchSellerCases({
          filter: activeFilter === "ALL" ? undefined : activeFilter,
          product_id: selectedProduct === "ALL" ? undefined : selectedProduct,
          risk: selectedRisk === "ALL" ? undefined : selectedRisk,
          search: searchQuery || undefined,
        }),
      ]);
      setSummary(sumData);
      setCases(caseData);
    } catch (err: any) {
      setError(err.message || "Failed to load seller dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeFilter, selectedProduct, selectedRisk]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Pie chart data for failure breakdown
  const failurePieData = summary?.failure_breakdown
    ? [
        { name: "Network Errors", value: summary.failure_breakdown.network_errors, fill: "#F59E0B" },
        { name: "Timeouts", value: summary.failure_breakdown.timeouts, fill: "#EF4444" },
        { name: "Bank Declines", value: summary.failure_breakdown.bank_declines, fill: "#8B5CF6" },
        { name: "Auth Failures", value: summary.failure_breakdown.auth_failures, fill: "#3B82F6" },
        { name: "Abandonments", value: summary.failure_breakdown.abandonments, fill: "#EC4899" },
        { name: "Other", value: summary.failure_breakdown.other, fill: "#64748B" },
      ].filter((item) => item.value > 0)
    : [];

  // Bar chart for Revenue Recovery comparison
  const revenueComparisonData = summary
    ? [
        {
          name: "Revenue at Risk",
          amount: summary.revenue_at_risk,
          fill: "#E11D48",
        },
        {
          name: "AI Recovered",
          amount: summary.ai_recovered_revenue,
          fill: "#10B981",
        },
        {
          name: "Human Recovered",
          amount: summary.human_recovered_revenue,
          fill: "#8B5CF6",
        },
        {
          name: "Total Recovered",
          amount: summary.total_recovered_revenue,
          fill: "#059669",
        },
      ]
    : [];

  return (
    <AppShell
      title="Electrical Seller Revenue Dashboard"
      description="Real-time order monitoring, network error diagnosis, checkout abandonment, and AI + Human revenue recovery analytics."
      onRefresh={loadData}
      isRefreshing={loading}
    >
      {error && <ErrorBanner title="Seller Analytics Error" message={error} onRetry={loadData} />}

      {/* Main KPI Overview Cards (Dynamic Calculations) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <MetricCard
          title="Total Orders"
          value={summary?.total_orders.toLocaleString() ?? "0"}
          icon={Package}
          variant="cyan"
          subtitle={`${summary?.successful_orders ?? 0} confirmed / ${summary?.failed_orders ?? 0} failed`}
        />

        {/* Total Revenue at Risk */}
        <MetricCard
          title="Revenue at Risk"
          value={formatCurrency(summary?.revenue_at_risk)}
          icon={AlertTriangle}
          variant="coral"
          subtitle={`${summary?.unresolved_cases ?? 0} unresolved cases`}
        />

        {/* Total Revenue Recovered */}
        <MetricCard
          title="Total Recovered"
          value={formatCurrency(summary?.total_recovered_revenue)}
          icon={TrendingUp}
          variant="mint"
          subtitle={`AI: ${formatCurrency(summary?.ai_recovered_revenue)} | Human: ${formatCurrency(summary?.human_recovered_revenue)}`}
        />

        {/* Recovery Rate */}
        <MetricCard
          title="Recovery Rate"
          value={`${summary?.recovery_rate ?? 0}%`}
          icon={Zap}
          variant="amber"
          subtitle={`${summary?.high_risk_cases ?? 0} high-risk priority cases`}
        />
      </div>

      {/* Secondary Operational Metric Cards (Clickable Drilldown) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Network Errors Clickable Pill */}
        <button
          onClick={() => setActiveFilter("NETWORK_ERROR")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "NETWORK_ERROR"
              ? "bg-amber-500/10 border-amber-500 shadow-md"
              : "bg-white border-slate-200 hover:border-amber-400"
          }`}
        >
          <div className="flex items-center gap-1.5 text-amber-600 text-xs font-mono font-bold">
            <WifiOff className="w-4 h-4" />
            <span>Network Errors</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-2">
            {summary?.network_errors ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Affected customers</p>
        </button>

        {/* Checkout Abandonments Clickable Pill */}
        <button
          onClick={() => setActiveFilter("CHECKOUT_ABANDONED")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "CHECKOUT_ABANDONED"
              ? "bg-pink-500/10 border-pink-500 shadow-md"
              : "bg-white border-slate-200 hover:border-pink-400"
          }`}
        >
          <div className="flex items-center gap-1.5 text-pink-600 text-xs font-mono font-bold">
            <UserX className="w-4 h-4" />
            <span>Abandonments</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-2">
            {summary?.checkout_abandonments ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Left at checkout</p>
        </button>

        {/* AI Recovered Revenue Pill */}
        <button
          onClick={() => setActiveFilter("AI_RECOVERY")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "AI_RECOVERY"
              ? "bg-emerald-500/10 border-emerald-500 shadow-md"
              : "bg-white border-slate-200 hover:border-emerald-400"
          }`}
        >
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-mono font-bold">
            <Bot className="w-4 h-4" />
            <span>AI Recovered</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono mt-2 truncate">
            {formatCurrency(summary?.ai_recovered_revenue)}
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">{summary?.ai_recovery_cases ?? 0} autonomous</p>
        </button>

        {/* Human Recovered Revenue Pill */}
        <button
          onClick={() => setActiveFilter("HUMAN_REVIEW")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "HUMAN_REVIEW"
              ? "bg-purple-500/10 border-purple-500 shadow-md"
              : "bg-white border-slate-200 hover:border-purple-400"
          }`}
        >
          <div className="flex items-center gap-1.5 text-purple-600 text-xs font-mono font-bold">
            <UserCheck className="w-4 h-4" />
            <span>Human Recovered</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono mt-2 truncate">
            {formatCurrency(summary?.human_recovered_revenue)}
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">{summary?.human_recovery_cases ?? 0} specialist cases</p>
        </button>

        {/* High Risk Cases Pill */}
        <button
          onClick={() => setActiveFilter("HIGH_RISK")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "HIGH_RISK"
              ? "bg-rose-500/10 border-rose-500 shadow-md"
              : "bg-white border-slate-200 hover:border-rose-400"
          }`}
        >
          <div className="flex items-center gap-1.5 text-rose-600 text-xs font-mono font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>High Risk Orders</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-2">
            {summary?.high_risk_cases ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">&ge; ₹10,000 value</p>
        </button>

        {/* Unresolved Revenue Pill */}
        <button
          onClick={() => setActiveFilter("UNRESOLVED")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeFilter === "UNRESOLVED"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white border-slate-200 hover:border-slate-400"
          }`}
        >
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono font-bold">
            <Clock className="w-4 h-4" />
            <span>Unresolved</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono mt-2 truncate">
            {formatCurrency(summary?.unresolved_revenue)}
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1">{summary?.unresolved_cases ?? 0} open cases</p>
        </button>
      </div>

      {/* Visual Funnel & Revenue Leakage Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recovery Funnel */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-sm text-slate-900 font-mono uppercase tracking-wider">
                Autonomous Recovery Funnel
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Real-Time Aggregation</span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            {[
              {
                label: "1. Total Orders Placed",
                count: summary?.funnel?.orders ?? 0,
                color: "bg-slate-100 text-slate-800 border-slate-300",
                width: "100%",
              },
              {
                label: "2. Payment Initiated",
                count: summary?.funnel?.payment_initiated ?? 0,
                color: "bg-blue-50 text-blue-800 border-blue-200",
                width: "90%",
              },
              {
                label: "3. Failed / Abandoned (Revenue at Risk)",
                count: summary?.funnel?.payment_failed_or_abandoned ?? 0,
                color: "bg-rose-50 text-rose-800 border-rose-200",
                width: "75%",
              },
              {
                label: "4. Autonomous AI Recovery Message & Link",
                count: summary?.funnel?.ai_recovery_triggered ?? 0,
                color: "bg-amber-50 text-amber-800 border-amber-200",
                width: "60%",
              },
              {
                label: "5. Customer Retry Captured (AI Success)",
                count: summary?.funnel?.ai_payment_success ?? 0,
                color: "bg-emerald-50 text-emerald-800 border-emerald-200",
                width: "45%",
              },
              {
                label: "6. Escalated to Human Associate Queue",
                count: summary?.funnel?.escalated_to_human ?? 0,
                color: "bg-purple-50 text-purple-800 border-purple-200",
                width: "35%",
              },
              {
                label: "7. Resolved via Human Assistance",
                count: summary?.funnel?.human_payment_success ?? 0,
                color: "bg-teal-50 text-teal-800 border-teal-200",
                width: "25%",
              },
            ].map((step, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex items-center justify-between font-bold ${step.color}`}
                style={{ width: step.width, minWidth: "220px" }}
              >
                <span>{step.label}</span>
                <span className="px-2 py-0.5 rounded-full bg-white/80 border text-[11px]">
                  {step.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Failure Breakdown & Revenue Chart */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-sm text-slate-900 font-mono uppercase tracking-wider">
                Revenue At Risk vs. Recovered
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-600">
              Recovered: {formatCurrency(summary?.total_recovered_revenue)}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueComparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fontFamily: "monospace" }} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), "Amount"]}
                  contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", color: "#fff", fontFamily: "monospace" }}
                />
                <Bar dataKey="amount" radius={[0, 8, 8, 0]}>
                  {revenueComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs font-mono">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-amber-800 font-semibold block">Network Glitch Risk:</span>
              <span className="text-amber-950 font-extrabold text-sm">
                {formatCurrency(summary?.revenue_risk_breakdown?.network_errors)}
              </span>
            </div>
            <div className="p-3 bg-pink-50 rounded-xl border border-pink-200">
              <span className="text-pink-800 font-semibold block">Abandonment Risk:</span>
              <span className="text-pink-950 font-extrabold text-sm">
                {formatCurrency(summary?.revenue_risk_breakdown?.checkout_abandonments)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Product-Level Revenue Loss Analysis */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              <h3 className="font-extrabold text-sm text-slate-900 font-mono uppercase tracking-wider">
                Product-Level Revenue Leakage Breakdown
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Identify which electrical products experience high network drops, cart drop-offs, and revenue risk.
            </p>
          </div>

          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border">
            {summary?.product_revenue_loss?.length ?? 0} Catalog SKUs Monitored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Electrical Product</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Unit Price</th>
                <th className="py-3 px-3">Orders</th>
                <th className="py-3 px-3">Network Errors</th>
                <th className="py-3 px-3">Abandonments</th>
                <th className="py-3 px-3 text-rose-600">Revenue at Risk</th>
                <th className="py-3 px-3 text-emerald-600">Recovered</th>
                <th className="py-3 px-4 text-right">Recovery Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {summary?.product_revenue_loss?.slice(0, 10).map((prod) => (
                <tr key={prod.product_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs truncate">
                    {prod.product_name}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border">
                      {prod.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 font-semibold">{formatCurrency(prod.unit_price)}</td>
                  <td className="py-3.5 px-3 font-semibold">{prod.orders_count}</td>
                  <td className="py-3.5 px-3">
                    {prod.network_errors > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                        {prod.network_errors}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    {prod.checkout_abandonments > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-pink-50 text-pink-700 font-bold border border-pink-200">
                        {prod.checkout_abandonments}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="py-3.5 px-3 font-extrabold text-rose-600">
                    {formatCurrency(prod.revenue_at_risk)}
                  </td>
                  <td className="py-3.5 px-3 font-extrabold text-emerald-600">
                    {formatCurrency(prod.recovered_revenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {prod.recovery_rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seller Cases Table with Multi-Dimensional Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-700" />
              <h3 className="font-extrabold text-sm text-slate-900 font-mono uppercase tracking-wider">
                Seller Order Recovery Cases
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Filter by failure cause, network glitch, risk level, or customer status.
            </p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex items-center relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search customer, order, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 pl-9 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          </form>
        </div>

        {/* Filter Badges Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100">
          {[
            { id: "ALL", label: "All Cases" },
            { id: "NETWORK_ERROR", label: "⚡ Network Errors" },
            { id: "CHECKOUT_ABANDONED", label: "🛒 Checkout Abandoned" },
            { id: "PAYMENT_FAILED", label: "❌ Payment Failed" },
            { id: "AI_RECOVERY", label: "🤖 AI Recovery Active" },
            { id: "HUMAN_REVIEW", label: "👨‍💼 Human Review" },
            { id: "RECOVERED", label: "✅ Recovered" },
            { id: "UNRESOLVED", label: "⏳ Unresolved" },
            { id: "HIGH_RISK", label: "🚨 High Risk" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold whitespace-nowrap transition-all ${
                activeFilter === f.id
                  ? "bg-slate-900 text-white shadow-sm font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cases Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Electrical Product</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Failure Reason</th>
                <th className="py-3 px-3">Attempts</th>
                <th className="py-3 px-3">Risk Level</th>
                <th className="py-3 px-3">AI Status</th>
                <th className="py-3 px-3">Human Status</th>
                <th className="py-3 px-3">Recovery Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-mono">
                    No order recovery cases found matching selected filters.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.transaction_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {c.order_id}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900">{c.customer.name}</div>
                      <div className="text-[10px] text-slate-400">{c.customer.email}</div>
                    </td>
                    <td className="py-3.5 px-3 max-w-[160px] truncate font-semibold" title={c.product_name}>
                      {c.product_name}
                    </td>
                    <td className="py-3.5 px-3 font-extrabold text-slate-900">
                      {formatCurrency(c.amount)}
                    </td>
                    <td className="py-3.5 px-3 max-w-[160px] truncate">
                      {c.is_network_error ? (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                          Network Error
                        </span>
                      ) : (
                        <span className="text-slate-600">{c.failure_reason}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-center">{c.attempts}</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          c.risk === "CRITICAL"
                            ? "bg-rose-50 text-rose-700 border-rose-300"
                            : c.risk === "HIGH"
                            ? "bg-orange-50 text-orange-700 border-orange-300"
                            : c.risk === "MEDIUM"
                            ? "bg-amber-50 text-amber-700 border-amber-300"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {c.risk}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {c.ai_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      {c.human_status !== "-" ? (
                        <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {c.human_status}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <StatusBadge type="recovery" status={c.recovery_status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectedCase(c)}
                          title="Inspect Case"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {c.recovery_token && (
                          <Link
                            href={`/pay/recover/${c.recovery_token}`}
                            title="Open Customer Recovery Link"
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case Details Inspection Modal */}
      {inspectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setInspectedCase(null)}></div>
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                  Order Case Inspection
                </span>
                <h3 className="font-bold text-base font-mono">{inspectedCase.order_id}</h3>
              </div>
              <button onClick={() => setInspectedCase(null)} className="p-1 text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-400 block">Customer Name:</span>
                  <span className="font-bold text-slate-900">{inspectedCase.customer.name}</span>
                  <span className="text-slate-500 block text-[10px]">{inspectedCase.customer.email}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <span className="text-slate-400 block">Product:</span>
                  <span className="font-bold text-slate-900 truncate block">{inspectedCase.product_name}</span>
                  <span className="text-amber-600 font-extrabold">{formatCurrency(inspectedCase.amount)}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border space-y-1">
                <span className="text-slate-400 block">Technical Diagnosis / Failure Reason:</span>
                <p className="font-semibold text-rose-600">{inspectedCase.failure_reason}</p>
                <div className="flex gap-2 pt-1">
                  <span className="px-2 py-0.5 bg-slate-200 rounded text-[10px]">Attempts: {inspectedCase.attempts}</span>
                  <span className="px-2 py-0.5 bg-slate-200 rounded text-[10px]">Risk: {inspectedCase.risk}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
                <span className="text-amber-800 font-bold block">Dynamic Recovery Token Link:</span>
                <code className="text-[11px] text-slate-800 bg-white p-2 rounded block border truncate">
                  /pay/recover/{inspectedCase.recovery_token}
                </code>
              </div>

              <div className="pt-2 flex gap-3">
                <Link
                  href={`/pay/recover/${inspectedCase.recovery_token}`}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-center rounded-xl transition-all shadow-md"
                >
                  Test Customer Payment Link
                </Link>
                <Link
                  href="/human-associate"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-center rounded-xl transition-all shadow-md"
                >
                  Open Human Workspace
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
