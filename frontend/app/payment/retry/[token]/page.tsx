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
  ArrowLeft,
  Info,
  Package,
} from "lucide-react";
import { fetchRecoverySession, retryCustomerPayment } from "../../../../lib/api";
import ProductImage from "../../../../components/common/ProductImage";

export default function DynamicPaymentRetryPage() {
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
          : (err.message || "Payment retry declined. Case forwarded to Human Associate."),
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
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-mono text-xs">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Payment Link Expired or Invalid</h2>
          <p className="text-slate-400 text-xs">{error || "Could not locate this recovery session."}</p>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
          >
            <span>Return to Store</span>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-900">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-400 to-orange-500 p-0.5 flex items-center justify-center">
              <Zap className="w-4 h-4 text-slate-950 fill-current" />
            </div>
            <div className="font-mono text-sm font-extrabold text-white">
              Volt<span className="text-amber-400">Store</span>
              <span className="text-slate-500 font-normal text-xs ml-2">/ Payment Recovery</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure 1-Click Retry</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full font-mono">
        {/* SUCCESS CONFIRMATION VIEW */}
        {isAlreadyPaid ? (
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              REVENUE RECOVERED & ORDER CONFIRMED
            </span>

            <h2 className="text-2xl font-black text-white mt-3 mb-1">
              Payment Completed Successfully!
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your recovery retry has succeeded. Inventory stock has been locked and your order is confirmed.
            </p>

            <div className="my-6 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="text-white font-bold">{sessionData.order_id || retryResult?.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Product:</span>
                <span className="text-slate-200 font-semibold">{displayProductName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="text-amber-400 font-extrabold text-sm">{formatPrice(displayAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Status:</span>
                <span className="text-emerald-400 font-bold">SUCCESS (RECOVERED)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Link
                href="/store/orders"
                className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" />
                <span>My Orders</span>
              </Link>
              <Link
                href="/store"
                className="py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <span>Continue Shopping</span>
              </Link>
            </div>
          </div>
        ) : isEscalated ? (
          /* HUMAN ASSOCIATE ESCALATION VIEW (Second Failure Reached Limit) */
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto mb-4">
              <Headset className="w-8 h-8" />
            </div>

            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-widest">
              FORWARDED TO HUMAN SPECIALIST
            </span>

            <h2 className="text-xl font-black text-white mt-3 mb-1">
              Automated Retries Limit Reached
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              To ensure your financial security, automated retries have stopped. Your order has been transferred to our Human Recovery Specialist team.
            </p>

            <div className="my-6 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="text-white font-bold">{sessionData.order_id || retryResult?.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Product:</span>
                <span className="text-slate-200 font-semibold">{displayProductName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reserved Amount:</span>
                <span className="text-amber-400 font-extrabold">{formatPrice(displayAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Support Priority:</span>
                <span className="text-purple-400 font-bold">HIGH PRIORITY QUEUE</span>
              </div>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-xs text-slate-300 space-y-1 mb-6 text-left">
              <div className="flex items-center gap-2 font-bold text-purple-300">
                <ShieldCheck className="w-4 h-4" />
                <span>Our specialist will contact you via WhatsApp / Phone with an approved fallback payment channel.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/human-associate"
                className="py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <span>View Human Associate Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/store"
                className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2"
              >
                <span>Return to Store</span>
              </Link>
            </div>
          </div>
        ) : (
          /* RETRY PAYMENT FORM */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  RECOVERY RESERVATION
                </span>
                <h2 className="text-xl font-extrabold text-white mt-1">Complete Your Payment</h2>
                <p className="text-xs text-slate-400">Order ID: {sessionData.order_id}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500">Amount Due:</span>
                <div className="text-lg font-black text-amber-400">{formatPrice(sessionData.amount)}</div>
              </div>
            </div>

            {/* Product Card */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-4">
              <ProductImage
                productId={sessionData.product?.id}
                productName={displayProductName}
                category={sessionData.product?.category}
                src={sessionData.product?.image_url || sessionData.product?.image}
                className="w-16 h-16 flex-shrink-0 p-1 rounded-xl"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-white truncate">{displayProductName}</h3>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">{sessionData.product?.category || "Laptops & Computers"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    ✓ Reserved for {sessionData.customer_name || "You"}
                  </span>
                </div>
              </div>
            </div>

            {/* Sandbox Retry Outcome Selector */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Select Test Retry Outcome:</span>
                <span className="text-[10px] text-indigo-400 font-bold">Sandbox Controller</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRetryOutcome("SUCCESS")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    retryOutcome === "SUCCESS"
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  ✓ RETRY_SUCCESS
                </button>

                <button
                  type="button"
                  onClick={() => setRetryOutcome("FAILED")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    retryOutcome === "FAILED"
                      ? "bg-rose-500/20 border-rose-400 text-rose-300 shadow"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  ✕ RETRY_FAILED (Escalates)
                </button>
              </div>
            </div>

            {/* Submit Retry */}
            <form onSubmit={handleRetryPayment} className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={isRetrying}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AUTHORIZING PAYMENT RETRY...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>RETRY PAYMENT NOW ({formatPrice(sessionData.amount)})</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link href="/store" className="text-xs text-slate-500 hover:text-slate-300 underline">
                  ← Cancel & Return to VoltStore
                </Link>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
