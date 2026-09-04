"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = "success",
  isOpen,
  onClose,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const isSuccess = type === "success";
  const isError = type === "error";

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div
        className={`flex items-start gap-3 p-4 rounded-2xl shadow-xl border ${
          isSuccess
            ? "bg-emerald-50/95 border-emerald-200 text-emerald-900"
            : isError
            ? "bg-rose-50/95 border-rose-200 text-rose-900"
            : "bg-slate-900/95 border-slate-700 text-white"
        } backdrop-blur-md`}
      >
        <div className="shrink-0 mt-0.5">
          {isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
        </div>

        <div className="flex-1 text-xs font-mono font-medium leading-relaxed">
          {message}
        </div>

        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
