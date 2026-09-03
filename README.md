# ReviveAI: Autonomous AI Agent for Payment Failure Detection, Diagnosis & Revenue Recovery

> **Detect → Diagnose → Decide → Recover → Measure**  
> *A production-grade autonomous fintech operations platform that recovers lost transaction revenue safely, explainably, and with 100% auditability.*

---

## 🚀 Executive Summary & Problem Statement

**The Problem**: Every year, merchants lose over $100 Billion globally due to false payment failures, gateway timeouts, transient network glitches, bank-side throttling, and improper retry handling. Traditional recovery systems rely on blind, brute-force cron retries that:
- Violate payment network rules and cause card blocks.
- Harass customers with duplicate charges.
- Fail to diagnose the true root cause of transaction drops.
- Lack compliance audit trails and safety policy guardrails.

**The Solution**: **ReviveAI** is an autonomous revenue recovery agent that operates as an intelligent payment ops layer. It monitors failed transactions in real time, diagnoses root causes using multi-vector evidence classification, evaluates autonomous policy rules, executes controlled intelligent retries, and records an immutable cryptographic audit log for every action taken.

---

## 🎯 Key Capabilities & Highlights

1. **Autonomous Root Cause Diagnosis**: Classifies failures into payment timeouts, bank declines, auth errors, and insufficient funds with confidence scoring and auditable evidence points (no exposed private chain-of-thought).
2. **Deterministic Safety & Policy Guardrails**: Enforces hard limits (Max 1 auto-retry, minimum confidence threshold $\ge 70\%$, customer opt-out compliance, payment method validation).
3. **Idempotent Recovery Engine**: Guaranteed single-execution semantics preventing double charges or duplicate recoveries.
4. **Automated Stopping Logic**: The state machine immediately terminates recovery loops upon payment capture (`SUCCESS → RECOVERY COMPLETE → STOP`).
5. **Human Escalation Queue**: Automatically routes edge cases, hard declines, and exhausted retries to human ops teams with AI recommendations and case resolution workflows.
6. **Chronological Audit Trail**: Full regulatory compliance event stream logging every decision, policy validation, execution result, and actor metadata.
7. **Judge Demo Control Center**: 1-click demonstration runner with baseline state resets for seamless hackathon evaluation.

---

## 🏗️ System Architecture & Workflow

```
[Payment Gateway Event]
           ↓
[Transaction Ingestion]  ──→  [Revenue-at-Risk Detection]
                                          ↓
                              [Recoverability Assessment]
                                          ↓
                              [AI Root-Cause Diagnosis]
                               (Timeout / Decline / Auth)
                                          ↓
                              [Recovery Decision Engine]
                                (Strategy Formulation)
                                          ↓
                              [Safety Policy Validation]
                              (Retry limits, Opt-out check)
                                          ↓
                 ┌────────────────────────┴────────────────────────┐
                 ↓                                                 ↓
      [Policy Approved: RETRY]                         [Policy Escalated / Blocked]
                 ↓                                                 ↓
     [Controlled Payment Retry]                        [Human Escalation Queue]
                 ↓                                                 ↓
    ┌────────────┴────────────┐                        [Ops Resolution Workflow]
    ↓                         ↓
 [SUCCESS]                 [FAILED]
    ↓                         ↓
[₹ Revenue Recovered]     [Escalate to Human]
    ↓                         ↓
[Recovery STOP]           [Audit Trail Complete]
    ↓                         ↓
    └─────────────────────────┴─────────────→ [Audit & Compliance Log]
```

---

## 💻 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend UI** | Next.js 14 (App Router), React 18, TypeScript (Strict), Tailwind CSS, Lucide Icons, Recharts |
| **Backend API** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy, Uvicorn |
| **Agent / AI Engine** | ReviveAI Multi-Vector Diagnosis Engine (OpenAI GPT-4.1-mini + Resilient Deterministic Fallback) |
| **Data & Storage** | SQLite (Demo & Local Testing), PostgreSQL / Supabase ready |
| **Testing & Quality** | Pytest, AnyIO, Vitest, React Testing Library, Jest-DOM, TypeScript Compiler |
| **Deployment** | Docker, Docker Compose, Render Blueprint, Vercel ready |

---

## ⚡ Quickstart Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (optional)
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend runs on `http://127.0.0.1:8000` (API Docs: `http://127.0.0.1:8000/docs`).*

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

