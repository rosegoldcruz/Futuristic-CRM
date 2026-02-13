"""
Payment models for deposits, invoices, and transactions
"""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field
from decimal import Decimal


# Payment type constants
PAYMENT_TYPES = ["deposit", "payment", "refund", "adjustment"]

# Payment method constants
PAYMENT_METHODS = ["credit_card", "debit_card", "cash", "check", "bank_transfer", "other"]

# Payment status constants
PAYMENT_STATUSES = ["pending", "processing", "completed", "failed", "refunded", "cancelled"]


class PaymentBase(BaseModel):
    """Base payment fields"""
    job_id: Optional[int] = None
    installer_id: Optional[int] = None
    payment_type: str = "payment"
    payment_method: Optional[str] = None
    amount: float
    description: Optional[str] = None
    reference_number: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class PaymentCreate(PaymentBase):
    """Create a new payment"""
    tenant_id: Optional[int] = None
    status: Optional[str] = "pending"


class PaymentUpdate(BaseModel):
    """Update an existing payment"""
    status: Optional[str] = None
    payment_method: Optional[str] = None
    paid_at: Optional[datetime] = None
    description: Optional[str] = None
    reference_number: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Payment(BaseModel):
    """Payment response model"""
    id: int
    tenant_id: Optional[int] = None
    job_id: Optional[int] = None
    installer_id: Optional[int] = None
    # Joined fields
    job_customer_name: Optional[str] = None
    installer_name: Optional[str] = None
    # Core fields
    payment_type: Optional[str] = "payment"
    payment_method: Optional[str] = None
    amount: float
    status: Optional[str] = "pending"
    paid_at: Optional[datetime] = None
    description: Optional[str] = None
    reference_number: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentStatusUpdate(BaseModel):
    """Request to update payment status"""
    status: str
    paid_at: Optional[datetime] = None


class DepositRequest(BaseModel):
    """Request to create a deposit payment"""
    job_id: int
    amount: float
    payment_method: str
    description: Optional[str] = "Deposit payment"
    reference_number: Optional[str] = None


class PaymentSummary(BaseModel):
    """Payment summary for a job or installer"""
    total_paid: float = 0.0
    total_pending: float = 0.0
    total_refunded: float = 0.0
    outstanding_balance: float = 0.0
    payment_count: int = 0


# Stripe-specific models
class StripeChargeRequest(BaseModel):
    """Request to create a Stripe charge"""
    job_id: int
    homeowner_id: int
    amount: float
    payment_method_id: Optional[str] = None  # Stripe payment method ID
    save_payment_method: bool = False
    description: Optional[str] = None
    idempotency_key: Optional[str] = None
    material_cost: Optional[float] = 0.0
    labor_cost: Optional[float] = 0.0


class StripeRefundRequest(BaseModel):
    """Request to refund a Stripe payment"""
    payment_id: int
    amount: Optional[float] = None  # Partial refund if specified
    reason: Optional[str] = None


class PaymentMethodBase(BaseModel):
    """Base payment method fields"""
    type: str = "card"
    card_brand: Optional[str] = None
    card_last4: Optional[str] = None
    card_exp_month: Optional[int] = None
    card_exp_year: Optional[int] = None
    is_default: bool = False
    metadata: Optional[dict[str, Any]] = None


class PaymentMethodCreate(PaymentMethodBase):
    """Create a payment method"""
    tenant_id: Optional[int] = None
    homeowner_id: int
    stripe_payment_method_id: str


class PaymentMethod(PaymentMethodBase):
    """Payment method response model"""
    id: int
    tenant_id: Optional[int] = None
    homeowner_id: int
    stripe_payment_method_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LedgerEntryBase(BaseModel):
    """Base ledger entry fields"""
    transaction_id: str
    entry_type: str  # "charge", "refund", "fee", "payout"
    entity_type: Optional[str] = None  # "payment", "job", "installer"
    entity_id: Optional[int] = None
    debit: float = 0.0
    credit: float = 0.0
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class LedgerEntryCreate(LedgerEntryBase):
    """Create a ledger entry"""
    tenant_id: Optional[int] = None
    balance: Optional[float] = 0.0


class LedgerEntry(LedgerEntryBase):
    """Ledger entry response model"""
    id: int
    tenant_id: Optional[int] = None
    balance: float = 0.0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlatformFeeBase(BaseModel):
    """Base platform fee fields"""
    payment_id: int
    fee_percentage: float = 10.0
    material_fee: float = 0.0
    labor_fee: float = 0.0
    total_fee: float = 0.0
    metadata: Optional[dict[str, Any]] = None


class PlatformFeeCreate(PlatformFeeBase):
    """Create a platform fee"""
    tenant_id: Optional[int] = None


class PlatformFee(PlatformFeeBase):
    """Platform fee response model"""
    id: int
    tenant_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentWithFees(Payment):
    """Payment with calculated fees"""
    platform_fee: float = 0.0
    material_cost: float = 0.0
    labor_cost: float = 0.0
    net_amount: float = 0.0  # amount - platform_fee


class StripeWebhookEvent(BaseModel):
    """Stripe webhook event payload"""
    type: str
    data: dict[str, Any]
