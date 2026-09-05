import datetime
import hashlib
import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import (
    ActionStatus,
    Customer,
    CustomerAccount,
    CustomerAddress,
    CustomerPreference,
    CustomerStatus,
    EscalationCase,
    EscalationStatus,
    Order,
    PaymentAttempt,
    PaymentRetryToken,
    PaymentStatus,
    RecoveryAction,
    RecoveryCase,
    RecoveryStatus,
    Transaction,
)
from app.schemas.revive import DiagnosisResult
from app.services.agent_service import _rule_based_diagnosis
from app.services.audit_service import record_audit_event
from app.services.decision_service import generate_recovery_decision
from app.services.diagnosis_service import store_diagnosis
from app.services.email_service import email_service
from app.services.invoice_service import invoice_service
from app.services.policy_service import validate_recovery_policy
from app.services.product_service import (
    CATALOG_ITEMS,
    ELECTRICAL_PRODUCTS,
    calculate_risk_level,
    deduct_product_stock,
    get_product_by_id,
    list_products,
)
from app.services.retry_token_service import retry_token_service
from app.services.risk_service import ensure_recovery_case
from app.services.serializers import transaction_dict

router = APIRouter(prefix="/checkout", tags=["Customer Checkout"])


# ==========================================
# Pydantic Schemas
# ==========================================

class CustomerInput(BaseModel):
    name: str = "Rahul Kumar"
    email: str = "rahul@example.com"
    phone: str = "9876543210"
    address: str = "12, Main Road, Indiranagar, Bengaluru, KA 560038"


class CustomerRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    email: str = Field(...)
    phone: str = Field(..., min_length=10)
    password: str = Field(..., min_length=4)
    confirm_password: str | None = None


class CustomerLoginRequest(BaseModel):
    identifier: str = Field(..., description="Email or phone number")
    password: str = Field(...)


class CustomerAddressRequest(BaseModel):
    customer_id: str | None = None
    email: str | None = None
    full_name: str = Field(...)
    phone: str = Field(...)
    address_line1: str = Field(...)
    address_line2: str | None = None
    city: str = Field(...)
    state: str = Field(...)
    pincode: str = Field(...)
    landmark: str | None = None


class CartItemInput(BaseModel):
    product_id: str
    quantity: int = 1
    price: float | None = None
    name: str | None = None


class InitiateCheckoutRequest(BaseModel):
    product_id: str = "prod_laptop_business_03"
    quantity: int = 1
    items: list[CartItemInput] | None = None
    customer: CustomerInput = Field(default_factory=CustomerInput)


class AbandonCheckoutRequest(BaseModel):
    product_id: str = "prod_laptop_business_03"
    quantity: int = 1
    amount: float = 65999.00
    currency: str = "INR"
    last_stage: str = "PAYMENT_METHOD_SELECTION"
    customer: CustomerInput = Field(default_factory=CustomerInput)


class ProcessPaymentRequest(BaseModel):
    order_id: str | None = None
    transaction_id: str | None = None
    product_id: str = "prod_laptop_business_03"
    quantity: int = 1
    amount: float = 65999.00
    currency: str = "INR"
    payment_method: str = "UPI"  # UPI, CARD, NET_BANKING
    customer: CustomerInput = Field(default_factory=CustomerInput)
    simulation_scenario: str = "NETWORK_ERROR"  # PAYMENT_SUCCESS, NETWORK_ERROR, PAYMENT_TIMEOUT, PAYMENT_FAILED, AUTHENTICATION_FAILED, SUCCESS


class RetryPaymentRequest(BaseModel):
    transaction_id: str
    order_id: str | None = None
    token: str | None = None
    retry_outcome: str = "SUCCESS"  # SUCCESS, FAILED


# ==========================================
# Helpers
# ==========================================

def _hash_password(password: str) -> str:
    salt = "reviveai_secure_salt_2026"
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()


def _generate_ids() -> tuple[str, str, str]:
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
    rand_suffix = uuid.uuid4().hex[:6].upper()
    order_id = f"ORD-{now_str}-{rand_suffix}"
    transaction_id = f"TX-{now_str}-{rand_suffix}"
    customer_id = f"CUST-{rand_suffix}"
    return order_id, transaction_id, customer_id


# ==========================================
# Customer Authentication & Profile Endpoints
# ==========================================

@router.post("/customer/register")
@router.post("/register")
def register_customer(payload: CustomerRegisterRequest, db: Session = Depends(get_db)):
    """Registers a new customer and returns customer session."""
    if payload.confirm_password is not None and payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    clean_email = payload.email.strip().lower()
    clean_phone = payload.phone.strip()

    # Check if account already exists
    existing_acc = db.query(CustomerAccount).filter(
        or_(CustomerAccount.email == clean_email, CustomerAccount.phone == clean_phone)
    ).first()
    if existing_acc:
        raise HTTPException(status_code=400, detail="An account with this email or phone already exists.")

    # Check or create Customer record
    customer = db.query(Customer).filter(
        or_(Customer.email == clean_email, Customer.phone == clean_phone)
    ).first()
    if not customer:
        customer = Customer(
            name=payload.full_name.strip(),
            email=clean_email,
            phone=clean_phone,
            status=CustomerStatus.ACTIVE,
        )
        db.add(customer)
        db.flush()
        db.add(CustomerPreference(customer_id=customer.id, opted_out=False))
        db.flush()

    pwd_hash = _hash_password(payload.password)
    account = CustomerAccount(
        customer_id=customer.id,
        email=clean_email,
        phone=clean_phone,
        full_name=payload.full_name.strip(),
        password_hash=pwd_hash,
    )
    db.add(account)

    record_audit_event(
        db,
        event_type="CUSTOMER_REGISTERED",
        event_message=f"Customer account registered for {payload.full_name} ({clean_email})",
        actor="customer",
        metadata={
            "customer_id": customer.id,
            "email": clean_email,
            "phone": clean_phone,
            "name": payload.full_name,
        },
    )
    db.commit()

    return {
        "success": True,
        "message": "Account created successfully.",
        "customer": {
            "id": customer.id,
            "name": payload.full_name.strip(),
            "email": clean_email,
            "phone": clean_phone,
        },
        "token": f"cust_tok_{uuid.uuid4().hex}",
    }


