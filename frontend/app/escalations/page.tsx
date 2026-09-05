"use client";

import React, { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import StatusBadge from "../../components/common/StatusBadge";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import ErrorBanner from "../../components/common/ErrorBanner";
import EmptyState from "../../components/common/EmptyState";
import { fetchEscalations, resolveEscalation } from "../../lib/api";
import { EscalationCase } from "../../types/revive";
import {
  UserCheck,
  CheckCircle2,
  FileCheck,
  X,
  Headset,
} from "lucide-react";
import Link from "next/link";

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<EscalationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve Modal State
  const [selectedCase, setSelectedCase] = useState<EscalationCase | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [resolving, setResolving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadEscalations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEscalations();
      setEscalations(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load escalations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEscalations();
  }, []);

  const handleOpenResolveModal = (caseItem: EscalationCase) => {
    setSelectedCase(caseItem);
    setResolutionText(
      `Reviewed gateway failure logs for ${caseItem.transaction_id}. Customer contact initiated with alternative payment link.`
    );
  };

  const handleSubmitResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !resolutionText.trim()) return;

    setResolving(true);
    setError(null);
    try {
      await resolveEscalation(selectedCase.id, resolutionText.trim());
      setSuccessMessage(`Escalation ${selectedCase.id} successfully resolved!`);
      setSelectedCase(null);
      await loadEscalations();
    } catch (err: any) {
      setError(`Failed to resolve escalation: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  return (
    <AppShell
      title="Human Escalations"
      description="Review cases where automated retries were halted by safety guardrails or retry limits."
      onRefresh={loadEscalations}
      isRefreshing={loading}
    >
      {error && (
        <ErrorBanner
          title="Escalation Queue Error"
          message={error}
          onRetry={loadEscalations}
        />
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-mono font-bold text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <SkeletonLoader variant="stats-grid" />
          <SkeletonLoader variant="card" count={3} />
        </div>
      ) : escalations.length === 0 ? (
        <EmptyState
          title="No Escalation Cases Open"
          description="All payment transactions are within normal limits or have been resolved."
          icon={UserCheck}
        />
      ) : (
        <div className="space-y-6">
          {/* Active Cases Grid */}
          <div className="grid grid-cols-1 gap-5">
            {escalations.map((esc) => {
              const isResolved = esc.status === "RESOLVED";
              return (
                <div
                  key={esc.id}
                  className={`bg-white border rounded-3xl p-6 shadow-sm transition-all ${
                    isResolved
                      ? "border-slate-200 opacity-80"
                      : "border-purple-300 shadow-md"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-lg font-extrabold font-mono text-slate-900">
                          Case {esc.id}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {esc.priority} PRIORITY
                        </span>
                        <StatusBadge type="escalation" status={esc.status} size="sm" />
                      </div>
                      <p className="text-xs font-mono text-slate-500">
                        Transaction Ref:{" "}
                        <Link
                          href={`/transactions/${esc.transaction_id}`}
                          className="text-indigo-600 hover:underline font-bold"
                        >
                          {esc.transaction_id}
                        </Link>
                        {" • "}
                        Created:{" "}
                        <span className="text-slate-800 font-bold">
                          {esc.created_at ? new Date(esc.created_at).toLocaleString() : "—"}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href="/human-associate"
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <Headset className="w-4 h-4" />
                        <span>Human Recovery Workspace</span>
                      </Link>
                      {!isResolved && (
                        <button
                          onClick={() => handleOpenResolveModal(esc)}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold font-mono text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <FileCheck className="w-4 h-4" />
                          <span>Resolve Case</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details Body */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 font-mono text-xs">
                    {/* Reason */}
                    <div className="space-y-1 bg-rose-50/50 p-4 rounded-2xl border border-rose-200">
                      <span className="text-rose-700 font-bold uppercase text-[10px]">
                        Escalation Reason
                      </span>
                      <p className="text-rose-900 font-bold leading-relaxed mt-1">
                        {esc.reason}
                      </p>
                    </div>

                    {/* AI Recommendation */}
                    <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-slate-600 font-bold uppercase text-[10px]">
                        AI Agent Recommendation
                      </span>
                      <p className="text-slate-800 leading-relaxed mt-1">
                        {esc.ai_recommendation ||
                          "Automatic retry limit reached. Hold further automation until payment method is updated."}
                      </p>
                    </div>

                    {/* Action History Summary */}
                    <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-slate-600 font-bold uppercase text-[10px]">
                        Action History Prior to Halting
                      </span>
                      <div className="space-y-1 mt-1 text-[11px] text-slate-700 font-bold">
                        <div>• Payment attempt 1 failed (TIMEOUT)</div>
                        <div>• Controlled retry attempted</div>
                        <div>• Retry limit (1/1) reached</div>
                        <div className="text-purple-700 font-extrabold">
                          • Safety guardrail halted workflow
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolve Escalation Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    Resolve Escalation Case
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Case {selectedCase.id} • {selectedCase.transaction_id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1.5">
                  Resolution Note (Logged to Audit Trail)
                </label>
                <textarea
                  rows={4}
                  required
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                  placeholder="Describe resolution taken..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  disabled={resolving}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold font-mono text-slate-700 border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving || !resolutionText.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold font-mono text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {resolving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Resolving...</span>
                    </>
                  ) : (
                    <span>Submit Resolution</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
