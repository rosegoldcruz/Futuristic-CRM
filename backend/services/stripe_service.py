"""
Stripe service - handles Stripe payment intents, charges, and webhooks
"""
import os
import stripe
from typing import Optional, Dict, Any
from datetime import datetime

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_...")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_...")


async def create_payment_intent(
    amount: float,
    currency: str = "usd",
    payment_method_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a Stripe payment intent"""
    try:
        # Convert amount to cents
        amount_cents = int(amount * 100)
        
        params: Dict[str, Any] = {
            "amount": amount_cents,
            "currency": currency,
            "description": description or "AEON Solar Installation",
            "metadata": metadata or {},
        }
        
        if payment_method_id:
            params["payment_method"] = payment_method_id
            params["confirm"] = True  # Auto-confirm if payment method provided
            params["automatic_payment_methods"] = {"enabled": True, "allow_redirects": "never"}
        else:
            params["automatic_payment_methods"] = {"enabled": True}
        
        if customer_id:
            params["customer"] = customer_id
        
        # Create payment intent
        intent = stripe.PaymentIntent.create(**params)
        
        return {
            "id": intent.id,
            "status": intent.status,
            "amount": intent.amount / 100,
            "currency": intent.currency,
            "client_secret": intent.client_secret,
            "charges": [c.id for c in intent.charges.data] if intent.charges else [],
        }
    except stripe.error.StripeError as e:
        raise Exception(f"Stripe error: {str(e)}")


async def retrieve_payment_intent(payment_intent_id: str) -> Dict[str, Any]:
    """Retrieve a Stripe payment intent"""
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return {
            "id": intent.id,
            "status": intent.status,
            "amount": intent.amount / 100,
            "currency": intent.currency,
            "charges": [c.id for c in intent.charges.data] if intent.charges else [],
        }
    except stripe.error.StripeError as e:
        raise Exception(f"Stripe error: {str(e)}")


async def create_refund(
    payment_intent_id: Optional[str] = None,
    charge_id: Optional[str] = None,
    amount: Optional[float] = None,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a Stripe refund"""
    try:
        params: Dict[str, Any] = {}
        
        if payment_intent_id:
            params["payment_intent"] = payment_intent_id
        elif charge_id:
            params["charge"] = charge_id
        else:
            raise ValueError("Either payment_intent_id or charge_id must be provided")
        
        if amount:
            params["amount"] = int(amount * 100)  # Convert to cents
        
        if reason:
            params["reason"] = reason
        
        refund = stripe.Refund.create(**params)
        
        return {
            "id": refund.id,
            "status": refund.status,
            "amount": refund.amount / 100,
            "currency": refund.currency,
            "payment_intent_id": refund.payment_intent,
            "charge_id": refund.charge,
        }
    except stripe.error.StripeError as e:
        raise Exception(f"Stripe error: {str(e)}")


async def create_customer(
    email: str,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a Stripe customer"""
    try:
        customer = stripe.Customer.create(
            email=email,
            name=name,
            phone=phone,
            metadata=metadata or {},
        )
        
        return {
            "id": customer.id,
            "email": customer.email,
            "name": customer.name,
        }
    except stripe.error.StripeError as e:
        raise Exception(f"Stripe error: {str(e)}")


async def attach_payment_method(
    payment_method_id: str,
    customer_id: str,
) -> Dict[str, Any]:
    """Attach a payment method to a customer"""
    try:
        payment_method = stripe.PaymentMethod.attach(
            payment_method_id,
            customer=customer_id,
        )
        
        return {
            "id": payment_method.id,
            "type": payment_method.type,
            "card": {
                "brand": payment_method.card.brand if payment_method.card else None,
                "last4": payment_method.card.last4 if payment_method.card else None,
                "exp_month": payment_method.card.exp_month if payment_method.card else None,
                "exp_year": payment_method.card.exp_year if payment_method.card else None,
            } if payment_method.card else None,
        }
    except stripe.error.StripeError as e:
        raise Exception(f"Stripe error: {str(e)}")


async def list_payment_methods(customer_id: str, type: str = "card") -> list:
    """List payment methods for a customer"""
    try:
        methods = stripe.PaymentMethod.list(
            customer=customer_id,
            type=type,
        )
        
        return [
            {
                "id": pm.id,
                "type": pm.type,
                "card": {
                    "brand": pm.card.brand if pm.card else None,
                    "last4": pm.card.last4 if pm.card else None,
                    "exp_month": pm.card.exp_month if pm.card else None,
                    "exp_year": pm.card.exp_year if pm.card else None,
                } if pm.card else None,
            }
            for pm in methods.data
        ]
    except stripe.error.StripeError as e:
        raise Exception(f"Stripe error: {str(e)}")


async def detach_payment_method(payment_method_id: str) -> Dict[str, Any]:
    """Detach a payment method from a customer"""
    try:
        payment_method = stripe.PaymentMethod.detach(payment_method_id)
        return {"id": payment_method.id, "detached": True}
    except stripe.error.StripeError as e:
        raise Exception(f"Stripe error: {str(e)}")


def verify_webhook_signature(payload: bytes, signature: str) -> Dict[str, Any]:
    """Verify Stripe webhook signature and return event"""
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, STRIPE_WEBHOOK_SECRET
        )
        return event
    except ValueError as e:
        raise Exception(f"Invalid payload: {str(e)}")
    except stripe.error.SignatureVerificationError as e:
        raise Exception(f"Invalid signature: {str(e)}")


async def calculate_platform_fee(
    total_amount: float,
    material_cost: float = 0.0,
    labor_cost: float = 0.0,
    material_fee_percentage: float = 5.0,
    labor_fee_percentage: float = 15.0,
) -> Dict[str, float]:
    """
    Calculate platform fees with different rates for materials vs labor
    
    Material fee: Lower percentage (e.g., 5%) - pass-through costs
    Labor fee: Higher percentage (e.g., 15%) - value-added services
    """
    material_fee = material_cost * (material_fee_percentage / 100)
    labor_fee = labor_cost * (labor_fee_percentage / 100)
    total_fee = material_fee + labor_fee
    
    # If costs not specified, use default 10% on total
    if material_cost == 0 and labor_cost == 0:
        total_fee = total_amount * 0.10
        material_fee = 0.0
        labor_fee = total_fee
    
    return {
        "material_fee": round(material_fee, 2),
        "labor_fee": round(labor_fee, 2),
        "total_fee": round(total_fee, 2),
        "fee_percentage": round((total_fee / total_amount * 100), 2) if total_amount > 0 else 0.0,
        "net_amount": round(total_amount - total_fee, 2),
    }
