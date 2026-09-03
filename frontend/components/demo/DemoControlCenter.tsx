"use client";

import React, { useState } from "react";
import {
  Sparkles,
  RotateCcw,
  Play,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";
import { resetDemoData, runPrimaryDemo, runRetryFailureDemo } from "../../lib/api";
import Link from "next/link";

interface DemoControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export default function DemoControlCenter({
  isOpen,
  onClose,
  onDataChanged,
}: DemoControlCenterProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = async () => {
    setLoadingAction("reset");
    setResultMessage(null);
    try {
      await resetDemoData();
      setResultMessage("Demo data successfully reset to initial baseline.");
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setResultMessage(`Reset failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRunPrimary = async () => {
    setLoadingAction("primary");
    setResultMessage(null);
    try {
      const res = await runPrimaryDemo();
      setResultMessage(
        `Primary Recovery executed for TX-DEMO-001! Recovered ₹5,999 with status: ${res.execution_result?.payment_status || "SUCCESS"}`
      );
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setResultMessage(`Execution failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRunFailure = async () => {
    setLoadingAction("failure");
    setResultMessage(null);
    try {
      await runRetryFailureDemo();
      setResultMessage(
        `Failure & Escalation executed for TX-DEMO-002! Retry failed, policy enforced limit, Escalation created.`
      );
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setResultMessage(`Execution failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>ReviveAI Demo Control Center</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Judge Sandbox
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Trigger end-to-end autonomous agent scenarios on actual backend APIs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Scenario 1: Primary Successful Recovery */}
          <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 font-mono uppercase tracking-wider">
                  Scenario 1 • Primary Demo
                </span>
                <span className="text-[11px] font-mono text-slate-500">TX-DEMO-001</span>
              </div>
              <p className="text-xs font-bold text-slate-800">
                Payment Timeout → AI Diagnosis → Policy ALLOWED → Successful Retry
              </p>
              <div className="text-[11px] text-slate-600 font-mono space-y-0.5 bg-white p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                <div>Amount: <span className="text-slate-900 font-bold">₹5,999 (UPI)</span></div>
                <div>Root Cause: <span className="text-indigo-600 font-bold">payment_timeout</span></div>
                <div>Target Outcome: <span className="text-emerald-600 font-bold">RECOVERED (₹5,999)</span></div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleRunPrimary}
                disabled={loadingAction !== null}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {loadingAction === "primary" ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Run Recovery</span>
              </button>

              <Link
                href="/transactions/TX-DEMO-001"
                onClick={onClose}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors shadow-sm"
                title="View TX-DEMO-001 details"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Scenario 2: Failure, Limit Enforcement & Human Escalation */}
          <div className="bg-rose-50/40 border border-rose-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 font-mono uppercase tracking-wider">
                  Scenario 2 • Safety Guardrail
                </span>
                <span className="text-[11px] font-mono text-slate-500">TX-DEMO-002</span>
              </div>
              <p className="text-xs font-bold text-slate-800">
                Retry Fails → Retry Limit Reached → System Halts → Human Escalation
              </p>
              <div className="text-[11px] text-slate-600 font-mono space-y-0.5 bg-white p-2.5 rounded-xl border border-rose-100 shadow-sm">
                <div>Amount: <span className="text-slate-900 font-bold">₹3,499 (Card)</span></div>
                <div>Policy Rule: <span className="text-amber-700 font-bold">Max 1 Auto-Retry</span></div>
                <div>Target Outcome: <span className="text-purple-700 font-bold">ESCALATED TO HUMAN</span></div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleRunFailure}
                disabled={loadingAction !== null}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {loadingAction === "failure" ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Run Escalation</span>
              </button>

              <Link
                href="/escalations"
                onClick={onClose}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors shadow-sm"
                title="View Escalation queue"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Live Feedback Banner */}
        {resultMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-mono text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{resultMessage}</span>
          </div>
        )}

        {/* Global Reset Action */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={handleReset}
            disabled={loadingAction !== null}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold font-mono text-slate-700 border border-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loadingAction === "reset" ? "animate-spin" : ""}`} />
            <span>Reset Demo Baseline Data</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
