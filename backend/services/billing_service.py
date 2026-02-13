"""
Billing service - Stripe integration, subscriptions, usage tracking
"""
from typing import Optional, List, Dict, Any
import json
from datetime import datetime, timedelta
from config.db import fetch_one, fetch_all, execute, execute_returning
from models.billing import (
    SubscriptionPlan, StripeCustomer, Subscription,
    Invoice, UsageRecord, BillingEvent
)

# Mock Stripe - in production, use actual Stripe SDK
# import stripe
# stripe.api_key = os.getenv("STRIPE_API_KEY")

MOCK_STRIPE_ENABLED = True  # Set to False in production


def _parse_json_field(value: Any) -> Any:
    """Parse JSON string to Python object if needed."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


# Subscription Plans
async def create_subscription_plan(plan_data: Dict[str, Any]) -> SubscriptionPlan:
    """Create a subscription plan"""
    query = """
        INSERT INTO subscription_plans (
            plan_key, name, description, tier, price_monthly, price_yearly,
            stripe_price_id_monthly, stripe_price_id_yearly, features, limits, is_active
        )
        VALUES (
            :plan_key, :name, :description, :tier, :price_monthly, :price_yearly,
            :stripe_price_id_monthly, :stripe_price_id_yearly, 
            CAST(:features AS jsonb), CAST(:limits AS jsonb), :is_active
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "plan_key": plan_data["plan_key"],
        "name": plan_data["name"],
        "description": plan_data.get("description"),
        "tier": plan_data["tier"],
        "price_monthly": plan_data.get("price_monthly"),
        "price_yearly": plan_data.get("price_yearly"),
        "stripe_price_id_monthly": plan_data.get("stripe_price_id_monthly"),
        "stripe_price_id_yearly": plan_data.get("stripe_price_id_yearly"),
        "features": json.dumps(plan_data.get("features", [])),
        "limits": json.dumps(plan_data.get("limits", {})),
        "is_active": plan_data.get("is_active", True),
    })
    
    return await get_subscription_plan(row["id"])  # type: ignore


async def get_subscription_plan(plan_id: int) -> Optional[SubscriptionPlan]:
    """Get subscription plan by ID"""
    query = "SELECT * FROM subscription_plans WHERE id = :plan_id"
    row = await fetch_one(query, {"plan_id": plan_id})
    
    if not row:
        return None
    
    return SubscriptionPlan(
        id=row[0],
        plan_key=row[1],
        name=row[2],
        description=row[3],
        tier=row[4],
        price_monthly=float(row[5]) if row[5] else None,
        price_yearly=float(row[6]) if row[6] else None,
        stripe_price_id_monthly=row[7],
        stripe_price_id_yearly=row[8],
        features=_parse_json_field(row[9]) or [],
        limits=_parse_json_field(row[10]) or {},
        is_active=row[11],
        created_at=row[12],
    )


async def list_subscription_plans(active_only: bool = True) -> List[SubscriptionPlan]:
    """List all subscription plans"""
    query = "SELECT * FROM subscription_plans WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if active_only:
        query += " AND is_active = true"
    
    query += " ORDER BY tier, price_monthly"
    
    rows = await fetch_all(query, params)
    
    return [
        SubscriptionPlan(
            id=r[0], plan_key=r[1], name=r[2], description=r[3],
            tier=r[4], price_monthly=float(r[5]) if r[5] else None,
            price_yearly=float(r[6]) if r[6] else None,
            stripe_price_id_monthly=r[7], stripe_price_id_yearly=r[8],
            features=_parse_json_field(r[9]) or [],
            limits=_parse_json_field(r[10]) or {},
            is_active=r[11], created_at=r[12]
        )
        for r in rows
    ]


