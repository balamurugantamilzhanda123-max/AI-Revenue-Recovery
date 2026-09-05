"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "../../../components/layout/AppShell";
import StatusBadge from "../../../components/common/StatusBadge";
import SkeletonLoader from "../../../components/common/SkeletonLoader";
import ErrorBanner from "../../../components/common/ErrorBanner";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import AuditTrailTimeline from "../../../components/AuditTrailTimeline";
import {
  fetchTransactionDetail,
  fetchTransactionAudit,
  diagnoseTransaction,
  decideRecovery,
  startRecoveryWorkflow,
  downloadTransactionPdf,
} from "../../../lib/api";
import {
  Transaction,
  DiagnosisResult,
  DecisionResult,
  PolicyResult,
} from "../../../types/revive";
import { AuditLogEvent } from "../../../types/audit";
import {
  Bot,
  ShieldCheck,
  Zap,
  Play,
  CheckCircle2,
  Clock,
  ArrowLeft,
  User,
  CreditCard,
  ChevronRight,
  FileText,
} from "lucide-react";
import Link from "next/link";

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const transactionId = typeof params?.id === "string" ? params.id : "TX-DEMO-001";

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingCert, setDownloadingCert] = useState(false);

  // AI & Action States
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [policy, setPolicy] = useState<PolicyResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const handleDownloadCertificate = async () => {
    setDownloadingCert(true);
    try {
      await downloadTransactionPdf(transactionId);
    } catch (err: any) {
      alert(`Certificate download failed: ${err.message}`);
    } finally {
      setDownloadingCert(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [txData, auditData] = await Promise.all([
        fetchTransactionDetail(transactionId),
        fetchTransactionAudit(transactionId),
      ]);
      if (!txData || !txData.transaction_id || txData.status === undefined) {
        throw new Error(`Transaction ${transactionId} not found.`);
      }
      setTransaction(txData);
      setAuditEvents(auditData.events || []);

      // If recovery case exists, seed initial diagnosis/policy
      if (txData.recovery_cases && txData.recovery_cases.length > 0) {
        const latestCase = txData.recovery_cases[0];
        if (latestCase.root_cause) {
          setDiagnosis({
            transaction_id: txData.transaction_id,
            root_cause: latestCase.root_cause,
            confidence: latestCase.confidence || 0.9,
            evidence: latestCase.evidence || [],
            reason: latestCase.recommended_action || "Transmitted diagnostics",
            requires_human_review: latestCase.recovery_status === "ESCALATED",
          });
        }
        if (latestCase.policy_result) {
          setPolicy(latestCase.policy_result);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load transaction details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transactionId) {
      loadData();
    }
  }, [transactionId]);

  const handleRunDiagnosis = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const result = await diagnoseTransaction(transactionId);
      setDiagnosis(result);
      // Automatically evaluate recovery decision
      const decResult = await decideRecovery(transactionId);
      setDecision(decResult);
      setPolicy({
        allowed: decResult.allowed,
        result: decResult.policy as any,
        reasons: [decResult.reason],
      });
      await loadData();
    } catch (err: any) {
      setError(`AI Diagnosis failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteRecovery = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await startRecoveryWorkflow(transactionId);
      setActionSuccessMessage(
        `Recovery workflow completed! Status: ${res.execution_result?.payment_status || "EXECUTED"}`
      );
      setConfirmModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(`Recovery execution failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val?: number, cur: string = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: cur || "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <AppShell
      title={`Transaction: ${transactionId}`}
      description="Inspect end-to-end payment failure diagnosis, policy verification, and recovery actions."
      onRefresh={loadData}
      isRefreshing={loading}
    >
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
        <Link href="/transactions" className="hover:text-slate-800 flex items-center gap-1 font-bold">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Transactions</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-indigo-600 font-bold">{transactionId}</span>
      </div>

      {error && (
        <ErrorBanner
          title="Transaction error"
          message={error}
          onRetry={loadData}
        />
      )}

      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-mono font-bold text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading && !transaction ? (
        <div className="space-y-8">
          <SkeletonLoader variant="stats-grid" />
          <SkeletonLoader variant="card" count={2} />
          <SkeletonLoader variant="timeline" count={4} />
        </div>
      ) : transaction ? (
        <div className="space-y-8">
          {/* Top Banner Summary */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
                    {transaction.transaction_id}
                  </h2>
                  <StatusBadge type="payment" status={transaction.status} size="md" />
                  <StatusBadge
                    type="recovery"
                    status={transaction.recovery_status || "OPEN"}
                    size="md"
                  />
                  {transaction.escalation_status === "OPEN" && (
                    <StatusBadge type="escalation" status="OPEN" size="md" />
                  )}
                </div>
                <p className="text-xs font-mono text-slate-500">
                  Order ID: <span className="text-slate-800 font-bold">{transaction.order_id || "—"}</span> • Created:{" "}
                  <span className="text-slate-800 font-bold">
                    {transaction.created_at ? new Date(transaction.created_at).toLocaleString() : "—"}
                  </span>
                </p>
              </div>

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleDownloadCertificate}
                  disabled={downloadingCert}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 font-bold font-mono text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 border border-slate-700"
                >
                  <FileText className={`w-4 h-4 ${downloadingCert ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
                  <span>{downloadingCert ? "Generating Certificate..." : "Download Certificate (PDF)"}</span>
                </button>

                {transaction.status === "FAILED" && transaction.recovery_status !== "RECOVERED" && (
                  <>
                    {!diagnosis ? (
                      <button
                        onClick={handleRunDiagnosis}
                        disabled={actionLoading}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-mono text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <Bot className="w-4 h-4" />
                        <span>{actionLoading ? "Diagnosing..." : "Run AI Diagnosis"}</span>
                      </button>
                    ) : (policy?.allowed === false || transaction.escalation_status === "OPEN" || transaction.escalation_status === "IN_REVIEW" || transaction.retry_count >= 1) ? (
                      <Link
                        href="/human-associate"
                        className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold font-mono text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
                      >
                        <User className="w-4 h-4" />
                        <span>Human Associate Recovery Workspace</span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => setConfirmModalOpen(true)}
                        disabled={actionLoading}
                        className="px-5 py-2.5 rounded-xl font-bold font-mono text-xs transition-all flex items-center gap-2 disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:scale-105"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{actionLoading ? "Executing..." : "Start Controlled Retry"}</span>
                      </button>
                    )}
                  </>
                )}

                {transaction.status === "SUCCESS" && (
                  <div className="px-4 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-800 flex items-center gap-2 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Revenue Successfully Recovered</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick 4 Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Total Amount</span>
                <p className="text-xl font-extrabold text-slate-900">
                  {formatCurrency(transaction.amount, transaction.currency)}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Payment Method</span>
                <p className="text-base font-bold text-slate-800">
                  {transaction.payment_method}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Attempt Count</span>
                <p className="text-base font-bold text-slate-800">
                  {transaction.retry_count} / 1 Allowed
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold">Recovered Amount</span>
                <p className="text-xl font-extrabold text-emerald-600">
                  {formatCurrency(transaction.recovered_amount, transaction.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2 & 3: Customer & Gateway Diagnostics Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Details */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <User className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                  Customer & Account Profile
                </h3>
              </div>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Name:</span>
                  <span className="text-slate-900 font-bold font-sans">
                    {transaction.customer?.name || "Guest Customer"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer ID:</span>
                  <span className="text-slate-800 font-medium">{transaction.customer_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-800 font-medium">{transaction.customer?.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="text-slate-800 font-medium">{transaction.customer?.phone || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recovery Opt-In:</span>
                  <span className="text-emerald-600 font-bold">Active (Opted-in)</span>
                </div>
              </div>
            </div>

            {/* Failure Information & Gateway Diagnostics */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <CreditCard className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                  Failure Reason & Gateway Telemetry
                </h3>
              </div>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Categorized Reason:</span>
                  <span className="text-rose-600 font-extrabold">
                    {transaction.failure_reason || "None"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500">Gateway Response Payload:</span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-[11px] leading-relaxed">
                    {transaction.gateway_response || "No gateway error payload recorded."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6, 7 & 8: AI Diagnosis & Safety Policy Verification */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Diagnosis Card */}
            <div className="bg-white border border-indigo-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                    AI Root Cause Diagnosis
                  </h3>
                </div>
                {diagnosis && (
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold">
                    {Math.round(diagnosis.confidence * 100)}% CONFIDENCE
                  </span>
                )}
              </div>

              {diagnosis ? (
                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Identified Root Cause:</span>
                    <p className="text-sm font-extrabold text-indigo-700 uppercase mt-0.5">
                      {(diagnosis.root_cause || "UNKNOWN").replace(/_/g, " ")}
                    </p>
                  </div>

                  {/* Confidence Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Diagnostic Confidence</span>
                      <span className="text-indigo-700 font-bold">
                        {Math.round(diagnosis.confidence * 100)}% (High)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.round(diagnosis.confidence * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Evidence Points */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-slate-500 text-[11px] font-bold">Auditable Evidence:</span>
                    <ul className="space-y-1 text-slate-700 text-[11px]">
                      {diagnosis.evidence && diagnosis.evidence.length > 0 ? (
                        diagnosis.evidence.map((ev, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold shrink-0">✓</span>
                            <span>{ev}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-slate-500">Diagnostic signals verified from telemetry.</li>
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs font-mono space-y-3">
                  <p>Click below to execute autonomous root cause diagnosis.</p>
                  <button
                    onClick={handleRunDiagnosis}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs shadow-sm"
                  >
                    Run AI Diagnosis
                  </button>
                </div>
              )}
            </div>

            {/* Recovery Strategy Card */}
            <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Zap className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                  Autonomous Decision
                </h3>
              </div>

              {decision || diagnosis ? (
                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Recommended Strategy:</span>
                    <p className="text-sm font-extrabold text-emerald-700 uppercase mt-0.5">
                      {(decision?.decision || "controlled_retry").replace(/_/g, " ")}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Rationale:</span>
                    <p className="text-slate-700 text-[11px] leading-relaxed mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {decision?.reason ||
                        "Transient timeout identified with 0 prior retries. Safe to attempt single controlled gateway retry."}
                    </p>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Human Escalation:</span>
                    <span
                      className={
                        decision?.requires_human_review
                          ? "text-purple-700 font-bold"
                          : "text-emerald-700 font-bold"
                      }
                    >
                      {decision?.requires_human_review ? "REQUIRED" : "NOT REQUIRED"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs font-mono">
                  Pending AI Diagnosis
                </div>
              )}
            </div>

            {/* Safety & Policy Validation Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                    Safety & Policy Check
                  </h3>
                </div>
                <StatusBadge
                  type="policy"
                  status={policy?.result || (policy?.allowed ? "APPROVED" : "ALLOWED")}
                  size="sm"
                />
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Retry Limit Rule:</span>
                  <span className="text-slate-800 font-bold">Max 1 Auto-Retry</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Retries:</span>
                  <span className="text-slate-800 font-bold">{transaction.retry_count} / 1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Opt-Out Check:</span>
                  <span className="text-emerald-600 font-bold">PASS (Opted In)</span>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <p className="text-emerald-700 font-bold mb-0.5">Policy Authority:</p>
                  <span>Deterministic safety engine verified limits prior to execution.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Payment Attempt History */}
          {transaction.payment_attempts && transaction.payment_attempts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Clock className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                  Payment Attempt Lifecycle History
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">Attempt #</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Gateway Error / Response</th>
                      <th className="p-3">Recorded At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transaction.payment_attempts.map((att, idx) => (
                      <tr key={att.id || idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">Attempt #{att.attempt_number}</td>
                        <td className="p-3">
                          <StatusBadge type="payment" status={att.status} size="sm" />
                        </td>
                        <td className="p-3 text-slate-700">{att.gateway_response || "—"}</td>
                        <td className="p-3 text-slate-500">
                          {att.created_at ? new Date(att.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 10: Chronological Audit Trail */}
          <div>
            <AuditTrailTimeline events={auditEvents} transactionId={transactionId} />
          </div>
        </div>
      ) : null}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleExecuteRecovery}
        title="Execute Autonomous Payment Recovery?"
        description="This will trigger the controlled recovery workflow via the backend API. Gateway will retry transaction under verified safety policies."
        confirmLabel="Execute Controlled Retry"
        variant="success"
        loading={actionLoading}
        details={[
          { label: "Transaction ID", value: transactionId },
          {
            label: "Amount",
            value: formatCurrency(transaction?.amount, transaction?.currency),
          },
          { label: "Selected Strategy", value: "Controlled Retry" },
          { label: "Safety Policy Check", value: "APPROVED (1/1 Attempt)" },
        ]}
      />
    </AppShell>
  );
}
