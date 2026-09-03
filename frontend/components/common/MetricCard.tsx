"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "mint" | "coral" | "indigo" | "amber" | "violet" | "cyan" | "slate";
  trend?: {
    value: string;
    positive?: boolean;
  };
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "mint",
  trend,
  onClick,
}: MetricCardProps) {
  const variantStyles = {
    mint: {
      border: "border-slate-200 hover:border-emerald-300",
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
      valText: "text-emerald-600",
      topBar: "bg-emerald-500",
    },
    coral: {
      border: "border-slate-200 hover:border-rose-300",
      iconBg: "bg-rose-50 text-rose-600 border-rose-200",
      valText: "text-rose-600",
      topBar: "bg-rose-500",
    },
    indigo: {
      border: "border-slate-200 hover:border-indigo-300",
      iconBg: "bg-indigo-50 text-indigo-600 border-indigo-200",
      valText: "text-indigo-600",
      topBar: "bg-indigo-500",
    },
    amber: {
      border: "border-slate-200 hover:border-amber-300",
      iconBg: "bg-amber-50 text-amber-600 border-amber-200",
      valText: "text-amber-600",
      topBar: "bg-amber-500",
    },
    violet: {
      border: "border-slate-200 hover:border-purple-300",
      iconBg: "bg-purple-50 text-purple-600 border-purple-200",
      valText: "text-purple-600",
      topBar: "bg-purple-500",
    },
    cyan: {
      border: "border-slate-200 hover:border-sky-300",
      iconBg: "bg-sky-50 text-sky-600 border-sky-200",
      valText: "text-sky-600",
      topBar: "bg-sky-500",
    },
    slate: {
      border: "border-slate-200 hover:border-slate-300",
      iconBg: "bg-slate-100 text-slate-700 border-slate-200",
      valText: "text-slate-900",
      topBar: "bg-slate-400",
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`relative bg-white border ${style.border} rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden ${
        onClick ? "cursor-pointer hover:-translate-y-1" : ""
      }`}
    >
      {/* Subtle top color bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${style.topBar}`} />

      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-wider text-slate-500 uppercase font-mono">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl lg:text-3xl font-extrabold font-mono tracking-tight ${style.valText}`}>
              {value}
            </span>
          </div>
        </div>
        <div className={`p-2.5 rounded-xl border ${style.iconBg} shadow-sm shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
          {subtitle && <span>{subtitle}</span>}
          {trend && (
            <span
              className={`font-bold ${
                trend.positive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
