from app.agents.root_cause import diagnose_transaction


TRANSACTION_ID = "94260551-89a0-4d86-bde3-6e8ac90b1ab5"


print("========== REAL OPENAI TEST ==========")

diagnosis = diagnose_transaction(TRANSACTION_ID)

print("Transaction ID:", diagnosis.transaction_id)
print("Root cause:", diagnosis.root_cause.value)
print("Confidence:", diagnosis.confidence)
print("Evidence:")

for item in diagnosis.evidence:
    print("-", item)

print("Reason:", diagnosis.reason)
print(
    "Requires human review:",
    diagnosis.requires_human_review,
)

print()
print("✅ REAL OPENAI DIAGNOSIS PASSED")