"""
Billing and subscription models - Stripe integration
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# Subscription tiers
SUBSCRIPTION_TIERS = ["free", "starter", "professional", "enterprise"]

# Subscription status
SUBSCRIPTION_STATUSES = ["active", "past_due", "canceled", "incomplete", "incomplete_expired", "trialing", "unpaid"]

# Customer types
CUSTOMER_TYPES = ["installer", "homeowner", "supplier", "admin"]

# Usage types
USAGE_TYPES = ["job", "quote", "file_storage", "api_call", "sms_sent", "email_sent"]


class SubscriptionPlanBase(BaseModel):
    """Base subscription plan"""
    plan_key: str
    name: str
    description: Optional[str] = None
    tier: str
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_yearly: Optional[str] = None
    features: List[str] = []
    limits: Dict[str, Any] = {}
    is_active: bool = True


class SubscriptionPlanCreate(SubscriptionPlanBase):
    """Create subscription plan"""
    pass


class SubscriptionPlan(SubscriptionPlanBase):
    """Subscription plan response"""
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StripeCustomerBase(BaseModel):
    """Base Stripe customer"""
    user_id: Optional[int] = None
    tenant_id: Optional[int] = None
    email: str
    customer_type: str
    metadata: Optional[Dict[str, Any]] = None


class StripeCustomerCreate(StripeCustomerBase):
    """Create Stripe customer"""
    pass


class StripeCustomer(StripeCustomerBase):
    """Stripe customer response"""
    id: int
    stripe_customer_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscriptionBase(BaseModel):
    """Base subscription"""
    status: str
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    canceled_at: Optional[datetime] = None
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class SubscriptionCreate(BaseModel):
    """Create subscription"""
    plan_key: str
    billing_cycle: str = "monthly"  # monthly or yearly
    trial_days: Optional[int] = None


class Subscription(SubscriptionBase):
    """Subscription response"""
    id: int
    stripe_customer_id: int
    stripe_subscription_id: str
    plan_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Invoice(BaseModel):
    """Invoice"""
    id: int
    stripe_customer_id: int
    stripe_invoice_id: str
    subscription_id: Optional[int] = None
    amount_due: float
    amount_paid: float
    status: str
    invoice_pdf: Optional[str] = None
    hosted_invoice_url: Optional[str] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UsageRecord(BaseModel):
    """Usage record"""
    id: int
    stripe_customer_id: int
    subscription_id: Optional[int] = None
    usage_type: str
    quantity: int
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BillingEvent(BaseModel):
    """Billing event from Stripe webhook"""
    id: int
    event_type: str
    stripe_event_id: str
    stripe_customer_id: Optional[str] = None
    payload: Dict[str, Any]
    processed: bool = False
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscriptionDetails(BaseModel):
    """Detailed subscription info"""
    subscription: Subscription
    plan: SubscriptionPlan
    customer: StripeCustomer
    usage: List[UsageRecord] = []
    recent_invoices: List[Invoice] = []


class BillingPortalSession(BaseModel):
    """Stripe billing portal session"""
    url: str
    return_url: str


class CheckoutSession(BaseModel):
    """Stripe checkout session"""
    session_id: str
    url: str
    success_url: str
    cancel_url: str


class UsageReport(BaseModel):
    """Usage summary"""
    usage_type: str
    quantity: int
    limit: Optional[int] = None
    percentage_used: Optional[float] = None
    overage: Optional[int] = None
