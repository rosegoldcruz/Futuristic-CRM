from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request

from models.landing_pages import (
    LandingPage, LandingPageCreate, LandingPageUpdate,
    LandingPageView, LandingPageViewCreate,
    LandingPageConversion, LandingPageConversionCreate,
    CampaignAnalytics, LandingPageAnalytics,
    TrackEventRequest, UTMParameters
)
from services import landing_page_service

router = APIRouter(tags=["landing_pages"])


# Landing Pages
@router.get("/", response_model=List[LandingPage])
async def list_landing_pages(
    campaign_id: Optional[int] = Query(None, description="Filter by campaign"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
):
    """List landing pages"""
    return await landing_page_service.list_landing_pages(campaign_id, is_active)


@router.get("/slug/{slug}", response_model=LandingPage)
async def get_landing_page_by_slug(slug: str):
    """Get landing page by slug"""
    page = await landing_page_service.get_landing_page_by_slug(slug)
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return page


@router.get("/{page_id}", response_model=LandingPage)
async def get_landing_page(page_id: int):
    """Get landing page by ID"""
    page = await landing_page_service.get_landing_page(page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return page


@router.post("/", response_model=LandingPage, status_code=201)
async def create_landing_page(payload: LandingPageCreate):
    """Create a new landing page"""
    return await landing_page_service.create_landing_page(payload)


# UTM Tracking & Views
@router.post("/track/view", response_model=LandingPageView, status_code=201)
async def track_page_view(payload: LandingPageViewCreate, request: Request):
    """Track a landing page view with UTM parameters"""
    # Capture IP and user agent if not provided
    if not payload.ip_address:
        payload.ip_address = request.client.host if request.client else None
    if not payload.user_agent:
        payload.user_agent = request.headers.get("user-agent")
    
    return await landing_page_service.track_page_view(payload)


@router.post("/track/conversion", response_model=LandingPageConversion, status_code=201)
async def track_conversion(payload: LandingPageConversionCreate):
    """Track a landing page conversion"""
    return await landing_page_service.track_conversion(payload)


@router.post("/track/event")
async def track_marketing_event(payload: TrackEventRequest, request: Request):
    """Track a marketing event with UTM parameters"""
    utm_params = payload.utm_params or UTMParameters()
    
    await landing_page_service.log_marketing_event(
        event_type=payload.event_type,
        event_name=payload.event_name,
        page_url=payload.page_url,
        utm_source=utm_params.utm_source,
        utm_medium=utm_params.utm_medium,
        utm_campaign=utm_params.utm_campaign,
        utm_term=utm_params.utm_term,
        utm_content=utm_params.utm_content,
        session_id=payload.session_id,
        properties=payload.properties,
    )
    
    return {"status": "tracked"}


# Analytics
@router.get("/analytics/campaign", response_model=CampaignAnalytics)
async def get_campaign_analytics(
    campaign_id: Optional[int] = Query(None, description="Campaign ID"),
    days: int = Query(30, ge=1, le=365, description="Number of days"),
):
    """Get campaign analytics"""
    return await landing_page_service.get_campaign_analytics(campaign_id, days)


@router.get("/{page_id}/analytics", response_model=LandingPageAnalytics)
async def get_landing_page_analytics(page_id: int):
    """Get analytics for a specific landing page"""
    analytics = await landing_page_service.get_landing_page_analytics(page_id)
    if not analytics:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return analytics
