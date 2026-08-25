-- ReviveAI database schema
-- Track 03 - AI Revenue Recovery
-- Run this in Supabase SQL Editor (or psql) AFTER creating the project.
-- Safe to re-run: uses IF NOT EXISTS / DROP ... CASCADE guards.

-- =========================================================
-- 0. Extensions
-- =========================================================
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- =========================================================
-- 1. Enums (state machine legal states, Section 7)
-- =========================================================
do $$ begin
  create type user_role as enum ('ADMIN', 'ANALYST');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_status as enum ('PENDING', 'FAILED', 'SUCCESS', 'ABANDONED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recovery_case_status as enum ('OPEN', 'ELIGIBLE', 'IN_PROGRESS', 'RECOVERED', 'UNRESOLVED', 'ESCALATED', 'STOPPED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recovery_action_status as enum ('PLANNED', 'APPROVED', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'BLOCKED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type escalation_status as enum ('OPEN', 'IN_REVIEW', 'RESOLVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type demo_outcome_mode as enum ('RETRY_SUCCEEDS', 'RETRY_FAILS');
exception when duplicate_object then null; end $$;

-- =========================================================
-- 2. users / roles (Auth + RBAC)
-- =========================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role user_role not null default 'ANALYST',
  created_at timestamptz not null default now()
);

-- =========================================================
-- 3. webhook_events (dedup / observability)
-- =========================================================
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  external_event_id text unique not null,
  payload_hash text not null,
  status text not null default 'RECEIVED', -- RECEIVED | PROCESSED | DUPLICATE | ERROR
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- =========================================================
-- 4. transactions
-- =========================================================
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  external_event_id text unique, -- webhook dedup key (Section 8)
  customer_id text not null,
  customer_name text,
  payment_method text not null,       -- e.g. UPI, CARD, NETBANKING
  amount_minor_units bigint not null,  -- avoid float money errors (Section 8)
  currency_minor_units int not null default 2, -- decimal places, e.g. 2 for INR paise
  currency text not null default 'INR',
  status transaction_status not null default 'PENDING',
  failure_reason text,
  gateway_response text,
  retry_count int not null default 0,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amount_non_negative check (amount_minor_units >= 0)
);
create index if not exists idx_transactions_status on transactions(status);
create index if not exists idx_transactions_customer on transactions(customer_id);
create index if not exists idx_transactions_correlation on transactions(correlation_id);

-- =========================================================
-- 5. recovery_cases
-- =========================================================
create table if not exists recovery_cases (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  status recovery_case_status not null default 'OPEN',
  revenue_at_risk_minor_units bigint not null default 0,
  recovered_amount_minor_units bigint not null default 0,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revenue_non_negative check (revenue_at_risk_minor_units >= 0),
  constraint recovered_non_negative check (recovered_amount_minor_units >= 0)
);
create index if not exists idx_recovery_cases_transaction on recovery_cases(transaction_id);
create index if not exists idx_recovery_cases_status on recovery_cases(status);

-- =========================================================
-- 6. agent_runs (AI diagnosis calls, Section 8 + 10)
-- =========================================================
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  recovery_case_id uuid references recovery_cases(id) on delete set null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  latency_ms int,
  structured_output jsonb not null,
  fallback_mode boolean not null default false,
  correlation_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_runs_transaction on agent_runs(transaction_id);

-- =========================================================
-- 7. policy_rules (versioned deterministic rules, Section 11)
-- =========================================================
create table if not exists policy_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  rule_version int not null default 1,
  config jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(rule_name, rule_version)
);

-- =========================================================
-- 8. recovery_actions
-- =========================================================
create table if not exists recovery_actions (
  id uuid primary key default gen_random_uuid(),
  recovery_case_id uuid not null references recovery_cases(id) on delete cascade,
  action_type text not null, -- e.g. controlled_retry
  status recovery_action_status not null default 'PLANNED',
  idempotency_key text not null unique, -- Section 8: prevent duplicate execution
  policy_decision jsonb,
  gateway_result jsonb,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_recovery_actions_case on recovery_actions(recovery_case_id);

-- =========================================================
-- 9. escalations
-- =========================================================
create table if not exists escalations (
  id uuid primary key default gen_random_uuid(),
  recovery_case_id uuid not null references recovery_cases(id) on delete cascade,
  reason text not null,
  priority text not null default 'MEDIUM', -- LOW | MEDIUM | HIGH
  status escalation_status not null default 'OPEN',
  recommendation text,
  resolution text,
  resolved_by uuid references users(id),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_escalations_case on escalations(recovery_case_id);
create index if not exists idx_escalations_status on escalations(status);

-- =========================================================
-- 10. audit_logs (append-only, Section 8)
-- =========================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  event_type text not null,
  actor text not null, -- 'SYSTEM' | user email | 'AI_AGENT'
  transaction_id uuid references transactions(id) on delete set null,
  recovery_case_id uuid references recovery_cases(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_correlation on audit_logs(correlation_id);
create index if not exists idx_audit_created on audit_logs(created_at);

-- =========================================================
-- 11. demo_controls (deterministic sandbox mode, Section 8)
-- =========================================================
create table if not exists demo_controls (
  id int primary key default 1,
  outcome_mode demo_outcome_mode not null default 'RETRY_SUCCEEDS',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into demo_controls (id, outcome_mode) values (1, 'RETRY_SUCCEEDS')
  on conflict (id) do nothing;

-- =========================================================
-- 12. touch updated_at helper
-- =========================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_transactions_updated on transactions;
create trigger trg_transactions_updated before update on transactions
  for each row execute function set_updated_at();

drop trigger if exists trg_recovery_cases_updated on recovery_cases;
create trigger trg_recovery_cases_updated before update on recovery_cases
  for each row execute function set_updated_at();

drop trigger if exists trg_recovery_actions_updated on recovery_actions;
create trigger trg_recovery_actions_updated before update on recovery_actions
  for each row execute function set_updated_at();
