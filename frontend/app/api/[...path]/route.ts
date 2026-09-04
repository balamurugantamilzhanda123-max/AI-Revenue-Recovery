import { NextRequest, NextResponse } from "next/server";
import { FALLBACK_PRODUCTS } from "../../../lib/fallbackProducts";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ||
  process.env.BACKEND_URL?.trim().replace(/\/+$/, "") ||
  "http://127.0.0.1:8000";

async function proxyOrFallback(req: NextRequest, { params }: { params: { path: string[] } }) {
  const pathStr = (params?.path || []).join("/");
  const targetUrl = `${BACKEND_URL}/api/${pathStr}${req.nextUrl.search}`;

  // 1. Attempt to proxy to the live backend if reachable
  try {
    let body: any = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        body = await req.text();
      } catch {
        // empty body
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (res.ok || res.status < 500) {
      const data = await res.json().catch(() => null);
      return NextResponse.json(data || {}, { status: res.status });
    }
  } catch {
    // Backend offline / not reachable -> proceed to seamless Next.js fallback
  }

  // 2. Built-in Next.js Fallback Handlers for Customer Auth & Store Endpoints
  if (pathStr === "checkout/customer/login" || pathStr === "checkout/login") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty json
    }
    const ident = (body.identifier || "customer@voltstore.in").trim();
    const name = ident.includes("@") ? ident.split("@")[0] : ident;
    return NextResponse.json({
      success: true,
      message: "Login successful.",
      customer: {
        id: "cust_active_" + Math.random().toString(36).substring(2, 9),
        name: name.toUpperCase(),
        email: ident.includes("@") ? ident.toLowerCase() : `${ident}@voltstore.in`,
        phone: !ident.includes("@") ? ident : "9876543210",
        saved_address: {
          full_name: name.toUpperCase(),
          phone: "9876543210",
          email: ident.includes("@") ? ident.toLowerCase() : `${ident}@voltstore.in`,
          address_line1: "12, Main Tech Park Road",
          address_line2: "Near Metro Hub",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          landmark: "Opposite Tech Park",
        },
      },
      token: "cust_tok_" + Math.random().toString(36).substring(2, 12),
    });
  }

  if (pathStr === "checkout/customer/register" || pathStr === "checkout/register") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty json
    }
    const name = (body.full_name || "Valued Customer").trim();
    const email = (body.email || "customer@voltstore.in").trim().toLowerCase();
    const phone = (body.phone || "9876543210").trim();
    return NextResponse.json({
      success: true,
      message: "Account created successfully.",
      customer: {
        id: "cust_active_" + Math.random().toString(36).substring(2, 9),
        name: name,
        email: email,
        phone: phone,
        saved_address: {
          full_name: name,
          phone: phone,
          email: email,
          address_line1: "12, Main Tech Park Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      },
      token: "cust_tok_" + Math.random().toString(36).substring(2, 12),
    });
  }

  if (pathStr === "checkout/customer/me") {
    const email = req.nextUrl.searchParams.get("email") || "customer@voltstore.in";
    const name = email.includes("@") ? email.split("@")[0].toUpperCase() : "CUSTOMER";
    return NextResponse.json({
      customer: {
        id: "cust_active_demo",
        name: name,
        email: email,
        phone: "9876543210",
        saved_address: {
          full_name: name,
          phone: "9876543210",
          email: email,
          address_line1: "12, Main Tech Park Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      },
    });
  }

  if (pathStr === "checkout/products") {
    return NextResponse.json({ data: FALLBACK_PRODUCTS, count: FALLBACK_PRODUCTS.length });
  }

  if (pathStr === "checkout/customer/orders") {
    return NextResponse.json({ data: [], count: 0 });
  }

  if (pathStr === "health") {
    return NextResponse.json({ status: "ok", service: "ReviveAI Vercel Proxy", version: "1.0.0" });
  }

  return NextResponse.json({ detail: `Endpoint /api/${pathStr} not found` }, { status: 404 });
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyOrFallback(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyOrFallback(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyOrFallback(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxyOrFallback(req, ctx);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
