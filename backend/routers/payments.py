from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.payments import (
    Payment, PaymentCreate, PaymentUpdate, PaymentStatusUpdate,
    DepositRequest, PaymentSummary,
    PAYMENT_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES,
    StripeChargeRequest, StripeRefundRequest, PaymentWithFees,
    PaymentMethod, LedgerEntry, PlatformFee
)
from services import payments_service, payments_stripe_service, ledger_service

router = APIRouter(tags=["payments"])


@router.get("/", response_model=List[Payment])
async def list_payments(
    job_id: Optional[int] = Query(None, description="Filter by job"),
    installer_id: Optional[int] = Query(None, description="Filter by installer"),
    status: Optional[str] = Query(None, description="Filter by status"),
    payment_type: Optional[str] = Query(None, description="Filter by payment type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List payments with optional filtering"""
    return await payments_service.list_payments(
        job_id=job_id,
        installer_id=installer_id,
        status=status,
        payment_type=payment_type,
        limit=limit,
        offset=offset,
    )


@router.get("/types", response_model=List[str])
async def get_payment_types():
    """Get list of valid payment types"""
    return PAYMENT_TYPES


@router.get("/methods", response_model=List[str])
async def get_payment_methods():
    """Get list of valid payment methods"""
    return PAYMENT_METHODS


@router.get("/statuses", response_model=List[str])
async def get_payment_statuses():
    """Get list of valid payment statuses"""
    return PAYMENT_STATUSES


@router.get("/{payment_id}", response_model=Payment)
async def get_payment(payment_id: int):
    """Get a specific payment by ID"""
    payment = await payments_service.get_payment(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/", response_model=Payment, status_code=201)
async def create_payment(payload: PaymentCreate):
    """Create a new payment"""
    try:
        return await payments_service.create_payment(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{payment_id}", response_model=Payment)
async def update_payment(payment_id: int, payload: PaymentUpdate):
    """Update an existing payment"""
    try:
        payment = await payments_service.update_payment(payment_id, payload)
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        return payment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{payment_id}", status_code=204)
async def delete_payment(payment_id: int):
    """Delete a payment"""
    ok = await payments_service.delete_payment(payment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Payment not found")
    return None


@router.post("/{payment_id}/status", response_model=Payment)
async def update_payment_status(payment_id: int, payload: PaymentStatusUpdate):
    """Update payment status"""
    try:
        payment = await payments_service.update_payment_status(
            payment_id,
            payload.status,
            payload.paid_at.isoformat() if payload.paid_at else None
        )
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        return payment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/deposit", response_model=Payment, status_code=201)
async def create_deposit(payload: DepositRequest):
    """Create a deposit payment for a job"""
    try:
        payment_data = PaymentCreate(
            job_id=payload.job_id,
            payment_type="deposit",
            payment_method=payload.payment_method,
            amount=payload.amount,
            description=payload.description,
            reference_number=payload.reference_number,
            status="pending",
        )
        return await payments_service.create_payment(payment_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/job/{job_id}/summary", response_model=PaymentSummary)
async def get_job_payment_summary(job_id: int):
    """Get payment summary for a specific job"""
    return await payments_service.get_payment_summary_for_job(job_id)


@router.get("/installer/{installer_id}/summary", response_model=PaymentSummary)
async def get_installer_payment_summary(installer_id: int):
    """Get payment summary for a specific installer"""
    return await payments_service.get_payment_summary_for_installer(installer_id)


# Stripe Payment Endpoints
@router.post("/charge", response_model=PaymentWithFees, status_code=201)
async def create_stripe_charge(payload: StripeChargeRequest):
    """Create a Stripe charge with platform fee calculation"""
    try:
        return await payments_stripe_service.create_stripe_charge(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Charge failed: {str(e)}")


@router.post("/refund", response_model=Payment)
async def create_stripe_refund(payload: StripeRefundRequest):
    """Create a Stripe refund"""
    try:
        return await payments_stripe_service.create_stripe_refund(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")


@router.get("/methods/homeowner/{homeowner_id}", response_model=List[PaymentMethod])
async def list_homeowner_payment_methods(homeowner_id: int):
    """List saved payment methods for a homeowner"""
    return await payments_stripe_service.list_payment_methods(homeowner_id)


@router.delete("/methods/{method_id}", status_code=204)
async def delete_payment_method(method_id: int):
    """Delete a saved payment method"""
    ok = await payments_stripe_service.delete_payment_method(method_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return None


@router.get("/{payment_id}/fees", response_model=PlatformFee)
async def get_payment_platform_fee(payment_id: int):
    """Get platform fee details for a payment"""
    fee = await payments_stripe_service.get_platform_fee(payment_id)
    if not fee:
        raise HTTPException(status_code=404, detail="Platform fee not found")
    return fee


# Ledger Endpoints
@router.get("/ledger/entries", response_model=List[LedgerEntry])
async def list_ledger_entries(
    transaction_id: Optional[str] = Query(None, description="Filter by transaction ID"),
    entry_type: Optional[str] = Query(None, description="Filter by entry type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List ledger entries with filtering"""
    return await ledger_service.list_ledger_entries(
        transaction_id=transaction_id,
        entry_type=entry_type,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
        offset=offset,
    )


@router.get("/ledger/verify")
async def verify_ledger_balance(
    transaction_id: Optional[str] = Query(None, description="Verify specific transaction"),
):
    """Verify ledger balance (debits = credits)"""
    return await ledger_service.verify_ledger_balance(transaction_id=transaction_id)
