"use client";

import React, { useState } from "react";
import { AlertTriangle, Check, X, Trash2, Loader2, ShieldAlert } from "lucide-react";

interface ResetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const CLEARED_ITEMS = [
  "Transactions",
  "Revenue at Risk",
  "Recovered Revenue",
  "AI Recovery Records",
  "Human Recovery Records",
  "Failed Payments",
  "Abandoned Payments",
  "Escalations",
  "Unresolved Cases",
  "Dashboard Analytics",
];

export default function ResetConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: ResetConfirmationModalProps) {
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error handled by parent toast
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg bg-white border border-rose-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900 font-mono uppercase">
                RESET DASHBOARD
              </h2>
              <p className="text-xs text-rose-600 font-semibold font-mono mt-0.5">
                Destructive Action • Irreversible Operational Data Purge
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isResetting}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Confirmation Text */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-800 leading-snug">
            Are you sure you want to reset all transaction and revenue recovery data?
          </p>

          {/* Checklist of cleared items */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
              This action will clear:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-700">
              {CLEARED_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preserved Data Notice */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs font-mono text-emerald-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-900 block">Preserved Configuration</span>
              <span>Your user/account and system configuration will <strong className="text-emerald-900">NOT</strong> be deleted.</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold text-xs transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold text-xs transition-all shadow-md shadow-rose-200 flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Resetting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset All Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
