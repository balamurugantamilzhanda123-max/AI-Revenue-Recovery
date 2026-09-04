"use client";

import React from "react";
import { Menu, RefreshCw, Sparkles, Cpu, RotateCcw } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenMobileNav?: () => void;
  onOpenDemo?: () => void;
  onOpenReset?: () => void;
}

export default function Header({
  title,
  description,
  onRefresh,
  isRefreshing = false,
  onOpenMobileNav,
  onOpenDemo,
  onOpenReset,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Mobile menu & Page Title */}
        <div className="flex items-center gap-4">
          {onOpenMobileNav && (
            <button
              onClick={onOpenMobileNav}
              className="lg:hidden p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
              <span>{title}</span>
            </h1>
            {description && (
              <p className="text-xs text-slate-500 font-mono mt-0.5 max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Autonomous Sandbox Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-mono text-indigo-700">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-slate-600">Mode:</span>
            <span className="font-semibold text-indigo-700">Deterministic + LLM</span>
          </div>

          {/* Demo Control Center Trigger */}
          {onOpenDemo && (
            <button
              onClick={onOpenDemo}
              className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-700 hover:to-emerald-600 text-white text-xs font-bold font-mono rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>Demo Center</span>
            </button>
          )}

          {/* Reset Dashboard Action */}
          {onOpenReset && (
            <button
              onClick={onOpenReset}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-900 text-xs font-bold font-mono rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
              title="Reset all transaction and recovery data"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>Reset Dashboard</span>
            </button>
          )}

          {/* Refresh Action */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 sm:px-3.5 sm:py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold font-mono rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              title="Refresh page data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`}
              />
              <span className="hidden sm:inline">
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
