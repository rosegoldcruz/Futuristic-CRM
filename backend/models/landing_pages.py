"""
Landing page models for marketing campaigns with UTM tracking
"""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class LandingPageBase(BaseModel):
    """Base landing page fields"""
    page_slug: str
    page_name: str
    page_title: Optional[str] = None
    page_content: Optional[str] = None
    page_template: str = "default"
    is_active: bool = True
    variant_name: Optional[str] = None
    variant_weight: int = 100
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class LandingPageCreate(LandingPageBase):
    """Create a landing page"""
    tenant_id: Optional[int] = None
    campaign_id: Optional[int] = None


class LandingPageUpdate(BaseModel):
    """Update a landing page"""
    page_name: Optional[str] = None
    page_title: Optional[str] = None
    page_content: Optional[str] = None
    is_active: Optional[bool] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class LandingPage(LandingPageBase):
    """Landing page response model"""
    id: int
    tenant_id: Optional[int] = None
    campaign_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LandingPageViewBase(BaseModel):
    """Base landing page view fields"""
    landing_page_id: int
    session_id: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    referrer_url: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None


class LandingPageViewCreate(LandingPageViewBase):
    """Create a landing page view"""
    pass


class LandingPageView(LandingPageViewBase):
    """Landing page view response model"""
    id: int
    viewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LandingPageConversionBase(BaseModel):
    """Base landing page conversion fields"""
    landing_page_id: int
    conversion_type: str  # "lead", "quote_request", "contact", etc.
    conversion_value: Optional[float] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class LandingPageConversionCreate(LandingPageConversionBase):
    """Create a landing page conversion"""
    view_id: Optional[int] = None
    lead_id: Optional[int] = None


class LandingPageConversion(LandingPageConversionBase):
    """Landing page conversion response model"""
    id: int
    view_id: Optional[int] = None
    lead_id: Optional[int] = None
    converted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UTMParameters(BaseModel):
    """UTM tracking parameters"""
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None


class CampaignAnalytics(BaseModel):
    """Campaign analytics summary"""
    campaign_id: Optional[int] = None
    campaign_name: Optional[str] = None
    total_views: int = 0
    total_conversions: int = 0
    conversion_rate: float = 0.0
    total_value: float = 0.0
    unique_visitors: int = 0
    top_sources: list[Dict[str, Any]] = []
    top_pages: list[Dict[str, Any]] = []
    daily_metrics: list[Dict[str, Any]] = []


class LandingPageAnalytics(BaseModel):
    """Landing page analytics summary"""
    landing_page_id: int
    page_name: str
    page_slug: str
    views: int = 0
    conversions: int = 0
    conversion_rate: float = 0.0
    avg_time_to_conversion: Optional[float] = None
    utm_breakdown: Dict[str, Any] = {}
    variant_performance: Optional[Dict[str, Any]] = None


class TrackEventRequest(BaseModel):
    """Request to track a marketing event"""
    event_type: str
    event_name: str
    page_url: Optional[str] = None
    utm_params: Optional[UTMParameters] = None
    session_id: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
