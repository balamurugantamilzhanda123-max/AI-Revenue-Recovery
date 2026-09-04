"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Zap,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Headset,
  ShoppingBag,
  Package,
} from "lucide-react";
import { fetchRecoverySession, retryCustomerPayment } from "../../../../lib/api";

export default function CustomerPaymentRecoveryPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [sessionData, setSessionData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controlled Retry Simulation Outcome
  const [retryOutcome, setRetryOutcome] = useState<"SUCCESS" | "FAILED">("SUCCESS");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<any | null>(null);

  const loadSession = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecoverySession(token);
      setSessionData(data);
    } catch (err: any) {
      setError(err.message || "Invalid or expired payment recovery link.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [token]);

  const handleRetryPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionData) return;

    setIsRetrying(true);
    setRetryResult(null);

    try {
      await new Promise((res) => setTimeout(res, 600));

      const res = await retryCustomerPayment({
        transaction_id: sessionData.transaction_id,
        order_id: sessionData.order_id,
        token,
        retry_outcome: retryOutcome,
      });

      setRetryResult(res);

      if (res.success || res.status === "SUCCESS" || res.payment_status === "SUCCESS") {
        setSessionData((prev: any) => ({
          ...prev,
          already_paid: true,
          status: "SUCCESS",
          order_status: "CONFIRMED",
        }));
      } else {
        setSessionData((prev: any) => ({
          ...prev,
          escalated_to_support: true,
          status: "ESCALATED",
          order_status: "ESCALATED_TO_SUPPORT",
        }));
      }
    } catch (err: any) {
      console.error("Retry failed:", err);
      const isSuccess = retryOutcome === "SUCCESS";
      const fallbackRes = {
        success: isSuccess,
        status: isSuccess ? "SUCCESS" : "ESCALATED",
        payment_status: isSuccess ? "SUCCESS" : "FAILED",
        escalated_to_human: !isSuccess,
        message: isSuccess
          ? "Payment retry successful! Order confirmed."
          : (err.message || "Payment retry declined. Transferred to Human Associate."),
      };
      setRetryResult(fallbackRes);
      setSessionData((prev: any) => ({
        ...prev,
        already_paid: isSuccess,
        escalated_to_support: !isSuccess,
        status: isSuccess ? "SUCCESS" : "ESCALATED",
      }));
    } finally {
      setIsRetrying(false);
    }
  };

  const formatPrice = (price?: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading secure payment recovery session...</span>
        </div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 font-mono text-xs shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-white">Payment Link Unavailable</h2>
          <p className="text-xs text-slate-400">{error || "This payment link is invalid or has expired."}</p>
          <Link
            href="/store"
            className="inline-block px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl"
          >
            Return to Store
          </Link>
        </div>
      </div>
    );
  }

  const isAlreadyPaid =
    sessionData?.already_paid === true ||
    sessionData?.status === "SUCCESS" ||
    retryResult?.status === "SUCCESS" ||
    retryResult?.payment_status === "SUCCESS" ||
    retryResult?.success === true;

  const isEscalated =
    sessionData?.escalated_to_support === true ||
    sessionData?.status === "ESCALATED" ||
    retryResult?.status === "ESCALATED" ||
    retryResult?.escalated_to_human === true ||
    retryResult?.escalated_to_support === true ||
    (retryResult !== null && retryResult.success === false);

  const displayProductName =
    sessionData?.product?.name ||
    sessionData?.product_name ||
    "ProBook Ultra Slim 15.6\" Business Laptop";

  const displayAmount =
    sessionData?.amount ||
    retryResult?.recovered_amount ||
    retryResult?.amount ||
    65999;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <span className="font-extrabold text-lg tracking-tight font-mono text-white">
              Volt<span className="text-amber-400">Store</span> Secure Payment Recovery
            </span>
          </Link>

          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>256-Bit SSL Protected</span>
          </div>
        </div>
      </header>

      {/* Sandbox Controller Bar */}
      <div className="bg-slate-900/90 border-b border-amber-500/30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Sparkles className="w-4 h-4" />
            <span>SANDBOX RETRY CONTROLLER:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Select Retry Attempt Outcome:</span>
            <select
              value={retryOutcome}
              onChange={(e) => setRetryOutcome(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-amber-300 rounded-lg px-2.5 py-1 font-bold text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="SUCCESS">✓ RETRY_SUCCESS (Order Confirmed / AI Recovered)</option>
              <option value="FAILED">✕ RETRY_FAILED (Attempt 2 Fails → Escalated to Human Associate)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 py-8 flex-1 w-full flex flex-col justify-center font-mono">
        {/* State 1: Order Already Paid / Confirmed */}
        {isAlreadyPaid ? (
          <div className="p-8 bg-slate-900 border border-emerald-500/40 rounded-3xl text-center space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest">
                PAYMENT COMPLETED & RECOVERED
              </span>
              <h2 className="text-2xl font-bold text-white font-mono mt-3">
                Order Successfully Confirmed!
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Order ID: <strong className="text-white">{sessionData.order_id || retryResult?.order_id}</strong>
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono space-y-2 text-left">
              <div className="flex justify-between text-slate-400">
                <span>Product:</span>
                <span className="text-white font-bold">{displayProductName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount Paid:</span>
                <span className="text-emerald-400 font-bold">{formatPrice(displayAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Customer:</span>
                <span className="text-white">{sessionData.customer_name || "Valued Customer"}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Status:</span>
                <span className="text-emerald-400 font-bold">CONFIRMED / PAID</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Link
                href="/store/orders"
                className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" />
                <span>My Orders</span>
              </Link>
              <Link
                href="/store"
                className="py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <span>Continue Shopping</span>
              </Link>
            </div>
          </div>
        ) : isEscalated ? (
          /* State 2: Second Retry Failed -> Escalated to Human Associate */
          <div className="p-8 bg-slate-900 border border-purple-500/40 rounded-3xl text-center space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-400 mx-auto">
              <Headset className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-widest">
                AUTO-RETRY LIMIT REACHED (2/2)
              </span>
              <h2 className="text-2xl font-bold text-white font-mono mt-3">
                Order Assigned to Support Specialist
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Your order <strong className="text-white">{sessionData.order_id || retryResult?.order_id}</strong> is safely on hold.
              </p>
            </div>

            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono text-left space-y-3">
              <p className="text-slate-300">
                Due to repeat gateway declines, our autonomous system stopped further retries to protect your account. A dedicated Human Associate has been assigned to assist you with alternative payment methods.
              </p>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-slate-400">
                <span>Revenue at Risk:</span>
                <span className="text-rose-400 font-bold">{formatPrice(displayAmount)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/human-associate"
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
              >
                <span>Open Human Associate Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/store"
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2"
              >
                <span>Return to Store</span>
              </Link>
            </div>
          </div>
        ) : (
          /* State 3: Normal Customer Recovery Landing View */
          <div className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Reserved Order Continuation</span>
              </div>
              <h2 className="text-xl font-bold text-white font-mono">
                Complete Your Payment for Order {sessionData.order_id}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Hello {sessionData.customer_name || "Valued Customer"}, your items are safely saved. Complete authorization below to confirm shipment.
              </p>
            </div>

            {/* Product Card */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0 p-1 border border-slate-800">
                <img
                  src={sessionData.product?.image_url || "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80"}
                  alt={displayProductName}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                  {sessionData.product?.category || "Laptops & Computers"}
                </span>
                <h4 className="font-bold text-sm text-white truncate">{displayProductName}</h4>
                <div className="text-base font-extrabold text-white font-mono mt-1">
                  {formatPrice(sessionData.amount)}
                </div>
              </div>
            </div>

            {/* Retry Form */}
            <form onSubmit={handleRetryPayment} className="space-y-4">
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs font-mono space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Selected Payment Mode:</span>
                  <span className="text-white font-semibold">{sessionData.payment_method || "UPI / Card"}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Order Total:</span>
                  <span className="text-amber-400 font-bold text-sm">{formatPrice(sessionData.amount)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isRetrying}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold font-mono text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {isRetrying ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Payment Retry...</span>
                  </div>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Complete Payment Now ({formatPrice(sessionData.amount)})</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-[11px] text-slate-500 font-mono text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Safe 256-Bit Encrypted Test Sandbox Gateway</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
