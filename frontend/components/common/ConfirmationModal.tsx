"use client";

import React from "react";
import { AlertCircle, X, ShieldCheck } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  details?: Array<{ label: string; value: React.ReactNode }>;
  variant?: "danger" | "primary" | "success";
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm Action",
  cancelLabel = "Cancel",
  loading = false,
  details = [],
  variant = "primary",
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    primary: {
      btn: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md",
      iconBg: "bg-indigo-50 text-indigo-600 border-indigo-200",
    },
    danger: {
      btn: "bg-rose-600 hover:bg-rose-700 text-white shadow-md",
      iconBg: "bg-rose-50 text-rose-600 border-rose-200",
    },
    success: {
      btn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-bold",
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
  };

  const currentStyle = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl border ${currentStyle.iconBg} shrink-0`}>
            {variant === "success" ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <AlertCircle className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1 pr-6">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Structured Details Box */}
        {details.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
            {details.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between pb-2 border-b border-slate-200 last:border-0 last:pb-0"
              >
                <span className="text-slate-500">{item.label}</span>
                <span className="font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 ${currentStyle.btn}`}
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
