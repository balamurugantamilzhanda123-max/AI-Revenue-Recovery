-- Default deterministic policy rules (Section 11 of spec)
-- Run AFTER schema.sql

insert into policy_rules (rule_name, rule_version, config, active) values
  ('max_automatic_retries', 1, '{"limit": 1}'::jsonb, true),
  ('max_recovery_messages', 1, '{"limit": 2}'::jsonb, true),
  ('success_stop_rule', 1, '{"description": "SUCCESS transaction stops all further recovery"}'::jsonb, true),
  ('opt_out_rule', 1, '{"description": "Customer opt-out stops communication and recovery"}'::jsonb, true),
  ('low_confidence_threshold', 1, '{"threshold": 0.70}'::jsonb, true),
  ('duplicate_request_rule', 1, '{"description": "Same idempotency key returns prior result"}'::jsonb, true)
on conflict (rule_name, rule_version) do nothing;