# Stripe Customers
async def create_stripe_customer(
    user_id: Optional[int],
    tenant_id: Optional[int],
    email: str,
    customer_type: str,
    metadata: Optional[Dict[str, Any]] = None
) -> StripeCustomer:
    """Create a Stripe customer"""
    # Create Stripe customer via API
    if MOCK_STRIPE_ENABLED:
        stripe_customer_id = f"cus_mock_{user_id or tenant_id}_{int(datetime.now().timestamp())}"
        print(f"[MOCK] Created Stripe customer: {stripe_customer_id}")
    else:
        # import stripe
        # stripe_customer = stripe.Customer.create(
        #     email=email,
        #     metadata=metadata or {}
        # )
        # stripe_customer_id = stripe_customer.id
        pass
    
    # Store in database
    query = """
        INSERT INTO stripe_customers (
            user_id, tenant_id, stripe_customer_id, email, customer_type, metadata
        )
        VALUES (:user_id, :tenant_id, :stripe_customer_id, :email, :customer_type, CAST(:metadata AS jsonb))
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "stripe_customer_id": stripe_customer_id,
        "email": email,
        "customer_type": customer_type,
        "metadata": json.dumps(metadata or {}),
    })
    
    return await get_stripe_customer(row["id"])  # type: ignore


async def get_stripe_customer(customer_id: int) -> Optional[StripeCustomer]:
    """Get Stripe customer by ID"""
    query = "SELECT * FROM stripe_customers WHERE id = :customer_id"
    row = await fetch_one(query, {"customer_id": customer_id})
    
    if not row:
        return None
    
    return StripeCustomer(
        id=row[0],
        user_id=row[1],
        tenant_id=row[2],
        stripe_customer_id=row[3],
        email=row[4],
        customer_type=row[5],
        metadata=_parse_json_field(row[6]),
        created_at=row[7],
        updated_at=row[8],
    )


async def get_stripe_customer_by_user(user_id: int) -> Optional[StripeCustomer]:
    """Get Stripe customer by user ID"""
    query = "SELECT * FROM stripe_customers WHERE user_id = :user_id"
    row = await fetch_one(query, {"user_id": user_id})
    
    if not row:
        return None
    
    return StripeCustomer(
        id=row[0],
        user_id=row[1],
        tenant_id=row[2],
        stripe_customer_id=row[3],
        email=row[4],
        customer_type=row[5],
        metadata=_parse_json_field(row[6]),
        created_at=row[7],
        updated_at=row[8],
    )


# Subscriptions
async def create_subscription(
    customer_id: int,
    plan_key: str,
    billing_cycle: str = "monthly",
    trial_days: Optional[int] = None
) -> Subscription:
    """Create a subscription"""
    # Get plan
    plan_query = "SELECT * FROM subscription_plans WHERE plan_key = :plan_key AND is_active = true"
    plan_row = await fetch_one(plan_query, {"plan_key": plan_key})
    
    if not plan_row:
        raise ValueError(f"Plan {plan_key} not found")
    
    plan_id = plan_row[0]
    stripe_price_id = plan_row[7] if billing_cycle == "monthly" else plan_row[8]
    
    # Get customer
    customer = await get_stripe_customer(customer_id)
    if not customer:
        raise ValueError("Customer not found")
    
    # Create Stripe subscription
    if MOCK_STRIPE_ENABLED:
        stripe_subscription_id = f"sub_mock_{customer_id}_{int(datetime.now().timestamp())}"
        current_period_start = datetime.now()
        current_period_end = current_period_start + timedelta(days=30 if billing_cycle == "monthly" else 365)
        print(f"[MOCK] Created Stripe subscription: {stripe_subscription_id}")
    else:
        # import stripe
        # stripe_sub = stripe.Subscription.create(
        #     customer=customer.stripe_customer_id,
        #     items=[{"price": stripe_price_id}],
        #     trial_period_days=trial_days
        # )
        # stripe_subscription_id = stripe_sub.id
        # current_period_start = datetime.fromtimestamp(stripe_sub.current_period_start)
        # current_period_end = datetime.fromtimestamp(stripe_sub.current_period_end)
        pass
    
    # Store in database
    query = """
        INSERT INTO subscriptions (
            stripe_customer_id, stripe_subscription_id, plan_id, status,
            current_period_start, current_period_end, trial_start, trial_end
        )
        VALUES (
            :customer_id, :subscription_id, :plan_id, 'active',
            :period_start, :period_end, :trial_start, :trial_end
        )
        RETURNING id
    """
    
    trial_start = datetime.now() if trial_days else None
    trial_end = trial_start + timedelta(days=trial_days) if trial_days else None
    
    row = await execute_returning(query, {
        "customer_id": customer_id,
        "subscription_id": stripe_subscription_id,
        "plan_id": plan_id,
        "period_start": current_period_start,
        "period_end": current_period_end,
        "trial_start": trial_start,
        "trial_end": trial_end,
    })
    
    return await get_subscription(row["id"])  # type: ignore


async def get_subscription(subscription_id: int) -> Optional[Subscription]:
    """Get subscription by ID"""
    query = "SELECT * FROM subscriptions WHERE id = :subscription_id"
    row = await fetch_one(query, {"subscription_id": subscription_id})
    
    if not row:
        return None
    
    return Subscription(
        id=row[0],
        stripe_customer_id=row[1],
        stripe_subscription_id=row[2],
        plan_id=row[3],
        status=row[4],
        current_period_start=row[5],
        current_period_end=row[6],
        cancel_at_period_end=row[7],
        canceled_at=row[8],
        trial_start=row[9],
        trial_end=row[10],
        metadata=_parse_json_field(row[11]),
        created_at=row[12],
        updated_at=row[13],
    )


async def get_active_subscription(customer_id: int) -> Optional[Subscription]:
    """Get active subscription for customer"""
    query = """
        SELECT * FROM subscriptions 
        WHERE stripe_customer_id = :customer_id 
        AND status IN ('active', 'trialing')
        ORDER BY created_at DESC
        LIMIT 1
    """
    row = await fetch_one(query, {"customer_id": customer_id})
    
    if not row:
        return None
    
    return Subscription(
        id=row[0],
        stripe_customer_id=row[1],
        stripe_subscription_id=row[2],
        plan_id=row[3],
        status=row[4],
        current_period_start=row[5],
        current_period_end=row[6],
        cancel_at_period_end=row[7],
        canceled_at=row[8],
        trial_start=row[9],
        trial_end=row[10],
        metadata=_parse_json_field(row[11]),
        created_at=row[12],
        updated_at=row[13],
    )


async def cancel_subscription(subscription_id: int, immediate: bool = False):
    """Cancel a subscription"""
    subscription = await get_subscription(subscription_id)
    if not subscription:
        raise ValueError("Subscription not found")
    
    if MOCK_STRIPE_ENABLED:
        print(f"[MOCK] Canceled Stripe subscription: {subscription.stripe_subscription_id}")
    else:
        # import stripe
        # if immediate:
        #     stripe.Subscription.delete(subscription.stripe_subscription_id)
        # else:
        #     stripe.Subscription.modify(
        #         subscription.stripe_subscription_id,
        #         cancel_at_period_end=True
        #     )
        pass
    
    if immediate:
        await execute(
            "UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE id = :id",
            {"id": subscription_id}
        )
    else:
        await execute(
            "UPDATE subscriptions SET cancel_at_period_end = true WHERE id = :id",
            {"id": subscription_id}
        )


# Usage Tracking
async def record_usage(
    customer_id: int,
    usage_type: str,
    quantity: int = 1,
    metadata: Optional[Dict[str, Any]] = None
):
    """Record usage for billing"""
    subscription = await get_active_subscription(customer_id)
    
    query = """
        INSERT INTO usage_records (
            stripe_customer_id, subscription_id, usage_type, quantity,
            period_start, period_end, metadata
        )
        VALUES (
            :customer_id, :subscription_id, :usage_type, :quantity,
            NOW(), NOW() + INTERVAL '1 month', CAST(:metadata AS jsonb)
        )
    """
    
    await execute(query, {
        "customer_id": customer_id,
        "subscription_id": subscription.id if subscription else None,
        "usage_type": usage_type,
        "quantity": quantity,
        "metadata": json.dumps(metadata or {}),
    })


async def get_usage_summary(customer_id: int, period_start: datetime, period_end: datetime) -> List[Dict[str, Any]]:
    """Get usage summary for a period"""
    query = """
        SELECT 
            usage_type,
            SUM(quantity) as total_quantity
        FROM usage_records
        WHERE stripe_customer_id = :customer_id
        AND created_at BETWEEN :period_start AND :period_end
        GROUP BY usage_type
    """
    
    rows = await fetch_all(query, {
        "customer_id": customer_id,
        "period_start": period_start,
        "period_end": period_end,
    })
    
    return [{"usage_type": r[0], "quantity": r[1]} for r in rows]


# Webhook Processing
async def process_webhook_event(event_type: str, event_id: str, payload: Dict[str, Any]) -> bool:
    """Process Stripe webhook event"""
    # Store event
    query = """
        INSERT INTO billing_events (event_type, stripe_event_id, stripe_customer_id, payload)
        VALUES (:event_type, :event_id, :customer_id, CAST(:payload AS jsonb))
        ON CONFLICT (stripe_event_id) DO NOTHING
        RETURNING id
    """
    
    customer_id = payload.get("data", {}).get("object", {}).get("customer")
    
    row = await execute_returning(query, {
        "event_type": event_type,
        "event_id": event_id,
        "customer_id": customer_id,
        "payload": json.dumps(payload),
    })
    
    if not row:
        return False  # Already processed
    
    # Process event
    try:
        if event_type == "customer.subscription.created":
            # Handle subscription created
            pass
        elif event_type == "customer.subscription.updated":
            # Handle subscription updated
            pass
        elif event_type == "customer.subscription.deleted":
            # Handle subscription canceled
            pass
        elif event_type == "invoice.payment_succeeded":
            # Handle successful payment
            pass
        elif event_type == "invoice.payment_failed":
            # Handle failed payment
            pass
        
        # Mark as processed
        await execute(
            "UPDATE billing_events SET processed = true, processed_at = NOW() WHERE id = :id",
            {"id": row["id"]}
        )
        return True
    
    except Exception as e:
        await execute(
            "UPDATE billing_events SET error_message = :error WHERE id = :id",
            {"id": row["id"], "error": str(e)}
        )
        return False
