"use client";

import React from "react";

interface SkeletonProps {
  variant?: "card" | "table" | "timeline" | "text" | "stats-grid";
  count?: number;
  rows?: number;
}

export default function SkeletonLoader({
  variant = "card",
  count = 1,
  rows = 5,
}: SkeletonProps) {
  if (variant === "stats-grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 animate-pulse shadow-sm"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-200 rounded w-24"></div>
              <div className="h-8 w-8 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="h-7 bg-slate-200 rounded w-32"></div>
            <div className="h-3 bg-slate-100 rounded w-20 pt-2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-pulse shadow-sm">
        <div className="h-12 bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-4">
          <div className="h-4 bg-slate-200 rounded w-28"></div>
          <div className="h-4 bg-slate-200 rounded w-32 ml-auto"></div>
        </div>
        <div className="divide-y divide-slate-100 p-4 space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 gap-4">
              <div className="h-4 bg-slate-200 rounded w-24"></div>
              <div className="h-4 bg-slate-200 rounded w-36"></div>
              <div className="h-4 bg-slate-200 rounded w-20"></div>
              <div className="h-5 bg-slate-100 rounded-md w-24"></div>
              <div className="h-8 bg-slate-100 rounded-xl w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "timeline") {
    return (
      <div className="space-y-6 animate-pulse pl-6 border-l-2 border-slate-200">
        {Array.from({ length: count || 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex justify-between">
              <div className="h-4 bg-slate-200 rounded w-36"></div>
              <div className="h-3 bg-slate-100 rounded w-16"></div>
            </div>
            <div className="h-3 bg-slate-100 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <div className="h-5 bg-slate-200 rounded w-1/3"></div>
          <div className="h-4 bg-slate-100 rounded w-2/3"></div>
          <div className="h-4 bg-slate-100 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}
