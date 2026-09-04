"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  ShoppingBag,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  User,
  ShieldCheck,
  Search,
} from "lucide-react";
import { fetchCustomerOrders, CustomerOrderData, CustomerProfile } from "../../../lib/api";

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");

  const loadOrders = async (userEmail?: string, userPhone?: string, custId?: string) => {
    setLoading(true);
    try {
      const res = await fetchCustomerOrders({
        email: userEmail || currentUser?.email || emailInput || undefined,
        phone: userPhone || currentUser?.phone || undefined,
        customer_id: custId || currentUser?.id || undefined,
      });
      setOrders(res.data || []);
    } catch (err) {
      console.error("Failed to load customer orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("voltstore_customer_session");
      if (stored) {
        const parsed: CustomerProfile = JSON.parse(stored);
        setCurrentUser(parsed);
        setEmailInput(parsed.email || "");
        loadOrders(parsed.email, parsed.phone, parsed.id);
      } else {
        loadOrders("rahul@example.com");
      }
    } catch {
      loadOrders();
    }
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Recently";
    try {
      return new Date(isoString).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-900">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2.5 group">
            <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white font-mono">
                Volt<span className="text-amber-400">Store</span>
              </span>
              <span className="text-slate-500 font-mono text-xs">/ Customer Order History</span>
            </div>
          </Link>

          <Link
            href="/store"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-mono text-xs border border-slate-700"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            <span>Storefront</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Package className="w-4 h-4" />
              <span>Customer Account</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              My Orders & Purchases
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Track confirmed orders, review payment statuses, and complete pending recovery checkouts
            </p>
          </div>

          {/* Lookup Input for Quick Filter */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by email or phone"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={() => loadOrders(emailInput)}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
            >
              Filter
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse h-32"></div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/60 rounded-3xl border border-slate-800">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No orders found</h3>
            <p className="text-xs text-slate-400 mt-1">You haven't placed any orders with this email yet.</p>
            <Link
              href="/store"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md"
            >
              <span>Explore Electrical & Laptop Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isSuccess = order.payment_status === "SUCCESS";
              const isRecoveryActive = order.can_retry;

              return (
                <div
                  key={order.transaction_id || order.order_id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 font-bold text-xs">
                        ORD
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white">{order.order_id}</span>
                        <p className="text-[10px] text-slate-400">{formatDate(order.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          isSuccess
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : isRecoveryActive
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {isSuccess ? "CONFIRMED" : isRecoveryActive ? "PAYMENT PENDING" : order.order_status}
                      </span>
                    </div>
                  </div>

                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={order.image_url}
                        alt={order.product_name}
                        className="w-14 h-14 object-cover rounded-xl bg-slate-950 border border-slate-800 flex-shrink-0"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-white">{order.product_name}</h4>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5">Category: {order.category}</p>
                        <p className="text-[10px] text-slate-500">Method: {order.payment_method}</p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end justify-between">
                      <span className="text-base font-extrabold text-white">
                        {formatPrice(order.amount)}
                      </span>

                      {/* Active Recovery / Complete Payment CTA */}
                      {isRecoveryActive && (
                        <Link
                          href={order.retry_link}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-md hover:scale-105 transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Complete Payment</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
