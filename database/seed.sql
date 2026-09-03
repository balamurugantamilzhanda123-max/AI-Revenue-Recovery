insert into customers (id, name, email, phone, status) values
  ('CUST-DEMO-001', 'Demo Customer', 'demo.customer@example.com', '+919999999999', 'ACTIVE'),
  ('CUST-DEMO-002', 'Retry Failure Customer', 'retry.failure@example.com', '+918888888888', 'ACTIVE'),
  ('CUST-DEMO-003', 'Abandoned Checkout Customer', 'abandoned@example.com', null, 'ACTIVE'),
  ('CUST-DEMO-004', 'Successful Customer', 'success@example.com', null, 'ACTIVE')
on conflict (id) do nothing;

insert into customer_preferences (customer_id, opted_out, recovery_message_count) values
  ('CUST-DEMO-001', false, 0),
  ('CUST-DEMO-002', false, 0),
  ('CUST-DEMO-003', false, 0),
  ('CUST-DEMO-004', false, 0)
on conflict (customer_id) do nothing;

insert into transactions (
  transaction_id,
  customer_id,
  order_id,
  amount,
  currency,
  payment_method,
  status,
  failure_reason,
  gateway_response,
  retry_count,
  recovery_status
) values
  ('TX-DEMO-001', 'CUST-DEMO-001', 'ORDER-DEMO-001', 5999.00, 'INR', 'UPI', 'FAILED', 'TIMEOUT', 'UPI collect request timed out at gateway', 0, 'OPEN'),
  ('TX-DEMO-002', 'CUST-DEMO-002', 'ORDER-DEMO-002', 3499.00, 'INR', 'CARD', 'FAILED', 'TEMPORARY_PAYMENT_ERROR', 'Temporary gateway error; retry allowed in sandbox', 0, 'OPEN'),
  ('TX-DEMO-003', 'CUST-DEMO-003', 'ORDER-DEMO-003', 1299.00, 'INR', 'NETBANKING', 'ABANDONED', 'CUSTOMER_ABANDONMENT', 'Checkout session expired before payment authorization', 0, 'OPEN'),
  ('TX-DEMO-004', 'CUST-DEMO-004', 'ORDER-DEMO-004', 899.00, 'INR', 'UPI', 'SUCCESS', null, 'Payment captured successfully', 0, 'NOT_STARTED')
on conflict (transaction_id) do nothing;

insert into payment_attempts (transaction_id, attempt_number, status, gateway_response)
select id, 1, status, coalesce(gateway_response, failure_reason)
from transactions
where transaction_id in ('TX-DEMO-001', 'TX-DEMO-002', 'TX-DEMO-003', 'TX-DEMO-004')
on conflict do nothing;

insert into recovery_cases (transaction_id, risk_amount, recovery_status)
select id, amount, 'OPEN'
from transactions
where transaction_id in ('TX-DEMO-001', 'TX-DEMO-002', 'TX-DEMO-003')
and not exists (
  select 1 from recovery_cases where recovery_cases.transaction_id = transactions.id
);

insert into policy_rules (rule_name, rule_version, config, active) values
  ('max_automatic_retries', 1, '{"limit": 1}', true),
  ('max_recovery_messages', 1, '{"limit": 2}', true),
  ('payment_success_stop_rule', 1, '{"when": "payment_status=SUCCESS", "action": "STOP_ALL_RECOVERY"}', true),
  ('customer_opt_out_rule', 1, '{"customer_response": "STOP", "action": "STOP_RECOVERY_COMMUNICATION"}', true),
  ('low_confidence_escalation', 1, '{"min_confidence": 0.55, "action": "ESCALATE"}', true)
on conflict (rule_name, rule_version) do nothing;
