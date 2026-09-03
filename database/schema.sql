create extension if not exists "pgcrypto";

create table if not exists customers (
  id text primary key,
  name text not null,
  email text unique,
  phone text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'OPTED_OUT', 'BLOCKED')),
  created_at timestamptz not null default now()
);

create table if not exists customer_preferences (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null unique references customers(id) on delete cascade,
  opted_out boolean not null default false,
  recovery_message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  customer_id text not null references customers(id) on delete restrict,
  order_id text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  payment_method text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'FAILED', 'SUCCESS', 'ABANDONED', 'UNRESOLVED')),
  failure_reason text,
  gateway_response text,
  retry_count integer not null default 0 check (retry_count >= 0),
  customer_response text,
  recovery_status text not null default 'NOT_STARTED'
    check (recovery_status in ('NOT_STARTED', 'OPEN', 'DIAGNOSED', 'IN_PROGRESS', 'RECOVERED', 'FAILED', 'UNRESOLVED', 'ESCALATED', 'STOPPED')),
  recovered_amount numeric(12, 2) not null default 0 check (recovered_amount >= 0),
  escalation_status text not null default 'NONE'
    check (escalation_status in ('NONE', 'OPEN', 'IN_REVIEW', 'RESOLVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_customer_id on transactions(customer_id);
create index if not exists idx_transactions_status on transactions(status);
create index if not exists idx_transactions_recovery_status on transactions(recovery_status);

create table if not exists payment_attempts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('PENDING', 'FAILED', 'SUCCESS', 'ABANDONED', 'UNRESOLVED')),
  gateway_response text,
  created_at timestamptz not null default now(),
  unique(transaction_id, attempt_number)
);

create index if not exists idx_payment_attempts_transaction_id on payment_attempts(transaction_id);

create table if not exists recovery_cases (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  risk_amount numeric(12, 2) not null check (risk_amount >= 0),
  root_cause text,
  confidence numeric(4, 3),
  evidence jsonb not null default '[]'::jsonb,
  recommended_action text,
  action_status text not null default 'PENDING'
    check (action_status in ('PENDING', 'POLICY_APPROVED', 'POLICY_BLOCKED', 'EXECUTED', 'FAILED', 'SKIPPED')),
  recovery_status text not null default 'OPEN'
    check (recovery_status in ('NOT_STARTED', 'OPEN', 'DIAGNOSED', 'IN_PROGRESS', 'RECOVERED', 'FAILED', 'UNRESOLVED', 'ESCALATED', 'STOPPED')),
  recovered_amount numeric(12, 2) not null default 0 check (recovered_amount >= 0),
  policy_result jsonb,
  detection_timestamp timestamptz not null default now(),
  success_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recovery_cases_transaction_id on recovery_cases(transaction_id);
create index if not exists idx_recovery_cases_status on recovery_cases(recovery_status);

create table if not exists recovery_actions (
  id uuid primary key default gen_random_uuid(),
  recovery_case_id uuid not null references recovery_cases(id) on delete cascade,
  action_type text not null,
  action_reason text not null,
  policy_result jsonb not null default '{}'::jsonb,
  execution_result jsonb,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'POLICY_APPROVED', 'POLICY_BLOCKED', 'EXECUTED', 'FAILED', 'SKIPPED')),
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_recovery_actions_case_id on recovery_actions(recovery_case_id);

create table if not exists escalation_cases (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  recovery_case_id uuid references recovery_cases(id) on delete set null,
  reason text not null,
  priority text not null default 'MEDIUM',
  status text not null default 'OPEN' check (status in ('NONE', 'OPEN', 'IN_REVIEW', 'RESOLVED')),
  ai_recommendation text,
  action_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_escalation_cases_transaction_id on escalation_cases(transaction_id);
create index if not exists idx_escalation_cases_status on escalation_cases(status);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete set null,
  recovery_case_id uuid references recovery_cases(id) on delete set null,
  event_type text not null,
  event_message text not null,
  actor text not null default 'SYSTEM',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_transaction_id on audit_logs(transaction_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
create index if not exists idx_audit_logs_event_type on audit_logs(event_type);

create table if not exists idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  method text not null,
  path text not null,
  request_hash text not null,
  status text not null default 'IN_PROGRESS',
  transaction_id uuid references transactions(id) on delete set null,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists policy_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  rule_version integer not null default 1,
  config jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(rule_name, rule_version)
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customer_preferences_updated_at on customer_preferences;
create trigger trg_customer_preferences_updated_at
before update on customer_preferences
for each row execute function set_updated_at();

drop trigger if exists trg_transactions_updated_at on transactions;
create trigger trg_transactions_updated_at
before update on transactions
for each row execute function set_updated_at();

drop trigger if exists trg_recovery_cases_updated_at on recovery_cases;
create trigger trg_recovery_cases_updated_at
before update on recovery_cases
for each row execute function set_updated_at();
