"use client";

import React from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  UserCheck,
} from "lucide-react";

interface StatusBadgeProps {
  type: "payment" | "recovery" | "policy" | "escalation" | "actor";
  status: string;
  size?: "sm" | "md" | "lg";
}

export default function StatusBadge({ type, status, size = "md" }: StatusBadgeProps) {
  const norm = (status || "").toUpperCase();

  let label = norm.replace(/_/g, " ");
  let bg = "bg-slate-100";
  let text = "text-slate-700";
  let border = "border-slate-200";
  let icon: React.ReactNode = <HelpCircle className="w-3.5 h-3.5" />;

  if (type === "payment") {
    switch (norm) {
      case "SUCCESS":
        label = "CAPTURED";
        bg = "bg-emerald-50";
        text = "text-emerald-700";
        border = "border-emerald-200";
        icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
        break;
      case "FAILED":
        label = "FAILED";
        bg = "bg-rose-50";
        text = "text-rose-700";
        border = "border-rose-200";
        icon = <XCircle className="w-3.5 h-3.5 text-rose-600" />;
        break;
      case "PENDING":
        label = "PENDING";
        bg = "bg-amber-50";
        text = "text-amber-700";
        border = "border-amber-200";
        icon = <Clock className="w-3.5 h-3.5 text-amber-600" />;
        break;
      case "ABANDONED":
        label = "ABANDONED";
        bg = "bg-slate-100";
        text = "text-slate-600";
        border = "border-slate-200";
        icon = <XCircle className="w-3.5 h-3.5 text-slate-500" />;
        break;
      default:
        label = norm || "UNKNOWN";
        break;
    }
  } else if (type === "recovery") {
    switch (norm) {
      case "RECOVERED":
        label = "RECOVERED";
        bg = "bg-emerald-50";
        text = "text-emerald-700";
        border = "border-emerald-300";
        icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
        break;
      case "IN_PROGRESS":
        label = "IN PROGRESS";
        bg = "bg-indigo-50";
        text = "text-indigo-700";
        border = "border-indigo-200";
        icon = <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600 animate-spin" />;
        break;
      case "OPEN":
        label = "OPEN CASE";
        bg = "bg-sky-50";
        text = "text-sky-700";
        border = "border-sky-200";
        icon = <Clock className="w-3.5 h-3.5 text-sky-600" />;
        break;
      case "ESCALATED":
        label = "ESCALATED";
        bg = "bg-purple-50";
        text = "text-purple-700";
        border = "border-purple-200";
        icon = <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />;
        break;
      case "STOPPED":
        label = "STOPPED";
        bg = "bg-slate-100";
        text = "text-slate-600";
        border = "border-slate-300";
        icon = <XCircle className="w-3.5 h-3.5 text-slate-500" />;
        break;
      case "FAILED":
        label = "RECOVERY FAILED";
        bg = "bg-rose-50";
        text = "text-rose-700";
        border = "border-rose-200";
        icon = <XCircle className="w-3.5 h-3.5 text-rose-600" />;
        break;
    }
  } else if (type === "policy") {
    if (norm === "APPROVED" || norm === "ALLOWED" || norm === "ALLOW" || norm === "TRUE") {
      label = "POLICY APPROVED";
      bg = "bg-emerald-50";
      text = "text-emerald-700";
      border = "border-emerald-200";
      icon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />;
    } else if (norm === "ESCALATE") {
      label = "POLICY ESCALATE";
      bg = "bg-purple-50";
      text = "text-purple-700";
      border = "border-purple-200";
      icon = <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />;
    } else {
      label = "POLICY REJECTED";
      bg = "bg-rose-50";
      text = "text-rose-700";
      border = "border-rose-200";
      icon = <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />;
    }
  } else if (type === "escalation") {
    switch (norm) {
      case "RESOLVED":
        label = "RESOLVED";
        bg = "bg-emerald-50";
        text = "text-emerald-700";
        border = "border-emerald-200";
        icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
        break;
      case "IN_REVIEW":
        label = "IN REVIEW";
        bg = "bg-amber-50";
        text = "text-amber-700";
        border = "border-amber-200";
        icon = <Clock className="w-3.5 h-3.5 text-amber-600" />;
        break;
      default:
        label = "OPEN ESCALATION";
        bg = "bg-rose-50";
        text = "text-rose-700";
        border = "border-rose-300";
        icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
        break;
    }
  } else if (type === "actor") {
    bg = "bg-slate-100";
    text = "text-slate-700";
    border = "border-slate-200";
    icon = <UserCheck className="w-3.5 h-3.5 text-slate-600" />;
  }

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : size === "lg"
      ? "px-3.5 py-1.5 text-sm gap-2"
      : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-bold font-mono rounded-lg border ${bg} ${text} ${border} ${sizeClasses} shadow-sm tracking-wide transition-all`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
