"use client";

import React, { useState } from "react";
import { AuditLogEvent } from "../types/audit";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Zap,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Brain,
  Target,
  ShieldAlert,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface AuditTrailTimelineProps {
  events: AuditLogEvent[];
  transactionId?: string;
}

const EVENT_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; bg: string; text: string; border: string }
> = {
  TRANSACTION_INGESTED: {
    label: "Transaction Ingested",
    icon: <FileText className="w-3.5 h-3.5 text-slate-600" />,
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  TRANSACTION_UPDATED: {
    label: "Transaction Updated",
    icon: <FileText className="w-3.5 h-3.5 text-slate-600" />,
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  REVENUE_RISK_DETECTED: {
    label: "Revenue Risk Detected",
    icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
  AI_DIAGNOSIS_COMPLETED: {
    label: "AI Diagnosis Completed",
    icon: <Brain className="w-3.5 h-3.5 text-indigo-600" />,
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
  RECOVERY_DECISION_CREATED: {
    label: "Recovery Decision Strategy",
    icon: <Target className="w-3.5 h-3.5 text-sky-600" />,
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  POLICY_VALIDATION_COMPLETED: {
    label: "Policy Validation",
    icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  POLICY_BLOCKED_ACTION: {
    label: "Policy Blocked Action",
    icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />,
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
  RECOVERY_STARTED: {
    label: "Recovery Workflow Started",
    icon: <Zap className="w-3.5 h-3.5 text-sky-600" />,
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  RECOVERY_SUCCEEDED: {
    label: "Recovery Succeeded",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-300",
  },
  REVENUE_RECOVERED: {
    label: "Revenue Recovered",
    icon: <Zap className="w-3.5 h-3.5 text-emerald-600" />,
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
  },
  RECOVERY_FAILED: {
    label: "Recovery Attempt Failed",
    icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-300",
  },
  HUMAN_ESCALATION_CREATED: {
    label: "Human Escalation Created",
    icon: <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />,
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  HUMAN_ESCALATION_RESOLVED: {
    label: "Human Escalation Resolved",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  RECOVERY_STOPPED: {
    label: "Recovery Workflow Halted",
    icon: <ShieldAlert className="w-3.5 h-3.5 text-slate-600" />,
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
  },
  CUSTOMER_OPT_OUT: {
    label: "Customer Opted Out",
    icon: <UserCheck className="w-3.5 h-3.5 text-amber-600" />,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
};

export default function AuditTrailTimeline({ events, transactionId }: AuditTrailTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 border border-slate-200 rounded-2xl bg-white shadow-sm">
        <p className="text-xs font-mono">No audit log records found.</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-slate-800">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-2">
        <div>
          <h3 className="text-base font-bold tracking-wide text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Chronological Audit Trail</span>
          </h3>
          {transactionId && (
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Transaction Reference: <span className="text-indigo-600 font-bold">{transactionId}</span>
            </p>
          )}
        </div>
        <div className="px-3 py-1 bg-slate-100 rounded-full text-xs font-mono font-bold text-slate-700 border border-slate-200">
          {events.length} Event{events.length === 1 ? "" : "s"} Logged
        </div>
      </div>

      {/* Timeline Events */}
      <div className="relative pl-6 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-emerald-400 before:via-indigo-400 before:to-rose-400">
        {events.map((event, index) => {
          const config = EVENT_CONFIG[event.event_type] || {
            label: event.event_type.replace(/_/g, " "),
            icon: <FileText className="w-3.5 h-3.5 text-slate-600" />,
            bg: "bg-slate-100",
            text: "text-slate-700",
            border: "border-slate-200",
          };

          const isExpanded = expandedId === event.id || (!event.id && expandedId === String(index));
          const eventKey = event.id || `event-${index}`;
          const formattedTime = new Date(event.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div key={eventKey} className="relative group">
              {/* Dot Icon Indicator */}
              <div
                className={`absolute -left-[31px] top-2 w-7 h-7 rounded-full flex items-center justify-center border shadow-sm ${config.bg} ${config.border}`}
              >
                {config.icon}
              </div>

              {/* Event Card */}
              <div
                className={`rounded-2xl border transition-all duration-200 ${config.border} ${
                  isExpanded ? "bg-slate-50 shadow-md" : "bg-white hover:bg-slate-50/80"
                } p-4 cursor-pointer shadow-sm`}
                onClick={() => toggleExpand(event.id || String(index))}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-lg border ${config.bg} ${config.text} ${config.border}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                      actor: {event.actor}
                    </span>
                    {event.transaction_id && !transactionId && (
                      <Link
                        href={`/transactions/${event.transaction_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold font-mono border border-indigo-200"
                      >
                        {event.transaction_id}
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono">{formattedTime}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>

                <p className="mt-2 text-xs font-semibold text-slate-800 font-mono leading-relaxed">
                  {event.event_message}
                </p>

                {/* Snippets when collapsed */}
                {event.metadata && Object.keys(event.metadata).length > 0 && !isExpanded && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono">
                    {event.metadata.risk_amount !== undefined && (
                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-bold">
                        Risk: {event.metadata.currency || "INR"} {event.metadata.risk_amount}
                      </span>
                    )}
                    {event.metadata.root_cause && (
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold">
                        Cause: {event.metadata.root_cause} ({Math.round((event.metadata.confidence || 0) * 100)}%)
                      </span>
                    )}
                    {event.metadata.policy_result && (
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                        Policy: {event.metadata.policy_result}
                      </span>
                    )}
                    {event.metadata.recovered_amount !== undefined && (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300 font-bold">
                        Recovered: {event.metadata.currency || "INR"} {event.metadata.recovered_amount}
                      </span>
                    )}
                    {event.metadata.stop_reason && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        Stop: {event.metadata.stop_reason}
                      </span>
                    )}
                  </div>
                )}

                {/* Expanded Full JSON Metadata Inspector */}
                {isExpanded && event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-[11px] font-bold text-slate-600 font-mono mb-1">
                      Structured Audit Metadata Payload:
                    </p>
                    <pre className="p-3 bg-slate-50 rounded-xl text-[11px] font-mono text-indigo-700 overflow-x-auto border border-slate-200">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
