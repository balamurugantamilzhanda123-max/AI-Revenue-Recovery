from pathlib import Path
import shutil

path = Path(r".\\app\\services\\recovery_service.py")
backup = Path(r".\\app\\services\\recovery_service.py.before_phase8_fix")

if not path.exists():
    raise SystemExit(f"File not found: {path}")

shutil.copy2(path, backup)
text = path.read_text(encoding="utf-8")

old_line = "    recovery_case.policy_result = policy"
new_line = "    if recovery_case is not None:\\n        recovery_case.policy_result = policy"

if old_line not in text:
    raise SystemExit("Expected policy_result line was not found. No changes made.")

text = text.replace(old_line, new_line, 1)

start_marker = '    if not policy["allowed"]:\\n'
start = text.find(start_marker)
if start == -1:
    raise SystemExit("Expected blocked-policy block was not found. No changes made.")

end_marker = "    result = execute_controlled_retry(\\n"
end = text.find(end_marker, start)
if end == -1:
    raise SystemExit("Could not locate end of blocked branch. No changes made.")

new_branch = '    if not policy["allowed"]:\n        if recovery_case is not None:\n            recovery_case.action_status = ActionStatus.POLICY_BLOCKED\n\n        escalation = None\n\n        if policy["result"] == "ESCALATE":\n            escalation = create_escalation(\n                db,\n                transaction=transaction,\n                recovery_case=recovery_case,\n                reason="; ".join(policy.get("reasons", [])),\n                priority="HIGH",\n                ai_recommendation=decision.reason,\n            )\n        else:\n            transaction.recovery_status = RecoveryStatus.STOPPED\n\n            if recovery_case is not None:\n                recovery_case.recovery_status = RecoveryStatus.STOPPED\n\n        result = {\n            "transaction_id": transaction.transaction_id,\n            "decision": decision.model_dump(mode="json"),\n            "policy": policy,\n            "recovery_status": transaction.recovery_status.value,\n            "escalation_id": escalation.id if escalation else None,\n            "action_id": None,\n            "recovery_case": (\n                recovery_case_dict(\n                    recovery_case,\n                    include_actions=True,\n                )\n                if recovery_case is not None\n                else None\n            ),\n        }\n\n        record_audit_event(\n            db,\n            event_type="POLICY_BLOCKED_ACTION",\n            event_message=(\n                f"Policy blocked recovery for "\n                f"{transaction.transaction_id}"\n            ),\n            transaction_id=transaction.id,\n            recovery_case_id=(\n                recovery_case.id\n                if recovery_case is not None\n                else None\n            ),\n            metadata=policy,\n        )\n\n        finish_idempotent_request(\n            db,\n            idem,\n            response_payload=result,\n        )\n        db.commit()\n        return result\n\n'
text = text[:start] + new_branch + text[end:]

compile(text, str(path), "exec")
path.write_text(text, encoding="utf-8")

print("PHASE 8 AUTOMATIC REPAIR: PASS")
print(f"Backup created: {backup}")
print(f"Updated: {path}")
print("Python syntax: PASS")
