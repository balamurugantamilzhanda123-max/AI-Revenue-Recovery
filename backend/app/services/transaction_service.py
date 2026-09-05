from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    Customer,
    CustomerPreference,
    CustomerStatus,
    EscalationStatus,
    PaymentAttempt,
    PaymentStatus,
    RecoveryStatus,
    Transaction,
)
from app.schemas.revive import TransactionCreate, TransactionUpdate
from app.services.audit_service import record_audit_event
from app.services.risk_service import ensure_recovery_case, is_recoverable_transaction
from app.services.serializers import transaction_dict


def _status(value: str | PaymentStatus) -> PaymentStatus:
    if isinstance(value, PaymentStatus):
        return value
    return PaymentStatus(value)


def get_transaction_by_ref(db: Session, transaction_ref: str) -> Transaction | None:
    return db.scalars(
        select(Transaction)
        .options(
            joinedload(Transaction.customer),
            selectinload(Transaction.payment_attempts),
            selectinload(Transaction.recovery_cases),
        )
        .where(or_(Transaction.id == transaction_ref, Transaction.transaction_id == transaction_ref))
    ).first()


def get_transaction_or_404(db: Session, transaction_ref: str) -> Transaction:
    transaction = get_transaction_by_ref(db, transaction_ref)
    if transaction is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


def ensure_customer(db: Session, payload: TransactionCreate) -> Customer:
    customer = db.get(Customer, payload.customer_id)
    if customer is None:
        customer = Customer(
            id=payload.customer_id,
            name=payload.customer_name,
            email=str(payload.customer_email) if payload.customer_email else None,
            phone=payload.customer_phone,
            status=CustomerStatus.ACTIVE,
        )
        db.add(customer)
        db.flush()
        db.add(CustomerPreference(customer_id=customer.id))
        db.flush()
    else:
        if payload.customer_name and customer.name == "Guest Customer":
            customer.name = payload.customer_name
        if payload.customer_email and not customer.email:
            customer.email = str(payload.customer_email)
        if payload.customer_phone and not customer.phone:
            customer.phone = payload.customer_phone
    return customer


def _apply_customer_stop_rule(db: Session, transaction: Transaction) -> bool:
    response = (transaction.customer_response or "").strip().upper()
    if response != "STOP":
        return False

    transaction.customer.status = CustomerStatus.OPTED_OUT
    if transaction.customer.preferences is None:
        db.add(CustomerPreference(customer_id=transaction.customer.id, opted_out=True))
    else:
        transaction.customer.preferences.opted_out = True
    transaction.recovery_status = RecoveryStatus.STOPPED
    transaction.escalation_status = EscalationStatus.NONE
    record_audit_event(
        db,
        event_type="CUSTOMER_OPT_OUT",
        event_message="Customer opted out of recovery communication",
        actor="customer",
        transaction_id=transaction.id,
        metadata={"customer_response": transaction.customer_response},
    )
    record_audit_event(
        db,
        event_type="RECOVERY_STOPPED",
        event_message="Recovery workflow stopped",
        actor="reviveai-safety-engine",
        transaction_id=transaction.id,
        metadata={
            "stop_reason": "CUSTOMER_OPTED_OUT",
            "transaction_status": transaction.status.value,
            "recovery_status": transaction.recovery_status.value,
        },
    )
    return True


def create_transaction(db: Session, payload: TransactionCreate) -> dict:
    existing = db.scalars(
        select(Transaction).where(Transaction.transaction_id == payload.transaction_id)
    ).first()
    if existing:
        return transaction_dict(existing, include_detail=True)

    customer = ensure_customer(db, payload)
    transaction = Transaction(
        transaction_id=payload.transaction_id,
        customer_id=customer.id,
        order_id=payload.order_id,
        amount=payload.amount,
        currency=payload.currency.upper(),
        payment_method=payload.payment_method,
        status=PaymentStatus(payload.status.value),
        failure_reason=payload.failure_reason,
        gateway_response=payload.gateway_response,
        retry_count=payload.retry_count,
        customer_response=payload.customer_response,
    )
    db.add(transaction)
    db.flush()

    db.add(
        PaymentAttempt(
            transaction_id=transaction.id,
            attempt_number=max(transaction.retry_count, 0) + 1,
            status=transaction.status,
            gateway_response=transaction.gateway_response or transaction.failure_reason,
        )
    )

    record_audit_event(
        db,
        event_type="TRANSACTION_INGESTED",
        event_message=f"Transaction {transaction.transaction_id} ingested",
        transaction_id=transaction.id,
        metadata={
            "status": transaction.status.value,
            "amount": float(transaction.amount),
            "currency": transaction.currency,
        },
    )

    stopped_by_customer = _apply_customer_stop_rule(db, transaction)
    if not stopped_by_customer and is_recoverable_transaction(transaction):
        ensure_recovery_case(db, transaction)

    db.commit()
    db.refresh(transaction)
    return transaction_dict(transaction, include_detail=True)


def list_transactions(
    db: Session,
    *,
    status: str | None = None,
    customer_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.customer),
            selectinload(Transaction.recovery_cases),
        )
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if status:
        query = query.where(Transaction.status == _status(status))
    if customer_id:
        query = query.where(Transaction.customer_id == customer_id)
    transactions = db.scalars(query).all()
    return {
        "data": [transaction_dict(transaction, include_detail=True) for transaction in transactions],
        "pagination": {
            "limit": limit,
            "offset": offset,
            "returned": len(transactions),
            "next_offset": offset + limit if len(transactions) == limit else None,
        },
    }


def update_transaction(db: Session, transaction_ref: str, payload: TransactionUpdate) -> dict:
    transaction = get_transaction_or_404(db, transaction_ref)
    data = payload.model_dump(exclude_none=True)
    for key, value in data.items():
        if key == "status":
            setattr(transaction, key, PaymentStatus(value.value))
        elif key == "recovery_status":
            setattr(transaction, key, RecoveryStatus(value))
        elif key == "escalation_status":
            setattr(transaction, key, EscalationStatus(value))
        else:
            setattr(transaction, key, value)

    if transaction.status == PaymentStatus.SUCCESS:
        transaction.recovery_status = RecoveryStatus.RECOVERED
        transaction.recovered_amount = transaction.amount
    else:
        stopped_by_customer = _apply_customer_stop_rule(db, transaction)
        if not stopped_by_customer and is_recoverable_transaction(transaction):
            ensure_recovery_case(db, transaction)

    record_audit_event(
        db,
        event_type="TRANSACTION_UPDATED",
        event_message=f"Transaction {transaction.transaction_id} updated",
        transaction_id=transaction.id,
        metadata=data,
    )
    db.commit()
    db.refresh(transaction)
    return transaction_dict(transaction, include_detail=True)
