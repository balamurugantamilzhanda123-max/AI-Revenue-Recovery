import sys

from app.agents.root_cause import diagnose_transaction


def main():
    if len(sys.argv) != 2:
        print("Usage: python test_root_cause.py TRANSACTION_ID")
        sys.exit(1)

    transaction_id = sys.argv[1]

    print()
    print("========== ROOT CAUSE TEST ==========")
    print()
    print("Transaction ID:", transaction_id)
    print()

    try:
        diagnosis = diagnose_transaction(transaction_id)

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
        print("✅ ROOT CAUSE TEST PASSED")

    except Exception as exc:
        print()
        print("❌ ROOT CAUSE TEST FAILED")
        print("Error type:", type(exc).__name__)
        print("Error:", str(exc))


if __name__ == "__main__":
    main()