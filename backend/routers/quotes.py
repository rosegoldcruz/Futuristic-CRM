from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.quotes import (
    Quote, QuoteCreate, QuoteUpdate, QuoteCostBreakdown,
    UpdateQuoteStatusRequest, AddLineItemRequest, AddLaborItemRequest,
    RecalculateRequest, QUOTE_STATUSES, get_allowed_quote_transitions
)
from services import quotes_service

router = APIRouter(tags=["quotes"])


@router.get("/", response_model=List[Quote])
async def list_quotes(
    search: Optional[str] = Query(None, description="Search quotes"),
    status: Optional[str] = Query(None, description="Filter by status"),
    homeowner_id: Optional[int] = Query(None, description="Filter by homeowner"),
    lead_id: Optional[int] = Query(None, description="Filter by lead"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await quotes_service.list_quotes(
        search=search,
        status=status,
        homeowner_id=homeowner_id,
        lead_id=lead_id,
        limit=limit,
        offset=offset,
    )


@router.get("/statuses", response_model=List[str])
async def get_statuses():
    """Get list of valid quote statuses."""
    return QUOTE_STATUSES


@router.get("/{quote_id}", response_model=Quote)
async def get_quote(quote_id: int):
    quote = await quotes_service.get_quote(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.post("/", response_model=Quote, status_code=201)
async def create_quote(payload: QuoteCreate):
    return await quotes_service.create_quote(payload)


@router.put("/{quote_id}", response_model=Quote)
async def update_quote(quote_id: int, payload: QuoteUpdate):
    quote = await quotes_service.update_quote(quote_id, payload)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(quote_id: int):
    ok = await quotes_service.delete_quote(quote_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Quote not found")
    return None


@router.get("/{quote_id}/allowed-statuses", response_model=List[str])
async def get_allowed_statuses(quote_id: int):
    """Get list of allowed next statuses for a quote."""
    quote = await quotes_service.get_quote(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return get_allowed_quote_transitions(quote.status or "draft")


@router.post("/{quote_id}/status", response_model=Quote)
async def update_quote_status(quote_id: int, payload: UpdateQuoteStatusRequest):
    """Update quote status with transition validation."""
    try:
        quote = await quotes_service.update_quote_status(quote_id, payload.status)
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        return quote
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{quote_id}/recalculate", response_model=Quote)
async def recalculate_quote(quote_id: int, payload: Optional[RecalculateRequest] = None):
    """Recalculate all quote totals from line items and labor."""
    tax_rate = payload.tax_rate if payload else None
    quote = await quotes_service.recalculate_quote(quote_id, tax_rate)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.post("/{quote_id}/line-items", response_model=Quote)
async def add_line_item(quote_id: int, payload: AddLineItemRequest):
    """Add a line item to a quote."""
    item_data = payload.model_dump()
    quote = await quotes_service.add_line_item(quote_id, item_data)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.delete("/{quote_id}/line-items/{item_index}", response_model=Quote)
async def remove_line_item(quote_id: int, item_index: int):
    """Remove a line item from a quote by index."""
    quote = await quotes_service.remove_line_item(quote_id, item_index)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.post("/{quote_id}/labor-items", response_model=Quote)
async def add_labor_item(quote_id: int, payload: AddLaborItemRequest):
    """Add a labor item to a quote."""
    item_data = payload.model_dump()
    quote = await quotes_service.add_labor_item(quote_id, item_data)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.delete("/{quote_id}/labor-items/{item_index}", response_model=Quote)
async def remove_labor_item(quote_id: int, item_index: int):
    """Remove a labor item from a quote by index."""
    quote = await quotes_service.remove_labor_item(quote_id, item_index)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.post("/{quote_id}/create-job")
async def create_job_from_quote(quote_id: int):
    """Create a job from an approved quote."""
    from services import jobs_service
    from models.jobs import JobCreate
    
    quote = await quotes_service.get_quote(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if quote.status != "approved":
        raise HTTPException(status_code=400, detail="Quote must be approved to create job")
    
    # Create job from quote
    job_data = JobCreate(
        customer_name=quote.homeowner_name or quote.lead_name or f"Quote #{quote.id} Customer",
        quote_id=quote.id,
        homeowner_id=quote.homeowner_id,
        lead_id=quote.lead_id,
        status="pending",
        project_details={
            "quote_total": quote.total_price,
            "materials": quote.line_items or [],
            "labor": quote.labor_items or [],
        }
    )
    
    job = await jobs_service.create_job(job_data)
    return {"job_id": job.id, "message": f"Job #{job.id} created from quote #{quote.id}"}