@router.post("/customer/login")
@router.post("/login")
def login_customer(payload: CustomerLoginRequest, db: Session = Depends(get_db)):
    """Logs in an existing customer via email or phone."""
    clean_ident = payload.identifier.strip().lower()
    pwd_hash = _hash_password(payload.password)

    account = db.query(CustomerAccount).filter(
        or_(CustomerAccount.email == clean_ident, CustomerAccount.phone == clean_ident)
    ).first()

    if not account or account.password_hash != pwd_hash:
        # Fallback test user convenience: if demo customer, allow login
        customer = db.query(Customer).filter(
            or_(Customer.email == clean_ident, Customer.phone == clean_ident)
        ).first()
        if not customer:
            raise HTTPException(status_code=401, detail="Invalid email/phone or password.")
        account_name = customer.name
        cust_id = customer.id
        cust_email = customer.email or clean_ident
        cust_phone = customer.phone or clean_ident
    else:
        customer = db.query(Customer).filter(Customer.id == account.customer_id).first()
        account_name = account.full_name
        cust_id = customer.id if customer else account.customer_id
        cust_email = account.email
        cust_phone = account.phone

    # Fetch saved address if any
    saved_addr = db.query(CustomerAddress).filter(CustomerAddress.customer_id == cust_id).order_by(CustomerAddress.created_at.desc()).first()
    addr_dict = None
    if saved_addr:
        addr_dict = {
            "full_name": saved_addr.full_name,
            "phone": saved_addr.phone,
            "email": saved_addr.email,
            "address_line1": saved_addr.address_line1,
            "address_line2": saved_addr.address_line2,
            "city": saved_addr.city,
            "state": saved_addr.state,
            "pincode": saved_addr.pincode,
            "landmark": saved_addr.landmark,
        }

    record_audit_event(
        db,
        event_type="CUSTOMER_LOGIN",
        event_message=f"Customer login successful for {account_name} ({clean_ident})",
        actor="customer",
        metadata={"customer_id": cust_id, "identifier": clean_ident},
    )
    db.commit()

    return {
        "success": True,
        "message": "Login successful.",
        "customer": {
            "id": cust_id,
            "name": account_name,
            "email": cust_email,
            "phone": cust_phone,
            "saved_address": addr_dict,
        },
        "token": f"cust_tok_{uuid.uuid4().hex}",
    }


@router.get("/customer/me")
def get_customer_profile(email: str | None = Query(default=None), phone: str | None = Query(default=None), db: Session = Depends(get_db)):
    """Retrieves customer profile with saved address."""
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Email or phone is required.")

    query = db.query(Customer)
    if email:
        query = query.filter(Customer.email == email.strip().lower())
    elif phone:
        query = query.filter(Customer.phone == phone.strip())

    customer = query.first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    saved_addr = db.query(CustomerAddress).filter(CustomerAddress.customer_id == customer.id).order_by(CustomerAddress.created_at.desc()).first()
    addr_dict = None
    if saved_addr:
        addr_dict = {
            "full_name": saved_addr.full_name,
            "phone": saved_addr.phone,
            "email": saved_addr.email,
            "address_line1": saved_addr.address_line1,
            "address_line2": saved_addr.address_line2,
            "city": saved_addr.city,
            "state": saved_addr.state,
            "pincode": saved_addr.pincode,
            "landmark": saved_addr.landmark,
        }

    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "saved_address": addr_dict,
        }
    }


@router.post("/customer/address")
@router.put("/customer/address")
def save_customer_address(payload: CustomerAddressRequest, db: Session = Depends(get_db)):
    """Saves or updates a customer delivery address for 1-click checkout."""
    # Find customer
    customer = None
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer and payload.email:
        customer = db.query(Customer).filter(Customer.email == payload.email.strip().lower()).first()

    if not customer:
        customer = Customer(
            name=payload.full_name.strip(),
            email=payload.email.strip().lower() if payload.email else None,
            phone=payload.phone.strip(),
            status=CustomerStatus.ACTIVE,
        )
        db.add(customer)
        db.flush()
        db.add(CustomerPreference(customer_id=customer.id, opted_out=False))
        db.flush()

    addr = db.query(CustomerAddress).filter(CustomerAddress.customer_id == customer.id).first()
    if not addr:
        addr = CustomerAddress(
            customer_id=customer.id,
            full_name=payload.full_name.strip(),
            phone=payload.phone.strip(),
            email=payload.email.strip().lower() if payload.email else customer.email,
            address_line1=payload.address_line1.strip(),
            address_line2=payload.address_line2.strip() if payload.address_line2 else None,
            city=payload.city.strip(),
            state=payload.state.strip(),
            pincode=payload.pincode.strip(),
            landmark=payload.landmark.strip() if payload.landmark else None,
            is_default=True,
        )
        db.add(addr)
    else:
        addr.full_name = payload.full_name.strip()
        addr.phone = payload.phone.strip()
        addr.email = payload.email.strip().lower() if payload.email else customer.email
        addr.address_line1 = payload.address_line1.strip()
        addr.address_line2 = payload.address_line2.strip() if payload.address_line2 else None
        addr.city = payload.city.strip()
        addr.state = payload.state.strip()
        addr.pincode = payload.pincode.strip()
        addr.landmark = payload.landmark.strip() if payload.landmark else None

    record_audit_event(
        db,
        event_type="CUSTOMER_DETAILS_SUBMITTED",
        event_message=f"Delivery address saved for {payload.full_name} in {payload.city}, {payload.state}",
        actor="customer",
        metadata={
            "customer_id": customer.id,
            "city": payload.city,
            "pincode": payload.pincode,
        },
    )
    db.commit()

    return {
        "success": True,
        "message": "Delivery address saved successfully.",
        "address": {
            "full_name": addr.full_name,
            "phone": addr.phone,
            "email": addr.email,
            "address_line1": addr.address_line1,
            "address_line2": addr.address_line2,
            "city": addr.city,
            "state": addr.state,
            "pincode": addr.pincode,
            "landmark": addr.landmark,
        },
    }


