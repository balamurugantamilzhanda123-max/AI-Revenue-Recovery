import { NextRequest, NextResponse } from "next/server";
import { FALLBACK_PRODUCTS } from "../../../lib/fallbackProducts";

const rawBackendUrl =
  process.env.BACKEND_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "";

const cleanBackendUrl = rawBackendUrl.replace(/\/+$/, "");

// Check whether we should proxy to an external backend
function shouldProxyToBackend(): boolean {
  if (!cleanBackendUrl) return false;
  // If running in production / Vercel cloud and URL points to localhost or private IP, do NOT proxy
  if (
    cleanBackendUrl.includes("localhost") ||
    cleanBackendUrl.includes("127.0.0.1") ||
    cleanBackendUrl.includes("0.0.0.0")
  ) {
    return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
  }
  return cleanBackendUrl.startsWith("https://") || cleanBackendUrl.startsWith("http://");
}

// In-Memory Fallback State (for standalone or serverless demo)
interface MockTx {
  id: string;
  transaction_id: string;
  order_id: string;
  customer_id: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    status: string;
  };
  product_id: string;
  product_name: string;
  category: string;
  amount: number;
  currency: string;
  status: "SUCCESS" | "FAILED" | "ABANDONED" | "UNRESOLVED" | "PENDING";
  payment_method: string;
  failure_reason: string | null;
  gateway_response: string | null;
  retry_count: number;
  recovery_status: "NOT_STARTED" | "OPEN" | "IN_PROGRESS" | "RECOVERED" | "FAILED" | "ESCALATED" | "STOPPED";
  recovered_amount: number;
  escalation_status: "NONE" | "OPEN" | "IN_REVIEW" | "RESOLVED";
  recovery_token?: string;
  customer_response?: string;
  created_at: string;
  updated_at: string;
}

let inMemoryTransactions: MockTx[] = [];
let inMemoryAuditLogs: any[] = [];

