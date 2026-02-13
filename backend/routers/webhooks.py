"""
Webhook handlers for Stripe and other external services
"""
from fastapi import APIRouter, Request, HTTPException, Header
from typing import Optional
import json

from services import payments_stripe_service, ledger_service
from services.stripe_service import verify_webhook_signature

router = APIRouter(tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
):
    """
    Handle Stripe webhook events
    
    Events handled:
    - payment_intent.succeeded: Update payment status to completed
    - payment_intent.payment_failed: Update payment status to failed
    - charge.refunded: Handle refund completion
    - customer.created: Save customer reference
    """
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")
    
    # Read raw body
    body = await request.body()
    
    # Verify webhook signature
    try:
        event = verify_webhook_signature(body, stripe_signature)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook verification failed: {str(e)}")
    
    event_type = event.get("type")
    event_data = event.get("data", {}).get("object", {})
    
    # Handle payment_intent.succeeded
    if event_type == "payment_intent.succeeded":
        payment_intent_id = event_data.get("id")
        
        # Find payment by stripe_payment_intent_id
        from config.db import fetch_one, execute
        query = "SELECT id FROM payments WHERE stripe_payment_intent_id = :pi_id"
        payment = await fetch_one(query, {"pi_id": payment_intent_id})
        
        if payment:
            # Update payment status
            update_query = """
                UPDATE payments
                SET status = 'completed',
                    paid_at = NOW(),
                    updated_at = NOW()
                WHERE id = :payment_id
            """
            await execute(update_query, {"payment_id": payment["id"]})
    
    # Handle payment_intent.payment_failed
    elif event_type == "payment_intent.payment_failed":
        payment_intent_id = event_data.get("id")
        error_message = event_data.get("last_payment_error", {}).get("message", "Payment failed")
        
        from config.db import fetch_one, execute
        query = "SELECT id FROM payments WHERE stripe_payment_intent_id = :pi_id"
        payment = await fetch_one(query, {"pi_id": payment_intent_id})
        
        if payment:
            # Update payment status
            update_query = """
                UPDATE payments
                SET status = 'failed',
                    metadata = CAST(:metadata AS jsonb),
                    updated_at = NOW()
                WHERE id = :payment_id
            """
            await execute(update_query, {
                "payment_id": payment["id"],
                "metadata": json.dumps({"error": error_message}),
            })
    
    # Handle charge.refunded
    elif event_type == "charge.refunded":
        charge_id = event_data.get("id")
        refund_amount = event_data.get("amount_refunded", 0) / 100  # Convert from cents
        
        from config.db import fetch_one, execute
        query = "SELECT id, job_id FROM payments WHERE stripe_charge_id = :charge_id"
        payment = await fetch_one(query, {"charge_id": charge_id})
        
        if payment:
            # Update payment status
            update_query = """
                UPDATE payments
                SET status = 'refunded',
                    updated_at = NOW()
                WHERE id = :payment_id
            """
            await execute(update_query, {"payment_id": payment["id"]})
            
            # Record refund in ledger
            if payment.get("job_id"):
                job_query = "SELECT homeowner_id FROM jobs WHERE id = :job_id"
                job = await fetch_one(job_query, {"job_id": payment["job_id"]})
                if job:
                    await ledger_service.record_refund(
                        payment_id=payment["id"],
                        refund_amount=refund_amount,
                        homeowner_id=job["homeowner_id"],
                    )
    
    # Handle customer.created
    elif event_type == "customer.created":
        customer_id = event_data.get("id")
        customer_email = event_data.get("email")
        
        # Store customer reference if needed
        # (Implementation depends on your homeowner/customer data model)
        pass
    
    return {"status": "received", "event_type": event_type}


@router.get("/stripe/health")
async def stripe_webhook_health():
    """Health check endpoint for Stripe webhooks"""
    return {"status": "healthy", "webhook": "stripe"}
