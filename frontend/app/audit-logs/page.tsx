"use client";

import React, { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import AuditTrailTimeline from "../../components/AuditTrailTimeline";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import ErrorBanner from "../../components/common/ErrorBanner";
import EmptyState from "../../components/common/EmptyState";
import { fetchGlobalAudit } from "../../lib/api";
import { AuditLogEvent } from "../../types/audit";
import {
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const EVENT_TYPES = [
  "TRANSACTION_INGESTED",
  "TRANSACTION_UPDATED",
  "REVENUE_RISK_DETECTED",
  "AI_DIAGNOSIS_COMPLETED",
  "RECOVERY_DECISION_CREATED",
  "POLICY_VALIDATION_COMPLETED",
  "POLICY_BLOCKED_ACTION",
  "RECOVERY_STARTED",
  "RECOVERY_SUCCEEDED",
  "REVENUE_RECOVERED",
  "RECOVERY_FAILED",
  "RECOVERY_STOPPED",
  "HUMAN_ESCALATION_CREATED",
  "HUMAN_ESCALATION_RESOLVED",
  "CUSTOMER_OPT_OUT",
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTxId, setSearchTxId] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGlobalAudit({
        transaction_id: searchTxId.trim() || undefined,
        event_type: selectedEventType || undefined,
        limit,
        offset,
      });
      setLogs(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [selectedEventType, offset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    loadAuditLogs();
  };

  return (
    <AppShell
      title="Audit & Compliance Trail"
      description="Immutable, chronological audit log capturing every payment failure detection, AI reasoning point, safety decision, and financial execution."
      onRefresh={loadAuditLogs}
      isRefreshing={loading}
    >
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-bold font-mono text-slate-700 uppercase tracking-wider mb-1.5">
              Filter by Transaction ID
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. TX-DEMO-001"
                value={searchTxId}
                onChange={(e) => setSearchTxId(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="w-64">
            <label className="block text-xs font-bold font-mono text-slate-700 uppercase tracking-wider mb-1.5">
              Event Type
            </label>
            <select
              value={selectedEventType}
              onChange={(e) => {
                setSelectedEventType(e.target.value);
                setOffset(0);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Event Types ({EVENT_TYPES.length})</option>
              {EVENT_TYPES.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-mono text-xs rounded-xl transition-colors shadow-sm"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <ErrorBanner
          title="Audit Log Error"
          message={error}
          onRetry={loadAuditLogs}
        />
      )}

      {/* Audit Log Content */}
      {loading ? (
        <SkeletonLoader variant="timeline" count={6} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No Audit Events Recorded"
          description="No audit events matched the search criteria or transaction filter."
          icon={ShieldCheck}
        />
      ) : (
        <div className="space-y-6">
          <AuditTrailTimeline events={logs} transactionId={searchTxId || undefined} />

          {/* Pagination */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-mono text-xs text-slate-500 shadow-sm">
            <div>
              Showing {logs.length} events (Offset: {offset})
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0 || loading}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1 font-bold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={logs.length < limit || loading}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1 font-bold"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
