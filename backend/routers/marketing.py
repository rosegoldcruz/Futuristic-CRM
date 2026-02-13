from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from models.marketing import (
    MarketingEvent, MarketingEventCreate, EventRequest,
    MarketingCampaign, MarketingCampaignCreate, MarketingCampaignUpdate,
    MarketingMetrics,
    EVENT_TYPES, CAMPAIGN_STATUSES, LEAD_SOURCES
)
from services import marketing_service

router = APIRouter(tags=["marketing"])


# Marketing Events
@router.get("/events", response_model=List[MarketingEvent])
async def list_events(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    utm_source: Optional[str] = Query(None, description="Filter by UTM source"),
    utm_campaign: Optional[str] = Query(None, description="Filter by UTM campaign"),
    lead_source: Optional[str] = Query(None, description="Filter by lead source"),
    session_id: Optional[str] = Query(None, description="Filter by session"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List marketing events with optional filtering"""
    return await marketing_service.list_events(
        tenant_id=tenant_id,
        event_type=event_type,
        utm_source=utm_source,
        utm_campaign=utm_campaign,
        lead_source=lead_source,
        session_id=session_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )


@router.get("/events/types", response_model=List[str])
async def get_event_types():
    """Get list of valid event types"""
    return EVENT_TYPES


@router.get("/events/sources", response_model=List[str])
async def get_lead_sources():
    """Get list of valid lead sources"""
    return LEAD_SOURCES


@router.get("/events/{event_id}", response_model=MarketingEvent)
async def get_event(event_id: int):
    """Get a specific event by ID"""
    event = await marketing_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("/event", response_model=MarketingEvent, status_code=201)
async def log_event(payload: EventRequest):
    """Log a new marketing event (simplified endpoint)"""
    try:
        event_data = MarketingEventCreate(
            event_type=payload.event_type,
            event_name=payload.event_name,
            page_url=payload.page_url,
            referrer_url=payload.referrer_url,
            utm_source=payload.utm_source,
            utm_medium=payload.utm_medium,
            utm_campaign=payload.utm_campaign,
            utm_term=payload.utm_term,
            utm_content=payload.utm_content,
            lead_source=payload.lead_source,
            session_id=payload.session_id,
            properties=payload.properties,
        )
        return await marketing_service.create_event(event_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/events", response_model=MarketingEvent, status_code=201)
async def create_event(payload: MarketingEventCreate):
    """Create a new marketing event"""
    try:
        return await marketing_service.create_event(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: int):
    """Delete an event"""
    ok = await marketing_service.delete_event(event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
    return None


# Marketing Metrics
@router.get("/metrics", response_model=MarketingMetrics)
async def get_marketing_metrics(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    start_date: Optional[datetime] = Query(None, description="Start date for metrics"),
    end_date: Optional[datetime] = Query(None, description="End date for metrics"),
):
    """Get aggregated marketing metrics"""
    return await marketing_service.get_marketing_metrics(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
    )


# Marketing Campaigns
@router.get("/campaigns", response_model=List[MarketingCampaign])
async def list_campaigns(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List marketing campaigns"""
    return await marketing_service.list_campaigns(
        tenant_id=tenant_id,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.get("/campaigns/statuses", response_model=List[str])
async def get_campaign_statuses():
    """Get list of valid campaign statuses"""
    return CAMPAIGN_STATUSES


@router.get("/campaigns/{campaign_id}", response_model=MarketingCampaign)
async def get_campaign(campaign_id: int):
    """Get a specific campaign by ID"""
    campaign = await marketing_service.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("/campaigns", response_model=MarketingCampaign, status_code=201)
async def create_campaign(payload: MarketingCampaignCreate):
    """Create a new marketing campaign"""
    try:
        return await marketing_service.create_campaign(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/campaigns/{campaign_id}", response_model=MarketingCampaign)
async def update_campaign(campaign_id: int, payload: MarketingCampaignUpdate):
    """Update an existing campaign"""
    try:
        campaign = await marketing_service.update_campaign(campaign_id, payload)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return campaign
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(campaign_id: int):
    """Delete a campaign"""
    ok = await marketing_service.delete_campaign(campaign_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return None
