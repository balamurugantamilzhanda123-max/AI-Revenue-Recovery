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
} from "lucide-react";
import { fetchElectricalProducts, ElectricalProduct } from "../../lib/api";

const CATEGORIES = [
  "All",
  "Lighting",
  "Fans & Cooling",
  "Kitchen Appliances",
  "Power & Cables",
  "Switches & Wiring",
  "Inverters & Heavy Power",
];

export default function ElectricalStorePage() {
  const router = useRouter();
  const [products, setProducts] = useState<ElectricalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<Array<{ product: ElectricalProduct; quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProductModal, setSelectedProductModal] = useState<ElectricalProduct | null>(null);

  // Load products dynamically from backend
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetchElectricalProducts({
        category: selectedCategory === "All" ? undefined : selectedCategory,
        search: searchQuery || undefined,
      });
      setProducts(res.data || []);
    } catch (err) {
      console.error("Failed to load products:", err);
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const proceedToCheckout = (directProduct?: ElectricalProduct) => {
    if (directProduct) {
      // Direct single product quick checkout
      localStorage.setItem(
        "voltstore_checkout_items",
        JSON.stringify([{ product: directProduct, quantity: 1 }])
      );
    } else {
      localStorage.setItem("voltstore_checkout_items", JSON.stringify(cart));
    }
    router.push("/store/checkout");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-900">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-4 py-2 text-xs font-bold font-mono text-center flex items-center justify-center gap-2 shadow-inner">
        <Flame className="w-4 h-4 animate-bounce" />
        <span>FESTIVE ELECTRICAL SALE: Up to 40% Off on BLDC Fans, Smart LEDs & Inverters! Free 2-Day Delivery</span>
      </div>

      {/* Main E-Commerce Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
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
                  ELECTRICALS
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider">
                Industrial & Consumer Electrical Goods
              </p>
            </div>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg hidden md:flex items-center relative">
            <input
              type="text"
              placeholder="Search LED bulbs, BLDC fans, inverters, cables, switches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2 pl-10 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  loadProducts();
                }}
                className="absolute right-3 text-xs text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Action Links & Cart Trigger */}
          <div className="flex items-center gap-3">
            <Link
              href="/seller"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700/80 border border-slate-700 text-xs font-mono font-semibold transition-all"
            >
              <span>Seller Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

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
        <div className="border-t border-slate-800/80 bg-slate-950/60 px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-max">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  selectedCategory === cat
                    ? "bg-amber-500 text-slate-950 shadow-sm font-bold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero Strip */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800/80 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold uppercase tracking-widest mb-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Direct-from-Manufacturer Quality Assurance</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Premium Electrical Products & Equipment
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1 max-w-xl">
              Certified high-voltage switches, pure copper wiring, BLDC inverter fans, smart IoT lighting, and heavy-duty battery backups.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>IS/IEC Certified</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>2-Day Delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Product Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs font-mono text-slate-400">
            Showing <span className="text-white font-bold">{products.length}</span> electrical products in{" "}
            <span className="text-amber-400 font-bold">{selectedCategory}</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 animate-pulse h-80 flex flex-col justify-between"
              >
                <div className="w-full h-36 bg-slate-700/60 rounded-xl"></div>
                <div className="space-y-2 mt-4">
                  <div className="w-3/4 h-4 bg-slate-700/60 rounded"></div>
                  <div className="w-1/2 h-3 bg-slate-700/40 rounded"></div>
                </div>
                <div className="w-full h-9 bg-slate-700/60 rounded-xl mt-4"></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 rounded-3xl border border-slate-800">
            <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No products found</h3>
            <p className="text-xs text-slate-400 font-mono mt-1">Try choosing another category or clearing your search.</p>
            <button
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 text-xs font-mono font-bold rounded-xl"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-slate-800/60 border border-slate-700/80 rounded-2xl overflow-hidden hover:border-amber-400/60 transition-all hover:shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between group"
              >
                {/* Product Card Top Image & Badges */}
                <div className="relative p-4 bg-slate-950/40 border-b border-slate-800/60">
                  {product.badge && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-amber-500 text-slate-950 uppercase tracking-wider shadow-sm z-10">
                      {product.badge}
                    </span>
                  )}
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800/90 text-slate-300 border border-slate-700 z-10">
                    {product.category}
                  </span>

                  <div className="w-full h-44 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-300">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback image gradient if external image fails
                        (e.target as any).src = "https://images.unsplash.com/photo-1550524514-6c70313172ca?w=600&auto=format&fit=crop&q=80";
                      }}
                    />
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-mono font-bold mb-1">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{product.rating}</span>
                      <span className="text-slate-500 font-normal">({product.reviews_count} reviews)</span>
                    </div>

                    <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug group-hover:text-amber-300 transition-colors">
                      {product.name}
                    </h3>

                    <p className="text-xs text-slate-400 font-mono line-clamp-2 mt-1.5 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* Key Spec Snippet */}
                  {product.specs && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                      {Object.entries(product.specs)
                        .slice(0, 2)
                        .map(([k, v]) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 rounded bg-slate-900/90 text-[10px] font-mono text-slate-300 border border-slate-800"
                          >
                            <strong className="text-slate-400">{k}:</strong> {v}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Price and Cart Buttons */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-lg font-extrabold text-white font-mono">
                        {formatPrice(product.price)}
                      </span>
                      <div className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>In Stock ({product.stock} units)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedProductModal(product)}
                        title="View Specs"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => addToCart(product)}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Slide-over Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
          ></div>

          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <h2 className="font-bold text-base text-white font-mono">
                  Shopping Cart ({totalCartCount} items)
                </h2>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-300">Your cart is empty</p>
                  <p className="text-xs text-slate-500 font-mono mt-1">Browse our electrical catalog and add items.</p>
                </div>
              ) : (
                cart.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="p-3.5 bg-slate-800/70 border border-slate-700/80 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="w-14 h-14 rounded-lg bg-slate-900 overflow-hidden flex-shrink-0 p-1 border border-slate-700">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{product.name}</h4>
                      <p className="text-[11px] font-mono text-amber-400 font-bold mt-0.5">
                        {formatPrice(product.price)}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border border-slate-700 rounded-lg bg-slate-900">
                          <button
                            onClick={() => updateCartQuantity(product.id, -1)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-mono font-bold text-white">{quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(product.id, 1)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(product.id)}
                          className="p-1 text-rose-400 hover:text-rose-300 ml-auto"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span className="text-white font-bold">{formatPrice(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Shipping & Handling:</span>
                    <span className="text-emerald-400 font-bold">FREE</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                    <span>Total Amount:</span>
                    <span className="text-amber-400 font-mono">{formatPrice(cartSubtotal)}</span>
                  </div>
                </div>

                <button
                  onClick={() => proceedToCheckout()}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setSelectedProductModal(null)}
          ></div>

          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                {selectedProductModal.category}
              </span>
              <button
                onClick={() => setSelectedProductModal(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[80vh] overflow-y-auto">
              <div className="w-full h-56 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden p-2">
                <img
                  src={selectedProductModal.image_url}
                  alt={selectedProductModal.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedProductModal.name}</h3>
                  <p className="text-xs text-slate-300 font-mono mt-2 leading-relaxed">
                    {selectedProductModal.description}
                  </p>
                </div>

                <div className="text-xl font-extrabold text-amber-400 font-mono">
                  {formatPrice(selectedProductModal.price)}
                </div>

                {selectedProductModal.specs && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <h5 className="text-xs font-bold text-slate-400 font-mono uppercase">
                      Technical Specifications
                    </h5>
                    <div className="space-y-1">
                      {Object.entries(selectedProductModal.specs).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">{k}:</span>
                          <span className="text-white font-semibold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => {
                      addToCart(selectedProductModal);
                      setSelectedProductModal(null);
                    }}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono rounded-xl transition-all shadow-md"
                  >
                    Add to Cart
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProductModal(null);
                      proceedToCheckout(selectedProductModal);
                    }}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs font-mono rounded-xl border border-slate-700"
                  >
                    Quick Buy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
