"""
Landing page service - UTM tracking, event logging, campaign analytics
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime, timedelta
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.landing_pages import (
    LandingPage, LandingPageCreate, LandingPageUpdate,
    LandingPageView, LandingPageViewCreate,
    LandingPageConversion, LandingPageConversionCreate,
    CampaignAnalytics, LandingPageAnalytics,
    TrackEventRequest, UTMParameters
)


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


def _row_to_landing_page(row: Dict[str, Any]) -> LandingPage:
    """Convert DB row to LandingPage model"""
    return LandingPage(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        campaign_id=row.get("campaign_id"),
        page_slug=row.get("page_slug"),
        page_name=row.get("page_name"),
        page_title=row.get("page_title"),
        page_content=row.get("page_content"),
        page_template=row.get("page_template", "default"),
        is_active=row.get("is_active", True),
        variant_name=row.get("variant_name"),
        variant_weight=row.get("variant_weight", 100),
        seo_title=row.get("seo_title"),
        seo_description=row.get("seo_description"),
        seo_keywords=row.get("seo_keywords"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_view(row: Dict[str, Any]) -> LandingPageView:
    """Convert DB row to LandingPageView model"""
    return LandingPageView(
        id=row["id"],
        landing_page_id=row.get("landing_page_id"),
        session_id=row.get("session_id"),
        utm_source=row.get("utm_source"),
        utm_medium=row.get("utm_medium"),
        utm_campaign=row.get("utm_campaign"),
        utm_term=row.get("utm_term"),
        utm_content=row.get("utm_content"),
        referrer_url=row.get("referrer_url"),
        user_agent=row.get("user_agent"),
        ip_address=row.get("ip_address"),
        viewed_at=row.get("viewed_at"),
    )


def _row_to_conversion(row: Dict[str, Any]) -> LandingPageConversion:
    """Convert DB row to LandingPageConversion model"""
    return LandingPageConversion(
        id=row["id"],
        landing_page_id=row.get("landing_page_id"),
        view_id=row.get("view_id"),
        lead_id=row.get("lead_id"),
        conversion_type=row.get("conversion_type"),
        conversion_value=float(row["conversion_value"]) if row.get("conversion_value") else None,
        utm_source=row.get("utm_source"),
        utm_medium=row.get("utm_medium"),
        utm_campaign=row.get("utm_campaign"),
        metadata=_parse_json_field(row.get("metadata")),
        converted_at=row.get("converted_at"),
    )


# Landing Pages
async def list_landing_pages(campaign_id: Optional[int] = None, is_active: Optional[bool] = None) -> List[LandingPage]:
    """List landing pages"""
    query = "SELECT * FROM landing_pages WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if campaign_id:
        query += " AND campaign_id = :campaign_id"
        params["campaign_id"] = campaign_id
    
    if is_active is not None:
        query += " AND is_active = :is_active"
        params["is_active"] = is_active
    
    query += " ORDER BY created_at DESC"
    
    rows = await fetch_all(query, params)
    return [_row_to_landing_page(r) for r in rows]


async def get_landing_page_by_slug(slug: str) -> Optional[LandingPage]:
    """Get landing page by slug"""
    query = "SELECT * FROM landing_pages WHERE page_slug = :slug AND is_active = true"
    row = await fetch_one(query, {"slug": slug})
    return _row_to_landing_page(row) if row else None


async def get_landing_page(page_id: int) -> Optional[LandingPage]:
    """Get landing page by ID"""
    query = "SELECT * FROM landing_pages WHERE id = :page_id"
    row = await fetch_one(query, {"page_id": page_id})
    return _row_to_landing_page(row) if row else None


async def create_landing_page(data: LandingPageCreate) -> LandingPage:
    """Create a new landing page"""
    query = """
        INSERT INTO landing_pages (
            tenant_id, campaign_id, page_slug, page_name, page_title,
            page_content, page_template, is_active, variant_name, variant_weight,
            seo_title, seo_description, seo_keywords, metadata
        )
        VALUES (
            :tenant_id, :campaign_id, :page_slug, :page_name, :page_title,
            :page_content, :page_template, :is_active, :variant_name, :variant_weight,
            :seo_title, :seo_description, :seo_keywords, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "campaign_id": data.campaign_id,
        "page_slug": data.page_slug,
        "page_name": data.page_name,
        "page_title": data.page_title,
        "page_content": data.page_content,
        "page_template": data.page_template,
        "is_active": data.is_active,
        "variant_name": data.variant_name,
        "variant_weight": data.variant_weight,
        "seo_title": data.seo_title,
        "seo_description": data.seo_description,
        "seo_keywords": data.seo_keywords,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_landing_page(row["id"])  # type: ignore


# UTM Tracking & Views
async def track_page_view(data: LandingPageViewCreate) -> LandingPageView:
    """Track a landing page view with UTM parameters"""
    query = """
        INSERT INTO landing_page_views (
            landing_page_id, session_id, utm_source, utm_medium, utm_campaign,
            utm_term, utm_content, referrer_url, user_agent, ip_address
        )
        VALUES (
            :landing_page_id, :session_id, :utm_source, :utm_medium, :utm_campaign,
            :utm_term, :utm_content, :referrer_url, :user_agent, :ip_address
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "landing_page_id": data.landing_page_id,
        "session_id": data.session_id,
        "utm_source": data.utm_source,
        "utm_medium": data.utm_medium,
        "utm_campaign": data.utm_campaign,
        "utm_term": data.utm_term,
        "utm_content": data.utm_content,
        "referrer_url": data.referrer_url,
        "user_agent": data.user_agent,
        "ip_address": data.ip_address,
    })
    
    # Also log to marketing_events
    await log_marketing_event(
        event_type="page_view",
        event_name=f"Landing Page View: {data.landing_page_id}",
        utm_source=data.utm_source,
        utm_medium=data.utm_medium,
        utm_campaign=data.utm_campaign,
        utm_term=data.utm_term,
        utm_content=data.utm_content,
        session_id=data.session_id,
        properties={"landing_page_id": data.landing_page_id},
    )
    
    query = "SELECT * FROM landing_page_views WHERE id = :view_id"
    row = await fetch_one(query, {"view_id": row["id"]})
    return _row_to_view(row) if row else None  # type: ignore


async def track_conversion(data: LandingPageConversionCreate) -> LandingPageConversion:
    """Track a landing page conversion"""
    query = """
        INSERT INTO landing_page_conversions (
            landing_page_id, view_id, lead_id, conversion_type, conversion_value,
            utm_source, utm_medium, utm_campaign, metadata
        )
        VALUES (
            :landing_page_id, :view_id, :lead_id, :conversion_type, :conversion_value,
            :utm_source, :utm_medium, :utm_campaign, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "landing_page_id": data.landing_page_id,
        "view_id": data.view_id,
        "lead_id": data.lead_id,
        "conversion_type": data.conversion_type,
        "conversion_value": data.conversion_value,
        "utm_source": data.utm_source,
        "utm_medium": data.utm_medium,
        "utm_campaign": data.utm_campaign,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    # Also log to marketing_events
    await log_marketing_event(
        event_type="conversion",
        event_name=f"Conversion: {data.conversion_type}",
        utm_source=data.utm_source,
        utm_medium=data.utm_medium,
        utm_campaign=data.utm_campaign,
        lead_id=data.lead_id,
        properties={
            "landing_page_id": data.landing_page_id,
            "conversion_type": data.conversion_type,
            "conversion_value": data.conversion_value,
        },
    )
    
    query = "SELECT * FROM landing_page_conversions WHERE id = :conv_id"
    row = await fetch_one(query, {"conv_id": row["id"]})
    return _row_to_conversion(row) if row else None  # type: ignore


# Marketing Events
async def log_marketing_event(
    event_type: str,
    event_name: str,
    page_url: Optional[str] = None,
    referrer_url: Optional[str] = None,
    utm_source: Optional[str] = None,
    utm_medium: Optional[str] = None,
    utm_campaign: Optional[str] = None,
    utm_term: Optional[str] = None,
    utm_content: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    properties: Optional[Dict[str, Any]] = None,
):
    """Log a marketing event"""
    query = """
        INSERT INTO marketing_events (
            event_type, event_name, page_url, referrer_url,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            session_id, user_id, lead_id, properties, metadata
        )
        VALUES (
            :event_type, :event_name, :page_url, :referrer_url,
            :utm_source, :utm_medium, :utm_campaign, :utm_term, :utm_content,
            :session_id, :user_id, :lead_id, CAST(:properties AS jsonb), CAST(:metadata AS jsonb)
        )
    """
    
    await execute(query, {
        "event_type": event_type,
        "event_name": event_name,
        "page_url": page_url,
        "referrer_url": referrer_url,
        "utm_source": utm_source,
        "utm_medium": utm_medium,
        "utm_campaign": utm_campaign,
        "utm_term": utm_term,
        "utm_content": utm_content,
        "session_id": session_id,
        "user_id": user_id,
        "lead_id": lead_id,
        "properties": json.dumps(properties) if properties else "{}",
        "metadata": "{}",
    })


# Analytics
async def get_campaign_analytics(campaign_id: Optional[int] = None, days: int = 30) -> CampaignAnalytics:
    """Get campaign analytics"""
    start_date = datetime.now() - timedelta(days=days)
    
    # Get campaign info
    campaign_name = None
    if campaign_id:
        campaign_query = "SELECT campaign_name FROM marketing_campaigns WHERE id = :campaign_id"
        campaign = await fetch_one(campaign_query, {"campaign_id": campaign_id})
        if campaign:
            campaign_name = campaign["campaign_name"]
    
    # Get total views
    views_query = """
        SELECT COUNT(*) as count
        FROM landing_page_views lpv
        JOIN landing_pages lp ON lpv.landing_page_id = lp.id
        WHERE lpv.viewed_at >= :start_date
    """
    params: Dict[str, Any] = {"start_date": start_date}
    
    if campaign_id:
        views_query += " AND lp.campaign_id = :campaign_id"
        params["campaign_id"] = campaign_id
    
    views_row = await fetch_one(views_query, params)
    total_views = views_row["count"] if views_row else 0
    
    # Get total conversions
    conv_query = """
        SELECT COUNT(*) as count, COALESCE(SUM(conversion_value), 0) as total_value
        FROM landing_page_conversions lpc
        JOIN landing_pages lp ON lpc.landing_page_id = lp.id
        WHERE lpc.converted_at >= :start_date
    """
    
    if campaign_id:
        conv_query += " AND lp.campaign_id = :campaign_id"
    
    conv_row = await fetch_one(conv_query, params)
    total_conversions = conv_row["count"] if conv_row else 0
    total_value = float(conv_row["total_value"]) if conv_row else 0.0
    
    # Get unique visitors
    unique_query = """
        SELECT COUNT(DISTINCT session_id) as count
        FROM landing_page_views lpv
        JOIN landing_pages lp ON lpv.landing_page_id = lp.id
        WHERE lpv.viewed_at >= :start_date AND lpv.session_id IS NOT NULL
    """
    
    if campaign_id:
        unique_query += " AND lp.campaign_id = :campaign_id"
    
    unique_row = await fetch_one(unique_query, params)
    unique_visitors = unique_row["count"] if unique_row else 0
    
    # Get top sources
    sources_query = """
        SELECT utm_source, COUNT(*) as views, COUNT(DISTINCT session_id) as unique_visitors
        FROM landing_page_views lpv
        JOIN landing_pages lp ON lpv.landing_page_id = lp.id
        WHERE lpv.viewed_at >= :start_date AND lpv.utm_source IS NOT NULL
    """
    
    if campaign_id:
        sources_query += " AND lp.campaign_id = :campaign_id"
    
    sources_query += " GROUP BY utm_source ORDER BY views DESC LIMIT 10"
    
    sources_rows = await fetch_all(sources_query, params)
    top_sources = [dict(r) for r in sources_rows]
    
    # Calculate conversion rate
    conversion_rate = (total_conversions / total_views * 100) if total_views > 0 else 0.0
    
    return CampaignAnalytics(
        campaign_id=campaign_id,
        campaign_name=campaign_name,
        total_views=total_views,
        total_conversions=total_conversions,
        conversion_rate=conversion_rate,
        total_value=total_value,
        unique_visitors=unique_visitors,
        top_sources=top_sources,
        top_pages=[],
        daily_metrics=[],
    )


async def get_landing_page_analytics(page_id: int) -> Optional[LandingPageAnalytics]:
    """Get analytics for a specific landing page"""
    page = await get_landing_page(page_id)
    if not page:
        return None
    
    # Get views count
    views_query = "SELECT COUNT(*) as count FROM landing_page_views WHERE landing_page_id = :page_id"
    views_row = await fetch_one(views_query, {"page_id": page_id})
    views = views_row["count"] if views_row else 0
    
    # Get conversions count
    conv_query = "SELECT COUNT(*) as count FROM landing_page_conversions WHERE landing_page_id = :page_id"
    conv_row = await fetch_one(conv_query, {"page_id": page_id})
    conversions = conv_row["count"] if conv_row else 0
    
    # Calculate conversion rate
    conversion_rate = (conversions / views * 100) if views > 0 else 0.0
    
    # Get UTM breakdown
    utm_query = """
        SELECT utm_source, utm_medium, COUNT(*) as count
        FROM landing_page_views
        WHERE landing_page_id = :page_id
        GROUP BY utm_source, utm_medium
        ORDER BY count DESC
    """
    utm_rows = await fetch_all(utm_query, {"page_id": page_id})
    utm_breakdown = {
        "sources": [{"source": r["utm_source"], "medium": r["utm_medium"], "count": r["count"]} for r in utm_rows]
    }
    
    return LandingPageAnalytics(
        landing_page_id=page_id,
        page_name=page.page_name,
        page_slug=page.page_slug,
        views=views,
        conversions=conversions,
        conversion_rate=conversion_rate,
        utm_breakdown=utm_breakdown,
    )
