"""
Enhanced payments service with Stripe integration, platform fees, and ledger tracking
"""
from typing import List, Optional, Dict, Any
import json
import uuid
from datetime import datetime
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.payments import (
    Payment, PaymentCreate, StripeChargeRequest, StripeRefundRequest,
    PaymentMethod, PaymentMethodCreate, PlatformFee, PlatformFeeCreate,
    PaymentWithFees
)
from services import stripe_service, ledger_service


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


def _row_to_payment(row: Dict[str, Any]) -> Payment:
    """Convert DB row to Payment model"""
    return Payment(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        job_id=row.get("job_id"),
        installer_id=row.get("installer_id"),
        payment_type=row.get("payment_type", "payment"),
        payment_method=row.get("payment_method"),
        amount=float(row["amount"]) if row.get("amount") else 0.0,
        status=row.get("status", "pending"),
        paid_at=row.get("paid_at"),
        description=row.get("description"),
        reference_number=row.get("reference_number"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


def _row_to_payment_method(row: Dict[str, Any]) -> PaymentMethod:
    """Convert DB row to PaymentMethod model"""
    return PaymentMethod(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        homeowner_id=row.get("homeowner_id"),
        stripe_payment_method_id=row.get("stripe_payment_method_id"),
        type=row.get("type", "card"),
        card_brand=row.get("card_brand"),
        card_last4=row.get("card_last4"),
        card_exp_month=row.get("card_exp_month"),
        card_exp_year=row.get("card_exp_year"),
        is_default=row.get("is_default", False),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


def _row_to_platform_fee(row: Dict[str, Any]) -> PlatformFee:
    """Convert DB row to PlatformFee model"""
    return PlatformFee(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        payment_id=row.get("payment_id"),
        fee_percentage=float(row.get("fee_percentage", 10.0)),
        material_fee=float(row.get("material_fee", 0.0)),
        labor_fee=float(row.get("labor_fee", 0.0)),
        total_fee=float(row.get("total_fee", 0.0)),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


async def create_stripe_charge(data: StripeChargeRequest, tenant_id: Optional[int] = None) -> PaymentWithFees:
    """
    Create a Stripe charge with platform fee calculation and ledger entries
    """
    # Validate inputs
    if data.amount <= 0:
        raise ValueError("Amount must be greater than 0")
    
    # Check if job and homeowner exist
    job_query = "SELECT id, homeowner_id FROM jobs WHERE id = :job_id AND deleted_at IS NULL"
    job = await fetch_one(job_query, {"job_id": data.job_id})
    if not job:
        raise ValueError(f"Job {data.job_id} not found")
    
    if job["homeowner_id"] != data.homeowner_id:
        raise ValueError(f"Homeowner {data.homeowner_id} does not match job {data.job_id}")
    
    # Generate idempotency key if not provided
    idempotency_key = data.idempotency_key or str(uuid.uuid4())
    
    # Check for duplicate charge with same idempotency key
    dup_query = "SELECT id FROM payments WHERE idempotency_key = :key AND deleted_at IS NULL"
    existing = await fetch_one(dup_query, {"key": idempotency_key})
    if existing:
        raise ValueError(f"Payment with idempotency key {idempotency_key} already exists")
    
    # Calculate platform fees
    fee_calc = await stripe_service.calculate_platform_fee(
        total_amount=data.amount,
        material_cost=data.material_cost or 0.0,
        labor_cost=data.labor_cost or 0.0,
    )
    
    # Create Stripe payment intent
    try:
        stripe_result = await stripe_service.create_payment_intent(
            amount=data.amount,
            payment_method_id=data.payment_method_id,
            description=data.description or f"Payment for job #{data.job_id}",
            metadata={
                "job_id": data.job_id,
                "homeowner_id": data.homeowner_id,
                "tenant_id": tenant_id,
            },
        )
    except Exception as e:
        raise ValueError(f"Stripe charge failed: {str(e)}")
    
    # Save payment to database
    payment_query = """
        INSERT INTO payments (
            tenant_id, job_id, homeowner_id, payment_type, payment_method,
            amount, status, description, reference_number, metadata,
            stripe_payment_intent_id, stripe_charge_id, idempotency_key,
            platform_fee, material_cost, labor_cost, paid_at
        )
        VALUES (
            :tenant_id, :job_id, :homeowner_id, :payment_type, :payment_method,
            :amount, :status, :description, :reference_number, CAST(:metadata AS jsonb),
            :stripe_payment_intent_id, :stripe_charge_id, :idempotency_key,
            :platform_fee, :material_cost, :labor_cost, NOW()
        )
        RETURNING id
    """
    
    payment_row = await execute_returning(payment_query, {
        "tenant_id": tenant_id,
        "job_id": data.job_id,
        "homeowner_id": data.homeowner_id,
        "payment_type": "payment",
        "payment_method": "credit_card",
        "amount": data.amount,
        "status": "completed" if stripe_result["status"] == "succeeded" else "processing",
        "description": data.description,
        "reference_number": stripe_result["id"],
        "metadata": json.dumps({
            "stripe_status": stripe_result["status"],
            "currency": stripe_result.get("currency", "usd"),
        }),
        "stripe_payment_intent_id": stripe_result["id"],
        "stripe_charge_id": stripe_result["charges"][0] if stripe_result.get("charges") else None,
        "idempotency_key": idempotency_key,
        "platform_fee": fee_calc["total_fee"],
        "material_cost": data.material_cost or 0.0,
        "labor_cost": data.labor_cost or 0.0,
    })
    
    payment_id = payment_row["id"]
    
    # Save platform fee record
    fee_query = """
        INSERT INTO platform_fees (
            tenant_id, payment_id, fee_percentage, material_fee, labor_fee, total_fee, metadata
        )
        VALUES (
            :tenant_id, :payment_id, :fee_percentage, :material_fee, :labor_fee, :total_fee, CAST(:metadata AS jsonb)
        )
    """
    
    await execute(fee_query, {
        "tenant_id": tenant_id,
        "payment_id": payment_id,
        "fee_percentage": fee_calc["fee_percentage"],
        "material_fee": fee_calc["material_fee"],
        "labor_fee": fee_calc["labor_fee"],
        "total_fee": fee_calc["total_fee"],
        "metadata": json.dumps({
            "material_cost": data.material_cost or 0.0,
            "labor_cost": data.labor_cost or 0.0,
        }),
    })
    
    # Record in ledger
    await ledger_service.record_payment_charge(
        payment_id=payment_id,
        amount=data.amount,
        homeowner_id=data.homeowner_id,
        tenant_id=tenant_id,
    )
    
    # Record platform fee in ledger
    await ledger_service.record_platform_fee(
        payment_id=payment_id,
        fee_amount=fee_calc["total_fee"],
        tenant_id=tenant_id,
    )
    
    # Save payment method if requested
    if data.save_payment_method and data.payment_method_id:
        await save_payment_method(
            homeowner_id=data.homeowner_id,
            stripe_payment_method_id=data.payment_method_id,
            tenant_id=tenant_id,
        )
    
    # Retrieve and return payment with fees
    payment = await get_payment(payment_id)
    
    return PaymentWithFees(
        **payment.model_dump(),
        platform_fee=fee_calc["total_fee"],
        material_cost=data.material_cost or 0.0,
        labor_cost=data.labor_cost or 0.0,
        net_amount=fee_calc["net_amount"],
    )


async def create_stripe_refund(data: StripeRefundRequest, tenant_id: Optional[int] = None) -> Payment:
    """
    Create a Stripe refund and record in ledger
    """
    # Get original payment
    payment = await get_payment(data.payment_id)
    if not payment:
        raise ValueError(f"Payment {data.payment_id} not found")
    
    if not payment.stripe_payment_intent_id:
        raise ValueError(f"Payment {data.payment_id} was not charged via Stripe")
    
    if payment.status == "refunded":
        raise ValueError(f"Payment {data.payment_id} is already refunded")
    
    # Determine refund amount
    refund_amount = data.amount if data.amount else payment.amount
    
    if refund_amount > payment.amount:
        raise ValueError(f"Refund amount cannot exceed original payment amount")
    
    # Create Stripe refund
    try:
        refund_result = await stripe_service.create_refund(
            payment_intent_id=payment.stripe_payment_intent_id,
            amount=refund_amount,
            reason=data.reason,
        )
    except Exception as e:
        raise ValueError(f"Stripe refund failed: {str(e)}")
    
    # Update payment status
    update_query = """
        UPDATE payments
        SET status = 'refunded',
            stripe_refund_id = :refund_id,
            metadata = CAST(:metadata AS jsonb),
            updated_at = NOW()
        WHERE id = :payment_id
    """
    
    await execute(update_query, {
        "payment_id": data.payment_id,
        "refund_id": refund_result["id"],
        "metadata": json.dumps({
            **(payment.metadata or {}),
            "refund": {
                "id": refund_result["id"],
                "amount": refund_amount,
                "reason": data.reason,
                "refunded_at": datetime.now().isoformat(),
            },
        }),
    })
    
    # Record refund in ledger
    if payment.job_id:
        job_query = "SELECT homeowner_id FROM jobs WHERE id = :job_id"
        job = await fetch_one(job_query, {"job_id": payment.job_id})
        if job:
            await ledger_service.record_refund(
                payment_id=data.payment_id,
                refund_amount=refund_amount,
                homeowner_id=job["homeowner_id"],
                tenant_id=tenant_id,
            )
    
    return await get_payment(data.payment_id)


async def save_payment_method(
    homeowner_id: int,
    stripe_payment_method_id: str,
    tenant_id: Optional[int] = None,
    is_default: bool = False,
) -> PaymentMethod:
    """Save a payment method for future use"""
    # Check if method already exists
    check_query = "SELECT id FROM payment_methods WHERE stripe_payment_method_id = :pm_id AND deleted_at IS NULL"
    existing = await fetch_one(check_query, {"pm_id": stripe_payment_method_id})
    if existing:
        raise ValueError(f"Payment method {stripe_payment_method_id} already saved")
    
    # Get payment method details from Stripe
    # (In production, you'd call stripe_service.retrieve_payment_method)
    # For now, create a placeholder
    
    query = """
        INSERT INTO payment_methods (
            tenant_id, homeowner_id, stripe_payment_method_id, type,
            card_brand, card_last4, card_exp_month, card_exp_year, is_default, metadata
        )
        VALUES (
            :tenant_id, :homeowner_id, :stripe_payment_method_id, :type,
            :card_brand, :card_last4, :card_exp_month, :card_exp_year, :is_default, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": tenant_id,
        "homeowner_id": homeowner_id,
        "stripe_payment_method_id": stripe_payment_method_id,
        "type": "card",
        "card_brand": "visa",  # Placeholder
        "card_last4": "4242",  # Placeholder
        "card_exp_month": 12,
        "card_exp_year": 2025,
        "is_default": is_default,
        "metadata": "{}",
    })
    
    return await get_payment_method(row["id"])


async def list_payment_methods(
    homeowner_id: int,
    tenant_id: Optional[int] = None,
) -> List[PaymentMethod]:
    """List saved payment methods for a homeowner"""
    query = """
        SELECT * FROM payment_methods
        WHERE homeowner_id = :homeowner_id
        AND deleted_at IS NULL
        ORDER BY is_default DESC, created_at DESC
    """
    
    rows = await fetch_all(query, {"homeowner_id": homeowner_id})
    return [_row_to_payment_method(r) for r in rows]


async def get_payment_method(method_id: int) -> Optional[PaymentMethod]:
    """Get a payment method by ID"""
    query = "SELECT * FROM payment_methods WHERE id = :method_id AND deleted_at IS NULL"
    row = await fetch_one(query, {"method_id": method_id})
    return _row_to_payment_method(row) if row else None


async def delete_payment_method(method_id: int) -> bool:
    """Delete a payment method"""
    query = "UPDATE payment_methods SET deleted_at = NOW() WHERE id = :method_id AND deleted_at IS NULL"
    count = await execute(query, {"method_id": method_id})
    return count > 0


async def get_payment(payment_id: int) -> Optional[Payment]:
    """Get a payment by ID"""
    query = "SELECT * FROM payments WHERE id = :payment_id AND deleted_at IS NULL"
    row = await fetch_one(query, {"payment_id": payment_id})
    return _row_to_payment(row) if row else None


async def get_platform_fee(payment_id: int) -> Optional[PlatformFee]:
    """Get platform fee for a payment"""
    query = "SELECT * FROM platform_fees WHERE payment_id = :payment_id"
    row = await fetch_one(query, {"payment_id": payment_id})
    return _row_to_platform_fee(row) if row else None