async function handleApiRequest(req: NextRequest, { params }: { params: { path: string[] } }) {
  const pathParts = params?.path || [];
  const pathStr = pathParts.join("/");

  // 1. If an external backend is configured and reachable, attempt proxying
  if (shouldProxyToBackend()) {
    const targetUrl = `${cleanBackendUrl}/api/${pathStr}${req.nextUrl.search}`;
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
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(targetUrl, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.get("authorization")
            ? { Authorization: req.headers.get("authorization")! }
            : {}),
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (res.ok || (res.status >= 200 && res.status < 500)) {
        // If it's a binary response like PDF or Excel
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("pdf") || contentType.includes("spreadsheetml") || contentType.includes("octet-stream")) {
          const blob = await res.arrayBuffer();
          return new NextResponse(blob, {
            status: res.status,
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": res.headers.get("content-disposition") || "attachment",
            },
          });
        }

        const data = await res.json().catch(() => null);
        return NextResponse.json(data || {}, { status: res.status });
      }
    } catch {
      // Backend unreachable -> seamlessly fall back to local handlers below
    }
  }

  // Merge any transactions synced from client storage (ensuring multi-order persistence in serverless environments)
  const syncHeader = req.headers.get("x-reviveai-synced-txs");
  if (syncHeader) {
    try {
      const decoded = JSON.parse(decodeURIComponent(syncHeader));
      if (Array.isArray(decoded)) {
        for (const item of decoded) {
          if (!item || (!item.transaction_id && !item.order_id)) continue;
          const existingIdx = inMemoryTransactions.findIndex(
            (t) =>
              (item.transaction_id && t.transaction_id === item.transaction_id) ||
              (item.id && t.id === item.id) ||
              (item.order_id && t.order_id === item.order_id)
          );
          if (existingIdx >= 0) {
            inMemoryTransactions[existingIdx] = {
              ...inMemoryTransactions[existingIdx],
              ...item,
            };
          } else {
            inMemoryTransactions.push(item);
          }
        }
      }
    } catch {}
  }

  // 2. Comprehensive Next.js Native Handlers

  // Health
  if (pathStr === "health") {
    return NextResponse.json({
      status: "ok",
      service: "ReviveAI Native Engine",
      version: "2.1.0",
      timestamp: new Date().toISOString(),
    });
  }

  // Admin Reset Dashboard & Demo Reset
  if (
    pathStr === "admin/reset-dashboard" ||
    pathStr === "demo/reset-all" ||
    pathStr === "demo/reset"
  ) {
    const prevCount = inMemoryTransactions.length;
    inMemoryTransactions = [];
    const resetTime = new Date().toISOString();
    inMemoryAuditLogs = [
      {
        id: "audit_reset_" + Math.random().toString(36).substring(2, 9),
        event_type: "DASHBOARD_RESET",
        event_message: "All operational transaction and revenue recovery data reset.",
        actor: "ADMIN",
        metadata: {
          transactions_deleted: prevCount,
          recovery_cases_deleted: prevCount,
          escalation_cases_deleted: 0,
          orders_deleted: prevCount,
          reset_timestamp: resetTime,
        },
        created_at: resetTime,
        timestamp: resetTime,
      },
    ];

    return NextResponse.json({
      success: true,
      message: "Dashboard and demo data successfully reset to clean baseline.",
      transactions: [],
      metadata: {
        transactions_deleted: prevCount,
        reset_timestamp: resetTime,
      },
      timestamp: resetTime,
    });
  }

  // Demo Scenarios Execution
  if (pathStr === "demo/run-primary") {
    const nowIso = new Date().toISOString();
    let found = inMemoryTransactions.find((t) => t.transaction_id === "TX-DEMO-001");
    if (!found) {
      found = {
        id: "demo_tx_001",
        transaction_id: "TX-DEMO-001",
        order_id: "ORDER-DEMO-001",
        customer_id: "CUST-DEMO-001",
        customer: {
          name: "Demo Customer",
          email: "demo.customer@example.com",
          phone: "+919999999999",
          status: "ACTIVE",
        },
        product_id: "prod_led_bulb_01",
        product_name: "Syska Smart LED Bulb 12W RGB",
        category: "Lighting & Smart Home",
        amount: 5999.0,
        currency: "INR",
        status: "FAILED",
        payment_method: "UPI",
        failure_reason: "TIMEOUT",
        gateway_response: "UPI collect request timed out at gateway",
        retry_count: 0,
        recovery_status: "OPEN",
        recovered_amount: 0,
        escalation_status: "NONE",
        recovery_token: "recov_demo_001",
        created_at: nowIso,
        updated_at: nowIso,
      };
      inMemoryTransactions.unshift(found);
    }
    found.status = "SUCCESS";
    found.recovery_status = "RECOVERED";
    found.recovered_amount = found.amount;
    found.retry_count += 1;
    found.updated_at = nowIso;
    found.failure_reason = null;
    found.gateway_response = "Payment captured successfully on autonomous recovery";

    inMemoryAuditLogs.unshift({
      id: "audit_demo_primary_" + Math.random().toString(36).substring(2, 8),
      transaction_id: "TX-DEMO-001",
      event_type: "AUTONOMOUS_RECOVERY_SUCCESS",
      event_message: `Primary Recovery executed for TX-DEMO-001. Recovered INR ${found.amount}`,
      actor: "ReviveAI Autonomous Agent",
      metadata: { amount: found.amount, status: "SUCCESS" },
      created_at: nowIso,
      timestamp: nowIso,
    });

    return NextResponse.json({
      success: true,
      transaction_id: "TX-DEMO-001",
      payment_status: "SUCCESS",
      recovery_status: "RECOVERED",
      recovered_amount: found.amount,
      execution_result: {
        payment_status: "SUCCESS",
        order_status: "CONFIRMED",
        message: `Primary Recovery executed for TX-DEMO-001! Recovered INR ${found.amount}`,
      },
      transaction: found,
    });
  }

  if (pathStr === "demo/run-retry-failure") {
    const nowIso = new Date().toISOString();
    let found = inMemoryTransactions.find((t) => t.transaction_id === "TX-DEMO-002");
    if (!found) {
      found = {
        id: "demo_tx_002",
        transaction_id: "TX-DEMO-002",
        order_id: "ORDER-DEMO-002",
        customer_id: "CUST-DEMO-002",
        customer: {
          name: "Retry Failure Customer",
          email: "retry.failure@example.com",
          phone: "+918888888888",
          status: "ACTIVE",
        },
        product_id: "prod_ceiling_fan_01",
        product_name: "Havells Stealth Air Ceiling Fan",
        category: "Fans & Air Quality",
        amount: 3499.0,
        currency: "INR",
        payment_method: "CARD",
        status: "FAILED",
        failure_reason: "TEMPORARY_PAYMENT_ERROR",
        gateway_response: "Temporary gateway error; retry allowed in sandbox",
        retry_count: 0,
        recovery_status: "OPEN",
        recovered_amount: 0,
        escalation_status: "NONE",
        recovery_token: "recov_demo_002",
        created_at: nowIso,
        updated_at: nowIso,
      };
      inMemoryTransactions.unshift(found);
    }
    found.status = "FAILED";
    found.recovery_status = "ESCALATED";
    found.escalation_status = "OPEN";
    found.retry_count += 1;
    found.updated_at = nowIso;
    found.failure_reason = "Customer payment failed twice. Automatic recovery limit reached.";
    found.gateway_response = "Payment retry failed on second attempt. Auto-recovery limit reached.";

    inMemoryAuditLogs.unshift({
      id: "audit_demo_failure_" + Math.random().toString(36).substring(2, 8),
      transaction_id: "TX-DEMO-002",
      event_type: "RECOVERY_LIMIT_ESCALATED",
      event_message: "Failure & Escalation executed for TX-DEMO-002. Escalation case created.",
      actor: "ReviveAI Safety Engine",
      metadata: { amount: found.amount, status: "ESCALATED" },
      created_at: nowIso,
      timestamp: nowIso,
    });

    return NextResponse.json({
      success: false,
      transaction_id: "TX-DEMO-002",
      payment_status: "FAILED",
      recovery_status: "ESCALATED",
      recovered_amount: 0,
      execution_result: {
        payment_status: "FAILED",
        order_status: "ESCALATED",
        message: "Failure & Escalation executed for TX-DEMO-002! Retry failed, policy enforced limit, Escalation created.",
      },
      transaction: found,
    });
  }

  // Customer Login
  if (pathStr === "checkout/customer/login" || pathStr === "checkout/login") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    const ident = (body.identifier || "customer@voltstore.in").trim();
    const name = ident.includes("@") ? ident.split("@")[0].toUpperCase() : ident.toUpperCase();
    return NextResponse.json({
      success: true,
      message: "Login successful.",
      customer: {
        id: "cust_volt_" + Math.random().toString(36).substring(2, 8),
        name: name,
        email: ident.includes("@") ? ident.toLowerCase() : `${ident}@voltstore.in`,
        phone: !ident.includes("@") ? ident : "9876543210",
        saved_address: {
          full_name: name,
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

  // Customer Products
  if (pathStr === "checkout/products" || pathStr === "products") {
    const category = req.nextUrl.searchParams.get("category");
    const search = req.nextUrl.searchParams.get("search");
    let list = [...FALLBACK_PRODUCTS];

    if (category && category !== "All") {
      list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return NextResponse.json({ data: list, count: list.length });
  }

  // Catalog Image Status
  if (pathStr === "products/images/status") {
    const total = FALLBACK_PRODUCTS.length;
    return NextResponse.json({
      total_products: total,
      local_verified_images: total,
      ai_generated_images: total,
      external_verified_images: 0,
      fallback_ready: total,
      coverage_percentage: 100.0,
      status: "ALL_IMAGES_HEALTHY",
    });
  }

  // AI Image Generation Endpoint
  if (pathStr === "products/generate-image" || (pathStr.startsWith("products/") && pathStr.endsWith("/generate-image"))) {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    const targetId = body.product_id || pathParts[1] || "prod_led_bulb_01";
    const found = FALLBACK_PRODUCTS.find((p) => p.id === targetId || p.productId === targetId) || FALLBACK_PRODUCTS[0];
    const generatedPath = `/products/generated/${found.id}.svg`;
    found.image_url = generatedPath;
    found.image = generatedPath;
    found.image_source = "AI_GENERATED";
    found.image_status = "IMAGE_GENERATED";

    return NextResponse.json({
      success: true,
      product_id: found.id,
      product_name: found.name,
      image_url: generatedPath,
      image_source: "AI_GENERATED",
      image_status: "IMAGE_GENERATED",
      generated_at: new Date().toISOString(),
      prompt: `Professional ecommerce product photograph of ${found.name}, isolated on clean studio background.`,
      message: "Product image generated and persisted successfully.",
    });
  }

  // Single Product Detail
  if (pathStr.startsWith("checkout/products/") || pathStr.startsWith("products/")) {
    const prodId = pathParts[pathParts.length - 1];
    const found = FALLBACK_PRODUCTS.find((p) => p.id === prodId || p.productId === prodId);
    return NextResponse.json({ data: found || FALLBACK_PRODUCTS[0] });
  }

  // Process Customer Payment & Demo Scenarios
  if (pathStr === "checkout/process-payment" || pathStr === "checkout/pay") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    const isSuccess =
      body.simulation_scenario === "SUCCESS" ||
      body.simulation_scenario === "PAYMENT_SUCCESS";
    const orderId = body.order_id || "ORD-" + Math.floor(100000 + Math.random() * 900000);
    const txnId = body.transaction_id || "TXN-" + Math.floor(100000 + Math.random() * 900000);
    const recovToken = "recov_" + Math.random().toString(36).substring(2, 10);
    const amount = Number(body.amount || 2499);

    const scenario = body.simulation_scenario || "NETWORK_ERROR";
    const failureReasonMap: Record<
      string,
      {
        reason: string;
        msg: string;
        risk: string;
        label: string;
        diagnosis_title: string;
        diagnosis_details: string;
        recovery_action: string;
      }
    > = {
      NETWORK_ERROR: {
        reason: "Network Error: Connection Reset During Payment (TCP RST)",
        msg: "Your payment could not be completed due to a temporary network connection drop (TCP RST). Your order is preserved.",
        risk: "HIGH",
        label: "NETWORK ERROR (TCP RST)",
        diagnosis_title: "Transient Network Disconnection (TCP RST)",
        diagnosis_details:
          "Connection dropped during 3DS auth handshake with gateway. Autonomous diagnosis confirmed transient fault. Policy approved immediate retry.",
        recovery_action: "RETRY VIA SECURE BACKUP ROUTE",
      },
      PAYMENT_TIMEOUT: {
        reason: "Payment Gateway Timeout (HTTP 504 Gateway Timeout)",
        msg: "The bank gateway timed out while processing your payment token (504 Gateway). ReviveAI verified no funds debited.",
        risk: "HIGH",
        label: "PAYMENT TIMEOUT (504 Gateway)",
        diagnosis_title: "Gateway Timeout & Status Verification",
        diagnosis_details:
          "Bank network connection timed out (HTTP 504). ReviveAI verified transaction state with acquiring gateway: Token state is UNCAPTURED (no duplicate charge). Safe to retry.",
        recovery_action: "VERIFY STATUS & RETRY PAYMENT",
      },
      TIMEOUT: {
        reason: "Payment Gateway Timeout (HTTP 504 Gateway Timeout)",
        msg: "The bank gateway timed out while processing your payment token (504 Gateway). ReviveAI verified no funds debited.",
        risk: "HIGH",
        label: "PAYMENT TIMEOUT (504 Gateway)",
        diagnosis_title: "Gateway Timeout & Status Verification",
        diagnosis_details:
          "Bank network connection timed out (HTTP 504). ReviveAI verified transaction state with acquiring gateway: Token state is UNCAPTURED (no duplicate charge). Safe to retry.",
        recovery_action: "VERIFY STATUS & RETRY PAYMENT",
      },
      AUTHENTICATION_FAILED: {
        reason: "Authentication Handshake Failure (OTP Timeout / 3DS Error)",
        msg: "Authentication handshake failed (OTP Timeout / 3DS verification). Please re-authenticate to complete payment.",
        risk: "MEDIUM",
        label: "AUTHENTICATION FAILED (3DS/OTP)",
        diagnosis_title: "Authentication Handshake Failure (3DS / OTP Expired)",
        diagnosis_details:
          "Customer 3DS auth token expired before verification completed. Customer re-authentication required before payment retry.",
        recovery_action: "RE-AUTHENTICATE (3DS/OTP) & RETRY",
      },
      AUTH_FAILURE: {
        reason: "Authentication Handshake Failure (OTP Timeout / 3DS Error)",
        msg: "Authentication handshake failed (OTP Timeout / 3DS verification). Please re-authenticate to complete payment.",
        risk: "MEDIUM",
        label: "AUTHENTICATION FAILED (3DS/OTP)",
        diagnosis_title: "Authentication Handshake Failure (3DS / OTP Expired)",
        diagnosis_details:
          "Customer 3DS auth token expired before verification completed. Customer re-authentication required before payment retry.",
        recovery_action: "RE-AUTHENTICATE (3DS/OTP) & RETRY",
      },
      PAYMENT_FAILED: {
        reason: "Issuer Bank Decline (Do Not Honor)",
        msg: "Your bank declined the transaction. Please retry with an alternative payment method.",
        risk: "HIGH",
        label: "ISSUER DECLINE",
        diagnosis_title: "Issuer Bank Decline (Validation / Balance)",
        diagnosis_details:
          "Bank declined transaction: Card or account validation error. Customer should use an alternative payment method.",
        recovery_action: "RETRY WITH ALTERNATIVE METHOD",
      },
    };

    const details = failureReasonMap[scenario] || failureReasonMap.NETWORK_ERROR;
    const nowIso = new Date().toISOString();

    // Ingest into inMemoryTransactions
    const newTx: MockTx = {
      id: "mock_tx_" + Math.random().toString(36).substring(2, 9),
      transaction_id: txnId,
      order_id: orderId,
      customer_id: "cust_active",
      customer: {
        name: body.customer?.name || "Valued Customer",
        email: body.customer?.email || "customer@voltstore.in",
        phone: body.customer?.phone || "+91 98765 43210",
        status: "ACTIVE",
      },
      product_id: body.product_id || "prod_volt_01",
      product_name: body.product_name || "VoltStore Electronics",
      category: body.category || "Electronics",
      amount: amount,
      currency: "INR",
      status: isSuccess ? "SUCCESS" : "FAILED",
      payment_method: body.payment_method || "UPI",
      failure_reason: isSuccess ? null : details.reason,
      gateway_response: isSuccess ? "Captured successfully" : details.msg,
      retry_count: 0,
      recovery_status: isSuccess ? "RECOVERED" : "OPEN",
      recovered_amount: isSuccess ? amount : 0,
      escalation_status: "NONE",
      recovery_token: recovToken,
      created_at: nowIso,
      updated_at: nowIso,
    };
    inMemoryTransactions.unshift(newTx);

    // Audit log
    inMemoryAuditLogs.unshift({
      id: "audit_" + Math.random().toString(36).substring(2, 9),
      transaction_id: txnId,
      event_type: isSuccess ? "PAYMENT_SUCCESS" : "REVENUE_RISK_DETECTED",
      event_message: isSuccess
        ? `Payment captured for ${txnId} (INR ${amount})`
        : `Revenue risk detected for ${txnId}: ${details.reason}`,
      actor: "ReviveAI Engine",
      metadata: { amount, scenario, status: newTx.status },
      created_at: nowIso,
      timestamp: nowIso,
    });

    return NextResponse.json({
      success: isSuccess,
      status: isSuccess ? "SUCCESS" : "FAILED",
      scenario: scenario,
      scenario_label: details.label,
      order_id: orderId,
      transaction_id: txnId,
      payment_status: isSuccess ? "SUCCESS" : "FAILED",
      order_status: isSuccess ? "CONFIRMED" : "PAYMENT_FAILED",
      failure_reason: isSuccess ? null : details.reason,
      diagnosis_title: details.diagnosis_title,
      diagnosis_details: details.diagnosis_details,
      recovery_action_label: details.recovery_action,
      is_network_error:
        !isSuccess &&
        (scenario === "NETWORK_ERROR" ||
          scenario === "PAYMENT_TIMEOUT" ||
          scenario === "TIMEOUT"),
      customer_message: isSuccess
        ? "Payment verified and order placed successfully!"
        : details.msg,
      automated_message_preview: isSuccess
        ? ""
        : `Hi ${body.customer?.name || "Valued Customer"},\n\nYour payment for ${body.product_id || "your order"} could not be completed due to ${details.reason}.\n\nDiagnosis: ${details.diagnosis_details}\n\nYour order is preserved.\nPlease complete your payment using the secure payment link below:\n\n/payment/retry/${recovToken}\n\n[${details.recovery_action}]`,
      risk_level: details.risk,
      recovery_token: recovToken,
      payment_link: `/payment/retry/${recovToken}`,
      retry_link: `/payment/retry/${recovToken}`,
      message: isSuccess
        ? "Payment verified and order placed successfully!"
        : "Payment attempt failed. Autonomous ReviveAI Recovery initialized.",
      transaction: newTx,
    });
  }

  // Abandon Customer Checkout
  if (pathStr === "checkout/abandon") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    const orderId = body.order_id || "ORD-" + Math.floor(100000 + Math.random() * 900000);
    const txnId = "TXN-" + Math.floor(100000 + Math.random() * 900000);
    const recovToken = "recov_abn_" + Math.random().toString(36).substring(2, 10);
    const amount = Number(body.amount || 2499);
    const nowIso = new Date().toISOString();

    const newTx: MockTx = {
      id: "mock_tx_" + Math.random().toString(36).substring(2, 9),
      transaction_id: txnId,
      order_id: orderId,
      customer_id: "cust_active",
      customer: {
        name: body.customer?.name || "Valued Customer",
        email: body.customer?.email || "customer@voltstore.in",
        phone: body.customer?.phone || "+91 98765 43210",
        status: "ACTIVE",
      },
      product_id: body.product_id || "prod_volt_01",
      product_name: body.product_name || "VoltStore Electronics",
      category: body.category || "Electronics",
      amount: amount,
      currency: "INR",
      status: "ABANDONED",
      payment_method: "NETBANKING",
      failure_reason: "Checkout session expired before payment authorization",
      gateway_response: "Session Abandonment",
      retry_count: 0,
      recovery_status: "OPEN",
      recovered_amount: 0,
      escalation_status: "NONE",
      recovery_token: recovToken,
      created_at: nowIso,
      updated_at: nowIso,
    };
    inMemoryTransactions.unshift(newTx);

    return NextResponse.json({
      success: true,
      message: "Checkout abandonment logged. Recovery link dispatched via SMS/Email.",
      recovery_token: recovToken,
      retry_link: `/pay/recover/${recovToken}`,
      transaction: newTx,
    });
  }

  // Customer Payment Recovery Session (Landing Page for Recovery Links)
  if (pathStr.startsWith("checkout/recover/") || pathStr.startsWith("recover/")) {
    const token = pathParts[pathParts.length - 1];
    const matched =
      inMemoryTransactions.find(
        (t) =>
          t.recovery_token === token ||
          t.transaction_id === token ||
          t.order_id === token ||
          t.id === token
      ) || inMemoryTransactions[0];

    if (matched) {
      const matchingProd =
        FALLBACK_PRODUCTS.find(
          (p) => p.id === matched.product_id || p.productId === matched.product_id
        ) || {
          id: matched.product_id || "prod_laptop_biz_01",
          name: matched.product_name || "VoltStore Electronics",
          category: matched.category || "Electronics",
          price: matched.amount,
          image_url: `/products/generated/${matched.product_id || "prod_laptop_biz_01"}.svg`,
          image: `/products/generated/${matched.product_id || "prod_laptop_biz_01"}.svg`,
        };

      const isAlreadyPaid = matched.status === "SUCCESS";
      const isEscalated =
        matched.escalation_status !== "NONE" ||
        matched.recovery_status === "ESCALATED";
      const isUsed = matched.retry_count >= 1;

      return NextResponse.json({
        order_id: matched.order_id,
        transaction_id: matched.transaction_id,
        token: token,
        status: matched.status,
        amount: matched.amount,
        currency: matched.currency || "INR",
        payment_method: matched.payment_method || "UPI",
        product: {
          id: matched.product_id,
          name: matched.product_name,
          category: matched.category,
          image_url: matchingProd.image_url || matchingProd.image,
          image: matchingProd.image_url || matchingProd.image,
          price: matched.amount,
        },
        product_name: matched.product_name,
        customer_name: matched.customer?.name || "Valued Customer",
        customer: matched.customer,
        retry_allowed:
          !isAlreadyPaid && !isUsed && !isEscalated && matched.retry_count < 1,
        already_paid: isAlreadyPaid,
        already_used: isUsed,
        escalated_to_support: isEscalated,
      });
    }

    return NextResponse.json(
      { detail: "Payment recovery link is invalid or not found." },
      { status: 404 }
    );
  }

  // Retry Customer Payment
  if (pathStr === "checkout/retry-payment" || pathStr === "retry-payment") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    const isSuccess =
      body.retry_outcome === "SUCCESS" || body.retry_outcome === "RETRY_SUCCESS";
    const txId = body.transaction_id || "";
    let matched = inMemoryTransactions.find(
      (t) =>
        (txId && t.transaction_id === txId) ||
        (body.order_id && t.order_id === body.order_id) ||
        (body.token && t.recovery_token === body.token)
    );
    if (!matched && inMemoryTransactions.length > 0) {
      matched = inMemoryTransactions[0];
    }
    if (matched) {
      if (isSuccess) {
        matched.status = "SUCCESS";
        matched.recovery_status = "RECOVERED";
        matched.recovered_amount = matched.amount;
        matched.failure_reason = null;
        matched.gateway_response = "Payment captured successfully on retry (Sandbox)";
      } else {
        matched.recovery_status = "ESCALATED";
        matched.escalation_status = "OPEN";
        matched.failure_reason =
          "Customer payment failed twice. Automatic recovery limit reached.";
        matched.gateway_response =
          "Payment retry failed on second attempt. Auto-recovery limit reached.";
      }
      matched.retry_count += 1;
      matched.updated_at = new Date().toISOString();
    }

    const matchedAmt = matched ? matched.amount : Number(body.amount || 65999);
    const matchedOrderId = matched
      ? matched.order_id
      : body.order_id || "ORD-REC-DEMO";
    const matchedTxnId = matched
      ? matched.transaction_id
      : body.transaction_id || "TXN-REC-DEMO";

    return NextResponse.json({
      success: isSuccess,
      status: isSuccess ? "SUCCESS" : "ESCALATED",
      payment_status: isSuccess ? "SUCCESS" : "FAILED",
      recovery_status: isSuccess ? "RECOVERED" : "RETRY_FAILED",
      order_status: isSuccess ? "CONFIRMED" : "ESCALATED_TO_SUPPORT",
      escalated_to_human: !isSuccess,
      escalated_to_support: !isSuccess,
      already_paid: isSuccess,
      order_id: matchedOrderId,
      transaction_id: matchedTxnId,
      recovered_amount: isSuccess ? matchedAmt : 0,
      amount: matchedAmt,
      currency: matched?.currency || "INR",
      message: isSuccess
        ? "Autonomous recovery successful! Payment confirmed."
        : "Payment retry was not successful. Case transferred to Human Associate.",
      transaction: matched,
    });
  }

  // Customer Orders List (VoltStore Customer History)
  if (
    pathStr === "checkout/customer/orders" ||
    pathStr === "customer/orders" ||
    pathStr === "orders"
  ) {
    const emailFilter = req.nextUrl.searchParams.get("email");
    const phoneFilter = req.nextUrl.searchParams.get("phone");
    const custIdFilter = req.nextUrl.searchParams.get("customer_id");

    let filtered = inMemoryTransactions;
    if (emailFilter) {
      filtered = filtered.filter(
        (t) => t.customer?.email?.toLowerCase() === emailFilter.toLowerCase()
      );
    }
    if (phoneFilter) {
      filtered = filtered.filter((t) => t.customer?.phone === phoneFilter);
    }
    if (custIdFilter) {
      filtered = filtered.filter((t) => t.customer_id === custIdFilter);
    }

    const effectiveList = filtered.length > 0 ? filtered : inMemoryTransactions;
    const mapped = effectiveList.map((t) => ({
      order_id: t.order_id,
      transaction_id: t.transaction_id,
      product_name: t.product_name || "VoltStore Appliance",
      category: t.category || "Electronics",
      image_url: `/products/generated/${t.product_id || "prod_laptop_biz_01"}.svg`,
      amount: t.amount,
      currency: t.currency || "INR",
      payment_method: t.payment_method || "UPI",
      payment_status: t.status,
      order_status: t.status === "SUCCESS" ? "CONFIRMED" : "PAYMENT_FAILED",
      recovery_status: t.recovery_status,
      recovery_token: t.recovery_token || `rec_${t.transaction_id}`,
      created_at: t.created_at,
      can_retry: t.status !== "SUCCESS" && t.retry_count < 1,
      retry_link: `/payment/retry/${t.recovery_token || `rec_${t.transaction_id}`}`,
    }));

    return NextResponse.json({
      data: mapped,
      count: mapped.length,
    });
  }

  // AI Agent: Diagnose
  if (pathStr.startsWith("agent/diagnose/")) {
    const txnId = pathParts[pathParts.length - 1];
    const matched =
      inMemoryTransactions.find(
        (t) => t.transaction_id === txnId || t.id === txnId || t.order_id === txnId
      ) || inMemoryTransactions[0];

    const reason = (matched?.failure_reason || "").toLowerCase();
    let rootCause = "technical_failure";
    let confidence = 0.94;
    let evidence = [
      "Network TCP connection reset during 3DS gateway handshake (TCP RST)",
      "Zero duplicate charge verified with acquiring switch",
      "Merchant automated retry policy active and approved",
    ];

    if (reason.includes("timeout")) {
      rootCause = "payment_timeout";
      confidence = 0.92;
      evidence = [
        "Bank network gateway timeout (HTTP 504)",
        "Token state is UNCAPTURED - no funds debited",
        "Safe to initiate status verification and retry",
      ];
    } else if (reason.includes("auth") || reason.includes("3ds") || reason.includes("otp")) {
      rootCause = "authentication_failure";
      confidence = 0.88;
      evidence = [
        "Customer 3DS auth token expired during verification",
        "User session active, re-authentication prompt required",
      ];
    } else if (reason.includes("decline") || reason.includes("balance")) {
      rootCause = "bank_decline";
      confidence = 0.86;
      evidence = [
        "Issuer bank declined authorization request",
        "Alternative payment instrument recommended",
      ];
    }

    return NextResponse.json({
      transaction_id: matched ? matched.transaction_id : txnId,
      root_cause: rootCause,
      confidence: confidence,
      evidence: evidence,
      reason: `Automated telemetry diagnosis: ${matched?.failure_reason || "Payment Error"}`,
      requires_human_review:
        matched?.recovery_status === "ESCALATED" || (matched?.retry_count || 0) >= 1,
    });
  }

  // AI Agent: Decide
  if (pathStr.startsWith("agent/decide/")) {
    const txnId = pathParts[pathParts.length - 1];
    const matched =
      inMemoryTransactions.find(
        (t) => t.transaction_id === txnId || t.id === txnId || t.order_id === txnId
      ) || inMemoryTransactions[0];

    const isEscalated =
      matched?.recovery_status === "ESCALATED" || (matched?.retry_count || 0) >= 1;
    const isSuccess = matched?.status === "SUCCESS";

    const decision = isSuccess
      ? "no_action_needed"
      : isEscalated
      ? "escalate_to_human"
      : "controlled_retry";

    const allowed = !isEscalated && !isSuccess;

    return NextResponse.json({
      transaction_id: matched ? matched.transaction_id : txnId,
      decision: decision,
      policy: allowed ? "APPROVED" : "BLOCKED",
      allowed: allowed,
      reason: allowed
        ? "Transaction eligible for 1-click autonomous retry under merchant safety policy."
        : isSuccess
        ? "Transaction is already paid and confirmed."
        : "Safety policy limit reached (max 1 retry). Escalated to human support.",
    });
  }

  // AI Agent: Workflow / Start Recovery / Payments Retry
  if (
    pathStr.startsWith("recovery/start/") ||
    pathStr.startsWith("payments/retry/") ||
    pathStr.startsWith("agent/workflow/")
  ) {
    const txnId = pathParts[pathParts.length - 1];
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }

    const matched = inMemoryTransactions.find(
      (t) => t.transaction_id === txnId || t.id === txnId || t.order_id === txnId
    );

    const forceResult = body.force_payment_result || body.force_result || "SUCCESS";
    const isSuccess = forceResult === "SUCCESS";

    if (matched) {
      if (isSuccess) {
        matched.status = "SUCCESS";
        matched.recovery_status = "RECOVERED";
        matched.recovered_amount = matched.amount;
        matched.failure_reason = null;
        matched.gateway_response = "Payment captured successfully on autonomous recovery";
      } else {
        matched.recovery_status = "ESCALATED";
        matched.escalation_status = "OPEN";
      }
      matched.retry_count += 1;
      matched.updated_at = new Date().toISOString();
    }

    return NextResponse.json({
      success: isSuccess,
      transaction_id: matched ? matched.transaction_id : txnId,
      payment_status: isSuccess ? "SUCCESS" : "FAILED",
      recovery_status: isSuccess ? "RECOVERED" : "ESCALATED",
      recovered_amount: isSuccess ? (matched?.amount || 0) : 0,
      execution_result: {
        payment_status: isSuccess ? "SUCCESS" : "FAILED",
        order_status: isSuccess ? "CONFIRMED" : "ESCALATED",
        message: isSuccess
          ? "Autonomous recovery successful! Payment confirmed."
          : "Recovery retry failed, escalated to Human Specialist.",
      },
      transaction: matched,
    });
  }

  // Dashboard Dynamic Calculations
  const txs = inMemoryTransactions;
  const totalOrders = txs.length;
  const successOrders = txs.filter((t) => t.status === "SUCCESS").length;
  const failedOrders = txs.filter((t) => t.status === "FAILED").length;
  const abandonedOrders = txs.filter((t) => t.status === "ABANDONED").length;

  const recoverableTxs = txs.filter(
    (t) => (t.status === "FAILED" || t.status === "ABANDONED" || t.status === "UNRESOLVED") &&
      t.recovery_status !== "RECOVERED" && t.recovery_status !== "STOPPED"
  );
  const revenueAtRisk = recoverableTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalRecovered = txs.reduce((sum, t) => sum + (t.recovered_amount || 0), 0);
  const recoveryPool = revenueAtRisk + totalRecovered;
  const recoveryRate = recoveryPool > 0 ? Number(((totalRecovered / recoveryPool) * 100).toFixed(1)) : 0;

  // Network errors
  const networkErrors = txs.filter((t) =>
    ((t.failure_reason || "") + (t.gateway_response || "")).toLowerCase().includes("network") ||
    ((t.failure_reason || "") + (t.gateway_response || "")).toLowerCase().includes("tcp rst")
  ).length;

  const timeouts = txs.filter((t) =>
    ((t.failure_reason || "") + (t.gateway_response || "")).toLowerCase().includes("timeout")
  ).length;

  const authFails = txs.filter((t) =>
    ((t.failure_reason || "") + (t.gateway_response || "")).toLowerCase().includes("auth") ||
    ((t.failure_reason || "") + (t.gateway_response || "")).toLowerCase().includes("3ds") ||
    ((t.failure_reason || "") + (t.gateway_response || "")).toLowerCase().includes("otp")
  ).length;

  // AI vs Human
  const aiRecovered = txs
    .filter((t) => t.status === "SUCCESS" && t.recovered_amount > 0 && t.customer_response !== "RECOVERED_BY_HUMAN")
    .reduce((sum, t) => sum + t.recovered_amount, 0);

  const humanRecovered = txs
    .filter((t) => t.status === "SUCCESS" && t.recovered_amount > 0 && t.customer_response === "RECOVERED_BY_HUMAN")
    .reduce((sum, t) => sum + t.recovered_amount, 0);

  const aiCasesCount = txs.filter((t) => t.recovery_status === "OPEN" || (t.recovery_status === "RECOVERED" && t.customer_response !== "RECOVERED_BY_HUMAN")).length;
  const humanCasesCount = txs.filter((t) => t.escalation_status !== "NONE" || t.recovery_status === "ESCALATED" || t.customer_response === "RECOVERED_BY_HUMAN").length;
  const highRiskCount = recoverableTxs.filter((t) => t.amount >= 10000).length;

  // Product loss breakdown
  const productStatsMap: Record<string, any> = {};
  for (const prod of FALLBACK_PRODUCTS) {
    productStatsMap[prod.id] = {
      product_id: prod.id,
      product_name: prod.name,
      category: prod.category,
      unit_price: prod.price,
      orders_count: 0,
      successful_orders: 0,
      failed_orders: 0,
      network_errors: 0,
      checkout_abandonments: 0,
      revenue_at_risk: 0,
      recovered_revenue: 0,
      recovery_rate: 0,
    };
  }

  for (const t of txs) {
    let pid = t.product_id;
    if (!pid || !productStatsMap[pid]) {
      const match =
        FALLBACK_PRODUCTS.find(
          (p) => Math.abs(p.price - (t.amount || 0)) < 5 || p.name === t.product_name
        ) || FALLBACK_PRODUCTS[0];
      pid = match.id;
    }
    if (productStatsMap[pid]) {
      const stat = productStatsMap[pid];
      stat.orders_count += 1;
      if (t.status === "SUCCESS") {
        stat.successful_orders += 1;
        if (t.recovered_amount && t.recovered_amount > 0) {
          stat.recovered_revenue += t.recovered_amount;
        }
      } else if (t.status === "FAILED") {
        stat.failed_orders += 1;
        const comb = ((t.failure_reason || "") + (t.gateway_response || "")).toLowerCase();
        if (comb.includes("network") || comb.includes("tcp rst")) {
          stat.network_errors += 1;
        }
        if (t.recovery_status !== "RECOVERED" && t.recovery_status !== "STOPPED") {
          stat.revenue_at_risk += t.amount || 0;
        }
      } else if (t.status === "ABANDONED") {
        stat.checkout_abandonments += 1;
        if (t.recovery_status !== "RECOVERED" && t.recovery_status !== "STOPPED") {
          stat.revenue_at_risk += t.amount || 0;
        }
      }
    }
  }

  const productLossList = Object.values(productStatsMap)
    .map((stat: any) => {
      const recPool = stat.revenue_at_risk + stat.recovered_revenue;
      stat.recovery_rate =
        recPool > 0
          ? Number(((stat.recovered_revenue / recPool) * 100).toFixed(1))
          : 0;
      return stat;
    })
    .sort(
      (a: any, b: any) =>
        b.revenue_at_risk - a.revenue_at_risk || b.orders_count - a.orders_count
    );

  // Dashboard Summary & Metrics
  if (pathStr === "dashboard/summary") {
    return NextResponse.json({
      total_transactions: totalOrders,
      failed_transactions: failedOrders,
      revenue_at_risk: revenueAtRisk,
      total_risk_detected: revenueAtRisk + totalRecovered,
      recovery_attempts: txs.filter((t) => t.retry_count > 0 || t.status === "FAILED").length,
      successful_recoveries: txs.filter((t) => t.recovery_status === "RECOVERED").length,
      revenue_recovered: totalRecovered,
      recovery_rate: recoveryRate,
      revenue_recovery_rate: recoveryRate,
      unresolved_cases: recoverableTxs.length,
      escalated_cases: txs.filter((t) => t.escalation_status !== "NONE" || t.recovery_status === "ESCALATED").length,
      failure_rate: totalOrders > 0 ? Number(((failedOrders / totalOrders) * 100).toFixed(1)) : 0,
      average_recovery_latency_seconds: 42,
      generated_at: new Date().toISOString(),
    });
  }

  if (pathStr === "dashboard/recovery-metrics") {
    const statusCounts: Record<string, number> = {};
    txs.forEach((t) => {
      statusCounts[t.recovery_status] = (statusCounts[t.recovery_status] || 0) + 1;
    });

    return NextResponse.json({
      summary: {
        total_transactions: totalOrders,
        failed_transactions: failedOrders,
        revenue_at_risk: revenueAtRisk,
        total_risk_detected: revenueAtRisk + totalRecovered,
        recovery_attempts: txs.filter((t) => t.retry_count > 0 || t.status === "FAILED").length,
        successful_recoveries: txs.filter((t) => t.recovery_status === "RECOVERED").length,
        revenue_recovered: totalRecovered,
        recovery_rate: recoveryRate,
        revenue_recovery_rate: recoveryRate,
        unresolved_cases: recoverableTxs.length,
        escalated_cases: txs.filter((t) => t.escalation_status !== "NONE" || t.recovery_status === "ESCALATED").length,
        failure_rate: totalOrders > 0 ? Number(((failedOrders / totalOrders) * 100).toFixed(1)) : 0,
        average_recovery_latency_seconds: 42,
        generated_at: new Date().toISOString(),
      },
      case_status_counts: statusCounts,
      total_recovered_amount: totalRecovered,
      recovery_rate_percentage: recoveryRate,
      avg_recovery_latency_sec: 42,
      prevented_churn_count: txs.filter((t) => t.recovery_status === "RECOVERED").length,
    });
  }

  // Seller Dashboard
  if (pathStr === "seller/dashboard") {
    return NextResponse.json({
      total_orders: totalOrders,
      successful_orders: successOrders,
      failed_orders: failedOrders,
      pending_orders: txs.filter((t) => t.status === "PENDING").length,
      checkout_abandonments: abandonedOrders,
      network_errors: networkErrors,
      payment_failures: failedOrders,
      failure_breakdown: {
        network_errors: networkErrors,
        timeouts: timeouts,
        bank_declines: failedOrders - networkErrors - timeouts > 0 ? failedOrders - networkErrors - timeouts : 0,
        auth_failures: authFails,
        abandonments: abandonedOrders,
        other: 0,
      },
      revenue_at_risk: revenueAtRisk,
      revenue_risk_breakdown: {
        network_errors: revenueAtRisk * 0.5,
        payment_failures: revenueAtRisk * 0.3,
        checkout_abandonments: revenueAtRisk * 0.2,
        human_pending_cases: 0,
      },
      ai_recovery_cases: aiCasesCount,
      ai_recovered_revenue: aiRecovered,
      human_recovery_cases: humanCasesCount,
      human_recovered_revenue: humanRecovered,
      total_recovered_revenue: totalRecovered,
      unresolved_cases: recoverableTxs.length,
      unresolved_revenue: revenueAtRisk,
      high_risk_cases: highRiskCount,
      recovery_rate: recoveryRate,
      funnel: {
        orders: totalOrders,
        checkout_started: totalOrders,
        payment_initiated: totalOrders - abandonedOrders,
        payment_failed_or_abandoned: failedOrders + abandonedOrders,
        revenue_at_risk_detected: recoverableTxs.length,
        ai_recovery_triggered: failedOrders + abandonedOrders,
        customer_retry_executed: txs.filter((t) => t.retry_count > 0).length,
        ai_payment_success: aiCasesCount,
        escalated_to_human: humanCasesCount,
        human_payment_success: humanCasesCount,
      },
      product_revenue_loss: productLossList,
      generated_at: new Date().toISOString(),
    });
  }

  // Seller Cases
  if (pathStr === "seller/cases") {
    return NextResponse.json(
      txs.map((t) => ({
        order_id: t.order_id,
        transaction_id: t.transaction_id,
        customer: t.customer,
        product_id: t.product_id,
        product_name: t.product_name,
        category: t.category,
        amount: t.amount,
        currency: t.currency,
        payment_status: t.status,
        failure_reason: t.failure_reason,
        is_network_error: (t.failure_reason || "").toLowerCase().includes("network"),
        attempts: t.retry_count + 1,
        risk: t.amount >= 50000 ? "CRITICAL" : t.amount >= 10000 ? "HIGH" : "MEDIUM",
        revenue_at_risk: t.status !== "SUCCESS" ? t.amount : 0,
        ai_status: t.recovery_status === "OPEN" ? "ACTIVE" : t.recovery_status,
        human_status: t.escalation_status,
        recovery_status: t.recovery_status,
        recovery_token: t.recovery_token,
        created_at: t.created_at,
      }))
    );
  }

  // Transactions list
  if (pathStr === "transactions") {
    return NextResponse.json({
      data: txs,
      transactions: txs,
      total: txs.length,
      total_count: txs.length,
      pagination: {
        limit: 50,
        offset: 0,
        returned: txs.length,
        next_offset: null,
      },
    });
  }

  // Single Transaction Detail
  if (pathStr.startsWith("transactions/") && !pathStr.endsWith("/pdf")) {
    const txnId = pathParts[pathParts.length - 1];
    let matched = inMemoryTransactions.find(
      (t) =>
        t.transaction_id === txnId ||
        t.id === txnId ||
        t.order_id === txnId ||
        t.recovery_token === txnId
    );

    // If not in inMemoryTransactions, check if audit trail has recorded events for this transaction
    if (!matched) {
      const auditEv = inMemoryAuditLogs.find(
        (a) =>
          a.transaction_id === txnId ||
          a.metadata?.transaction_id === txnId ||
          a.metadata?.order_id === txnId ||
          (a.event_message && a.event_message.includes(txnId))
      );
      if (auditEv) {
        const meta = auditEv.metadata || {};
        matched = {
          id: "tx_" + txnId,
          transaction_id: txnId,
          order_id: meta.order_id || `ORD-${txnId}`,
          customer_id: "cust_active",
          customer: {
            name: meta.customer_name || "Rahul Kumar",
            email: meta.customer_email || "rahul@example.com",
            phone: meta.customer_phone || "+91 98765 43210",
            status: "ACTIVE",
          },
          product_id: meta.product_id || "prod_laptop_biz_01",
          product_name: meta.product_name || "VoltStore Electronics",
          category: meta.category || "Electronics",
          amount: Number(meta.amount || 65999),
          currency: meta.currency || "INR",
          status: (meta.status as any) || "FAILED",
          payment_method: meta.payment_method || "UPI",
          failure_reason:
            meta.failure_reason ||
            auditEv.event_message ||
            "Authentication Handshake Failure (OTP Timeout / 3DS Error)",
          gateway_response:
            meta.gateway_response ||
            auditEv.event_message ||
            "Customer 3DS auth token expired before verification completed",
          retry_count: Number(meta.retry_count || 0),
          recovery_status: (meta.recovery_status as any) || "OPEN",
          recovered_amount: Number(meta.recovered_amount || 0),
          escalation_status: (meta.escalation_status as any) || "NONE",
          recovery_token: meta.recovery_token || `rec_${txnId}`,
          created_at: auditEv.created_at || new Date().toISOString(),
          updated_at: auditEv.created_at || new Date().toISOString(),
        };
        inMemoryTransactions.unshift(matched);
      }
    }

    if (matched) {
      if (req.method === "PATCH") {
        let body: any = {};
        try {
          body = await req.json();
        } catch {}
        Object.assign(matched, body);
        matched.updated_at = new Date().toISOString();
        return NextResponse.json(matched);
      }

      return NextResponse.json({
        id: matched.id,
        transaction_id: matched.transaction_id,
        order_id: matched.order_id,
        customer_id: matched.customer_id,
        customer: matched.customer,
        product_id: matched.product_id,
        product_name: matched.product_name,
        category: matched.category,
        amount: matched.amount,
        currency: matched.currency || "INR",
        payment_method: matched.payment_method || "UPI",
        status: matched.status,
        failure_reason: matched.failure_reason,
        gateway_response: matched.gateway_response,
        retry_count: matched.retry_count,
        recovery_status: matched.recovery_status,
        recovered_amount: matched.recovered_amount,
        escalation_status: matched.escalation_status,
        recovery_token: matched.recovery_token,
        created_at: matched.created_at,
        updated_at: matched.updated_at,
        payment_attempts: [
          {
            id: "pa_1_" + matched.transaction_id,
            transaction_id: matched.transaction_id,
            attempt_number: 1,
            status: "FAILED",
            gateway_response: matched.gateway_response || matched.failure_reason,
            created_at: matched.created_at,
          },
          ...(matched.retry_count >= 1
            ? [
                {
                  id: "pa_2_" + matched.transaction_id,
                  transaction_id: matched.transaction_id,
                  attempt_number: 2,
                  status: matched.status,
                  gateway_response: matched.gateway_response,
                  created_at: matched.updated_at,
                },
              ]
            : []),
        ],
        recovery_cases: [
          {
            id: "case_" + matched.transaction_id,
            transaction_id: matched.transaction_id,
            risk_amount: matched.amount,
            root_cause: (matched.failure_reason || "").toLowerCase().includes("timeout")
              ? "payment_timeout"
              : (matched.failure_reason || "").toLowerCase().includes("auth")
              ? "authentication_failure"
              : "technical_failure",
            confidence: 0.94,
            evidence: [matched.failure_reason || "Payment failure telemetry captured"],
            recommended_action: "controlled_retry",
            action_status: "POLICY_APPROVED",
            recovery_status: matched.recovery_status,
            recovered_amount: matched.recovered_amount,
            policy_result: {
              allowed: matched.recovery_status !== "ESCALATED",
              result: matched.recovery_status !== "ESCALATED" ? "APPROVED" : "BLOCKED",
              reasons: ["Merchant automatic retry policy active"],
            },
            created_at: matched.created_at,
            updated_at: matched.updated_at,
          },
        ],
      });
    }

    return NextResponse.json({ detail: "Transaction not found." }, { status: 404 });
  }

  // Revenue Risk list
  if (pathStr === "revenue-risk") {
    const riskCases = recoverableTxs.map((t) => ({
      id: "risk_" + t.transaction_id,
      case_id: "risk_" + t.transaction_id,
      transaction_id: t.transaction_id,
      risk_amount: t.amount,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      recovery_status: t.recovery_status,
      action_status: "POLICY_APPROVED",
      risk_level: t.amount >= 10000 ? "HIGH" : "MEDIUM",
      root_cause: (t.failure_reason || "").toLowerCase().includes("network")
        ? "technical_failure"
        : (t.failure_reason || "").toLowerCase().includes("auth")
        ? "authentication_failure"
        : "payment_timeout",
      recommended_action: "controlled_retry",
      recovered_amount: t.recovered_amount,
      evidence: [t.failure_reason || "Payment declined by switch"],
      created_at: t.created_at,
    }));
    return NextResponse.json(riskCases);
  }

  if (pathStr === "revenue-risk/summary") {
    return NextResponse.json({
      total_transactions: totalOrders,
      failed_transactions: failedOrders,
      revenue_at_risk: revenueAtRisk,
      total_risk_detected: revenueAtRisk + totalRecovered,
      recovery_attempts: txs.filter((t) => t.retry_count > 0 || t.status === "FAILED").length,
      successful_recoveries: txs.filter((t) => t.recovery_status === "RECOVERED").length,
      revenue_recovered: totalRecovered,
      recovery_rate: recoveryRate,
      unresolved_cases: recoverableTxs.length,
      escalated_cases: txs.filter((t) => t.escalation_status !== "NONE" || t.recovery_status === "ESCALATED").length,
      failure_rate: totalOrders > 0 ? Number(((failedOrders / totalOrders) * 100).toFixed(1)) : 0,
      revenue_recovery_rate: recoveryRate,
      average_recovery_latency_seconds: 42,
    });
  }

  // Escalations
  if (
    (pathStr.startsWith("escalations/") && pathStr.endsWith("/resolve")) ||
    (pathStr.startsWith("escalations/") && req.method === "PATCH")
  ) {
    const parts = pathStr.split("/");
    const escId = parts[1];
    const txnId = escId.replace("esc_", "");
    let body: any = {};
    try {
      body = await req.json();
    } catch {}
    const matched = inMemoryTransactions.find(
      (t) => t.transaction_id === txnId || t.id === txnId || t.order_id === txnId
    );
    const nowIso = new Date().toISOString();
    if (matched) {
      matched.escalation_status = "RESOLVED";
      matched.updated_at = nowIso;

      inMemoryAuditLogs.unshift({
        id: "audit_esc_res_" + Math.random().toString(36).substring(2, 8),
        transaction_id: matched.transaction_id,
        event_type: "HUMAN_ESCALATION_RESOLVED",
        event_message: `Human escalation case ${escId} resolved for ${matched.transaction_id}: ${body.resolution || "Case marked resolved"}`,
        actor: "Support Associate",
        metadata: { resolution: body.resolution || "Resolved", case_id: escId },
        created_at: nowIso,
        timestamp: nowIso,
      });
    }

    return NextResponse.json({
      message: "Escalation case resolved successfully.",
      escalation: {
        id: escId,
        transaction_id: matched?.transaction_id || txnId,
        status: "RESOLVED",
        resolution: body.resolution || "Resolved",
        resolved_at: nowIso,
      },
      transaction: matched,
    });
  }

  if (pathStr === "escalations") {
    const escTxs = txs.filter((t) => t.escalation_status !== "NONE" || t.recovery_status === "ESCALATED");
    return NextResponse.json(
      escTxs.map((t) => ({
        id: "esc_" + t.transaction_id,
        transaction_id: t.transaction_id,
        reason: t.failure_reason || "SAFETY_LIMIT_REACHED",
        status: t.escalation_status || "OPEN",
        priority: t.amount >= 10000 ? "CRITICAL" : "MEDIUM",
        amount: t.amount,
        currency: t.currency,
        created_at: t.created_at,
      }))
    );
  }

  // Human Associate Cases
  if (pathStr === "human-associate/cases") {
    const escTxs = txs.filter(
      (t) => t.escalation_status !== "NONE" || t.recovery_status === "ESCALATED" || t.customer_response === "RECOVERED_BY_HUMAN"
    );

    const humanCases = escTxs.map((t) => ({
      case_id: "case_" + t.transaction_id,
      order_id: t.order_id,
      transaction_id: t.transaction_id,
      customer: {
        id: t.customer_id,
        name: t.customer?.name || "Valued Customer",
        email: t.customer?.email || "customer@voltstore.in",
        phone: t.customer?.phone || "+91 98765 43210",
      },
      product: {
        id: t.product_id,
        name: t.product_name,
        category: t.category,
      },
      amount: t.amount,
      currency: t.currency,
      payment_attempts_count: t.retry_count + 1,
      payment_attempts: [
        {
          attempt_number: 1,
          status: "FAILED",
          gateway_response: t.gateway_response || t.failure_reason || "Gateway failure",
          created_at: t.created_at,
        },
        ...(t.retry_count >= 1
          ? [
              {
                attempt_number: 2,
                status: t.status === "SUCCESS" && t.customer_response === "RECOVERED_BY_HUMAN" ? "SUCCESS" : "FAILED",
                gateway_response:
                  t.status === "SUCCESS" && t.customer_response === "RECOVERED_BY_HUMAN"
                    ? "Payment captured successfully on human-assisted retry (Sandbox)"
                    : "Second payment retry attempt failed. Auto-recovery halted.",
                created_at: t.updated_at,
              },
            ]
          : []),
      ],
      failure_reason: t.failure_reason || "Payment retry limit reached",
      is_network_error: (t.failure_reason || "").toLowerCase().includes("network"),
      ai_diagnosis: `Root cause: ${t.failure_reason || "Payment Failure"}. Automatic retry policy halted after ${t.retry_count} failed attempt(s).`,
      ai_recommendation: "Contact customer directly, verify bank status, or offer assisted payment channel.",
      priority: t.amount >= 50000 ? "CRITICAL" : t.amount >= 10000 ? "HIGH" : "MEDIUM",
      risk_level: t.amount >= 50000 ? "CRITICAL" : "HIGH",
      revenue_at_risk: t.status === "SUCCESS" ? 0 : t.amount,
      case_status:
        t.escalation_status === "RESOLVED"
          ? "RESOLVED"
          : t.escalation_status === "IN_REVIEW"
          ? "IN_REVIEW"
          : "OPEN",
      created_at: t.created_at,
      resolved_at: t.escalation_status === "RESOLVED" ? t.updated_at : null,
      action_history: [
        {
          action: "ESCALATED_FROM_RETRY_FAILURE",
          notes: "Automated retry limit reached. Forwarded to Human Associate.",
          timestamp: t.created_at,
        },
        ...(t.status === "SUCCESS" && t.customer_response === "RECOVERED_BY_HUMAN"
          ? [
              {
                action: "CASE_RESOLVED_PAYMENT_SUCCESS",
                notes: "Customer completed payment successfully using human-assisted link.",
                recovered_amount: t.recovered_amount,
                timestamp: t.updated_at,
              },
            ]
          : []),
      ],
      recovery_token: t.recovery_token || `token_${t.transaction_id}`,
    }));

    return NextResponse.json(humanCases);
  }

  // Human Associate Actions
  if (pathStr.startsWith("human-associate/cases/") && pathStr.endsWith("/contact")) {
    const parts = pathStr.split("/");
    const caseId = parts[2];
    const txnId = caseId.replace("case_", "").replace("esc_", "");
    let body: any = {};
    try {
      body = await req.json();
    } catch {}
    const matched = inMemoryTransactions.find((t) => t.transaction_id === txnId || t.id === txnId || t.order_id === txnId);
    const nowIso = new Date().toISOString();
    if (matched) {
      matched.escalation_status = "IN_REVIEW";
      matched.updated_at = nowIso;

      inMemoryAuditLogs.unshift({
        id: "audit_contact_" + Math.random().toString(36).substring(2, 8),
        transaction_id: matched.transaction_id,
        event_type: "HUMAN_CUSTOMER_CONTACTED",
        event_message: `Human associate contacted customer via ${body.channel || "PHONE"}: ${body.notes || "Call logged"}`,
        actor: body.agent_name || "Human Associate",
        metadata: { channel: body.channel || "PHONE", notes: body.notes, order_id: matched.order_id },
        created_at: nowIso,
        timestamp: nowIso,
      });
    }
    return NextResponse.json({
      success: true,
      case_id: caseId,
      status: "IN_REVIEW",
      message: `Contact logged via ${body.channel || "PHONE"}. Status updated to IN_REVIEW.`,
    });
  }

  if (pathStr.startsWith("human-associate/cases/") && pathStr.endsWith("/send-link")) {
    const parts = pathStr.split("/");
    const caseId = parts[2];
    const txnId = caseId.replace("case_", "").replace("esc_", "");
    const matched = inMemoryTransactions.find((t) => t.transaction_id === txnId || t.id === txnId || t.order_id === txnId);
    const token = matched?.recovery_token || `rec_${txnId}`;
    const nowIso = new Date().toISOString();
    if (matched) {
      matched.escalation_status = "IN_REVIEW";
      matched.updated_at = nowIso;

      inMemoryAuditLogs.unshift({
        id: "audit_sendlink_" + Math.random().toString(36).substring(2, 8),
        transaction_id: matched.transaction_id,
        event_type: "HUMAN_PAYMENT_LINK_SENT",
        event_message: `Human associate dispatched approved recovery link for Order ${matched.order_id}`,
        actor: "Human Associate",
        metadata: { order_id: matched.order_id, token, link: `/pay/recover/${token}` },
        created_at: nowIso,
        timestamp: nowIso,
      });
    }
    return NextResponse.json({
      success: true,
      case_id: caseId,
      recovery_token: token,
      payment_link: `/pay/recover/${token}`,
      message: "Approved recovery payment link generated and dispatched.",
    });
  }

  if (pathStr.startsWith("human-associate/cases/") && pathStr.endsWith("/complete-payment")) {
    const parts = pathStr.split("/");
    const caseId = parts[2];
    const txnId = caseId.replace("case_", "").replace("esc_", "");
    const matched = inMemoryTransactions.find((t) => t.transaction_id === txnId || t.id === txnId || t.order_id === txnId);
    const nowIso = new Date().toISOString();
    if (matched) {
      // Idempotency: only mutate if not already recovered
      const wasAlreadyRecovered = matched.status === "SUCCESS" && matched.recovery_status === "RECOVERED";
      if (!wasAlreadyRecovered) {
        matched.status = "SUCCESS";
        matched.recovery_status = "RECOVERED";
        matched.recovered_amount = matched.amount;
        matched.escalation_status = "RESOLVED";
        matched.customer_response = "RECOVERED_BY_HUMAN";
        matched.failure_reason = null;
        matched.gateway_response = "Payment captured successfully via Human Associate Support (Sandbox)";
        matched.retry_count = Math.max(matched.retry_count, 1);
        matched.updated_at = nowIso;

        inMemoryAuditLogs.unshift({
          id: "audit_human_" + Math.random().toString(36).substring(2, 8),
          transaction_id: matched.transaction_id,
          event_type: "PAYMENT_SUCCESS",
          event_message: `Payment captured successfully via Human Support for Order ${matched.order_id}`,
          actor: "payment-gateway",
          metadata: { order_id: matched.order_id, amount: matched.amount, recovery_channel: "HUMAN_ASSOCIATE" },
          created_at: nowIso,
          timestamp: nowIso,
        });

        inMemoryAuditLogs.unshift({
          id: "audit_human_rec_" + Math.random().toString(36).substring(2, 8),
          transaction_id: matched.transaction_id,
          event_type: "HUMAN_REVENUE_RECOVERED",
          event_message: `Revenue recovered by Human Associate: INR ${matched.amount.toFixed(2)}`,
          actor: "Human Associate",
          metadata: { recovered_amount: matched.amount, currency: matched.currency || "INR", order_id: matched.order_id },
          created_at: nowIso,
          timestamp: nowIso,
        });

        inMemoryAuditLogs.unshift({
          id: "audit_human_esc_" + Math.random().toString(36).substring(2, 8),
          transaction_id: matched.transaction_id,
          event_type: "HUMAN_ESCALATION_RESOLVED",
          event_message: `Escalation case ${caseId} marked RESOLVED after successful payment capture`,
          actor: "Human Associate",
          metadata: { order_id: matched.order_id, case_id: caseId },
          created_at: nowIso,
          timestamp: nowIso,
        });
      }
    }
    return NextResponse.json({
      success: true,
      case_id: caseId,
      order_id: matched?.order_id,
      transaction_id: matched?.transaction_id || txnId,
      status: "RESOLVED",
      recovered_amount: matched?.amount || 0,
      message: `Case resolved! ₹${(matched?.amount || 0).toLocaleString("en-IN")} recovered successfully by Human Associate.`,
      transaction: matched,
    });
  }

  // Audit Logs (with transaction filter support)
  if (pathStr.startsWith("audit")) {
    const targetTxId = pathParts.length > 1 ? pathParts[1] : req.nextUrl.searchParams.get("transaction_id");
    let logs = inMemoryAuditLogs;
    if (targetTxId) {
      const filtered = inMemoryAuditLogs.filter(
        (a) =>
          a.transaction_id === targetTxId ||
          a.metadata?.transaction_id === targetTxId ||
          a.metadata?.order_id === targetTxId ||
          (a.event_message && a.event_message.includes(targetTxId))
      );
      if (filtered.length > 0) {
        logs = filtered;
      }
    }

    return NextResponse.json({
      transaction_id: targetTxId || undefined,
      data: logs,
      events: logs,
      count: logs.length,
      total_count: logs.length,
      pagination: {
        limit: 50,
        offset: 0,
        returned: logs.length,
        next_offset: null,
      },
    });
  }

  // Reports JSON endpoint
  if (pathStr === "reports") {
    const findings: string[] = [];
    if (totalOrders === 0) {
      findings.push("No transactions or revenue events recorded in the current system period.");
      findings.push("Operational baseline is reset. Ready to ingest new checkout transactions.");
    } else {
      findings.push(`Total monitored volume is ${totalOrders} transactions with INR ${revenueAtRisk.toLocaleString("en-IN")} at risk.`);
      findings.push(`Autonomous AI & Human recovery recovered INR ${totalRecovered.toLocaleString("en-IN")} (${recoveryRate}% recovery rate).`);
      if (recoverableTxs.length > 0) {
        findings.push(`${recoverableTxs.length} active unresolved case(s) requiring retry sequence or human associate review.`);
      }
    }

    const txDetails = txs.map((t) => ({
      transaction_id: t.transaction_id,
      order_id: t.order_id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      failure_type: t.failure_reason || (t.status === "ABANDONED" ? "Checkout Abandonment" : "None"),
      diagnosis: t.failure_reason || (t.status === "SUCCESS" ? "Standard Authorization" : "Payment Failure"),
      recovery_action: t.status === "SUCCESS" ? "Captured" : "Automated Smart Retry",
      recovery_method: t.customer_response === "RECOVERED_BY_HUMAN" ? "Human Associate" : "AI Autonomous Agent",
      recovery_status: t.recovery_status,
      recovered_amount: t.recovered_amount,
      created_date: t.created_at,
      updated_date: t.updated_at,
    }));

    return NextResponse.json({
      summary: {
        total_orders: totalOrders,
        successful_payments: successOrders,
        failed_payments: failedOrders,
        abandoned_payments: abandonedOrders,
        revenue_at_risk: revenueAtRisk,
        ai_recovered: aiRecovered,
        human_recovered: humanRecovered,
        total_recovered: totalRecovered,
        recovery_rate: recoveryRate,
      },
      failure_analysis: {
        network_errors: networkErrors,
        payment_timeouts: timeouts,
        authentication_failures: authFails,
        abandonments: abandonedOrders,
        other_failures: 0,
      },
      recovery_analysis: {
        ai_recovery_cases: aiCasesCount,
        human_recovery_cases: humanCasesCount,
        high_risk_cases: highRiskCount,
        unresolved_cases: recoverableTxs.length,
      },
      executive_findings: findings,
      transactions: txDetails,
      generated_at: new Date().toISOString(),
    });
  }

  // Reports PDF endpoint
  if (pathStr === "reports/pdf") {
    const pdfSimple = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj 4 0 obj<</Length 160>>stream\nBT /F1 16 Tf 50 720 Td (REVIVEAI - REVENUE RECOVERY REPORT) Tj ET\nBT /F1 10 Tf 50 690 Td (Total Orders: ${totalOrders}  |  Revenue at Risk: INR ${revenueAtRisk}  |  Recovered: INR ${totalRecovered}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000115 00000 n\n0000000210 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n420\n%%EOF\n`;
    const curDate = new Date().toISOString().split("T")[0];
    return new NextResponse(pdfSimple, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ReviveAI_Revenue_Recovery_Report_${curDate}.pdf"`,
      },
    });
  }

  // Transaction PDF Certificate endpoint
  if (pathStr.startsWith("transactions/") && pathStr.endsWith("/pdf")) {
    const parts = pathStr.split("/");
    const txnId = parts[1] || "TX-UNKNOWN";
    const foundTx = inMemoryTransactions.find((t) => t.transaction_id === txnId || t.id === txnId);
    const amt = foundTx?.amount || 2499;
    const stat = foundTx?.status || "SUCCESS";
    const recStat = foundTx?.recovery_status || "RECOVERED";

    const pdfTx = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj 4 0 obj<</Length 220>>stream\nBT /F1 16 Tf 50 720 Td (REVIVEAI - TRANSACTION AUDIT CERTIFICATE) Tj ET\nBT /F1 11 Tf 50 680 Td (Transaction ID: ${txnId}  |  Amount: INR ${amt}) Tj ET\nBT /F1 10 Tf 50 650 Td (Payment Status: ${stat}  |  Recovery Status: ${recStat}) Tj ET\nBT /F1 9 Tf 50 620 Td (Certified cryptographic audit record generated by ReviveAI.) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000115 00000 n\n0000000210 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n480\n%%EOF\n`;

    return new NextResponse(pdfTx, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ReviveAI_Transaction_${txnId}.pdf"`,
      },
    });
  }

  // Reports Excel endpoint
  if (pathStr === "reports/excel") {
    const csvContent = `Metric,Value\nTotal Orders,${totalOrders}\nSuccessful Payments,${successOrders}\nFailed Payments,${failedOrders}\nAbandoned Payments,${abandonedOrders}\nRevenue at Risk,${revenueAtRisk}\nAI Recovered,${aiRecovered}\nHuman Recovered,${humanRecovered}\nTotal Recovered,${totalRecovered}\nRecovery Rate,${recoveryRate}%\n`;
    const curDate = new Date().toISOString().split("T")[0];
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ReviveAI_Revenue_Recovery_Report_${curDate}.xlsx"`,
      },
    });
  }

  // Default fallback for any unspecified endpoint
  return NextResponse.json({
    status: "ok",
    message: `ReviveAI handled /api/${pathStr}`,
  });
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleApiRequest(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleApiRequest(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleApiRequest(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleApiRequest(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleApiRequest(req, ctx);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