## 🔐 Environment Variables & Security Configuration

Set environment variables in your local `.env` file (copy from `.env.example`).

```env
# Backend & AI Configuration
ENVIRONMENT=development
DATABASE_URL=sqlite:///./reviveai_demo.db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Set your OpenAI / LLM API Key here:
AI_API_KEY=your_openai_api_key_here
AI_MODEL=gpt-4.1-mini
AI_MOCK_MODE=false
```

> **Security Note**: Never commit real API keys, passwords, or credentials to Git. Real secrets are kept only in uncommitted local `.env` files.


## 🐳 Docker Container Deployment

To launch both backend and frontend with a single command:
```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Health Check: `http://localhost:8000/api/health`

---

## 📊 Core API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health and telemetry status |
| `GET` | `/api/dashboard/summary` | Aggregated merchant financial KPIs |
| `GET` | `/api/transactions` | Filterable transaction stream with search & pagination |
| `GET` | `/api/transactions/{id}` | Detailed transaction lifecycle & payment attempts |
| `POST` | `/api/agent/diagnose/{id}` | AI root-cause diagnosis & confidence scoring |
| `POST` | `/api/agent/decide/{id}` | Strategy formulation & policy pre-validation |
| `POST` | `/api/recovery/start/{id}` | Idempotent autonomous recovery execution |
| `GET` | `/api/escalations` | Human escalation operations queue |
| `PATCH`| `/api/escalations/{id}/resolve`| Resolve human escalation case |
| `GET` | `/api/audit` | System-wide chronological audit events |
| `POST` | `/api/demo/reset` | Resets demo data to pristine baseline |
| `POST` | `/api/demo/run-primary` | Executes primary demo flow on `TX-DEMO-001` |
| `POST` | `/api/demo/run-retry-failure` | Executes escalation flow on `TX-DEMO-002` |

---

## 🎬 Hackathon Evaluation Walkthrough

### Scenario 1: Primary Autonomous Recovery (`TX-DEMO-001`)
1. **Initial State**: Transaction `TX-DEMO-001` (₹5,999, UPI) fails due to a `TIMEOUT` gateway error.
2. **Revenue Risk Identified**: Instant dashboard recognition of ₹5,999 at risk.
3. **AI Diagnosis**: Agent analyzes gateway telemetry and identifies root cause `payment_timeout` with 95% confidence.
4. **Policy Check**: Validates that retry count is 0/1, customer is opted-in, and transaction is eligible (`POLICY APPROVED`).
5. **Execution**: Autonomous payment retry triggers through sandbox gateway and succeeds (`CAPTURED`).
6. **Recovery Complete**: Recovered amount is updated to ₹5,999; state machine immediately halts further retries.
7. **Audit Record**: 9 chronological events recorded covering detection, diagnosis, decision, execution, and stopping.

### Scenario 2: Hard Failure & Human Escalation (`TX-DEMO-002`)
1. **Trigger**: Trigger failure scenario via Demo Control Center (`POST /api/demo/run-retry-failure`).
2. **Execution**: Retry fails due to invalid credentials or repeat timeout.
3. **Policy Gate**: Retry limit (1/1) reached.
4. **Escalation**: Autonomous agent halts automated retries and creates an entry in `/escalations` tagged with `HIGH` priority and AI recommendations.
5. **Resolution**: Support agent inspects the case and marks it resolved with updated payment instructions.

---

## 🧪 Automated Test Suite

### Running Backend Tests (41 tests)
```bash
cd backend
pytest -v
```

### Running Frontend Tests (12 tests)
```bash
cd frontend
npm test
```

### Type Checking & Production Build
```bash
cd frontend
npx tsc --noEmit
npm run build
```

---

## 🔒 Security & Safety Principles
- **No Hardcoded Secrets**: All API keys, database URLs, and secrets are strictly managed via environment variables.
- **Explainability Over Black Box**: No raw LLM internal chain-of-thought is exposed; outputs are formatted into clean, verifiable evidence points.
- **Idempotency Protection**: Every recovery action requires an idempotency token to prevent double charges.
- **Regulatory Audit Log**: Every automated action creates an immutable log record with actor attribution and timestamps.

---

## 👥 Authors & Hackathon Team
**ReviveAI Team** — Razorpay Hackathon 2026
