"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Building2,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  processCustomerPayment,
  abandonCustomerCheckout,
  ElectricalProduct,
} from "../../../lib/api";

export default function CustomerCheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<Array<{ product: ElectricalProduct; quantity: number }>>([]);
  const [customer, setCustomer] = useState({
    name: "Arun Kumar",
    email: "arun.kumar@example.com",
    phone: "+91 98765 43210",
    address: "Flat 402, Green Meadows, 100ft Road, Indiranagar, Bengaluru, KA 560038",
  });

  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CARD" | "NET_BANKING">("UPI");
  const [simulationScenario, setSimulationScenario] = useState<
    "SUCCESS" | "NETWORK_ERROR" | "TIMEOUT" | "AUTH_FAILURE" | "DECLINE"
  >("NETWORK_ERROR");

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any | null>(null);
  const [abandonedState, setAbandonedState] = useState<any | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("voltstore_checkout_items");
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        // Default sample product for instant demo: Atomberg Renesa Smart Fan
        setItems([
          {
            product: {
              id: "prod_smart_fan_05",
              name: "Atomberg Renesa BLDC Smart Ceiling Fan with Remote",
              category: "Fans & Cooling",
              price: 7499.0,
              currency: "INR",
              stock: 35,
              in_stock: true,
              rating: 4.9,
              reviews_count: 620,
              badge: "5-Star BLDC",
              image_url: "https://images.unsplash.com/photo-1594918074900-50d4f20f66e0?w=600&auto=format&fit=crop&q=80",
              description: "Super energy-efficient BLDC motor with smart remote & IoT WiFi app control.",
            },
            quantity: 1,
          },
        ]);
      }
    } catch {
      // fallback
    }
  }, []);

  const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setIsProcessing(true);
    setPaymentResult(null);
    setAbandonedState(null);

    const primaryItem = items[0];

    try {
      // Small simulated processing latency for realism
      await new Promise((res) => setTimeout(res, 900));

      const res = await processCustomerPayment({
        product_id: primaryItem.product.id,
        quantity: primaryItem.quantity,
        amount: totalAmount,
        currency: "INR",
        payment_method: paymentMethod,
        customer,
        simulation_scenario: simulationScenario,
      });

      setPaymentResult(res);
    } catch (err: any) {
      console.error("Payment failed:", err);
      setPaymentResult({
        success: false,
        status: "FAILED",
        customer_message: "A network glitch occurred during payment capture.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAbandonCheckout = async () => {
    if (items.length === 0) return;
    const primaryItem = items[0];

    try {
      const res = await abandonCustomerCheckout({
        product_id: primaryItem.product.id,
        quantity: primaryItem.quantity,
        amount: totalAmount,
        currency: "INR",
        last_stage: "PAYMENT_PAGE_ABANDONED",
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
      });
      setAbandonedState(res);
    } catch (err) {
      console.error("Abandon error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Checkout Minimal Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2.5 text-xs font-mono font-bold text-slate-400 hover:text-amber-400 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Store</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <span className="font-extrabold text-lg tracking-tight font-mono text-white">
              Volt<span className="text-amber-400">Store</span> Checkout
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>
      </header>

      {/* Sandbox Controller Banner (For Test / Demo Scenarios) */}
      <div className="bg-slate-900/90 border-b border-amber-500/30 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>TEST / SANDBOX PAYMENT CONTROLLER:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400">Simulate Outcome:</span>
            <select
              value={simulationScenario}
              onChange={(e) => setSimulationScenario(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-amber-300 rounded-lg px-2.5 py-1 font-bold text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="NETWORK_ERROR">Scenario 1: Network Error (Transient TCP Glitch)</option>
              <option value="TIMEOUT">Scenario 2: Gateway Timeout (504 Timeout)</option>
              <option value="AUTH_FAILURE">Auth Failure (OTP / 3DS Error)</option>
              <option value="DECLINE">Bank Card Decline (Limit Exceeded)</option>
              <option value="SUCCESS">Direct Payment Success</option>
            </select>

            <button
              type="button"
              onClick={handleAbandonCheckout}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/40 rounded-lg font-bold transition-all"
            >
              Test Scenario 3: Leave / Abandon Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Main Checkout Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Abandonment State Notice */}
        {abandonedState && (
          <div className="mb-8 p-6 bg-slate-900 border border-rose-500/40 rounded-2xl shadow-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm font-mono">
                <AlertCircle className="w-5 h-5" />
                <span>Checkout Session Abandoned</span>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Revenue at Risk: {formatPrice(abandonedState.revenue_at_risk)}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-mono">
              The customer navigated away from the payment screen. ReviveAI detected checkout abandonment and autonomously triggered a recovery reminder with a dynamic continuation link.
            </p>

            {/* Simulated Customer Message Toast */}
            <div className="p-4 bg-slate-950 border border-amber-500/40 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
                <MessageSquare className="w-4 h-4" />
                <span>Simulated Incoming Customer Recovery Notification (SMS / WhatsApp / Email)</span>
              </div>
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                {abandonedState.customer_message}
              </pre>

              <Link
                href={`/pay/recover/${abandonedState.recovery_token}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-extrabold rounded-xl transition-all shadow-md"
              >
                <span>Click Simulated Customer Link: Complete Payment</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Success State Screen */}
        {paymentResult && paymentResult.success && (
          <div className="max-w-xl mx-auto p-8 bg-slate-900 border border-emerald-500/40 rounded-3xl shadow-2xl text-center space-y-6 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ORDER CONFIRMED
              </span>
              <h2 className="text-2xl font-bold text-white mt-3 font-mono">
                Payment Successful!
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Order ID: <strong className="text-white">{paymentResult.order_id}</strong>
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono space-y-2 text-left">
              <div className="flex justify-between text-slate-400">
                <span>Product:</span>
                <span className="text-white font-bold">{paymentResult.product_name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount Paid:</span>
                <span className="text-emerald-400 font-extrabold">{formatPrice(paymentResult.amount)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payment Mode:</span>
                <span className="text-white">{paymentMethod}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Delivery To:</span>
                <span className="text-white truncate max-w-[200px]">{customer.name}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                href="/store"
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs rounded-xl border border-slate-700"
              >
                Shop More Electricals
              </Link>
              <Link
                href="/seller"
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs rounded-xl"
              >
                View in Seller Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Payment Failure Screen with Autonomous Recovery Notification */}
        {paymentResult && !paymentResult.success && (
          <div className="mb-8 p-6 bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white font-mono">
                    Payment Could Not Be Completed
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {paymentResult.customer_message}
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Status: Payment Failed
              </span>
            </div>

            {/* Standard Customer Safe Information */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs font-mono space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Order Reference:</span>
                <span className="text-white font-bold">{paymentResult.order_id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Product Reserved:</span>
                <span className="text-white">{paymentResult.product_name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Amount:</span>
                <span className="text-amber-400 font-bold">{formatPrice(paymentResult.amount)}</span>
              </div>
            </div>

            {/* Automatic Customer Recovery Message Dispatch Box (CORE REQUIREMENT) */}
            <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  <span>ReviveAI Autonomous Recovery Notification Sent</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Dynamic Link Active
                </span>
              </div>

              <p className="text-xs text-slate-300 font-mono">
                ReviveAI detected the technical failure, validated policies, and automatically generated a secure continuation link dispatched to <strong>{customer.email}</strong>.
              </p>

              {paymentResult.automated_message_preview && (
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  {paymentResult.automated_message_preview}
                </pre>
              )}

              {paymentResult.recovery_token && (
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <Link
                    href={`/pay/recover/${paymentResult.recovery_token}`}
                    className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold font-mono text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    <span>Open Dynamic Recovery Link (Customer View)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href="/seller"
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs rounded-xl border border-slate-700 text-center"
                  >
                    Inspect in Seller Dashboard
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Regular Checkout Form */}
        {(!paymentResult || (!paymentResult.success && !paymentResult.recovery_token)) && (
          <form onSubmit={handlePayNow} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Customer Details & Payment Options */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1: Customer Details */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-extrabold">
                      1
                    </span>
                    <span>Customer & Delivery Details</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">Pre-filled for Demo</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">Email Address (For Invoicing & Recovery Link)</label>
                    <input
                      type="email"
                      value={customer.email}
                      onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">Delivery Address</label>
                    <textarea
                      value={customer.address}
                      onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-400 resize-none"
                      required
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Step 2: Payment Method */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-extrabold">
                      2
                    </span>
                    <span>Select Payment Method</span>
                  </h3>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      id: "UPI",
                      label: "UPI (Google Pay, PhonePe, Paytm, BHIM)",
                      desc: "Instant authorization via UPI Virtual Payment Address / QR",
                      icon: Smartphone,
                    },
                    {
                      id: "CARD",
                      label: "Credit / Debit Card",
                      desc: "Visa, Mastercard, RuPay with 3D Secure OTP verification",
                      icon: CreditCard,
                    },
                    {
                      id: "NET_BANKING",
                      label: "Net Banking",
                      desc: "Direct corporate & retail banking switches (SBI, HDFC, ICICI, Axis)",
                      icon: Building2,
                    },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <label
                        key={m.id}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === m.id
                            ? "bg-amber-500/10 border-amber-500/60 shadow-sm"
                            : "bg-slate-800/60 border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={m.id}
                          checked={paymentMethod === m.id}
                          onChange={() => setPaymentMethod(m.id as any)}
                          className="mt-1 text-amber-500 focus:ring-amber-400"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-amber-400" />
                            <span className="font-bold text-xs text-white font-mono">{m.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{m.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary & Pay Button */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 sticky top-24">
                <h3 className="font-bold text-sm text-white font-mono border-b border-slate-800 pb-3">
                  Order Summary ({items.length} product{items.length > 1 ? "s" : ""})
                </h3>

                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {items.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div className="w-12 h-12 rounded-lg bg-slate-950 overflow-hidden p-1 border border-slate-800 flex-shrink-0">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-white truncate">{product.name}</h5>
                        <p className="text-slate-400">Qty: {quantity}</p>
                      </div>
                      <span className="text-amber-400 font-bold font-mono">
                        {formatPrice(product.price * quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span className="text-white font-bold">{formatPrice(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>GST (18% Included):</span>
                    <span className="text-white">{formatPrice(totalAmount * 0.18)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Shipping:</span>
                    <span className="text-emerald-400 font-bold">FREE</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                    <span>Total Due:</span>
                    <span className="text-amber-400 font-mono">{formatPrice(totalAmount)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing || items.length === 0}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-extrabold font-mono text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Connecting Bank Switch...</span>
                    </div>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Authorize & Pay {formatPrice(totalAmount)}</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-slate-500 font-mono text-center">
                  Protected by 256-bit encryption. Safe sandbox payment testing.
                </p>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
