"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../components/layout/AppShell";
import StatusBadge from "../../components/common/StatusBadge";
import ErrorBanner from "../../components/common/ErrorBanner";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import {
  fetchHumanCases,
  contactCustomerHuman,
  sendHumanPaymentLink,
  completeHumanPayment,
  HumanCase,
} from "../../lib/api";
import {
  Headset,
  PhoneCall,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Bot,
  ExternalLink,
  X,
  Plus,
  FileText,
  UserCheck,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  WifiOff,
} from "lucide-react";

export default function HumanAssociatePage() {
  const [cases, setCases] = useState<HumanCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Selected Case Drawer
  const [selectedCase, setSelectedCase] = useState<HumanCase | null>(null);

  // Actions State
  const [contactChannel, setContactChannel] = useState<"PHONE" | "WHATSAPP" | "EMAIL">("PHONE");
  const [contactNotes, setContactNotes] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHumanCases({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        priority: priorityFilter === "ALL" ? undefined : priorityFilter,
      });
      setCases(data || []);
      if (selectedCase) {
        const refreshed = (data || []).find((c) => c.case_id === selectedCase.case_id);
        if (refreshed) setSelectedCase(refreshed);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load Human Associate cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [statusFilter, priorityFilter]);

  const handleContactCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !contactNotes.trim()) return;

    setActionLoading(true);
    setActionSuccess(null);
    try {
      await contactCustomerHuman(selectedCase.case_id, {
        channel: contactChannel,
        notes: contactNotes.trim(),
        agent_name: "Priya Sharma (Human Associate)",
      });
      setActionSuccess(`Customer contact logged via ${contactChannel}!`);
      setContactNotes("");
      await loadCases();
    } catch (err: any) {
      setError(`Contact logging failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendApprovedLink = async () => {
    if (!selectedCase) return;

    setActionLoading(true);
    setActionSuccess(null);
    try {
      const res = await sendHumanPaymentLink(selectedCase.case_id, {
        custom_message: customMessage || undefined,
        agent_name: "Priya Sharma (Human Associate)",
      });
      setActionSuccess(`Approved payment link generated and dispatched to ${selectedCase.customer.email}!`);
      setCustomMessage("");
      await loadCases();
    } catch (err: any) {
      setError(`Sending link failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompletePaymentSimulation = async () => {
    if (!selectedCase) return;

    setActionLoading(true);
    setActionSuccess(null);
    try {
      const res = await completeHumanPayment(selectedCase.case_id, {
        notes: `Customer completed payment of ₹${selectedCase.amount.toLocaleString()} through Human Associate assistance.`,
      });
      setActionSuccess(`Order ${selectedCase.order_id} marked RESOLVED! ₹${selectedCase.amount.toLocaleString()} recovered.`);
      await loadCases();
    } catch (err: any) {
      setError(`Payment completion failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const openCasesCount = cases.filter((c) => c.case_status === "OPEN").length;
  const inReviewCount = cases.filter((c) => c.case_status === "IN_REVIEW").length;
  const resolvedCount = cases.filter((c) => c.case_status === "RESOLVED").length;
  const totalRevenueAtRisk = cases
    .filter((c) => c.case_status !== "RESOLVED")
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <AppShell
      title="Human Associate Agent Workspace"
      description="Specialist workspace for high-value orders and cases where autonomous retries reached safety limits."
      onRefresh={loadCases}
      isRefreshing={loading}
    >
      {error && <ErrorBanner title="Human Queue Error" message={error} onRetry={loadCases} />}

      {/* KPI Cards for Human Queue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
              Pending Human Queue
            </span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
              {openCasesCount}
            </div>
            <p className="text-[11px] text-rose-600 font-mono font-bold mt-0.5">Urgent Intervention</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
              In Active Review
            </span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
              {inReviewCount}
            </div>
            <p className="text-[11px] text-purple-600 font-mono font-bold mt-0.5">Customer Contacted</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <Headset className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
              Resolved Cases
            </span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
              {resolvedCount}
            </div>
            <p className="text-[11px] text-emerald-600 font-mono font-bold mt-0.5">Assisted Captures</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
              Queue Revenue at Risk
            </span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1 truncate max-w-[170px]">
              {formatCurrency(totalRevenueAtRisk)}
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Pending Recovery</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Workspace Layout (Left: Queue Table, Right: Case Action Details) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cases Queue List */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 font-mono uppercase tracking-wider">
                Escalated Case Queue
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Automated retries halted. Manual review required.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-mono">
              {["ALL", "OPEN", "IN_REVIEW", "RESOLVED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === st
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <SkeletonLoader count={4} />
          ) : cases.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Headset className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 font-mono">No Escalated Cases</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                All payment failures are currently handled autonomously by ReviveAI.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => {
                const isSelected = selectedCase?.case_id === c.case_id;
                return (
                  <div
                    key={c.case_id}
                    onClick={() => {
                      setSelectedCase(c);
                      setActionSuccess(null);
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-50/50 border-purple-400 ring-2 ring-purple-400/20 shadow-sm"
                        : "bg-white border-slate-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold border ${
                            c.priority === "CRITICAL"
                              ? "bg-rose-100 text-rose-700 border-rose-300"
                              : c.priority === "HIGH"
                              ? "bg-orange-100 text-orange-700 border-orange-300"
                              : "bg-amber-100 text-amber-700 border-amber-300"
                          }`}
                        >
                          {c.priority} PRIORITY
                        </span>
                        <span className="text-xs font-bold text-slate-900 font-mono">{c.order_id}</span>
                      </div>

                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        {formatCurrency(c.amount)}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs font-mono text-slate-600">
                      <div>
                        <strong>Customer:</strong> {c.customer.name} ({c.customer.phone})
                      </div>
                      <div>
                        <strong>Product:</strong> {c.product.name}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                      <div className="text-rose-600 font-semibold truncate max-w-xs flex items-center gap-1">
                        {c.is_network_error && <WifiOff className="w-3.5 h-3.5 inline text-amber-500" />}
                        <span>{c.failure_reason}</span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          c.case_status === "RESOLVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.case_status === "IN_REVIEW"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {c.case_status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Case Action Workspace */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          {selectedCase ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-700 border border-purple-200">
                      CASE #{selectedCase.case_id.slice(0, 8)}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {selectedCase.order_id}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900 mt-1 font-mono">
                    {selectedCase.product.name}
                  </h3>
                </div>

                <div className="text-right font-mono">
                  <div className="text-lg font-extrabold text-slate-900">
                    {formatCurrency(selectedCase.amount)}
                  </div>
                  <span className="text-[10px] text-rose-600 font-bold uppercase">
                    Revenue at Risk
                  </span>
                </div>
              </div>

              {actionSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Customer Contact Details */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Name:</span>
                  <span className="font-bold text-slate-900">{selectedCase.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-bold text-slate-900">{selectedCase.customer.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-bold text-slate-900">{selectedCase.customer.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Attempts:</span>
                  <span className="font-bold text-rose-600">{selectedCase.payment_attempts_count} (Limit Reached)</span>
                </div>
              </div>

              {/* AI Diagnosis & Recommendation Box */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-900">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>ReviveAI Diagnosis & Recommendation</span>
                </div>
                <p className="text-xs text-indigo-950 font-mono">
                  {selectedCase.ai_recommendation}
                </p>
                <p className="text-[11px] text-indigo-700 font-mono">
                  <strong>Technical Cause:</strong> {selectedCase.failure_reason}
                </p>
              </div>

              {/* Action 1: Log Customer Contact */}
              <form onSubmit={handleContactCustomer} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-purple-600" />
                    <span>Contact Customer</span>
                  </span>
                  <div className="flex gap-1">
                    {(["PHONE", "WHATSAPP", "EMAIL"] as const).map((ch) => (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => setContactChannel(ch)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          contactChannel === ch
                            ? "bg-purple-600 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  placeholder="Log call/chat details (e.g. customer verified bank limit, requested link via WhatsApp)..."
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500 resize-none"
                  required
                />

                <button
                  type="submit"
                  disabled={actionLoading || !contactNotes.trim()}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-200 text-white font-mono font-bold text-xs rounded-lg transition-all"
                >
                  Log Contact & Mark In-Review
                </button>
              </form>

              {/* Action 2: Send Approved Payment Link */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-purple-600" />
                    <span>Send Approved Payment Link</span>
                  </span>
                </div>

                <input
                  type="text"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Optional note / support message for customer..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                />

                <button
                  onClick={handleSendApprovedLink}
                  disabled={actionLoading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Approved Recovery Link</span>
                </button>
              </div>

              {/* Action 3: Complete Assisted Payment Simulation (Scenario 2 End) */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between text-emerald-900 font-mono font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Simulate Assisted Customer Payment</span>
                  </span>
                  <span>{formatCurrency(selectedCase.amount)}</span>
                </div>
                <p className="text-[11px] text-emerald-800 font-mono">
                  Test customer completing payment via human assistance. Confirms order and marks case RESOLVED.
                </p>

                <button
                  onClick={handleCompletePaymentSimulation}
                  disabled={actionLoading || selectedCase.case_status === "RESOLVED"}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 text-white font-mono font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                >
                  {selectedCase.case_status === "RESOLVED"
                    ? "Case Already Resolved"
                    : `Mark Resolved & Recover ${formatCurrency(selectedCase.amount)}`}
                </button>
              </div>

              {/* Case History Timeline */}
              {selectedCase.action_history && selectedCase.action_history.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <h5 className="text-xs font-bold text-slate-600 font-mono uppercase">
                    Case Activity Timeline
                  </h5>
                  <div className="space-y-2">
                    {selectedCase.action_history.map((hist, i) => (
                      <div key={i} className="p-2.5 bg-slate-50 rounded-lg text-xs font-mono text-slate-700 border">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{hist.action?.replace(/_/g, " ") || hist.event}</span>
                          <span className="text-[10px] text-slate-400">{hist.timestamp?.slice(11, 16) || "Just now"}</span>
                        </div>
                        {hist.notes && <p className="text-slate-600 mt-0.5">{hist.notes}</p>}
                        {hist.message && <p className="text-slate-600 mt-0.5">{hist.message}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 font-mono">
              <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700">Select a case from the queue</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Review payment history, contact customer, and dispatch payment links.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
