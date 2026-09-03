from app.services.diagnosis_service import diagnose_and_store


def main():
    transaction_id = "94260551-89a0-4d86-bde3-6e8ac90b1ab5"

    print()
    print("========== DIAGNOSIS STORAGE TEST ==========")

    try:
        result = diagnose_and_store(transaction_id)

        print("Root cause:")
        print(result["diagnosis"]["root_cause"])

        print("Confidence:")
        print(result["diagnosis"]["confidence"])

        print("Stored diagnosis ID:")
        print(result["stored"]["id"])

        print()
        print("✅ DIAGNOSIS STORAGE TEST PASSED")

    except Exception as exc:
        print()
        print("❌ DIAGNOSIS STORAGE TEST FAILED")
        print(type(exc).__name__, str(exc))


if __name__ == "__main__":
    main()