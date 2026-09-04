"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  ShoppingCart,
  Zap,
  Star,
  CheckCircle2,
  ShieldCheck,
  Truck,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  X,
  Info,
  Flame,
  User,
  LogOut,
  Package,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Laptop,
  Cpu,
  Monitor,
} from "lucide-react";
import {
  fetchElectricalProducts,
  customerLogin,
  customerRegister,
  ElectricalProduct,
  CustomerProfile,
} from "../../lib/api";

const CATEGORIES = [
  "All",
  "Lighting",
  "Fans & Cooling",
  "Kitchen Appliances",
  "Power & Cables",
  "Switches & Wiring",
  "Inverters & Heavy Power",
  "Laptops & Computers",
  "Computer Accessories",
];

// Fallback image SVG in case network CDN fails
const getPlaceholderImage = (category: string) => {
  if (category.includes("Laptop")) {
    return "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&auto=format&fit=crop&q=80";
  }
  if (category.includes("Accessories")) {
    return "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80";
  }
  if (category.includes("Lighting")) {
    return "https://images.unsplash.com/photo-1550524514-6c70313172ca?w=600&auto=format&fit=crop&q=80";
  }
  if (category.includes("Fans")) {
    return "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80";
  }
  return "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80";
};

export default function ElectricalStorePage() {
  const router = useRouter();
  const [products, setProducts] = useState<ElectricalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<Array<{ product: ElectricalProduct; quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProductModal, setSelectedProductModal] = useState<ElectricalProduct | null>(null);
  const [productModalQty, setProductModalQty] = useState(1);

  // Customer Auth State
  const [currentUser, setCurrentUser] = useState<CustomerProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [postAuthAction, setPostAuthAction] = useState<(() => void) | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Login Form
  const [loginIdent, setLoginIdent] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register Form
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Load user session on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("voltstore_customer_session");
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
      const storedCart = localStorage.getItem("voltstore_cart_items");
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
    } catch {
      // ignore parse error
    }
  }, []);

  // Save cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem("voltstore_cart_items", JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Load products dynamically from backend API
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetchElectricalProducts({
        category: selectedCategory === "All" ? undefined : selectedCategory,
        search: searchQuery.trim() || undefined,
      });
      if (res && res.data && res.data.length > 0) {
        setProducts(res.data);
      } else if (res && res.data) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error("Failed to load products from API:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts();
  };

  const addToCart = (product: ElectricalProduct, qty: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    setIsCartOpen(true);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: ElectricalProduct; quantity: number }>
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartDiscount = cart.reduce((sum, item) => {
    const origPrice = item.product.price;
    const discPrice = item.product.discountPrice || item.product.price;
    return sum + (origPrice > discPrice ? (origPrice - discPrice) * item.quantity : 0);
  }, 0);
  const deliveryCharge = cartSubtotal > 999 || cartSubtotal === 0 ? 0 : 99;
  const cartGrandTotal = cartSubtotal + deliveryCharge;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Auth Handler: Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
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
      setIsAuthModalOpen(false);
      setLoginPassword("");

      // Execute queued action if any
      if (postAuthAction) {
        postAuthAction();
        setPostAuthAction(null);
      }
    } catch (err: any) {
      setAuthError(err.message || "Invalid credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Auth Handler: Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (!regName.trim()) throw new Error("Full name is required.");
      if (!regEmail.trim() || !regEmail.includes("@")) throw new Error("Please provide a valid email.");
      if (!regPhone.trim() || regPhone.trim().length < 10) throw new Error("Please enter a valid 10-digit phone number.");
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
      setIsAuthModalOpen(false);
      setRegPassword("");
      setRegConfirmPassword("");

      // Execute queued action if any
      if (postAuthAction) {
        postAuthAction();
        setPostAuthAction(null);
      }
    } catch (err: any) {
      setAuthError(err.message || "Registration failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("voltstore_customer_session");
    setIsUserMenuOpen(false);
  };

  // Buy Now Flow: Enforces Authentication BEFORE Checkout
  const handleBuyNow = (product: ElectricalProduct, qty: number = 1) => {
    const buyItems = [{ product, quantity: qty }];
    localStorage.setItem("voltstore_checkout_items", JSON.stringify(buyItems));

    if (!currentUser) {
      // Must login before checkout
      setPostAuthAction(() => () => {
        router.push("/store/checkout");
      });
      setIsAuthModalOpen(true);
    } else {
      router.push("/store/checkout");
    }
  };

  // Cart Checkout Flow: Enforces Authentication
  const handleCartCheckout = () => {
    if (cart.length === 0) return;
    localStorage.setItem("voltstore_checkout_items", JSON.stringify(cart));

    if (!currentUser) {
      setPostAuthAction(() => () => {
        router.push("/store/checkout");
      });
      setIsCartOpen(false);
      setIsAuthModalOpen(true);
    } else {
      router.push("/store/checkout");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-900 font-sans">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-4 py-2 text-xs font-bold font-mono text-center flex items-center justify-center gap-2 shadow-inner">
        <Flame className="w-4 h-4 animate-bounce" />
        <span>MEGA TECH & ELECTRICAL SALE: Up to 40% Off on Laptops, BLDC Fans, Smart LEDs & Inverters! Free Express Delivery</span>
      </div>

      {/* Main Store Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/store" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 via-orange-500 to-amber-600 p-0.5 shadow-md shadow-amber-500/20 transition-transform group-hover:scale-105">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5 fill-current" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white font-mono">
                  Volt<span className="text-amber-400">Store</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  TECH & ELECTRICALS
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider">
                Certified Electricals, Laptops & Electronics
              </p>
            </div>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg hidden md:flex items-center relative">
            <input
              type="text"
              placeholder="Search LED bulb, fan, inverter, laptop, keyboard, mouse, SSD, monitor, switch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  loadProducts();
                }}
                className="absolute right-3 text-xs text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Navigation Controls: User Auth, Seller Portal, Cart */}
          <div className="flex items-center gap-3">
            {/* Seller Portal Link */}
            <Link
              href="/seller"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-amber-400 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-semibold transition-all"
            >
              <span>Seller Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Customer Authentication State */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-400/50 text-xs font-mono text-white transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate">{currentUser.name}</span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 font-mono text-xs space-y-1">
                    <div className="px-3 py-2 border-b border-slate-800 text-[11px]">
                      <p className="font-bold text-white">{currentUser.name}</p>
                      <p className="text-slate-400 truncate text-[10px]">{currentUser.email}</p>
                    </div>
                    <Link
                      href="/store/orders"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Package className="w-4 h-4 text-amber-400" />
                      <span>My Orders</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthTab("LOGIN");
                  setAuthError(null);
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-mono font-semibold transition-all"
              >
                <User className="w-4 h-4 text-amber-400" />
                <span>Login / Register</span>
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cart</span>
              {totalCartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-400 text-[11px] font-extrabold flex items-center justify-center ml-0.5">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Categories Horizontal Scroller */}
        <div className="border-t border-slate-800/80 bg-slate-950/70 px-4 sm:px-6 lg:px-8 py-2.5 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-max">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSearchQuery("");
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  selectedCategory === cat
                    ? "bg-amber-500 text-slate-950 shadow-md font-bold scale-105"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/90"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero Strip */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold uppercase tracking-widest mb-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Enterprise & Consumer Electronics Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Premium Electrical Products, Laptops & Computer Accessories
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1.5 max-w-2xl">
              High-performance business laptops, 4K monitors, pure sine wave inverters, BLDC ceiling fans, smart lighting, and industrial electrical gear with ReviveAI payment protection.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Genuine Warranty</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 shadow-sm">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Free 2-Day Delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Product Catalog Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-800">
          <div className="text-xs font-mono text-slate-400">
            Showing <span className="text-white font-bold text-sm">{products.length}</span> products in{" "}
            <span className="text-amber-400 font-bold">{selectedCategory}</span>
            {searchQuery && (
              <span>
                {" "}matching <span className="text-white font-bold">"{searchQuery}"</span>
              </span>
            )}
          </div>

          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                loadProducts();
              }}
              className="text-xs font-mono text-amber-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Clear Search</span>
            </button>
          )}
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 animate-pulse h-96 flex flex-col justify-between"
              >
                <div className="w-full h-44 bg-slate-800 rounded-xl"></div>
                <div className="space-y-2 mt-4">
                  <div className="w-3/4 h-4 bg-slate-800 rounded"></div>
                  <div className="w-1/2 h-3 bg-slate-800/60 rounded"></div>
                </div>
                <div className="w-full h-10 bg-slate-800 rounded-xl mt-4"></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/60 rounded-3xl border border-slate-800">
            <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No products found</h3>
            <p className="text-xs text-slate-400 font-mono mt-1">Try another category or clear your search query.</p>
            <button
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
                loadProducts();
              }}
              className="mt-5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold rounded-xl transition-all shadow-md"
            >
              Clear Search & Show All Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const hasDiscount = product.discountPrice && product.discountPrice < product.price;
              const displayPrice = product.price;
              const imageUrl = product.image_url || product.image || getPlaceholderImage(product.category);

              return (
                <div
                  key={product.id}
                  className="group bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5"
                >
                  <div>
                    {/* Product Image Container */}
                    <div
                      onClick={() => {
                        setSelectedProductModal(product);
                        setProductModalQty(1);
                      }}
                      className="relative w-full h-48 bg-slate-950 rounded-xl overflow-hidden mb-3.5 cursor-pointer flex items-center justify-center p-2 border border-slate-800/80 group-hover:border-slate-700"
                    >
                      <img
                        src={imageUrl}
                        alt={product.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getPlaceholderImage(product.category);
                        }}
                        className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                      />

                      {product.badge && (
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500 text-slate-950 shadow-md">
                          {product.badge}
                        </span>
                      )}

                      <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-sm text-[10px] font-mono font-semibold text-slate-300 border border-slate-800">
                        {product.category}
                      </span>
                    </div>

                    {/* Rating & Reviews */}
                    <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 mb-1.5">
                      <div className="flex items-center">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="ml-1 font-bold text-white">{product.rating}</span>
                      </div>
                      <span className="text-slate-500">({product.reviews_count || product.reviewCount || 100})</span>
                      <span className="ml-auto text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        In Stock ({product.stock})
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      onClick={() => {
                        setSelectedProductModal(product);
                        setProductModalQty(1);
                      }}
                      className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-2 cursor-pointer"
                      title={product.name}
                    >
                      {product.name}
                    </h3>

                    <p className="text-[11px] text-slate-400 font-mono line-clamp-2 mt-1 mb-3">
                      {product.description}
                    </p>
                  </div>

                  <div>
                    {/* Price Block */}
                    <div className="flex items-baseline gap-2 mb-3.5 pt-2 border-t border-slate-800/80">
                      <span className="text-lg font-extrabold text-white font-mono">
                        {formatPrice(displayPrice)}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-slate-500 line-through font-mono">
                          {formatPrice(product.price * 1.15)}
                        </span>
                      )}
                    </div>

                    {/* Card Actions: Add to Cart & Buy Now */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => addToCart(product, 1)}
                        className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-mono text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>

                      <button
                        onClick={() => handleBuyNow(product, 1)}
                        className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-extrabold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1 active:scale-95"
                      >
                        <span>Buy Now</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Product Details Modal */}
      {selectedProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedProductModal(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Visual */}
              <div className="flex flex-col items-center">
                <div className="w-full h-64 bg-slate-950 rounded-2xl overflow-hidden p-2 border border-slate-800 flex items-center justify-center relative">
                  <img
                    src={selectedProductModal.image_url || selectedProductModal.image || getPlaceholderImage(selectedProductModal.category)}
                    alt={selectedProductModal.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  {selectedProductModal.badge && (
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-md text-xs font-mono font-bold bg-amber-500 text-slate-950">
                      {selectedProductModal.badge}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs font-mono text-slate-400 w-full justify-between px-2">
                  <div className="flex items-center gap-1 text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Official Warranty</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 font-bold">
                    <Truck className="w-4 h-4" />
                    <span>Free Shipping</span>
                  </div>
                </div>
              </div>

              {/* Product Info & Specs */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {selectedProductModal.category}
                    </span>
                    {selectedProductModal.subcategory && (
                      <span className="text-xs font-mono text-slate-400">
                        / {selectedProductModal.subcategory}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-extrabold text-white tracking-tight">
                    {selectedProductModal.name}
                  </h2>

                  <div className="flex items-center gap-2 my-2 text-xs font-mono">
                    <div className="flex items-center text-amber-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="ml-1 font-bold text-white">{selectedProductModal.rating}</span>
                    </div>
                    <span className="text-slate-500">
                      ({selectedProductModal.reviews_count || selectedProductModal.reviewCount || 120} reviews)
                    </span>
                    <span className="text-emerald-400 font-bold ml-auto">
                      ✓ In Stock ({selectedProductModal.stock} units)
                    </span>
                  </div>

                  <div className="text-2xl font-black text-white font-mono my-3">
                    {formatPrice(selectedProductModal.price)}
                  </div>

                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    {selectedProductModal.description}
                  </p>

                  {/* Technical Specifications Table */}
                  {selectedProductModal.specs && Object.keys(selectedProductModal.specs).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Technical Specifications
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                        {Object.entries(selectedProductModal.specs).map(([k, v]) => (
                          <div key={k} className="flex flex-col">
                            <span className="text-[10px] text-slate-500">{k}:</span>
                            <span className="text-slate-200 font-semibold">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quantity Selector & CTAs */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400 font-semibold">Quantity:</span>
                    <div className="flex items-center gap-3 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                      <button
                        onClick={() => setProductModalQty((q) => Math.max(1, q - 1))}
                        className="text-slate-400 hover:text-white"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold text-white w-6 text-center">
                        {productModalQty}
                      </span>
                      <button
                        onClick={() => setProductModalQty((q) => Math.min(selectedProductModal.stock, q + 1))}
                        className="text-slate-400 hover:text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        addToCart(selectedProductModal, productModalQty);
                        setSelectedProductModal(null);
                      }}
                      className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-mono text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4 text-amber-400" />
                      <span>Add to Cart</span>
                    </button>

                    <button
                      onClick={() => {
                        handleBuyNow(selectedProductModal, productModalQty);
                        setSelectedProductModal(null);
                      }}
                      className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-extrabold transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                    >
                      <span>Buy Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Slide-out Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl p-6">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                  <h3 className="font-extrabold text-white text-base font-mono">
                    Your Shopping Cart ({totalCartCount})
                  </h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items List */}
              <div className="mt-4 space-y-3 overflow-y-auto max-h-[58vh] pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 font-mono text-xs">
                    <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p>Your cart is empty.</p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="mt-3 px-4 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <img
                        src={item.product.image_url || item.product.image || getPlaceholderImage(item.product.category)}
                        alt={item.product.name}
                        className="w-14 h-14 object-cover rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate" title={item.product.name}>
                          {item.product.name}
                        </h4>
                        <div className="text-xs font-mono text-amber-400 font-semibold mt-0.5">
                          {formatPrice(item.product.price)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, -1)}
                            className="w-5 h-5 rounded bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono font-bold text-white">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, 1)}
                            className="w-5 h-5 rounded bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end justify-between self-stretch">
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono font-bold text-white">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Calculations & Checkout CTA */}
            {cart.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="text-white font-bold">{formatPrice(cartSubtotal)}</span>
                </div>
                {cartDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount Savings:</span>
                    <span>-{formatPrice(cartDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>Delivery:</span>
                  <span>{deliveryCharge === 0 ? "FREE" : formatPrice(deliveryCharge)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                  <span>Total Amount:</span>
                  <span className="text-amber-400">{formatPrice(cartGrandTotal)}</span>
                </div>

                <button
                  onClick={handleCartCheckout}
                  className="w-full py-3 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs font-mono rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>PROCEED TO CHECKOUT</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Login & Registration Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Auth Modal Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white font-mono">
                {authTab === "LOGIN" ? "WELCOME BACK" : "CREATE CUSTOMER ACCOUNT"}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                {authTab === "LOGIN"
                  ? "Login to proceed with your order & saved details"
                  : "Register once for instant 1-click delivery & recovery"}
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5 font-mono text-xs">
              <button
                onClick={() => {
                  setAuthTab("LOGIN");
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg font-bold transition-all ${
                  authTab === "LOGIN"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                LOGIN
              </button>
              <button
                onClick={() => {
                  setAuthTab("REGISTER");
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg font-bold transition-all ${
                  authTab === "REGISTER"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                CREATE ACCOUNT
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Login Form */}
            {authTab === "LOGIN" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Email or Phone Number:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="rahul@example.com or 9876543210"
                    value={loginIdent}
                    onChange={(e) => setLoginIdent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Password:
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold font-mono text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                >
                  {authLoading ? "LOGGING IN..." : "LOGIN"}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("REGISTER");
                      setAuthError(null);
                    }}
                    className="text-slate-400 hover:text-amber-400 text-xs font-mono"
                  >
                    Don't have an account? <span className="text-amber-400 font-bold underline">CREATE ACCOUNT</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Registration Form */
              <form onSubmit={handleRegisterSubmit} className="space-y-3 font-mono text-xs">
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
                  <label className="block text-slate-300 font-semibold mb-1">Email Address:</label>
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
                  className="w-full py-3 mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold font-mono text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                >
                  {authLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("LOGIN");
                      setAuthError(null);
                    }}
                    className="text-slate-400 hover:text-amber-400 text-xs font-mono"
                  >
                    Already have an account? <span className="text-amber-400 font-bold underline">LOGIN</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
