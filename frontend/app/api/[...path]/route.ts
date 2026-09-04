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
        const data = await res.json().catch(() => null);
        return NextResponse.json(data || {}, { status: res.status });
      }
    } catch {
      // Backend unreachable -> seamlessly fall back to local handlers below
    }
  }

  // 2. Comprehensive Next.js Native Handlers

  // Health
  if (pathStr === "health") {
    return NextResponse.json({
      status: "ok",
      service: "ReviveAI Vercel Engine",
      version: "2.1.0",
      timestamp: new Date().toISOString(),
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

  // Customer Registration
  if (pathStr === "checkout/customer/register" || pathStr === "checkout/register") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    const name = (body.full_name || "Valued Customer").trim();
    const email = (body.email || "customer@voltstore.in").trim().toLowerCase();
    const phone = (body.phone || "9876543210").trim();
    return NextResponse.json({
      success: true,
      message: "Account created successfully.",
      customer: {
        id: "cust_volt_" + Math.random().toString(36).substring(2, 8),
        name: name,
        email: email,
        phone: phone,
        saved_address: {
          full_name: name,
          phone: phone,
          email: email,
          address_line1: "12, Main Tech Park Road",
          address_line2: "",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      },
      token: "cust_tok_" + Math.random().toString(36).substring(2, 12),
    });
  }

  // Customer Profile (Me)
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
          address_line2: "Near Metro Hub",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      },
    });
  }

  // Customer Address Save
  if (pathStr === "checkout/customer/address") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    return NextResponse.json({
      success: true,
      message: "Address saved successfully.",
      address: body,
    });
  }

  // Customer Products
  if (pathStr === "checkout/products") {
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
          p.category.toLowerCase().includes(q) ||
          (p.subcategory && p.subcategory.toLowerCase().includes(q))
      );
    }
    return NextResponse.json({ data: list, count: list.length });
  }

  // Single Product Detail
  if (pathStr.startsWith("checkout/products/")) {
    const prodId = pathParts[2];
    const found = FALLBACK_PRODUCTS.find((p) => p.id === prodId || p.productId === prodId);
    return NextResponse.json({ data: found || FALLBACK_PRODUCTS[0] });
  }

  // Customer Orders
  if (pathStr === "checkout/customer/orders") {
    return NextResponse.json({
      data: [
        {
          order_id: "ORD-9821-DEMO",
          transaction_id: "TXN-9821-DEMO",
          product_name: "Philips Stellar 9W LED Bulb (Cool Day White)",
          category: "Lighting",
          image_url: "https://images.unsplash.com/photo-1550524514-6c70313172ca?w=600&auto=format&fit=crop&q=80",
          amount: 298,
          currency: "INR",
          payment_method: "UPI / PhonePe",
          payment_status: "SUCCESS",
          order_status: "CONFIRMED",
          recovery_status: "RECOVERED",
          recovery_token: "recov_demo_tok",
          created_at: new Date(Date.now() - 3600000).toISOString(),
          can_retry: false,
          retry_link: "/pay/recover/recov_demo_tok",
        },
      ],
      count: 1,
    });
  }

  // Initiate Checkout Session
  if (pathStr === "checkout/initiate") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
    const txnId = "TXN-" + Math.floor(100000 + Math.random() * 900000);
    return NextResponse.json({
      success: true,
      order_id: orderId,
      transaction_id: txnId,
      amount: body.amount || 2499,
      currency: "INR",
      message: "Checkout session initialized",
    });
  }

  // Process Customer Payment
  if (pathStr === "checkout/process-payment") {
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

    return NextResponse.json({
      success: isSuccess,
      order_id: orderId,
      transaction_id: txnId,
      payment_status: isSuccess ? "SUCCESS" : "FAILED",
      order_status: isSuccess ? "CONFIRMED" : "PAYMENT_FAILED",
      failure_reason: isSuccess ? null : body.simulation_scenario || "PAYMENT_TIMEOUT",
      is_network_error: !isSuccess && (body.simulation_scenario === "NETWORK_ERROR" || body.simulation_scenario === "TIMEOUT"),
      recovery_token: recovToken,
      retry_link: `/pay/recover/${recovToken}`,
      message: isSuccess
        ? "Payment verified and order placed successfully!"
        : "Payment attempt failed. Autonomous ReviveAI Recovery initialized.",
    });
  }

  // Abandon Customer Checkout
  if (pathStr === "checkout/abandon") {
    const recovToken = "recov_abn_" + Math.random().toString(36).substring(2, 10);
    return NextResponse.json({
      success: true,
      message: "Checkout abandonment logged. Recovery link dispatched via SMS/Email.",
      recovery_token: recovToken,
      retry_link: `/pay/recover/${recovToken}`,
    });
  }

  // Recovery Session Details
  if (pathStr.startsWith("checkout/recover/")) {
    const token = pathParts[2] || "demo_token";
    return NextResponse.json({
      order_id: "ORD-REC-" + token.substring(0, 6).toUpperCase(),
      transaction_id: "TXN-REC-" + token.substring(0, 6).toUpperCase(),
      token: token,
      status: "FAILED",
      amount: 65999,
      discounted_amount: 63999,
      currency: "INR",
      payment_method: "UPI / Netbanking",
      failure_reason: "BANK_NETWORK_TIMEOUT",
      is_network_error: true,
      recovery_status: "IN_PROGRESS",
      attempts_left: 1,
      customer_name: "VALUED CUSTOMER",
      customer: {
        name: "VALUED CUSTOMER",
        email: "customer@voltstore.in",
        phone: "9876543210",
      },
      product: {
        id: "prod_laptop_biz_01",
        name: "ProBook Ultra Slim 15.6\" Business Laptop",
        category: "Laptops & Computers",
        image_url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80",
        price: 65999,
      },
      product_name: "ProBook Ultra Slim 15.6\" Business Laptop",
      already_paid: false,
      already_used: false,
      escalated_to_support: false,
      retry_allowed: true,
    });
  }

  // Retry Customer Payment
  if (pathStr === "checkout/retry-payment") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty
    }
    const isSuccess =
      body.retry_outcome === "SUCCESS" || body.retry_outcome === "RETRY_SUCCESS";
    return NextResponse.json({
      success: isSuccess,
      status: isSuccess ? "SUCCESS" : "ESCALATED",
      payment_status: isSuccess ? "SUCCESS" : "FAILED",
      recovery_status: isSuccess ? "RECOVERED" : "RETRY_FAILED",
      order_status: isSuccess ? "CONFIRMED" : "ESCALATED_TO_SUPPORT",
      escalated_to_human: !isSuccess,
      escalated_to_support: !isSuccess,
      already_paid: isSuccess,
      order_id: body.order_id || "ORD-REC-DEMO",
      transaction_id: body.transaction_id || "TXN-REC-DEMO",
      recovered_amount: isSuccess ? 65999 : 0,
      amount: 65999,
      currency: "INR",
      message: isSuccess
        ? "Autonomous recovery successful! Payment confirmed."
        : "Payment retry was not successful. Case transferred to Human Associate.",
    });
  }

  // Seller Dashboard
  if (pathStr === "seller/dashboard") {
    return NextResponse.json({
      total_orders: 148,
      successful_orders: 114,
      failed_orders: 34,
      pending_orders: 6,
      checkout_abandonments: 12,
      network_errors: 15,
      payment_failures: 19,
      failure_breakdown: {
        network_errors: 15,
        timeouts: 8,
        bank_declines: 6,
        auth_failures: 5,
        abandonments: 12,
        other: 0,
      },
      revenue_at_risk: 485200,
      revenue_risk_breakdown: {
        network_errors: 245000,
        payment_failures: 128000,
        checkout_abandonments: 89000,
        human_pending_cases: 23200,
      },
      ai_recovery_cases: 22,
      ai_recovered_revenue: 312500,
      human_recovery_cases: 7,
      human_recovered_revenue: 98000,
      total_recovered_revenue: 410500,
      unresolved_cases: 5,
      unresolved_revenue: 74700,
      high_risk_cases: 3,
      recovery_rate: 84.6,
      funnel: {
        orders: 148,
        checkout_started: 148,
        payment_initiated: 136,
        payment_failed_or_abandoned: 34,
        revenue_at_risk_detected: 34,
        ai_recovery_triggered: 22,
        customer_retry_executed: 20,
        ai_payment_success: 18,
        escalated_to_human: 7,
        human_payment_success: 6,
      },
      product_revenue_loss: [
        {
          product_id: "prod_laptop_biz_01",
          product_name: "ProBook Ultra Slim 15.6\" Business Laptop",
          category: "Laptops & Computers",
          unit_price: 65999,
          orders_count: 32,
          successful_orders: 26,
          failed_orders: 6,
          network_errors: 4,
          checkout_abandonments: 2,
          revenue_at_risk: 395994,
          recovered_revenue: 329995,
          recovery_rate: 83.3,
        },
        {
          product_id: "prod_acc_mech_keyboard_01",
          product_name: "Keychron K2 V2 Wireless Mechanical Keyboard",
          category: "Computer Accessories",
          unit_price: 6999,
          orders_count: 48,
          successful_orders: 42,
          failed_orders: 6,
          network_errors: 3,
          checkout_abandonments: 3,
          revenue_at_risk: 41994,
          recovered_revenue: 34995,
          recovery_rate: 83.3,
        },
      ],
      generated_at: new Date().toISOString(),
    });
  }

  // Seller Cases
  if (pathStr === "seller/cases") {
    return NextResponse.json([
      {
        order_id: "ORD-8812-BLR",
        transaction_id: "TXN-8812-BLR",
        customer: {
          name: "Rohan Verma",
          email: "rohan.v@techcorp.in",
          phone: "+91 98450 11223",
        },
        product_id: "prod_laptop_biz_01",
        product_name: "ProBook Ultra Slim 15.6\" Business Laptop",
        category: "Laptops & Computers",
        amount: 65999,
        currency: "INR",
        payment_status: "FAILED",
        failure_reason: "BANK_NETWORK_TIMEOUT",
        is_network_error: true,
        attempts: 1,
        risk: "HIGH",
        revenue_at_risk: 65999,
        ai_status: "RECOVERY_DISPATCHED",
        human_status: "PENDING_HUMAN_REVIEW",
        recovery_status: "IN_PROGRESS",
        recovery_token: "recov_8812",
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        order_id: "ORD-8813-CHN",
        transaction_id: "TXN-8813-CHN",
        customer: {
          name: "Priya Sundaram",
          email: "priya.sundaram@gmail.com",
          phone: "+91 94440 33445",
        },
        product_id: "prod_acc_mech_keyboard_01",
        product_name: "Keychron K2 V2 Wireless Mechanical Keyboard",
        category: "Computer Accessories",
        amount: 6999,
        currency: "INR",
        payment_status: "SUCCESS",
        failure_reason: "OTP_AUTH_TIMEOUT",
        is_network_error: false,
        attempts: 2,
        risk: "LOW",
        revenue_at_risk: 6999,
        ai_status: "SMART_RETRY_SUCCESS",
        human_status: "AUTO_RESOLVED",
        recovery_status: "RECOVERED",
        recovery_token: "recov_8813",
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ]);
  }

  // Human Associate Cases
  if (pathStr === "human-associate/cases") {
    return NextResponse.json([
      {
        case_id: "CASE-HA-901",
        order_id: "ORD-901-DEL",
        transaction_id: "TXN-901-DEL",
        customer: {
          name: "Amit Patel",
          email: "amit.patel@logistics.in",
          phone: "+91 99887 76655",
        },
        product: {
          id: "prod_laptop_workstation_02",
          name: "Precision Workstation 16\" (Core i9, 32GB RAM, RTX 4070)",
          category: "Laptops & Computers",
        },
        amount: 129999,
        currency: "INR",
        payment_attempts_count: 2,
        payment_attempts: [
          {
            attempt_number: 1,
            status: "FAILED",
            gateway_response: "GATEWAY_TIMEOUT",
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            attempt_number: 2,
            status: "FAILED",
            gateway_response: "CARD_AUTHENTICATION_FAILED",
            created_at: new Date(Date.now() - 1800000).toISOString(),
          },
        ],
        failure_reason: "HIGH_VALUE_TRANSACTION_BANK_DECLINE",
        is_network_error: false,
        ai_diagnosis: "Customer attempted payment using corporate credit card exceeding single-swipe limits.",
        ai_recommendation: "Offer custom split payment link or assisted RTGS/NEFT payment with 3% recovery concession.",
        priority: "CRITICAL",
        risk_level: "CRITICAL",
        revenue_at_risk: 129999,
        case_status: "OPEN",
        created_at: new Date(Date.now() - 3600000).toISOString(),
        action_history: [],
        recovery_token: "recov_case_901",
      },
    ]);
  }

  // Human Associate Actions
  if (pathStr.startsWith("human-associate/cases/") && pathStr.endsWith("/contact")) {
    return NextResponse.json({
      success: true,
      message: "Customer contact logged. Communication channel triggered.",
    });
  }
  if (pathStr.startsWith("human-associate/cases/") && pathStr.endsWith("/send-link")) {
    return NextResponse.json({
      success: true,
      message: "Personalized recovery payment link generated and sent via SMS & WhatsApp.",
      payment_link: "/pay/recover/recov_case_901",
    });
  }
  if (pathStr.startsWith("human-associate/cases/") && pathStr.endsWith("/complete-payment")) {
    return NextResponse.json({
      success: true,
      message: "Payment marked as completed by associate. Revenue recovered.",
    });
  }

  // Dashboard Summary & Metrics
  if (pathStr === "dashboard/summary") {
    const sumObj = {
      total_transactions: 1250,
      failed_transactions: 84,
      revenue_at_risk: 485200,
      total_risk_detected: 485200,
      recovery_attempts: 72,
      successful_recoveries: 68,
      revenue_recovered: 410500,
      recovery_rate: 84.6,
      revenue_recovery_rate: 84.6,
      unresolved_cases: 5,
      escalated_cases: 3,
      failure_rate: 6.72,
      average_recovery_latency_seconds: 42,
      total_volume: 18450000,
      failed_count: 84,
      failed_volume: 1240000,
      recovered_count: 68,
      recovered_volume: 410500,
      active_escalations: 3,
      avg_recovery_time_sec: 42,
      generated_at: new Date().toISOString(),
    };
    return NextResponse.json(sumObj);
  }

  if (pathStr === "dashboard/recovery-metrics") {
    const sumObj = {
      total_transactions: 1250,
      failed_transactions: 84,
      revenue_at_risk: 485200,
      total_risk_detected: 485200,
      recovery_attempts: 72,
      successful_recoveries: 68,
      revenue_recovered: 410500,
      recovery_rate: 84.6,
      revenue_recovery_rate: 84.6,
      unresolved_cases: 5,
      escalated_cases: 3,
      failure_rate: 6.72,
      average_recovery_latency_seconds: 42,
      total_volume: 18450000,
      failed_count: 84,
      failed_volume: 1240000,
      recovered_count: 68,
      recovered_volume: 410500,
      active_escalations: 3,
      avg_recovery_time_sec: 42,
      generated_at: new Date().toISOString(),
    };
    return NextResponse.json({
      summary: sumObj,
      case_status_counts: {
        RECOVERED: 68,
        OPEN: 11,
        IN_PROGRESS: 5,
        ESCALATED: 3,
        FAILED: 2,
      },
      total_recovered_amount: 410500,
      recovery_rate_percentage: 84.6,
      avg_recovery_latency_sec: 42,
      prevented_churn_count: 68,
      smart_retry_success_rate: 76.4,
      downtime_circuit_trips: 2,
    });
  }

  // Transactions list
  if (pathStr === "transactions") {
    const txList = [
      {
        id: "txn_demo_1",
        transaction_id: "TXN-8812-BLR",
        customer_id: "cust_rohan",
        customer: {
          id: "cust_rohan",
          name: "Rohan Verma",
          email: "rohan.v@techcorp.in",
          phone: "+91 98450 11223",
          status: "ACTIVE",
        },
        order_id: "ORD-8812-BLR",
        amount: 65999,
        currency: "INR",
        status: "FAILED",
        payment_method: "CARD",
        failure_reason: "BANK_NETWORK_TIMEOUT",
        gateway_response: "Acquiring gateway connection dropped during 3DS auth handshake",
        retry_count: 1,
        recovery_status: "IN_PROGRESS",
        recovered_amount: 0,
        escalation_status: "OPEN",
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: "txn_demo_2",
        transaction_id: "TXN-8813-CHN",
        customer_id: "cust_priya",
        customer: {
          id: "cust_priya",
          name: "Priya Sundaram",
          email: "priya.sundaram@gmail.com",
          phone: "+91 94440 33445",
          status: "ACTIVE",
        },
        order_id: "ORD-8813-CHN",
        amount: 6999,
        currency: "INR",
        status: "SUCCESS",
        payment_method: "UPI",
        failure_reason: null,
        gateway_response: "Payment captured successfully on customer retry (Sandbox)",
        retry_count: 1,
        recovery_status: "RECOVERED",
        recovered_amount: 6999,
        escalation_status: "NONE",
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
    return NextResponse.json({
      data: txList,
      transactions: txList,
      total: txList.length,
      total_count: txList.length,
      pagination: {
        limit: 50,
        offset: 0,
        returned: txList.length,
        next_offset: null,
      },
    });
  }

  // Revenue Risk
  if (pathStr === "revenue-risk") {
    const riskCases = [
      {
        id: "risk_case_1",
        case_id: "risk_case_1",
        transaction_id: "TXN-8812-BLR",
        risk_amount: 65999,
        amount: 65999,
        currency: "INR",
        status: "FAILED",
        recovery_status: "IN_PROGRESS",
        action_status: "POLICY_APPROVED",
        risk_level: "HIGH",
        root_cause: "payment_timeout",
        recommended_action: "controlled_retry",
        recovered_amount: 0,
        evidence: ["Gateway latency exceeded 30000ms", "3DS auth dropped"],
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: "risk_case_2",
        case_id: "risk_case_2",
        transaction_id: "TXN-8813-CHN",
        risk_amount: 6999,
        amount: 6999,
        currency: "INR",
        status: "SUCCESS",
        recovery_status: "RECOVERED",
        action_status: "EXECUTED",
        risk_level: "LOW",
        root_cause: "authentication_failure",
        recommended_action: "controlled_retry",
        recovered_amount: 6999,
        evidence: ["OTP handshake retry succeeded"],
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
    return NextResponse.json(riskCases);
  }

  if (pathStr === "revenue-risk/summary") {
    return NextResponse.json({
      total_transactions: 1250,
      failed_transactions: 84,
      revenue_at_risk: 485200,
      total_risk_detected: 485200,
      recovery_attempts: 72,
      successful_recoveries: 68,
      revenue_recovered: 410500,
      recovery_rate: 84.6,
      unresolved_cases: 5,
      escalated_cases: 3,
      failure_rate: 6.72,
      revenue_recovery_rate: 84.6,
      average_recovery_latency_seconds: 42,
    });
  }

  // Escalations
  if (pathStr === "escalations") {
    return NextResponse.json([
      {
        id: "esc_demo_1",
        transaction_id: "TXN-901-DEL",
        reason: "CARD_LIMIT_EXCEEDED",
        status: "OPEN",
        priority: "CRITICAL",
        amount: 129999,
        currency: "INR",
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ]);
  }

  // Audit Logs
  if (pathStr.startsWith("audit")) {
    const evList = [
      {
        id: "audit_ev_1",
        transaction_id: "TXN-8812-BLR",
        recovery_case_id: "risk_case_1",
        event_type: "RECOVERY_DISPATCHED",
        event_message: "Automated payment continuation link sent to customer",
        actor: "ReviveAI Autonomous Agent",
        metadata: { channel: "SMS", token: "recov_8812" },
        created_at: new Date(Date.now() - 1200000).toISOString(),
        timestamp: new Date(Date.now() - 1200000).toISOString(),
      },
      {
        id: "audit_ev_2",
        transaction_id: "TXN-8813-CHN",
        recovery_case_id: "risk_case_2",
        event_type: "PAYMENT_RECOVERED",
        event_message: "Payment captured successfully on customer retry (Sandbox)",
        actor: "Smart Retry Engine",
        metadata: { amount: 6999, method: "UPI" },
        created_at: new Date(Date.now() - 7100000).toISOString(),
        timestamp: new Date(Date.now() - 7100000).toISOString(),
      },
    ];
    return NextResponse.json({
      data: evList,
      events: evList,
      count: evList.length,
      total_count: evList.length,
      pagination: {
        limit: 50,
        offset: 0,
        returned: evList.length,
        next_offset: null,
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
