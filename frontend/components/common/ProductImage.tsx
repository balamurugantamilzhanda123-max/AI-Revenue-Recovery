"use client";

import React, { useState, useEffect } from "react";
import {
  Lightbulb,
  Fan,
  Cable,
  ToggleLeft,
  Flame,
  BatteryCharging,
  Laptop,
  Mouse,
  Package,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export type ImageSourceType = "LOCAL" | "EXTERNAL" | "AI_GENERATED" | "FALLBACK";
export type ImageStatusType = "IMAGE_AVAILABLE" | "IMAGE_GENERATING" | "IMAGE_GENERATED" | "IMAGE_FAILED" | "IMAGE_UNAVAILABLE";

export interface ProductImageProps {
  productId?: string;
  productName: string;
  category?: string;
  src?: string;
  imageSource?: ImageSourceType;
  imageStatus?: ImageStatusType;
  className?: string;
  imgClassName?: string;
  aspectRatio?: "square" | "video" | "auto";
  showBadge?: boolean;
  priority?: boolean;
  alt?: string;
  onClick?: () => void;
}

export default function ProductImage({
  productId,
  productName,
  category = "General",
  src,
  imageSource = "LOCAL",
  imageStatus = "IMAGE_AVAILABLE",
  className = "",
  imgClassName = "",
  aspectRatio = "square",
  showBadge = false,
  priority = false,
  alt,
  onClick,
}: ProductImageProps) {
  // Determine primary candidate source
  const getInitialSrc = () => {
    if (src && src.trim() !== "") return src;
    if (productId) return `/products/existing/${productId}.svg`;
    return `/products/generated/${productId}.svg`;
  };

  const [currentSrc, setCurrentSrc] = useState<string>(getInitialSrc());
  const [tier, setTier] = useState<number>(1); // 1: Local/Provided, 2: Generated, 3: Category Fallback
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const initial = getInitialSrc();
    setCurrentSrc(initial);
    setTier(1);
    setIsLoading(true);
    setHasError(false);
  }, [src, productId]);

  const handleError = () => {
    setIsLoading(false);
    if (tier === 1 && productId) {
      // Try Tier 2: Generated local SVG
      setTier(2);
      setCurrentSrc(`/products/generated/${productId}.svg`);
    } else if (tier <= 2 && productId) {
      // Try Tier 3: Existing local SVG
      setTier(3);
      setCurrentSrc(`/products/existing/${productId}.svg`);
    } else {
      // Final Fallback Tier
      setTier(4);
      setHasError(true);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  // Category Icon & Color Mapping for Professional Fallback
  const getCategoryIcon = () => {
    const cat = (category || "").toLowerCase();
    const name = (productName || "").toLowerCase();

    if (cat.includes("light") || name.includes("bulb") || name.includes("lamp") || name.includes("tube")) {
      return <Lightbulb className="w-12 h-12 text-amber-400" />;
    }
    if (cat.includes("fan") || cat.includes("cool") || name.includes("fan")) {
      return <Fan className="w-12 h-12 text-cyan-400" />;
    }
    if (cat.includes("power") || cat.includes("cable") || name.includes("wire") || name.includes("cord") || name.includes("strip")) {
      return <Cable className="w-12 h-12 text-blue-400" />;
    }
    if (cat.includes("switch") || cat.includes("socket") || name.includes("mcb") || name.includes("panel")) {
      return <ToggleLeft className="w-12 h-12 text-purple-400" />;
    }
    if (cat.includes("kitchen") || name.includes("kettle") || name.includes("mixer") || name.includes("stove")) {
      return <Flame className="w-12 h-12 text-rose-400" />;
    }
    if (cat.includes("inverter") || cat.includes("battery") || cat.includes("ups") || cat.includes("heavy")) {
      return <BatteryCharging className="w-12 h-12 text-emerald-400" />;
    }
    if (cat.includes("laptop") || cat.includes("computer") || name.includes("book") || name.includes("notebook")) {
      return <Laptop className="w-12 h-12 text-indigo-400" />;
    }
    if (cat.includes("accessor") || name.includes("mouse") || name.includes("keyboard") || name.includes("stand") || name.includes("hub")) {
      return <Mouse className="w-12 h-12 text-pink-400" />;
    }
    return <Package className="w-12 h-12 text-amber-400" />;
  };

  // Aspect ratio helper
  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "video"
      ? "aspect-video"
      : "";

  return (
    <div
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800/80 flex items-center justify-center p-2 transition-all group ${aspectClass} ${className}`}
    >
      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-800/60 animate-pulse flex items-center justify-center z-10">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Main Product Image (Priority 1, 2, 3) */}
      {!hasError && currentSrc ? (
        <img
          src={currentSrc}
          alt={alt || productName}
          loading={priority ? "eager" : "lazy"}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-105 ${imgClassName}`}
        />
      ) : (
        /* Professional Category Vector Fallback (Priority 4) */
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 space-y-2 bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center shadow-lg shadow-black/40">
            {getCategoryIcon()}
          </div>
          <div className="space-y-0.5 max-w-[200px]">
            <p className="text-[11px] font-bold text-white font-mono truncate">{productName}</p>
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">{category}</p>
          </div>
          <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            VERIFIED SPEC
          </span>
        </div>
      )}

      {/* AI Generated / Verified Badge */}
      {showBadge && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-[9px] font-mono text-amber-400 shadow-md">
          <Sparkles className="w-2.5 h-2.5" />
          <span>AI Studio</span>
        </div>
      )}
    </div>
  );
}
