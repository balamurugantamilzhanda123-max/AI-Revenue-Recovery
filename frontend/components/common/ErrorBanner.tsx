"use client";

import React from "react";
import { AlertTriangle, RefreshCw, XCircle } from "lucide-react";

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  severity?: "error" | "warning";
}

export default function ErrorBanner({
  title = "An error occurred",
  message,
  onRetry,
  severity = "error",
}: ErrorBannerProps) {
  const isWarning = severity === "warning";

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        isWarning
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-rose-50 border-rose-200 text-rose-900"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl border ${
              isWarning
                ? "bg-amber-100 text-amber-700 border-amber-300"
                : "bg-rose-100 text-rose-700 border-rose-300"
            }`}
          >
            {isWarning ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-wide text-slate-900">
              {title}
            </h4>
            <p className="mt-1 text-xs text-slate-700 font-mono leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-xs font-bold rounded-xl border border-slate-300 hover:border-slate-400 text-slate-800 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
}