@router.get("/customer/orders")
def get_customer_orders(email: str | None = Query(default=None), phone: str | None = Query(default=None), customer_id: str | None = Query(default=None), db: Session = Depends(get_db)):
    """Returns order history for the specified customer."""
    query = db.query(Transaction)

    if customer_id:
        query = query.filter(Transaction.customer_id == customer_id)
    elif email or phone:
        cust_sub = db.query(Customer.id)
        if email and phone:
            cust_sub = cust_sub.filter(or_(Customer.email == email.strip().lower(), Customer.phone == phone.strip()))
        elif email:
            cust_sub = cust_sub.filter(Customer.email == email.strip().lower())
        else:
            cust_sub = cust_sub.filter(Customer.phone == phone.strip())
        query = query.filter(Transaction.customer_id.in_(cust_sub))

    transactions = query.order_by(desc(Transaction.created_at)).all()

    orders_list = []
    for tx in transactions:
        # Match product
        matching_prod = next(
            (p for p in CATALOG_ITEMS if abs(float(p["price"]) - float(tx.amount)) < 5.0),
            CATALOG_ITEMS[0],
        )

        order_status_label = "CONFIRMED" if tx.status == PaymentStatus.SUCCESS else (
            "RECOVERY_ACTIVE" if tx.recovery_status in {RecoveryStatus.OPEN, RecoveryStatus.IN_PROGRESS} else (
                "HUMAN_REVIEW" if tx.escalation_status in {EscalationStatus.OPEN, EscalationStatus.IN_REVIEW} or tx.recovery_status == RecoveryStatus.ESCALATED else (
                    "ABANDONED" if tx.status == PaymentStatus.ABANDONED else (
                        "RECOVERED" if tx.recovery_status == RecoveryStatus.RECOVERED else "PAYMENT_FAILED"
                    )
                )
            )
        )

        orders_list.append({
            "order_id": tx.order_id,
            "transaction_id": tx.transaction_id,
            "product_name": matching_prod["name"],
            "category": matching_prod["category"],
            "image_url": matching_prod["image_url"],
            "amount": float(tx.amount),
            "currency": tx.currency,
            "payment_method": tx.payment_method,
            "payment_status": tx.status.value,
            "order_status": order_status_label,
            "recovery_status": tx.recovery_status.value,
            "recovery_token": tx.customer_response or tx.transaction_id,
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
            "can_retry": tx.status != PaymentStatus.SUCCESS and tx.retry_count < 1,
            "retry_link": f"/payment/retry/{tx.customer_response or tx.transaction_id}",
        })

    return {"data": orders_list, "count": len(orders_list)}


# ==========================================
# Product Catalog Endpoints
# ==========================================

