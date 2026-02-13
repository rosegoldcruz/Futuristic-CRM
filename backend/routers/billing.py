from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request, Header
import json

from models.billing import (
    SubscriptionPlan, SubscriptionPlanCreate,
    StripeCustomerCreate, SubscriptionCreate,
    Subscription, Invoice, UsageReport
)
from services import billing_service

router = APIRouter(tags=["billing"])


# Subscription Plans
@router.get("/plans", response_model=List[SubscriptionPlan])
async def list_subscription_plans(
    active_only: bool = Query(True, description="Show only active plans"),
):
    """List all subscription plans"""
    return await billing_service.list_subscription_plans(active_only)


@router.get("/plans/{plan_id}", response_model=SubscriptionPlan)
async def get_subscription_plan(plan_id: int):
    """Get subscription plan details"""
    plan = await billing_service.get_subscription_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.post("/plans", response_model=SubscriptionPlan, status_code=201)
async def create_subscription_plan(payload: SubscriptionPlanCreate):
    """Create a new subscription plan (admin only)"""
    plan_data = payload.model_dump()
    return await billing_service.create_subscription_plan(plan_data)


# Stripe Customers
@router.post("/customers", status_code=201)
async def create_customer(payload: StripeCustomerCreate):
    """Create a Stripe customer"""
    return await billing_service.create_stripe_customer(
        user_id=payload.user_id,
        tenant_id=payload.tenant_id,
        email=payload.email,
        customer_type=payload.customer_type,
        metadata=payload.metadata,
    )


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: int):
    """Get customer details"""
    customer = await billing_service.get_stripe_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/customers/user/{user_id}")
async def get_customer_by_user(user_id: int):
    """Get customer by user ID"""
    customer = await billing_service.get_stripe_customer_by_user(user_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


# Subscriptions
@router.post("/subscriptions", response_model=Subscription, status_code=201)
async def create_subscription(payload: SubscriptionCreate, customer_id: int = Query(...)):
    """Create a new subscription"""
    try:
        return await billing_service.create_subscription(
            customer_id=customer_id,
            plan_key=payload.plan_key,
            billing_cycle=payload.billing_cycle,
            trial_days=payload.trial_days,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscriptions/{subscription_id}", response_model=Subscription)
async def get_subscription(subscription_id: int):
    """Get subscription details"""
    subscription = await billing_service.get_subscription(subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription


@router.get("/subscriptions/customer/{customer_id}")
async def get_customer_subscription(customer_id: int):
    """Get active subscription for customer"""
    subscription = await billing_service.get_active_subscription(customer_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription")
    return subscription


@router.post("/subscriptions/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: int,
    immediate: bool = Query(False, description="Cancel immediately or at period end"),
):
    """Cancel a subscription"""
    try:
        await billing_service.cancel_subscription(subscription_id, immediate)
        return {"status": "canceled" if immediate else "will_cancel_at_period_end"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Usage Tracking
@router.post("/usage")
async def record_usage(
    customer_id: int,
    usage_type: str,
    quantity: int = 1,
):
    """Record usage for billing"""
    await billing_service.record_usage(
        customer_id=customer_id,
        usage_type=usage_type,
        quantity=quantity,
    )
    return {"status": "recorded", "usage_type": usage_type, "quantity": quantity}


@router.get("/usage/{customer_id}")
async def get_usage(
    customer_id: int,
    period_start: Optional[str] = Query(None),
    period_end: Optional[str] = Query(None),
):
    """Get usage summary"""
    from datetime import datetime, timedelta
    
    if not period_start:
        period_start = (datetime.now() - timedelta(days=30)).isoformat()
    if not period_end:
        period_end = datetime.now().isoformat()
    
    start_dt = datetime.fromisoformat(period_start)
    end_dt = datetime.fromisoformat(period_end)
    
    usage = await billing_service.get_usage_summary(customer_id, start_dt, end_dt)
    return usage


# Stripe Webhooks
@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
):
    """Handle Stripe webhook events"""
    # Get raw body
    body = await request.body()
    
    # In production, verify webhook signature:
    # import stripe
    # try:
    #     event = stripe.Webhook.construct_event(
    #         body, stripe_signature, webhook_secret
    #     )
    # except Exception:
    #     raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Parse event (mock for now)
    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event_type = event.get("type")
    event_id = event.get("id")
    
    if not event_type or not event_id:
        raise HTTPException(status_code=400, detail="Missing event type or ID")
    
    # Process webhook
    success = await billing_service.process_webhook_event(
        event_type=event_type,
        event_id=event_id,
        payload=event,
    )
    
    if success:
        return {"status": "processed"}
    else:
        return {"status": "already_processed"}


# Checkout
@router.post("/checkout/create-session")
async def create_checkout_session(
    customer_id: int,
    plan_key: str,
    billing_cycle: str = "monthly",
    success_url: str = Query(...),
    cancel_url: str = Query(...),
):
    """Create a Stripe checkout session"""
    # Get plan
    plans = await billing_service.list_subscription_plans()
    plan = next((p for p in plans if p.plan_key == plan_key), None)
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Get customer
    customer = await billing_service.get_stripe_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Create checkout session (mock)
    session_id = f"cs_mock_{customer_id}_{plan_key}"
    checkout_url = f"https://checkout.stripe.com/pay/{session_id}"
    
    # In production:
    # import stripe
    # session = stripe.checkout.Session.create(
    #     customer=customer.stripe_customer_id,
    #     payment_method_types=['card'],
    #     line_items=[{
    #         'price': plan.stripe_price_id_monthly if billing_cycle == 'monthly' else plan.stripe_price_id_yearly,
    #         'quantity': 1,
    #     }],
    #     mode='subscription',
    #     success_url=success_url,
    #     cancel_url=cancel_url,
    # )
    
    return {
        "session_id": session_id,
        "url": checkout_url,
        "success_url": success_url,
        "cancel_url": cancel_url,
    }


# Billing Portal
@router.post("/portal/create-session")
async def create_portal_session(
    customer_id: int,
    return_url: str = Query(...),
):
    """Create a Stripe billing portal session"""
    customer = await billing_service.get_stripe_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Create portal session (mock)
    portal_url = f"https://billing.stripe.com/session/mock_{customer_id}"
    
    # In production:
    # import stripe
    # session = stripe.billing_portal.Session.create(
    #     customer=customer.stripe_customer_id,
    #     return_url=return_url,
    # )
    
    return {
        "url": portal_url,
        "return_url": return_url,
    }


# Analytics
@router.get("/stats")
async def get_billing_stats():
    """Get billing statistics (admin only)"""
    from config.db import fetch_one
    
    # Active subscriptions
    active_query = """
        SELECT COUNT(*) as count
        FROM subscriptions
        WHERE status IN ('active', 'trialing')
    """
    active_row = await fetch_one(active_query, {})
    
    # Monthly recurring revenue
    mrr_query = """
        SELECT COALESCE(SUM(sp.price_monthly), 0) as mrr
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.status = 'active'
    """
    mrr_row = await fetch_one(mrr_query, {})
    
    return {
        "active_subscriptions": active_row[0] if active_row else 0,
        "monthly_recurring_revenue": float(mrr_row[0]) if mrr_row else 0.0,
        "total_customers": 0,  # Could add this
    }
