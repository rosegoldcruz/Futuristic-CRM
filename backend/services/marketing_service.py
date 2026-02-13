"""
Marketing service - handles event tracking, UTM parameters, and campaign metrics
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime, timedelta
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.marketing import (
    MarketingEvent, MarketingEventCreate,
    MarketingCampaign, MarketingCampaignCreate, MarketingCampaignUpdate,
    MarketingMetrics,
    EVENT_TYPES, CAMPAIGN_STATUSES
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


def _row_to_event(row: Dict[str, Any]) -> MarketingEvent:
    """Convert DB row to MarketingEvent model"""
    return MarketingEvent(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        event_type=row.get("event_type"),
        event_name=row.get("event_name"),
        page_url=row.get("page_url"),
        referrer_url=row.get("referrer_url"),
        utm_source=row.get("utm_source"),
        utm_medium=row.get("utm_medium"),
        utm_campaign=row.get("utm_campaign"),
        utm_term=row.get("utm_term"),
        utm_content=row.get("utm_content"),
        ad_source=row.get("ad_source"),
        lead_source=row.get("lead_source"),
        user_agent=row.get("user_agent"),
        ip_address=row.get("ip_address"),
        session_id=row.get("session_id"),
        user_id=row.get("user_id"),
        lead_id=row.get("lead_id"),
        properties=_parse_json_field(row.get("properties")),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        deleted_at=row.get("deleted_at"),
    )


def _row_to_campaign(row: Dict[str, Any]) -> MarketingCampaign:
    """Convert DB row to MarketingCampaign model"""
    return MarketingCampaign(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        campaign_name=row.get("campaign_name"),
        campaign_type=row.get("campaign_type"),
        status=row.get("status", "active"),
        start_date=row.get("start_date"),
        end_date=row.get("end_date"),
        budget=float(row["budget"]) if row.get("budget") else None,
        spent=float(row["spent"]) if row.get("spent") else 0.0,
        utm_campaign=row.get("utm_campaign"),
        utm_source=row.get("utm_source"),
        utm_medium=row.get("utm_medium"),
        target_audience=_parse_json_field(row.get("target_audience")),
        metrics=_parse_json_field(row.get("metrics")),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_events(
    tenant_id: Optional[int] = None,
    event_type: Optional[str] = None,
    utm_source: Optional[str] = None,
    utm_campaign: Optional[str] = None,
    lead_source: Optional[str] = None,
    session_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[MarketingEvent]:
    """List marketing events with optional filtering"""
    query = "SELECT * FROM marketing_events WHERE deleted_at IS NULL"
    params: Dict[str, Any] = {}

    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if event_type:
        query += " AND event_type = :event_type"
        params["event_type"] = event_type

    if utm_source:
        query += " AND utm_source = :utm_source"
        params["utm_source"] = utm_source

    if utm_campaign:
        query += " AND utm_campaign = :utm_campaign"
        params["utm_campaign"] = utm_campaign

    if lead_source:
        query += " AND lead_source = :lead_source"
        params["lead_source"] = lead_source

    if session_id:
        query += " AND session_id = :session_id"
        params["session_id"] = session_id

    if start_date:
        query += " AND created_at >= :start_date"
        params["start_date"] = start_date

    if end_date:
        query += " AND created_at <= :end_date"
        params["end_date"] = end_date

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_event(r) for r in rows]


async def get_event(event_id: int) -> Optional[MarketingEvent]:
    """Get a single event by ID"""
    query = "SELECT * FROM marketing_events WHERE id = :event_id AND deleted_at IS NULL"
    row = await fetch_one(query, {"event_id": event_id})
    return _row_to_event(row) if row else None


async def create_event(data: MarketingEventCreate) -> MarketingEvent:
    """Create a new marketing event"""
    # Validate event type
    if data.event_type not in EVENT_TYPES:
        raise ValueError(f"Invalid event_type. Must be one of: {', '.join(EVENT_TYPES)}")
    
    query = """
        INSERT INTO marketing_events (
            tenant_id, event_type, event_name, page_url, referrer_url,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            ad_source, lead_source, user_agent, ip_address, session_id,
            user_id, lead_id, properties, metadata
        )
        VALUES (
            :tenant_id, :event_type, :event_name, :page_url, :referrer_url,
            :utm_source, :utm_medium, :utm_campaign, :utm_term, :utm_content,
            :ad_source, :lead_source, :user_agent, :ip_address, :session_id,
            :user_id, :lead_id, CAST(:properties AS jsonb), CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "event_type": data.event_type,
        "event_name": data.event_name,
        "page_url": data.page_url,
        "referrer_url": data.referrer_url,
        "utm_source": data.utm_source,
        "utm_medium": data.utm_medium,
        "utm_campaign": data.utm_campaign,
        "utm_term": data.utm_term,
        "utm_content": data.utm_content,
        "ad_source": data.ad_source,
        "lead_source": data.lead_source,
        "user_agent": data.user_agent,
        "ip_address": data.ip_address,
        "session_id": data.session_id,
        "user_id": data.user_id,
        "lead_id": data.lead_id,
        "properties": json.dumps(data.properties) if data.properties else "{}",
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_event(row["id"])  # type: ignore


async def delete_event(event_id: int) -> bool:
    """Soft delete an event"""
    query = "UPDATE marketing_events SET deleted_at = NOW() WHERE id = :event_id AND deleted_at IS NULL"
    count = await execute(query, {"event_id": event_id})
    return count > 0


async def get_marketing_metrics(
    tenant_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> MarketingMetrics:
    """Get aggregated marketing metrics"""
    params: Dict[str, Any] = {}
    where_clauses = ["deleted_at IS NULL"]
    
    if tenant_id:
        where_clauses.append("tenant_id = :tenant_id")
        params["tenant_id"] = tenant_id
    
    if start_date:
        where_clauses.append("created_at >= :start_date")
        params["start_date"] = start_date
    
    if end_date:
        where_clauses.append("created_at <= :end_date")
        params["end_date"] = end_date
    
    where_sql = " AND ".join(where_clauses)
    
    # Total events
    query = f"SELECT COUNT(*) as count FROM marketing_events WHERE {where_sql}"
    row = await fetch_one(query, params)
    total_events = row["count"] if row else 0
    
    # Total page views
    query = f"SELECT COUNT(*) as count FROM marketing_events WHERE {where_sql} AND event_type = 'page_view'"
    row = await fetch_one(query, params)
    total_page_views = row["count"] if row else 0
    
    # Total leads
    query = f"SELECT COUNT(*) as count FROM marketing_events WHERE {where_sql} AND event_type = 'lead_created'"
    row = await fetch_one(query, params)
    total_leads = row["count"] if row else 0
    
    # Total conversions
    query = f"SELECT COUNT(*) as count FROM marketing_events WHERE {where_sql} AND event_type IN ('quote_requested', 'job_created')"
    row = await fetch_one(query, params)
    total_conversions = row["count"] if row else 0
    
    # Top sources
    query = f"""
        SELECT utm_source, COUNT(*) as count 
        FROM marketing_events 
        WHERE {where_sql} AND utm_source IS NOT NULL
        GROUP BY utm_source 
        ORDER BY count DESC 
        LIMIT 10
    """
    rows = await fetch_all(query, params)
    top_sources = [{"source": r["utm_source"], "count": r["count"]} for r in rows]
    
    # Top campaigns
    query = f"""
        SELECT utm_campaign, COUNT(*) as count 
        FROM marketing_events 
        WHERE {where_sql} AND utm_campaign IS NOT NULL
        GROUP BY utm_campaign 
        ORDER BY count DESC 
        LIMIT 10
    """
    rows = await fetch_all(query, params)
    top_campaigns = [{"campaign": r["utm_campaign"], "count": r["count"]} for r in rows]
    
    # Top mediums
    query = f"""
        SELECT utm_medium, COUNT(*) as count 
        FROM marketing_events 
        WHERE {where_sql} AND utm_medium IS NOT NULL
        GROUP BY utm_medium 
        ORDER BY count DESC 
        LIMIT 10
    """
    rows = await fetch_all(query, params)
    top_mediums = [{"medium": r["utm_medium"], "count": r["count"]} for r in rows]
    
    # Timeline data (daily aggregation)
    query = f"""
        SELECT DATE(created_at) as date, COUNT(*) as count, event_type
        FROM marketing_events 
        WHERE {where_sql}
        GROUP BY DATE(created_at), event_type
        ORDER BY date DESC
        LIMIT 30
    """
    rows = await fetch_all(query, params)
    timeline_data = [
        {
            "date": r["date"].isoformat() if r["date"] else None,
            "count": r["count"],
            "event_type": r["event_type"],
        }
        for r in rows
    ]
    
    return MarketingMetrics(
        total_events=total_events,
        total_page_views=total_page_views,
        total_leads=total_leads,
        total_conversions=total_conversions,
        top_sources=top_sources,
        top_campaigns=top_campaigns,
        top_mediums=top_mediums,
        timeline_data=timeline_data,
    )


# Campaign management
async def list_campaigns(
    tenant_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[MarketingCampaign]:
    """List marketing campaigns"""
    query = "SELECT * FROM marketing_campaigns WHERE deleted_at IS NULL"
    params: Dict[str, Any] = {}

    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if status:
        query += " AND status = :status"
        params["status"] = status

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_campaign(r) for r in rows]


async def get_campaign(campaign_id: int) -> Optional[MarketingCampaign]:
    """Get a single campaign by ID"""
    query = "SELECT * FROM marketing_campaigns WHERE id = :campaign_id AND deleted_at IS NULL"
    row = await fetch_one(query, {"campaign_id": campaign_id})
    return _row_to_campaign(row) if row else None


async def create_campaign(data: MarketingCampaignCreate) -> MarketingCampaign:
    """Create a new marketing campaign"""
    if data.status and data.status not in CAMPAIGN_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(CAMPAIGN_STATUSES)}")
    
    query = """
        INSERT INTO marketing_campaigns (
            tenant_id, campaign_name, campaign_type, status, start_date, end_date,
            budget, spent, utm_campaign, utm_source, utm_medium,
            target_audience, metrics, metadata
        )
        VALUES (
            :tenant_id, :campaign_name, :campaign_type, :status, :start_date, :end_date,
            :budget, :spent, :utm_campaign, :utm_source, :utm_medium,
            CAST(:target_audience AS jsonb), CAST(:metrics AS jsonb), CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "campaign_name": data.campaign_name,
        "campaign_type": data.campaign_type,
        "status": data.status or "active",
        "start_date": data.start_date,
        "end_date": data.end_date,
        "budget": data.budget,
        "spent": data.spent or 0.0,
        "utm_campaign": data.utm_campaign,
        "utm_source": data.utm_source,
        "utm_medium": data.utm_medium,
        "target_audience": json.dumps(data.target_audience) if data.target_audience else "{}",
        "metrics": json.dumps(data.metrics) if data.metrics else "{}",
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_campaign(row["id"])  # type: ignore


async def update_campaign(campaign_id: int, data: MarketingCampaignUpdate) -> Optional[MarketingCampaign]:
    """Update an existing campaign"""
    updates = []
    params: Dict[str, Any] = {"campaign_id": campaign_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    if "status" in payload and payload["status"] and payload["status"] not in CAMPAIGN_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(CAMPAIGN_STATUSES)}")
    
    field_mappings = {
        "campaign_name": "campaign_name",
        "status": "status",
        "budget": "budget",
        "spent": "spent",
        "end_date": "end_date",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    if "metrics" in payload:
        updates.append("metrics = CAST(:metrics AS jsonb)")
        params["metrics"] = json.dumps(payload["metrics"]) if payload["metrics"] else "{}"
    
    if "metadata" in payload:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(payload["metadata"]) if payload["metadata"] else "{}"

    if not updates:
        return await get_campaign(campaign_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE marketing_campaigns SET {set_clause}
        WHERE id = :campaign_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_campaign(campaign_id)


async def delete_campaign(campaign_id: int) -> bool:
    """Soft delete a campaign"""
    query = "UPDATE marketing_campaigns SET deleted_at = NOW() WHERE id = :campaign_id AND deleted_at IS NULL"
    count = await execute(query, {"campaign_id": campaign_id})
    return count > 0