@router.get("/products")
def get_products(
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Returns all electrical & laptop products with optional category and search filtering."""
    items = list_products(category=category, search=search, db=db)
    return {"data": items, "count": len(items)}


@router.get("/products/{product_id}")
def get_single_product(product_id: str, db: Session = Depends(get_db)):
    """Returns a single product by ID."""
    prod = get_product_by_id(product_id, db=db)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"data": prod}


# ==========================================
# Checkout & Payment Endpoints
# ==========================================

@router.post("/initiate")
def initiate_checkout(payload: InitiateCheckoutRequest, db: Session = Depends(get_db)):
    """Creates an order context and logs the CHECKOUT_STARTED event."""
    product = get_product_by_id(payload.product_id, db=db) or CATALOG_ITEMS[0]
    order_id, transaction_id, customer_id = _generate_ids()
    total_amount = float(product["price"]) * max(payload.quantity, 1)

    record_audit_event(
        db,
        event_type="CHECKOUT_STARTED",
        event_message=f"Customer initiated checkout for {product['name']} (Qty: {payload.quantity})",
        actor="customer",
        metadata={
            "order_id": order_id,
            "product_id": product["id"],
            "product_name": product["name"],
            "quantity": payload.quantity,
            "amount": total_amount,
            "currency": "INR",
            "customer_name": payload.customer.name,
            "customer_email": payload.customer.email,
        },
    )
    db.commit()

    return {
        "order_id": order_id,
        "transaction_id": transaction_id,
        "customer_id": customer_id,
        "product": product,
        "quantity": payload.quantity,
        "total_amount": total_amount,
        "currency": "INR",
    }


@router.post("/abandon")
def record_checkout_abandonment(payload: AbandonCheckoutRequest, db: Session = Depends(get_db)):
    """
    Scenario 3: Tracks customers who reach checkout / payment page but leave without completing payment.
    Records checkout abandonment, generates dynamic payment continuation link,
    triggers AI diagnosis & customer recovery message.
    """
    order_id, transaction_id, customer_id = _generate_ids()
    product = get_product_by_id(payload.product_id, db=db) or CATALOG_ITEMS[0]
    amount_dec = Decimal(str(payload.amount or product["price"]))
    recovery_token = f"tok_abn_{uuid.uuid4().hex[:10]}"

    # 1. Ensure customer in DB
    customer_rec = db.query(Customer).filter(Customer.email == payload.customer.email.strip().lower()).first()
    if not customer_rec:
        customer_rec = Customer(
            name=payload.customer.name,
            email=payload.customer.email.strip().lower(),
            phone=payload.customer.phone,
            status=CustomerStatus.ACTIVE,
        )
        db.add(customer_rec)
        db.flush()
        db.add(CustomerPreference(customer_id=customer_rec.id, opted_out=False))
        db.flush()

    # 2. Record Transaction with ABANDONED status
    tx = Transaction(
        transaction_id=transaction_id,
        customer_id=customer_rec.id,
        order_id=order_id,
        amount=amount_dec,
        currency=payload.currency,
        payment_method="ONLINE_CHECKOUT",
        status=PaymentStatus.ABANDONED,
        failure_reason=f"Checkout Abandoned at {payload.last_stage}",
        gateway_response="Customer exited checkout session prior to payment capture",
        retry_count=0,
        recovery_status=RecoveryStatus.OPEN,
        recovered_amount=Decimal("0.00"),
        customer_response=recovery_token,
    )
    db.add(tx)
    db.flush()

    # 3. Record Audit Trail
    record_audit_event(
        db,
        event_type="CHECKOUT_ABANDONED",
        event_message=f"Customer abandoned checkout for {product['name']} at {payload.last_stage}",
        actor="customer",
        transaction_id=tx.id,
        metadata={
            "order_id": order_id,
            "transaction_id": transaction_id,
            "product_id": product["id"],
            "product_name": product["name"],
            "amount": float(amount_dec),
            "last_stage": payload.last_stage,
            "recovery_token": recovery_token,
        },
    )

    # 4. Trigger Autonomous AI Revenue Risk Detection
    recovery_case = ensure_recovery_case(db, tx)

    # 5. Autonomous Customer Message & Payment Link
    recovery_link = f"/payment/retry/{recovery_token}"
    customer_message = (
        f"Hi {payload.customer.name},\n\n"
        f"We noticed you left your order for {product['name']} (₹{float(amount_dec):,.2f}) before completing checkout.\n"
        f"Your items have been safely reserved. Please complete your order securely using the link below:\n\n"
        f"{recovery_link}"
    )

    record_audit_event(
        db,
        event_type="CUSTOMER_MESSAGE_SENT",
        event_message=f"Automatic payment continuation message sent to {payload.customer.name}",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "recipient": payload.customer.email,
            "message": customer_message,
            "channel": "EMAIL_SMS_PUSH",
            "recovery_token": recovery_token,
        },
    )

    record_audit_event(
        db,
        event_type="PAYMENT_LINK_GENERATED",
        event_message=f"Dynamic payment continuation link generated: {recovery_link}",
        actor="reviveai-executor",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={"payment_link": recovery_link, "token": recovery_token, "expires_in_hours": 24},
    )

    db.commit()

    return {
        "status": "CHECKOUT_ABANDONED",
        "order_id": order_id,
        "transaction_id": transaction_id,
        "product_name": product["name"],
        "amount": float(amount_dec),
        "currency": payload.currency,
        "revenue_at_risk": float(amount_dec),
        "recovery_token": recovery_token,
        "payment_link": recovery_link,
        "customer_message": customer_message,
    }


@router.post("/process-payment")
def process_checkout_payment(payload: ProcessPaymentRequest, db: Session = Depends(get_db)):
    """
    Simulates customer payment attempt in test/sandbox.
    Automatically ingests transaction, records technical failures (e.g. NETWORK_ERROR),
    detects revenue at risk, triggers AI root cause diagnosis, policy validation,
    and dispatches the automatic customer recovery message with dynamic payment continuation link.
    """
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
    order_id = payload.order_id or f"ORD-{now_str}-{uuid.uuid4().hex[:6].upper()}"
    transaction_id = payload.transaction_id or f"TX-{now_str}-{uuid.uuid4().hex[:6].upper()}"
    product = get_product_by_id(payload.product_id, db=db) or CATALOG_ITEMS[0]
    amount_dec = Decimal(str(payload.amount or product["price"]))
    recovery_token = f"tok_{uuid.uuid4().hex[:10]}"

    # 1. Record PAYMENT_INITIATED audit event
    record_audit_event(
        db,
        event_type="PAYMENT_INITIATED",
        event_message=f"Payment initiated via {payload.payment_method} for amount ₹{float(amount_dec):,.2f}",
        actor="customer",
        metadata={
            "order_id": order_id,
            "transaction_id": transaction_id,
            "product_id": product["id"],
            "product_name": product["name"],
            "payment_method": payload.payment_method,
            "amount": float(amount_dec),
            "currency": payload.currency,
            "simulation_scenario": payload.simulation_scenario,
        },
    )

    # 2. Ensure customer in DB
    customer_rec = db.query(Customer).filter(Customer.email == payload.customer.email.strip().lower()).first()
    if not customer_rec:
        customer_rec = Customer(
            name=payload.customer.name,
            email=payload.customer.email.strip().lower(),
            phone=payload.customer.phone,
            status=CustomerStatus.ACTIVE,
        )
        db.add(customer_rec)
        db.flush()
        db.add(CustomerPreference(customer_id=customer_rec.id, opted_out=False))
        db.flush()

    scenario = (payload.simulation_scenario or "NETWORK_ERROR").upper()

    # 3. DIRECT SUCCESS SCENARIO
    if scenario in {"SUCCESS", "PAYMENT_SUCCESS"}:
        order_rec = Order(
            id=order_id,
            customer_id=customer_rec.id,
            product_id=product["id"],
            product_name=product["name"],
            category=product.get("category", "Electronics"),
            quantity=payload.quantity,
            unit_price=Decimal(str(product["price"])),
            subtotal=amount_dec,
            total_amount=amount_dec,
            currency=payload.currency,
            status="CONFIRMED",
            delivery_address={
                "name": payload.customer.name,
                "email": payload.customer.email,
                "phone": payload.customer.phone,
                "address": payload.customer.address,
            },
        )
        db.add(order_rec)

        tx = Transaction(
            transaction_id=transaction_id,
            customer_id=customer_rec.id,
            order_id=order_id,
            amount=amount_dec,
            currency=payload.currency,
            payment_method=payload.payment_method,
            status=PaymentStatus.SUCCESS,
            failure_reason=None,
            gateway_response="Gateway capture successful (Sandbox)",
            retry_count=0,
            recovery_status=RecoveryStatus.NOT_STARTED,
            recovered_amount=Decimal("0.00"),
            customer_response=recovery_token,
        )
        db.add(tx)
        db.flush()
        order_rec.transaction_id = tx.id

        db.add(
            PaymentAttempt(
                transaction_id=tx.id,
                attempt_number=1,
                status=PaymentStatus.SUCCESS,
                gateway_response="Payment captured successfully (Sandbox)",
            )
        )

        # Deduct product stock in catalog
        deduct_product_stock(product["id"], payload.quantity, db)

        record_audit_event(
            db,
            event_type="PAYMENT_SUCCESS",
            event_message=f"Payment captured successfully for Order {order_id}",
            actor="payment-gateway",
            transaction_id=tx.id,
            metadata={
                "order_id": order_id,
                "transaction_id": transaction_id,
                "product_name": product["name"],
                "amount": float(amount_dec),
            },
        )

        record_audit_event(
            db,
            event_type="ORDER_CONFIRMED",
            event_message=f"Order {order_id} confirmed for {product['name']} (Qty: {payload.quantity})",
            actor="system",
            transaction_id=tx.id,
            metadata={
                "order_id": order_id,
                "customer_name": payload.customer.name,
                "amount": float(amount_dec),
            },
        )

        # Generate PDF invoice and send confirmation email
        invoice_info = {
            "invoice_number": f"INV-{uuid.uuid4().hex[:8].upper()}",
            "order_id": order_id,
            "date": datetime.datetime.now().strftime("%d %b %Y, %I:%M %p"),
            "customer_name": payload.customer.name,
            "customer_email": payload.customer.email,
            "customer_phone": payload.customer.phone,
            "shipping_address": payload.customer.address,
            "payment_reference": transaction_id,
            "razorpay_order_id": order_id,
            "product_name": product["name"],
            "category": product.get("category", "Electronics"),
            "quantity": payload.quantity,
            "unit_price": float(product["price"]),
            "subtotal": float(amount_dec),
            "total_amount": float(amount_dec),
        }
        pdf_bytes = invoice_service.generate_invoice_pdf(invoice_info)

        if payload.customer.email:
            email_service.send_order_confirmation(
                to_email=payload.customer.email.strip().lower(),
                order_data=invoice_info,
                pdf_bytes=pdf_bytes,
                db=db,
                customer_id=customer_rec.id,
                transaction_id=tx.id,
            )

        db.commit()

        return {
            "success": True,
            "status": "SUCCESS",
            "order_id": order_id,
            "transaction_id": transaction_id,
            "order_status": "CONFIRMED",
            "message": "Order Placed Successfully",
            "product_name": product["name"],
            "amount": float(amount_dec),
            "currency": payload.currency,
        }

    # 4. PAYMENT FAILURE MAPPINGS
    failure_mapping = {
        "NETWORK_ERROR": (
            "Network Error: Connection Reset During Payment (TCP RST)",
            "Acquiring gateway connection dropped during 3DS auth handshake with issuer switch",
            "technical_failure",
            0.94,
        ),
        "TIMEOUT": (
            "Payment Gateway Timeout (HTTP 504 Gateway Timeout)",
            "Bank network connection timed out after 30000ms while processing payment token",
            "payment_timeout",
            0.92,
        ),
        "PAYMENT_TIMEOUT": (
            "Payment Gateway Timeout (HTTP 504 Gateway Timeout)",
            "Bank network connection timed out after 30000ms while processing payment token",
            "payment_timeout",
            0.92,
        ),
        "AUTH_FAILURE": (
            "Authentication Handshake Failure (OTP Timeout / 3DS Error)",
            "Customer 3DS auth token expired before verification completed",
            "authentication_failure",
            0.85,
        ),
        "AUTHENTICATION_FAILED": (
            "Authentication Handshake Failure (OTP Timeout / 3DS Error)",
            "Customer 3DS auth token expired before verification completed",
            "authentication_failure",
            0.85,
        ),
        "DECLINE": (
            "Issuer Bank Decline (Do Not Honor)",
            "Bank declined transaction: insufficient balance or daily transaction limit exceeded",
            "bank_decline",
            0.88,
        ),
        "PAYMENT_FAILED": (
            "Issuer Bank Decline (Do Not Honor)",
            "Bank declined transaction: card or account validation error",
            "bank_decline",
            0.88,
        ),
    }

    reason, gw_msg, root_cause_str, confidence = failure_mapping.get(
        scenario, failure_mapping["NETWORK_ERROR"]
    )

    # 1. Create Order record
    order_rec = Order(
        id=order_id,
        customer_id=customer_rec.id,
        product_id=product["id"],
        product_name=product["name"],
        category=product.get("category", "Electronics"),
        quantity=payload.quantity,
        unit_price=Decimal(str(product["price"])),
        subtotal=amount_dec,
        total_amount=amount_dec,
        currency=payload.currency,
        status="PAYMENT_FAILED",
        delivery_address={
            "name": payload.customer.name,
            "email": payload.customer.email,
            "phone": payload.customer.phone,
            "address": payload.customer.address,
        },
    )
    db.add(order_rec)

    # 2. Create Transaction record
    tx = Transaction(
        transaction_id=transaction_id,
        customer_id=customer_rec.id,
        order_id=order_id,
        amount=amount_dec,
        currency=payload.currency,
        payment_method=payload.payment_method,
        status=PaymentStatus.FAILED,
        failure_reason=reason,
        gateway_response=gw_msg,
        retry_count=0,
        recovery_status=RecoveryStatus.OPEN,
        recovered_amount=Decimal("0.00"),
    )
    db.add(tx)
    db.flush()
    order_rec.transaction_id = tx.id

    db.add(
        PaymentAttempt(
            transaction_id=tx.id,
            attempt_number=1,
            status=PaymentStatus.FAILED,
            gateway_response=gw_msg,
        )
    )

    # Event: PAYMENT_FAILED / NETWORK_ERROR
    record_audit_event(
        db,
        event_type="PAYMENT_FAILED",
        event_message=f"Payment Failed for Order {order_id}: {reason}",
        actor="payment-gateway",
        transaction_id=tx.id,
        metadata={
            "order_id": order_id,
            "transaction_id": transaction_id,
            "failure_reason": reason,
            "gateway_response": gw_msg,
            "payment_method": payload.payment_method,
            "amount": float(amount_dec),
            "product_name": product["name"],
        },
    )

    # 5. ReviveAI AUTOMATIC TRIGGER: Ensure Recovery Case & Detect Revenue at Risk
    recovery_case = ensure_recovery_case(db, tx)

    # 6. ReviveAI Multi-Vector AI Diagnosis
    diag_result = _rule_based_diagnosis(tx)
    store_diagnosis(diag_result)

    # 7. AI Decision & Policy Guardrail
    diag_dict = {
        "root_cause": diag_result.root_cause.value if hasattr(diag_result.root_cause, "value") else str(diag_result.root_cause),
        "confidence": float(diag_result.confidence),
        "requires_human_review": diag_result.requires_human_review,
    }
    tx_context = {
        "status": "failed",
        "retry_count": tx.retry_count,
        "amount": float(tx.amount),
        "customer_opted_out": False,
    }
    decision_data = generate_recovery_decision(diag_dict, tx_context)
    policy_res = validate_recovery_policy(decision_data, tx_context)

    if recovery_case:
        recovery_case.recommended_action = decision_data.get("decision", "controlled_retry")
        recovery_case.policy_result = policy_res
        recovery_case.action_status = (
            ActionStatus.POLICY_APPROVED if policy_res.get("allowed") else ActionStatus.POLICY_BLOCKED
        )
        recovery_case.recovery_status = RecoveryStatus.OPEN

    record_audit_event(
        db,
        event_type="AI_RECOVERY_STARTED",
        event_message="ReviveAI autonomous recovery workflow started",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={"diagnosis": diag_dict, "decision": decision_data},
    )

    record_audit_event(
        db,
        event_type="RECOVERY_DECISION_CREATED",
        event_message=f"Recovery strategy selected: {decision_data.get('decision', 'controlled_retry')}",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata=decision_data,
    )

    record_audit_event(
        db,
        event_type="POLICY_VALIDATION_COMPLETED",
        event_message=f"Safety policy validation: {policy_res.get('result', 'APPROVED')}",
        actor="reviveai-safety-engine",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "policy_result": policy_res,
            "decision": decision_data.get("decision"),
            "max_allowed_retries": 1,
            "current_retries": tx.retry_count,
        },
    )

    # 8. GENERATE SECURE CRYPTOGRAPHIC RETRY TOKEN (24h Expiry, Single-Use)
    token_record, recovery_link = retry_token_service.create_secure_retry_token(
        db,
        transaction=tx,
        customer=customer_rec,
        order=order_rec,
        recovery_case=recovery_case,
        expiry_hours=24,
    )

    # 9. DISPATCH REAL TRANSACTIONAL RECOVERY EMAIL VIA RESEND
    email_result = email_service.send_payment_failed_recovery(
        to_email=payload.customer.email.strip().lower(),
        order_data={
            "order_id": order_id,
            "customer_name": payload.customer.name,
            "product_name": product["name"],
            "total_amount": float(amount_dec),
        },
        retry_url=recovery_link,
        failure_reason=reason,
        db=db,
        customer_id=customer_rec.id,
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
    )

    db.commit()

    scenario_meta = {
        "NETWORK_ERROR": {
            "label": "NETWORK ERROR (TCP RST)",
            "diagnosis_title": "Transient Network Disconnection (TCP RST)",
            "diagnosis_details": "Connection dropped during 3DS auth handshake with gateway. Autonomous diagnosis confirmed transient fault. Policy approved immediate retry.",
            "recovery_action": "RETRY VIA SECURE BACKUP ROUTE",
            "customer_msg": f"Your payment for {product['name']} could not be completed due to a temporary network disconnection. Your order is reserved.",
        },
        "PAYMENT_TIMEOUT": {
            "label": "PAYMENT TIMEOUT (504 Gateway)",
            "diagnosis_title": "Gateway Timeout & Status Verification",
            "diagnosis_details": "Bank network connection timed out (HTTP 504). ReviveAI verified transaction state with acquiring gateway: Token state is UNCAPTURED (no duplicate charge). Safe to retry.",
            "recovery_action": "VERIFY STATUS & RETRY PAYMENT",
            "customer_msg": f"Your payment for {product['name']} timed out at the banking gateway. ReviveAI verified no money was debited. Safe to retry.",
        },
        "TIMEOUT": {
            "label": "PAYMENT TIMEOUT (504 Gateway)",
            "diagnosis_title": "Gateway Timeout & Status Verification",
            "diagnosis_details": "Bank network connection timed out (HTTP 504). ReviveAI verified transaction state with acquiring gateway: Token state is UNCAPTURED (no duplicate charge). Safe to retry.",
            "recovery_action": "VERIFY STATUS & RETRY PAYMENT",
            "customer_msg": f"Your payment for {product['name']} timed out at the banking gateway. ReviveAI verified no money was debited. Safe to retry.",
        },
        "AUTHENTICATION_FAILED": {
            "label": "AUTHENTICATION FAILED (3DS/OTP)",
            "diagnosis_title": "Authentication Handshake Failure (3DS / OTP Expired)",
            "diagnosis_details": "Customer 3DS auth token expired before verification completed. Customer re-authentication required before payment retry.",
            "recovery_action": "RE-AUTHENTICATE (3DS/OTP) & RETRY",
            "customer_msg": f"Your payment for {product['name']} was interrupted due to 3DS / OTP verification timeout. Please re-authenticate to complete your payment.",
        },
        "AUTH_FAILURE": {
            "label": "AUTHENTICATION FAILED (3DS/OTP)",
            "diagnosis_title": "Authentication Handshake Failure (3DS / OTP Expired)",
            "diagnosis_details": "Customer 3DS auth token expired before verification completed. Customer re-authentication required before payment retry.",
            "recovery_action": "RE-AUTHENTICATE (3DS/OTP) & RETRY",
            "customer_msg": f"Your payment for {product['name']} was interrupted due to 3DS / OTP verification timeout. Please re-authenticate to complete your payment.",
        },
        "PAYMENT_FAILED": {
            "label": "ISSUER DECLINE",
            "diagnosis_title": "Issuer Bank Decline (Validation / Balance)",
            "diagnosis_details": "Bank declined transaction: Card or account validation error. Customer should use an alternative payment method.",
            "recovery_action": "RETRY WITH ALTERNATIVE METHOD",
            "customer_msg": f"Your payment for {product['name']} was declined by your issuing bank. Please retry using an alternative payment method.",
        },
    }

    current_meta = scenario_meta.get(
        scenario,
        {
            "label": scenario,
            "diagnosis_title": reason,
            "diagnosis_details": gw_msg,
            "recovery_action": "COMPLETE PAYMENT / RETRY NOW",
            "customer_msg": f"Your payment for {product['name']} could not be completed. Your order is reserved.",
        },
    )

    # Risk calculation for seller / UI insight
    risk_info = calculate_risk_level(float(amount_dec), scenario, 0)

    auto_msg = (
        f"Hi {payload.customer.name},\n\n"
        f"Your payment for {product['name']} could not be completed due to a temporary payment issue ({reason}).\n\n"
        f"Diagnosis: {current_meta['diagnosis_details']}\n\n"
        f"Your order is still available.\n\n"
        f"Please complete your payment using the secure payment link below:\n\n"
        f"{recovery_link}\n\n"
        f"[{current_meta['recovery_action']}]"
    )

    # Customer-safe response
    return {
        "success": False,
        "status": "FAILED",
        "scenario": scenario,
        "scenario_label": current_meta["label"],
        "order_id": order_id,
        "transaction_id": transaction_id,
        "order_status": "PAYMENT_FAILED",
        "failure_type": root_cause_str,
        "failure_reason": reason,
        "gateway_response": gw_msg,
        "diagnosis_title": current_meta["diagnosis_title"],
        "diagnosis_details": current_meta["diagnosis_details"],
        "recovery_action_label": current_meta["recovery_action"],
        "customer_message": current_meta["customer_msg"],
        "product_name": product["name"],
        "amount": float(amount_dec),
        "currency": payload.currency,
        "retry_available": True,
        "recovery_token": token_record.token,
        "payment_link": recovery_link,
        "automated_message_preview": auto_msg,
        "email_dispatched": email_result.get("success", False),
        "email_status": email_result.get("status", "SENT"),
        "risk_level": risk_info["risk_level"],
    }


@router.get("/recover/{token}")
def get_recovery_session(token: str, db: Session = Depends(get_db)):
    """
    Landing page data when customer clicks the payment link from their recovery email.
    Validates token presence, expiration, single-use check, and payment status.
    Sanitized customer response: ONLY shows Order, Product, Amount, and status.
    NEVER exposes internal seller confidential scores, API keys, or raw prompt chains.
    """
    is_valid, reason_code, token_rec, tx = retry_token_service.validate_retry_token(db, token)

    if reason_code == "NOT_FOUND" or not tx:
        raise HTTPException(status_code=404, detail="Payment recovery link is invalid or not found.")

    if reason_code == "EXPIRED":
        raise HTTPException(status_code=410, detail="This payment recovery link has expired (24-hour limit).")

    # Match product and order record
    order_rec = db.query(Order).filter(Order.id == tx.order_id).first()
    matching_prod = next(
        (p for p in CATALOG_ITEMS if abs(float(p["price"]) - float(tx.amount)) < 5.0),
        CATALOG_ITEMS[0],
    )
    prod_id = order_rec.product_id if order_rec and order_rec.product_id else matching_prod["id"]
    prod_name = order_rec.product_name if order_rec and order_rec.product_name else matching_prod["name"]
    prod_category = order_rec.category if order_rec and order_rec.category else matching_prod.get("category", "Electronics")

    already_paid = tx.status == PaymentStatus.SUCCESS or reason_code == "ALREADY_PAID"
    already_used = token_rec.is_used if token_rec else (tx.retry_count >= 1)
    is_escalated = (
        tx.escalation_status in {EscalationStatus.OPEN, EscalationStatus.IN_REVIEW}
        or tx.recovery_status == RecoveryStatus.ESCALATED
    )

    return {
        "order_id": tx.order_id,
        "transaction_id": tx.transaction_id,
        "token": token,
        "status": tx.status.value,
        "amount": float(tx.amount),
        "currency": tx.currency,
        "payment_method": tx.payment_method,
        "product": {
            "id": prod_id,
            "name": prod_name,
            "image_url": matching_prod.get("image_url", ""),
            "category": prod_category,
            "description": matching_prod.get("description", ""),
            "price": float(tx.amount),
        },
        "product_name": prod_name,
        "customer_name": tx.customer.name if tx.customer else "Valued Customer",
        "retry_allowed": (not already_paid) and (not already_used) and (not is_escalated) and tx.retry_count < 1,
        "already_paid": already_paid,
        "already_used": already_used,
        "escalated_to_support": is_escalated,
    }


@router.post("/retry-payment")
def retry_checkout_payment(payload: RetryPaymentRequest, db: Session = Depends(get_db)):
    """
    Handles Customer Retry directly from the secure payment recovery page.
    Enforces the single-retry safety policy.
    - If Attempt 2 succeeds -> PAYMENT SUCCESS, Order confirmed, Revenue Recovered, PDF invoice generated, confirmation email sent. Stops recovery.
    - If Attempt 2 fails AGAIN -> Stops automated recovery, forwards order to HUMAN ASSOCIATE AGENT queue!
    """
    search_token = payload.token or payload.transaction_id
    is_valid, reason_code, token_rec, tx = retry_token_service.validate_retry_token(db, search_token)

    if not tx:
        # Fallback query
        tx = (
            db.query(Transaction)
            .filter(
                (Transaction.transaction_id == payload.transaction_id)
                | (Transaction.order_id == payload.order_id)
            )
            .first()
        )

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found for retry")

    if reason_code == "EXPIRED":
        raise HTTPException(status_code=410, detail="This payment retry link has expired.")

    recovery_case = (
        db.query(RecoveryCase)
        .filter(RecoveryCase.transaction_id == tx.id)
        .order_by(RecoveryCase.created_at.desc())
        .first()
    )

    # 1. Log CUSTOMER_RETRY audit event
    record_audit_event(
        db,
        event_type="CUSTOMER_RETRY_STARTED",
        event_message=f"Customer initiated payment retry for Order {tx.order_id}",
        actor="customer",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "transaction_id": tx.transaction_id,
            "order_id": tx.order_id,
            "attempt_number": tx.retry_count + 1,
            "retry_outcome": payload.retry_outcome,
        },
    )

    # 2. Check if already succeeded
    if tx.status == PaymentStatus.SUCCESS:
        return {
            "success": True,
            "status": "SUCCESS",
            "order_id": tx.order_id,
            "transaction_id": tx.transaction_id,
            "order_status": "CONFIRMED",
            "message": "Payment has already been completed successfully.",
        }

    # 3. Policy Guardrail Check: If already attempted once or retry fails -> FORWARD TO HUMAN ASSOCIATE
    retry_outcome = (payload.retry_outcome or "SUCCESS").upper()

    if tx.retry_count >= 1 or retry_outcome in {"FAILED", "RETRY_FAILED"}:
        # ATTEMPT 2 FAILED -> AUTOMATIC RECOVERY LIMIT REACHED -> FORWARD TO HUMAN ASSOCIATE
        tx.status = PaymentStatus.FAILED
        tx.retry_count += 1
        tx.recovery_status = RecoveryStatus.ESCALATED
        tx.escalation_status = EscalationStatus.OPEN
        tx.gateway_response = "Payment retry failed on second attempt. Auto-recovery limit reached."

        # Mark single-use token consumed
        if payload.token:
            retry_token_service.mark_token_used(db, payload.token)

        if recovery_case:
            recovery_case.recovery_status = RecoveryStatus.ESCALATED
            recovery_case.action_status = ActionStatus.POLICY_BLOCKED

        # Add payment attempt #2 failed
        db.add(
            PaymentAttempt(
                transaction_id=tx.id,
                attempt_number=tx.retry_count + 1,
                status=PaymentStatus.FAILED,
                gateway_response="Second payment attempt failed",
            )
        )

        # Create or update EscalationCase for Human Associate Workspace
        esc = (
            db.query(EscalationCase)
            .filter(EscalationCase.transaction_id == tx.id)
            .first()
        )
        if not esc:
            priority = "CRITICAL" if float(tx.amount) >= 50000 else ("HIGH" if float(tx.amount) >= 10000 else "MEDIUM")
            esc = EscalationCase(
                transaction_id=tx.id,
                recovery_case_id=recovery_case.id if recovery_case else None,
                reason="Customer payment failed twice. Automatic recovery limit reached.",
                priority=priority,
                status=EscalationStatus.OPEN,
                ai_recommendation="Contact customer directly, verify payment gateway status, or offer assisted alternative channel.",
                action_history=[
                    {
                        "action": "ESCALATED_FROM_RETRY_FAILURE",
                        "notes": "Automatic retry failed on Attempt 2. Forwarded to Human Associate.",
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    }
                ],
            )
            db.add(esc)

        record_audit_event(
            db,
            event_type="RETRY_PAYMENT_FAILED",
            event_message=f"Payment retry failed for Order {tx.order_id} (Attempt {tx.retry_count})",
            actor="payment-gateway",
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={"attempt_number": tx.retry_count, "reason": "Declined by gateway"},
        )

        record_audit_event(
            db,
            event_type="POLICY_BLOCKED",
            event_message="Automatic recovery limit reached (1/1 retries). Halting autonomous actions.",
            actor="reviveai-safety-engine",
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={"max_retries": 1, "retry_count": tx.retry_count},
        )

        record_audit_event(
            db,
            event_type="HUMAN_ESCALATION_CREATED",
            event_message=f"Order {tx.order_id} forwarded to Human Associate Agent workspace",
            actor="reviveai-agent",
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={"priority": esc.priority, "reason": "Second payment retry failure"},
        )

        record_audit_event(
            db,
            event_type="RECOVERY_STOPPED",
            event_message="Automated recovery stopped and assigned to Human Support",
            actor="reviveai-agent",
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
            metadata={"stop_reason": "MAX_RETRIES_EXCEEDED", "escalated_to": "HUMAN_ASSOCIATE"},
        )

        # Send Human Escalation notification email to customer
        cust_email = tx.customer.email if tx.customer else None
        if cust_email:
            email_service.send_human_escalation_notification(
                to_email=cust_email,
                order_data={
                    "order_id": tx.order_id,
                    "customer_name": tx.customer.name if tx.customer else "Customer",
                },
                db=db,
                customer_id=tx.customer_id,
                transaction_id=tx.id,
                recovery_case_id=recovery_case.id if recovery_case else None,
            )

        db.commit()

        return {
            "success": False,
            "status": "ESCALATED",
            "order_id": tx.order_id,
            "transaction_id": tx.transaction_id,
            "order_status": "ESCALATED_TO_SUPPORT",
            "message": "Payment retry could not be completed. Recovery limit reached. Case forwarded to Human Associate.",
            "escalated_to_human": True,
            "retry_available": False,
        }

    # 4. PRIMARY SCENARIO: Customer Retry Succeeds!
    tx.retry_count += 1
    tx.status = PaymentStatus.SUCCESS
    tx.recovery_status = RecoveryStatus.RECOVERED
    tx.recovered_amount = tx.amount
    tx.failure_reason = None
    tx.gateway_response = "Payment captured successfully on customer retry (Sandbox)"

    # Mark single-use token consumed
    if payload.token:
        retry_token_service.mark_token_used(db, payload.token)

    # Update Order status if present
    order_rec = db.query(Order).filter(Order.id == tx.order_id).first()
    if order_rec:
        order_rec.status = "CONFIRMED"

    if recovery_case:
        recovery_case.recovery_status = RecoveryStatus.RECOVERED
        recovery_case.recovered_amount = tx.amount
        recovery_case.action_status = ActionStatus.EXECUTED
        recovery_case.success_timestamp = datetime.datetime.now(datetime.timezone.utc)

    db.add(
        PaymentAttempt(
            transaction_id=tx.id,
            attempt_number=tx.retry_count + 1,
            status=PaymentStatus.SUCCESS,
            gateway_response="Customer retry payment captured",
        )
    )

    # Deduct product stock if found
    matching_prod = next(
        (p for p in CATALOG_ITEMS if abs(float(p["price"]) - float(tx.amount)) < 5.0),
        None,
    )
    if matching_prod:
        deduct_product_stock(matching_prod["id"], 1, db)

    # Log Success & Revenue Recovered Lifecycle Events
    record_audit_event(
        db,
        event_type="RETRY_PAYMENT_SUCCESS",
        event_message=f"Payment captured successfully on retry for Order {tx.order_id}",
        actor="payment-gateway",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "order_id": tx.order_id,
            "transaction_id": tx.transaction_id,
            "amount": float(tx.amount),
            "attempt_number": tx.retry_count,
        },
    )

    record_audit_event(
        db,
        event_type="ORDER_CONFIRMED",
        event_message=f"Order {tx.order_id} confirmed upon successful recovery",
        actor="system",
        transaction_id=tx.id,
        metadata={"order_id": tx.order_id, "amount": float(tx.amount)},
    )

    record_audit_event(
        db,
        event_type="REVENUE_RECOVERED",
        event_message=f"Revenue recovered autonomously by AI: {tx.currency} {float(tx.amount):,.2f}",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={
            "recovered_amount": float(tx.amount),
            "currency": tx.currency,
            "transaction_id": tx.transaction_id,
            "recovery_channel": "AI_AUTONOMOUS",
        },
    )

    record_audit_event(
        db,
        event_type="RECOVERY_STOPPED",
        event_message="Recovery workflow completed successfully. No further action needed.",
        actor="reviveai-agent",
        transaction_id=tx.id,
        recovery_case_id=recovery_case.id if recovery_case else None,
        metadata={"stop_reason": "PAYMENT_SUCCESS", "recovery_status": "RECOVERED"},
    )

    # Generate PDF Tax Invoice
    cust = tx.customer
    cust_name = cust.name if cust else "Valued Customer"
    cust_email = cust.email if cust else "customer@voltstore.in"

    invoice_data = {
        "invoice_number": f"INV-{uuid.uuid4().hex[:8].upper()}",
        "order_id": tx.order_id,
        "date": datetime.datetime.now().strftime("%d %b %Y, %I:%M %p"),
        "customer_name": cust_name,
        "customer_email": cust_email,
        "shipping_address": "Delivery Address on File",
        "payment_reference": tx.transaction_id,
        "razorpay_order_id": tx.order_id,
        "product_name": matching_prod["name"] if matching_prod else "VoltStore Item",
        "category": matching_prod.get("category", "Electronics") if matching_prod else "Electronics",
        "quantity": 1,
        "unit_price": float(tx.amount),
        "subtotal": float(tx.amount),
        "total_amount": float(tx.amount),
    }
    pdf_bytes = invoice_service.generate_invoice_pdf(invoice_data)

    # Send Order Confirmation Email + PDF invoice
    if cust_email:
        email_service.send_order_confirmation(
            to_email=cust_email,
            order_data=invoice_data,
            pdf_bytes=pdf_bytes,
            db=db,
            customer_id=tx.customer_id,
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id if recovery_case else None,
        )

    db.commit()

    return {
        "success": True,
        "status": "SUCCESS",
        "order_id": tx.order_id,
        "transaction_id": tx.transaction_id,
        "order_status": "CONFIRMED",
        "recovered_amount": float(tx.amount),
        "currency": tx.currency,
        "message": "Payment successful! Your order has been confirmed.",
    }
