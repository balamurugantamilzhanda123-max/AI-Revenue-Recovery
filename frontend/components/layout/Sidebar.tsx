"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  AlertOctagon,
  Bot,
  Activity,
  UserCheck,
  ShieldCheck,
  Zap,
  ShoppingBag,
  Store,
  Headset,
} from "lucide-react";

interface SidebarProps {
  onCloseMobile?: () => void;
}

const NAV_ITEMS = [
  {
    name: "Electrical Store",
    href: "/store",
    icon: ShoppingBag,
    badge: "Shop",
    badgeColor: "bg-amber-50 text-amber-600 border-amber-200",
  },
  {
    name: "Seller Dashboard",
    href: "/seller",
    icon: Store,
    badge: "Seller",
    badgeColor: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  {
    name: "Human Associate",
    href: "/human-associate",
    icon: Headset,
    badge: "Agent",
    badgeColor: "bg-purple-50 text-purple-600 border-purple-200",
  },
  {
    name: "Overview",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Transactions",
    href: "/transactions",
    icon: CreditCard,
    badge: null,
  },
  {
    name: "Revenue at Risk",
    href: "/revenue-risk",
    icon: AlertOctagon,
    badge: "Risk",
    badgeColor: "bg-rose-50 text-rose-600 border-rose-200",
  },
  {
    name: "AI Recovery",
    href: "/ai-recovery",
    icon: Bot,
    badge: "AI",
    badgeColor: "bg-indigo-50 text-indigo-600 border-indigo-200",
  },
  {
    name: "Recovery Monitoring",
    href: "/recovery-monitoring",
    icon: Activity,
    badge: "Live",
    badgeColor: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  {
    name: "Human Escalations",
    href: "/escalations",
    icon: UserCheck,
    badge: null,
  },
  {
    name: "Audit & Compliance",
    href: "/audit-logs",
    icon: ShieldCheck,
    badge: null,
  },
];

export default function Sidebar({ onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 lg:w-72 bg-white border-r border-slate-200 flex flex-col h-full select-none shadow-sm">
      {/* Brand Wordmark & Tagline */}
      <div className="p-6 border-b border-slate-100">
        <Link
          href="/"
          className="flex items-center gap-3 group"
          onClick={onCloseMobile}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 p-0.5 shadow-md transition-transform group-hover:scale-105">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-emerald-600">
              <Zap className="w-5 h-5 fill-current" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Revive<span className="text-emerald-600">AI</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Autonomous Revenue Recovery
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
          Core Operations
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono tracking-wide transition-all group ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? "text-emerald-600"
                      : "text-slate-400 group-hover:text-slate-700"
                  }`}
                />
                <span>{item.name}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Autonomous System Status Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-slate-800 font-semibold">Agent Online</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-200">
            Sandbox
          </span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1 shadow-sm">
          <div className="flex justify-between">
            <span>Safety Policy:</span>
            <span className="text-emerald-600 font-bold">ENFORCED</span>
          </div>
          <div className="flex justify-between">
            <span>Max Auto-Retries:</span>
            <span className="text-slate-800 font-bold">1 / Txn</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
