insert into policy_rules (rule_name, rule_version, config, active) values
  ('max_automatic_retries', 1, '{"limit": 1}', true),
  ('max_recovery_messages', 1, '{"limit": 2}', true),
  ('payment_success_stop_rule', 1, '{"when": "payment_status=SUCCESS", "action": "STOP_ALL_RECOVERY"}', true),
  ('customer_opt_out_rule', 1, '{"customer_response": "STOP", "action": "STOP_RECOVERY_COMMUNICATION"}', true),
  ('idempotency_required', 1, '{"protected_endpoints": ["/api/recovery/start/{transaction_id}", "/api/payments/retry/{transaction_id}"]}', true),
  ('human_escalation_rule', 1, '{"conditions": ["repeated_failure", "low_confidence", "unsupported_action"]}', true)
on conflict (rule_name, rule_version) do nothing;
