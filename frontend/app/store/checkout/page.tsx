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
  User,
  MapPin,
  Truck,
  ArrowRight,
  Edit3,
  Phone,
  Mail,
  RefreshCw,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import {
  processCustomerPayment,
  abandonCustomerCheckout,
  saveCustomerAddress,
  customerLogin,
  customerRegister,
  ElectricalProduct,
  CustomerProfile,
} from "../../../lib/api";
import ProductImage from "../../../components/common/ProductImage";

type CheckoutStep = "AUTH" | "ADDRESS" | "SUMMARY" | "PAYMENT" | "SUCCESS" | "FAILURE";

export default function CustomerCheckoutPage() {
  const router = useRouter();

  // State
  const [items, setItems] = useState<Array<{ product: ElectricalProduct; quantity: number }>>([]);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("ADDRESS");
  const [currentUser, setCurrentUser] = useState<CustomerProfile | null>(null);

  // Address Form State
  const [addressForm, setAddressForm] = useState({
    fullName: "Rahul Kumar",
    phone: "9876543210",
    email: "rahul@example.com",
    addressLine1: "12, Main Road, Indiranagar",
    addressLine2: "Near BDA Complex",
    city: "Bengaluru",
    state: "Tamil Nadu",
    pincode: "600001",
    landmark: "Opposite Metro Station",
  });
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CARD" | "NET_BANKING">("UPI");
  const [simulationScenario, setSimulationScenario] = useState<
    "PAYMENT_SUCCESS" | "NETWORK_ERROR" | "PAYMENT_TIMEOUT" | "PAYMENT_FAILED" | "AUTHENTICATION_FAILED"
  >("NETWORK_ERROR");

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any | null>(null);
  const [abandonedState, setAbandonedState] = useState<any | null>(null);

  // Auth Form State (if user is logged out)
  const [authTab, setAuthTab] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginIdent, setLoginIdent] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Load items and customer session on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("voltstore_customer_session");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(parsed);
        if (parsed.saved_address) {
          setAddressForm({
            fullName: parsed.saved_address.full_name || parsed.name || "Rahul Kumar",
            phone: parsed.saved_address.phone || parsed.phone || "9876543210",
            email: parsed.saved_address.email || parsed.email || "rahul@example.com",
            addressLine1: parsed.saved_address.address_line1 || "12, Main Road",
            addressLine2: parsed.saved_address.address_line2 || "",
            city: parsed.saved_address.city || "Chennai",
            state: parsed.saved_address.state || "Tamil Nadu",
            pincode: parsed.saved_address.pincode || "600001",
            landmark: parsed.saved_address.landmark || "",
          });
        } else {
          setAddressForm((prev) => ({
            ...prev,
            fullName: parsed.name || prev.fullName,
            email: parsed.email || prev.email,
            phone: parsed.phone || prev.phone,
          }));
        }
        setCurrentStep("ADDRESS");
      } else {
        // If not logged in, prompt Auth step
        setCurrentStep("AUTH");
      }

      const stored = localStorage.getItem("voltstore_checkout_items");
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        // Default sample product: Business Laptop
        setItems([
          {
            product: {
              id: "prod_laptop_business_03",
              name: "ThinkPro 14\" Enterprise Business Ultrabook",
              category: "Laptops & Computers",
              price: 65999.0,
              currency: "INR",
              stock: 20,
              in_stock: true,
              rating: 4.9,
              reviews_count: 420,
              badge: "High Value / Priority",
              image_url: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&auto=format&fit=crop&q=80",
              description: "Military-grade certified business ultrabook with Intel Core i7 13th Gen, 16GB RAM, 1TB SSD.",
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

  // Auth Handler: Login
  const handleAuthLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (!loginIdent.trim() || !loginPassword) {
        throw new Error("Please enter email/phone and password.");
      }
      const res = await customerLogin({
        identifier: loginIdent.trim(),
        password: loginPassword,
      });
      setCurrentUser(res.customer);
      localStorage.setItem("voltstore_customer_session", JSON.stringify(res.customer));
      if (res.customer.saved_address) {
        setAddressForm({
          fullName: res.customer.saved_address.full_name || res.customer.name,
          phone: res.customer.saved_address.phone || res.customer.phone,
          email: res.customer.saved_address.email || res.customer.email,
          addressLine1: res.customer.saved_address.address_line1 || "12, Main Road",
          addressLine2: res.customer.saved_address.address_line2 || "",
          city: res.customer.saved_address.city || "Chennai",
          state: res.customer.saved_address.state || "Tamil Nadu",
          pincode: res.customer.saved_address.pincode || "600001",
          landmark: res.customer.saved_address.landmark || "",
        });
      } else {
        setAddressForm((prev) => ({
          ...prev,
          fullName: res.customer.name,
          email: res.customer.email,
          phone: res.customer.phone,
        }));
      }
      setCurrentStep("ADDRESS");
    } catch (err: any) {
      setAuthError(err.message || "Invalid credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Auth Handler: Registration
  const handleAuthRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (!regName.trim()) throw new Error("Name is required.");
      if (!regEmail.trim() || !regEmail.includes("@")) throw new Error("Valid email required.");
      if (!regPhone.trim() || regPhone.trim().length < 10) throw new Error("Valid 10-digit phone number required.");
      if (!regPassword || regPassword.length < 4) throw new Error("Password must be at least 4 characters.");
      if (regPassword !== regConfirmPassword) throw new Error("Passwords do not match.");

      const res = await customerRegister({
        full_name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        password: regPassword,
        confirm_password: regConfirmPassword,
      });
      setCurrentUser(res.customer);
      localStorage.setItem("voltstore_customer_session", JSON.stringify(res.customer));
      setAddressForm((prev) => ({
        ...prev,
        fullName: res.customer.name,
        email: res.customer.email,
        phone: res.customer.phone,
      }));
      setCurrentStep("ADDRESS");
    } catch (err: any) {
      setAuthError(err.message || "Registration failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Address Submit Handler
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);

    if (!addressForm.fullName.trim()) return setAddressError("Full name is required.");
    if (!addressForm.phone.trim() || addressForm.phone.trim().length < 10)
      return setAddressError("Valid 10-digit phone number is required.");
    if (!addressForm.email.trim() || !addressForm.email.includes("@"))
      return setAddressError("Valid email address is required.");
    if (!addressForm.addressLine1.trim()) return setAddressError("Address Line 1 is required.");
    if (!addressForm.city.trim()) return setAddressError("City is required.");
    if (!addressForm.state.trim()) return setAddressError("State is required.");
    if (!addressForm.pincode.trim() || addressForm.pincode.trim().length < 6)
      return setAddressError("Valid 6-digit Pincode is required.");

    // Save address to backend & local profile if checked
    if (saveAddressForFuture && currentUser) {
      try {
        await saveCustomerAddress({
          customer_id: currentUser.id,
          email: addressForm.email,
          full_name: addressForm.fullName,
          phone: addressForm.phone,
          address_line1: addressForm.addressLine1,
          address_line2: addressForm.addressLine2,
          city: addressForm.city,
          state: addressForm.state,
          pincode: addressForm.pincode,
          landmark: addressForm.landmark,
        });
      } catch (err) {
        console.warn("Could not save address to server:", err);
      }
    }

    setCurrentStep("SUMMARY");
  };

  // Payment Execution Handler
  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setIsProcessing(true);
    setPaymentResult(null);
    setAbandonedState(null);

    const primaryItem = items[0];
    const fullAddress = `${addressForm.addressLine1}, ${addressForm.addressLine2 ? addressForm.addressLine2 + ", " : ""}${addressForm.city}, ${addressForm.state} - ${addressForm.pincode}`;

    try {
      // Small simulated latency for realistic test experience
      await new Promise((res) => setTimeout(res, 800));

      const res = await processCustomerPayment({
        product_id: primaryItem.product.id,
        quantity: primaryItem.quantity,
        amount: totalAmount,
        currency: "INR",
        payment_method: paymentMethod,
        customer: {
          name: addressForm.fullName,
          email: addressForm.email,
          phone: addressForm.phone,
          address: fullAddress,
        },
        simulation_scenario: simulationScenario,
      });

      setPaymentResult(res);
      if (res.status === "SUCCESS" || res.success === true || res.payment_status === "SUCCESS") {
        setCurrentStep("SUCCESS");
      } else {
        setCurrentStep("FAILURE");
      }
    } catch (err: any) {
      console.error("Payment failed:", err);
      const isSuccess = simulationScenario === "PAYMENT_SUCCESS";
      if (isSuccess) {
        setPaymentResult({
          success: true,
          status: "SUCCESS",
          order_id: `ORD-REC-${Date.now()}`,
          transaction_id: `TXN-REC-${Date.now()}`,
          amount: totalAmount,
          currency: "INR",
          message: "Payment captured successfully",
        });
        setCurrentStep("SUCCESS");
      } else {
        const scenarioMessages: Record<string, { msg: string; risk: string }> = {
          NETWORK_ERROR: {
            msg: "Your payment could not be completed due to a network connection drop (TCP RST). Your order has been preserved.",
            risk: "HIGH",
          },
          PAYMENT_TIMEOUT: {
            msg: "Payment gateway timed out during processing (504 Gateway). Your order has been preserved.",
            risk: "HIGH",
          },
          AUTHENTICATION_FAILED: {
            msg: "Authentication handshake failed (OTP Timeout / 3DS Error). Your order has been preserved.",
            risk: "MEDIUM",
          },
        };
        const info = scenarioMessages[simulationScenario] || {
          msg: "Your payment could not be completed due to a technical issue. Your order has been preserved.",
          risk: "HIGH",
        };
        const tok = `tok_err_${Date.now()}`;
        setPaymentResult({
          success: false,
          status: "FAILED",
          order_id: `ORD-ERR-${Date.now()}`,
          customer_message: info.msg,
          product_name: primaryItem.product.name,
          amount: totalAmount,
          risk_level: info.risk,
          retry_available: true,
          recovery_token: tok,
          payment_link: `/payment/retry/${tok}`,
        });
        setCurrentStep("FAILURE");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Checkout Abandonment Simulation
  const handleAbandonCheckout = async () => {
    if (items.length === 0) return;
    const primaryItem = items[0];

    try {
      const res = await abandonCustomerCheckout({
        product_id: primaryItem.product.id,
        quantity: primaryItem.quantity,
        amount: totalAmount,
        currency: "INR",
        last_stage: "PAYMENT_METHOD_SELECTION",
        customer: {
          name: addressForm.fullName,
          email: addressForm.email,
          phone: addressForm.phone,
        },
      });
      setAbandonedState(res);
    } catch (err: any) {
      console.error("Failed to log abandonment:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-900">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2.5 group">
            <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white font-mono">
                Volt<span className="text-amber-400">Store</span>
              </span>
              <span className="text-slate-500 font-mono text-xs">/ Secure Checkout</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>256-bit Encrypted Checkout</span>
          </div>
        </div>
      </header>

      {/* Progress Steps Indicator */}
      <div className="bg-slate-900/60 border-b border-slate-800 py-3 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center gap-2 ${currentStep === "AUTH" ? "text-amber-400 font-bold" : currentUser ? "text-emerald-400" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 text-[10px] font-bold">1</span>
            <span>Authentication</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-700" />

          <div className={`flex items-center gap-2 ${currentStep === "ADDRESS" ? "text-amber-400 font-bold" : currentStep === "SUMMARY" || currentStep === "PAYMENT" || currentStep === "SUCCESS" || currentStep === "FAILURE" ? "text-emerald-400" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 text-[10px] font-bold">2</span>
            <span>Delivery Details</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-700" />

          <div className={`flex items-center gap-2 ${currentStep === "SUMMARY" || currentStep === "PAYMENT" ? "text-amber-400 font-bold" : currentStep === "SUCCESS" ? "text-emerald-400" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 text-[10px] font-bold">3</span>
            <span>Payment & Test</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-700" />

          <div className={`flex items-center gap-2 ${currentStep === "SUCCESS" ? "text-emerald-400 font-bold" : currentStep === "FAILURE" ? "text-amber-400 font-bold" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 text-[10px] font-bold">4</span>
            <span>Confirmation</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {/* ========================================== */}
        {/* STEP 1: AUTHENTICATION (If logged out)    */}
        {/* ========================================== */}
        {currentStep === "AUTH" && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-white font-mono">
                {authTab === "LOGIN" ? "CUSTOMER LOGIN" : "CREATE ACCOUNT"}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Please login or create an account to proceed with your order
              </p>
            </div>

            {/* Auth Tab Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5 font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthTab("LOGIN");
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg font-bold transition-all ${
                  authTab === "LOGIN" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                LOGIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab("REGISTER");
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg font-bold transition-all ${
                  authTab === "REGISTER" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                CREATE ACCOUNT
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authTab === "LOGIN" ? (
              <form onSubmit={handleAuthLogin} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email / Phone:</label>
                  <input
                    type="text"
                    required
                    placeholder="rahul@example.com or 9876543210"
                    value={loginIdent}
                    onChange={(e) => setLoginIdent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Password:</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {authLoading ? "LOGGING IN..." : "LOGIN & CONTINUE"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAuthRegister} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="Rahul Kumar"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email:</label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number:</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Password:</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Confirm:</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {authLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT & PROCEED"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* STEP 2: CUSTOMER & DELIVERY DETAILS       */}
        {/* ========================================== */}
        {currentStep === "ADDRESS" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white font-mono">
                    Customer & Delivery Details
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Enter the recipient and shipping address for this order
                  </p>
                </div>
              </div>

              {addressError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{addressError}</span>
                </div>
              )}

              <form onSubmit={handleAddressSubmit} className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">FULL NAME *</label>
                    <input
                      type="text"
                      required
                      placeholder="Rahul Kumar"
                      value={addressForm.fullName}
                      onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">PHONE NUMBER *</label>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">EMAIL ADDRESS *</label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@example.com"
                    value={addressForm.email}
                    onChange={(e) => setAddressForm({ ...addressForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ADDRESS LINE 1 (House/Flat/Street) *</label>
                  <input
                    type="text"
                    required
                    placeholder="12, Main Road, Green Meadows"
                    value={addressForm.addressLine1}
                    onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ADDRESS LINE 2 (Area/Colony)</label>
                  <input
                    type="text"
                    placeholder="Near City Hospital / Block B"
                    value={addressForm.addressLine2}
                    onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">CITY *</label>
                    <input
                      type="text"
                      required
                      placeholder="Chennai"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">STATE *</label>
                    <input
                      type="text"
                      required
                      placeholder="Tamil Nadu"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">PINCODE *</label>
                    <input
                      type="text"
                      required
                      placeholder="600001"
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">LANDMARK (Optional)</label>
                  <input
                    type="text"
                    placeholder="Opposite Metro Gate #2"
                    value={addressForm.landmark}
                    onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="save_addr"
                    checked={saveAddressForFuture}
                    onChange={(e) => setSaveAddressForFuture(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400"
                  />
                  <label htmlFor="save_addr" className="text-slate-300 text-xs cursor-pointer">
                    Save this address to my profile for future 1-click orders
                  </label>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs font-mono rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>CONTINUE TO ORDER SUMMARY</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* Sidebar Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-fit space-y-4">
              <h3 className="font-extrabold text-white text-sm font-mono pb-2 border-b border-slate-800">
                Order Items ({items.length})
              </h3>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3">
                    <ProductImage
                      productId={item.product.id}
                      productName={item.product.name}
                      category={item.product.category}
                      src={item.product.image_url || item.product.image}
                      imageSource={item.product.image_source}
                      imageStatus={item.product.image_status}
                      className="w-12 h-12 flex-shrink-0 p-1 rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.product.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {formatPrice(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-between font-mono text-sm font-extrabold text-white">
                <span>Total Amount:</span>
                <span className="text-amber-400">{formatPrice(totalAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* STEP 3: ORDER SUMMARY & PAYMENT SANDBOX    */}
        {/* ========================================== */}
        {currentStep === "SUMMARY" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Delivery Address Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span>DELIVERY ADDRESS</span>
                  </div>
                  <button
                    onClick={() => setCurrentStep("ADDRESS")}
                    className="text-xs font-mono text-amber-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Details</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-white text-sm">{addressForm.fullName}</p>
                  <p>{addressForm.addressLine1}{addressForm.addressLine2 ? `, ${addressForm.addressLine2}` : ""}</p>
                  <p>{addressForm.city}, {addressForm.state} - {addressForm.pincode}</p>
                  <p className="text-slate-400">Phone: {addressForm.phone} | Email: {addressForm.email}</p>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Select Payment Method
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("UPI")}
                    className={`p-4 rounded-2xl border text-left font-mono transition-all ${
                      paymentMethod === "UPI"
                        ? "bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-amber-400 mb-2" />
                    <div className="font-bold text-xs text-white">UPI / QR</div>
                    <div className="text-[10px] text-slate-500">GPay, PhonePe, Paytm</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`p-4 rounded-2xl border text-left font-mono transition-all ${
                      paymentMethod === "CARD"
                        ? "bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-amber-400 mb-2" />
                    <div className="font-bold text-xs text-white">Credit / Debit Card</div>
                    <div className="text-[10px] text-slate-500">Visa, Mastercard, RuPay</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("NET_BANKING")}
                    className={`p-4 rounded-2xl border text-left font-mono transition-all ${
                      paymentMethod === "NET_BANKING"
                        ? "bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-amber-400 mb-2" />
                    <div className="font-bold text-xs text-white">Net Banking</div>
                    <div className="text-[10px] text-slate-500">All Major Indian Banks</div>
                  </button>
                </div>
              </div>

              {/* Controlled Test Scenarios Sandbox */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      Controlled Test Scenarios (ReviveAI Engine Sandbox)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    TEST / SANDBOX
                  </span>
                </div>

                <p className="text-xs text-slate-400 font-mono mb-4 leading-relaxed">
                  Select a test outcome to trigger ReviveAI autonomous detection, technical diagnosis, customer recovery messages, and human escalation:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setSimulationScenario("NETWORK_ERROR")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      simulationScenario === "NETWORK_ERROR"
                        ? "bg-amber-500/20 border-amber-400 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-amber-400">⚡ NETWORK_ERROR (TCP RST)</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      Simulates technical drop → AI diagnoses transient fault & sends payment link.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSimulationScenario("PAYMENT_SUCCESS")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      simulationScenario === "PAYMENT_SUCCESS"
                        ? "bg-emerald-500/20 border-emerald-400 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-emerald-400">✓ PAYMENT_SUCCESS</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      Simulates instant successful capture, stock reduction & order confirmation.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSimulationScenario("PAYMENT_TIMEOUT")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      simulationScenario === "PAYMENT_TIMEOUT"
                        ? "bg-amber-500/20 border-amber-400 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-amber-300">⏱ PAYMENT_TIMEOUT (504 Gateway)</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      Simulates bank gateway timeout during token verification.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSimulationScenario("AUTHENTICATION_FAILED")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      simulationScenario === "AUTHENTICATION_FAILED"
                        ? "bg-indigo-500/20 border-indigo-400 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-indigo-300">🔒 AUTHENTICATION_FAILED (3DS/OTP)</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      Simulates 3DS verification timeout / OTP expiry.
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Summary & Payment CTA */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl font-mono text-xs space-y-4">
                <h3 className="font-extrabold text-white text-sm border-b border-slate-800 pb-3">
                  ORDER SUMMARY
                </h3>

                <div className="space-y-2.5">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex justify-between items-center text-slate-300">
                      <span className="truncate pr-2">{item.product.name} (x{item.quantity})</span>
                      <span className="font-bold text-white">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800">
                    <span>Shipping / Delivery:</span>
                    <span className="text-emerald-400 font-bold">FREE</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                    <span>Total Amount:</span>
                    <span className="text-amber-400">{formatPrice(totalAmount)}</span>
                  </div>
                </div>

                <form onSubmit={handlePayNow} className="pt-2">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs font-mono rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>PROCESSING TEST PAYMENT...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>PAY NOW {formatPrice(totalAmount)}</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-2 border-t border-slate-800/80 text-center">
                  <button
                    type="button"
                    onClick={handleAbandonCheckout}
                    className="text-[11px] text-slate-500 hover:text-rose-400 underline transition-colors"
                  >
                    [Simulate Leaving Checkout / Abandonment]
                  </button>
                </div>
              </div>

              {/* Checkout Abandonment Trigger Feedback */}
              {abandonedState && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl font-mono text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>CHECKOUT ABANDONMENT DETECTED</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Customer exited before payment. Revenue at risk: <strong className="text-white">{formatPrice(abandonedState.revenue_at_risk)}</strong>.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Dynamic payment continuation link generated:
                  </p>
                  <Link
                    href={abandonedState.payment_link}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 font-bold underline"
                  >
                    <span>Open Recovery Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* STEP 4A: PAYMENT SUCCESS VIEW (CONFIRMED) */}
        {/* ========================================== */}
        {currentStep === "SUCCESS" && paymentResult && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 shadow-2xl text-center font-mono animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              ORDER CONFIRMED
            </span>

            <h2 className="text-2xl font-black text-white mt-3 mb-1">
              Order Placed Successfully!
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your payment has been captured and inventory stock has been reserved.
            </p>

            <div className="my-6 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="text-white font-bold">{paymentResult.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="text-white font-bold">{paymentResult.transaction_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Status:</span>
                <span className="text-emerald-400 font-bold">SUCCESS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="text-amber-400 font-extrabold text-sm">{formatPrice(paymentResult.amount || totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Delivery To:</span>
                <span className="text-slate-200">{addressForm.city}, {addressForm.state}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Link
                href="/store/orders"
                className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all"
              >
                <span>View My Orders</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/store"
                className="py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>Continue Shopping</span>
              </Link>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* STEP 4B: PAYMENT FAILURE & AI RECOVERY     */}
        {/* ========================================== */}
        {currentStep === "FAILURE" && paymentResult && (
          <div className="max-w-2xl mx-auto space-y-6 font-mono animate-in fade-in zoom-in-95 duration-200">
            {/* Failure Card */}
            <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-7 h-7" />
              </div>

              <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-widest">
                  {paymentResult.scenario_label || "PAYMENT ATTEMPT FAILED"}
                </span>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest">
                  REVIVEAI ACTIVE
                </span>
              </div>

              <h2 className="text-xl font-black text-white mt-1 mb-1">
                {paymentResult.diagnosis_title || "Payment Could Not Be Completed"}
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {paymentResult.customer_message}
              </p>

              {/* Technical Diagnosis Box */}
              {paymentResult.diagnosis_details && (
                <div className="mt-4 p-3.5 bg-slate-950/80 rounded-2xl border border-indigo-500/30 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AUTONOMOUS ROOT CAUSE DIAGNOSIS & POLICY</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    {paymentResult.diagnosis_details}
                  </p>
                </div>
              )}

              <div className="my-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Order ID:</span>
                  <span className="text-white font-bold">{paymentResult.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Product:</span>
                  <span className="text-slate-200 font-semibold">{paymentResult.product_name || items[0]?.product.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount at Risk:</span>
                  <span className="text-amber-400 font-extrabold">{formatPrice(paymentResult.amount || totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">AI Risk Priority:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${paymentResult.risk_level === "CRITICAL" || paymentResult.risk_level === "HIGH" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                    {paymentResult.risk_level || "HIGH"} RISK
                  </span>
                </div>
              </div>

              {/* Simulated Customer Recovery Message Preview */}
              <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-amber-400">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>AUTOMATIC CUSTOMER MESSAGE DISPATCHED</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Instant SMS / WhatsApp</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-[11px] text-slate-300 font-sans whitespace-pre-line border border-slate-800/80 leading-relaxed">
                  {paymentResult.automated_message_preview ||
                    `Hi ${addressForm.fullName},\n\nYour payment for ${items[0]?.product.name} (₹${totalAmount.toLocaleString()}) could not be completed due to a temporary payment issue.\n\nYour order is still available.\n\nPlease complete your payment using the secure payment link below.`}
                </div>
              </div>

              {/* Dynamic Payment Recovery Action */}
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
                <Link
                  href={`/payment/retry/${paymentResult.recovery_token}`}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{paymentResult.recovery_action_label || "COMPLETE PAYMENT / RETRY NOW"}</span>
                </Link>

                <div className="flex items-center justify-between text-xs text-slate-400 px-2">
                  <Link href="/store" className="hover:underline">
                    ← Return to Store
                  </Link>
                  <Link href="/seller" className="text-amber-400 hover:underline flex items-center gap-1">
                    <span>Inspect in Seller Portal</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
