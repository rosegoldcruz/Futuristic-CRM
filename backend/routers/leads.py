from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.leads import Lead, LeadCreate, LeadUpdate
from services import leads_service

router = APIRouter(tags=["leads"])


@router.get("/", response_model=List[Lead])
async def list_leads(
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    status: Optional[str] = Query(None, description="Filter by status"),
    source: Optional[str] = Query(None, description="Filter by source"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await leads_service.list_leads(
        search=search,
        status=status,
        source=source,
        limit=limit,
        offset=offset,
    )


@router.get("/{lead_id}", response_model=Lead)
async def get_lead(lead_id: int):
    lead = await leads_service.get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.post("/", response_model=Lead, status_code=201)
async def create_lead(payload: LeadCreate):
    return await leads_service.create_lead(payload)


@router.put("/{lead_id}", response_model=Lead)
async def update_lead(lead_id: int, payload: LeadUpdate):
    lead = await leads_service.update_lead(lead_id, payload)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(lead_id: int):
    ok = await leads_service.delete_lead(lead_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Lead not found")
    return None
