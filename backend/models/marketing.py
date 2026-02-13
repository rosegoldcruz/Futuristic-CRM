"""
Marketing models for event tracking, UTM parameters, and campaign metrics
"""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


# Event type constants
EVENT_TYPES = [
    "page_view",
    "button_click",
    "form_submit",
    "lead_created",
    "quote_requested",
    "job_created",
    "phone_call",
    "email_sent",
    "chat_started",
]

# Campaign status constants
CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed", "archived"]

# Lead source constants
LEAD_SOURCES = [
    "organic_search",
    "paid_search",
    "social_media",
    "referral",
    "direct",
    "email",
    "display_ads",
    "affiliate",
    "other",
]


class MarketingEventBase(BaseModel):
    """Base marketing event fields"""
    event_type: str
    event_name: Optional[str] = None
    page_url: Optional[str] = None
    referrer_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    ad_source: Optional[str] = None
    lead_source: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[int] = None
    lead_id: Optional[int] = None
    properties: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None


class MarketingEventCreate(MarketingEventBase):
    """Create a new marketing event"""
    tenant_id: Optional[int] = None


class MarketingEvent(BaseModel):
    """Marketing event response model"""
    id: int
    tenant_id: Optional[int] = None
    event_type: str
    event_name: Optional[str] = None
    page_url: Optional[str] = None
    referrer_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    ad_source: Optional[str] = None
    lead_source: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[int] = None
    lead_id: Optional[int] = None
    properties: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MarketingCampaignBase(BaseModel):
    """Base marketing campaign fields"""
    campaign_name: str
    campaign_type: Optional[str] = None
    status: Optional[str] = "active"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget: Optional[float] = None
    spent: Optional[float] = 0.0
    utm_campaign: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    target_audience: Optional[dict[str, Any]] = None
    metrics: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None


class MarketingCampaignCreate(MarketingCampaignBase):
    """Create a new marketing campaign"""
    tenant_id: Optional[int] = None


class MarketingCampaignUpdate(BaseModel):
    """Update an existing marketing campaign"""
    campaign_name: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    spent: Optional[float] = None
    end_date: Optional[datetime] = None
    metrics: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None


class MarketingCampaign(BaseModel):
    """Marketing campaign response model"""
    id: int
    tenant_id: Optional[int] = None
    campaign_name: str
    campaign_type: Optional[str] = None
    status: str = "active"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget: Optional[float] = None
    spent: Optional[float] = 0.0
    utm_campaign: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    target_audience: Optional[dict[str, Any]] = None
    metrics: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MarketingMetrics(BaseModel):
    """Aggregated marketing metrics"""
    total_events: int = 0
    total_page_views: int = 0
    total_leads: int = 0
    total_conversions: int = 0
    top_sources: list[dict[str, Any]] = []
    top_campaigns: list[dict[str, Any]] = []
    top_mediums: list[dict[str, Any]] = []
    timeline_data: list[dict[str, Any]] = []


class EventRequest(BaseModel):
    """Request to log a marketing event"""
    event_type: str
    event_name: Optional[str] = None
    page_url: Optional[str] = None
    referrer_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    lead_source: Optional[str] = None
    session_id: Optional[str] = None
    properties: Optional[dict[str, Any]] = None
