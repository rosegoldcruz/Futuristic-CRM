"""
AR Visualizer service - handles before/after rendering and AR sessions
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.ar_visualizer import (
    ARVisualizer, ARVisualizerCreate, ARVisualizerUpdate,
    RENDER_TYPES, RENDER_STATUSES
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


def _row_to_ar_visualizer(row: Dict[str, Any]) -> ARVisualizer:
    """Convert DB row to ARVisualizer model"""
    return ARVisualizer(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        homeowner_id=row.get("homeowner_id"),
        job_id=row.get("job_id"),
        homeowner_name=row.get("homeowner_name"),
        job_customer_name=row.get("job_customer_name"),
        render_type=row.get("render_type", "before_after"),
        before_image_url=row.get("before_image_url"),
        after_image_url=row.get("after_image_url"),
        render_status=row.get("render_status", "pending"),
        ar_session_id=row.get("ar_session_id"),
        panel_selection=_parse_json_field(row.get("panel_selection")),
        roof_analysis=_parse_json_field(row.get("roof_analysis")),
        ar_metadata=_parse_json_field(row.get("ar_metadata")),
        render_settings=_parse_json_field(row.get("render_settings")),
        thumbnail_url=row.get("thumbnail_url"),
        processing_started_at=row.get("processing_started_at"),
        processing_completed_at=row.get("processing_completed_at"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_renders(
    homeowner_id: Optional[int] = None,
    job_id: Optional[int] = None,
    render_type: Optional[str] = None,
    render_status: Optional[str] = None,
    ar_session_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[ARVisualizer]:
    """List AR visualizer renders with optional filtering"""
    query = """
        SELECT ar.id, ar.tenant_id, ar.homeowner_id, ar.job_id, ar.render_type,
               ar.before_image_url, ar.after_image_url, ar.render_status, ar.ar_session_id,
               ar.panel_selection, ar.roof_analysis, ar.ar_metadata, ar.render_settings,
               ar.thumbnail_url, ar.processing_started_at, ar.processing_completed_at,
               ar.metadata, ar.created_at, ar.updated_at, ar.deleted_at,
               CONCAT(h.first_name, ' ', h.last_name) as homeowner_name,
               j.customer_name as job_customer_name
        FROM ar_visualizer ar
        LEFT JOIN homeowners h ON ar.homeowner_id = h.id
        LEFT JOIN jobs j ON ar.job_id = j.id
        WHERE ar.deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if homeowner_id:
        query += " AND ar.homeowner_id = :homeowner_id"
        params["homeowner_id"] = homeowner_id

    if job_id:
        query += " AND ar.job_id = :job_id"
        params["job_id"] = job_id

    if render_type:
        query += " AND ar.render_type = :render_type"
        params["render_type"] = render_type

    if render_status:
        query += " AND ar.render_status = :render_status"
        params["render_status"] = render_status

    if ar_session_id:
        query += " AND ar.ar_session_id = :ar_session_id"
        params["ar_session_id"] = ar_session_id

    query += " ORDER BY ar.created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_ar_visualizer(r) for r in rows]


async def get_render(render_id: int) -> Optional[ARVisualizer]:
    """Get a single render by ID"""
    query = """
        SELECT ar.id, ar.tenant_id, ar.homeowner_id, ar.job_id, ar.render_type,
               ar.before_image_url, ar.after_image_url, ar.render_status, ar.ar_session_id,
               ar.panel_selection, ar.roof_analysis, ar.ar_metadata, ar.render_settings,
               ar.thumbnail_url, ar.processing_started_at, ar.processing_completed_at,
               ar.metadata, ar.created_at, ar.updated_at, ar.deleted_at,
               CONCAT(h.first_name, ' ', h.last_name) as homeowner_name,
               j.customer_name as job_customer_name
        FROM ar_visualizer ar
        LEFT JOIN homeowners h ON ar.homeowner_id = h.id
        LEFT JOIN jobs j ON ar.job_id = j.id
        WHERE ar.id = :render_id AND ar.deleted_at IS NULL
    """
    row = await fetch_one(query, {"render_id": render_id})
    return _row_to_ar_visualizer(row) if row else None


async def create_render(data: ARVisualizerCreate) -> ARVisualizer:
    """Create a new AR visualizer render"""
    # Validate render type
    if data.render_type not in RENDER_TYPES:
        raise ValueError(f"Invalid render_type. Must be one of: {', '.join(RENDER_TYPES)}")
    
    # Validate status if provided
    if data.render_status and data.render_status not in RENDER_STATUSES:
        raise ValueError(f"Invalid render_status. Must be one of: {', '.join(RENDER_STATUSES)}")
    
    # Validate homeowner exists
    if data.homeowner_id:
        homeowner_check = await fetch_one(
            "SELECT id FROM homeowners WHERE id = :homeowner_id AND deleted_at IS NULL",
            {"homeowner_id": data.homeowner_id}
        )
        if not homeowner_check:
            raise ValueError(f"Homeowner #{data.homeowner_id} not found")
    
    # Validate job exists if provided
    if data.job_id:
        job_check = await fetch_one(
            "SELECT id FROM jobs WHERE id = :job_id AND deleted_at IS NULL",
            {"job_id": data.job_id}
        )
        if not job_check:
            raise ValueError(f"Job #{data.job_id} not found")
    
    # Validate before_image_url is provided
    if not data.before_image_url:
        raise ValueError("before_image_url is required")
    
    query = """
        INSERT INTO ar_visualizer (
            tenant_id, homeowner_id, job_id, render_type, before_image_url,
            after_image_url, render_status, ar_session_id,
            panel_selection, roof_analysis, ar_metadata, render_settings
        )
        VALUES (
            :tenant_id, :homeowner_id, :job_id, :render_type, :before_image_url,
            :after_image_url, :render_status, :ar_session_id,
            CAST(:panel_selection AS jsonb), CAST(:roof_analysis AS jsonb),
            CAST(:ar_metadata AS jsonb), CAST(:render_settings AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "homeowner_id": data.homeowner_id,
        "job_id": data.job_id,
        "render_type": data.render_type,
        "before_image_url": data.before_image_url,
        "after_image_url": data.after_image_url,
        "render_status": data.render_status or "pending",
        "ar_session_id": data.ar_session_id,
        "panel_selection": json.dumps(data.panel_selection) if data.panel_selection else "{}",
        "roof_analysis": json.dumps(data.roof_analysis) if data.roof_analysis else "{}",
        "ar_metadata": json.dumps(data.ar_metadata) if data.ar_metadata else "{}",
        "render_settings": json.dumps(data.render_settings) if data.render_settings else "{}",
    })
    
    return await get_render(row["id"])  # type: ignore


async def update_render(render_id: int, data: ARVisualizerUpdate) -> Optional[ARVisualizer]:
    """Update an existing render"""
    updates = []
    params: Dict[str, Any] = {"render_id": render_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    # Validate status if provided
    if "render_status" in payload and payload["render_status"] and payload["render_status"] not in RENDER_STATUSES:
        raise ValueError(f"Invalid render_status. Must be one of: {', '.join(RENDER_STATUSES)}")
    
    field_mappings = {
        "render_status": "render_status",
        "before_image_url": "before_image_url",
        "after_image_url": "after_image_url",
        "thumbnail_url": "thumbnail_url",
        "processing_started_at": "processing_started_at",
        "processing_completed_at": "processing_completed_at",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    # Handle JSONB fields
    jsonb_fields = ["panel_selection", "roof_analysis", "ar_metadata", "render_settings", "metadata"]
    for field_name in jsonb_fields:
        if field_name in payload:
            updates.append(f"{field_name} = CAST(:{field_name} AS jsonb)")
            params[field_name] = json.dumps(payload[field_name]) if payload[field_name] else "{}"

    if not updates:
        return await get_render(render_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE ar_visualizer SET {set_clause}
        WHERE id = :render_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_render(render_id)


async def delete_render(render_id: int) -> bool:
    """Soft delete a render"""
    query = "UPDATE ar_visualizer SET deleted_at = NOW() WHERE id = :render_id AND deleted_at IS NULL"
    count = await execute(query, {"render_id": render_id})
    return count > 0


async def update_render_status(
    render_id: int,
    render_status: str,
    after_image_url: Optional[str] = None,
    thumbnail_url: Optional[str] = None
) -> Optional[ARVisualizer]:
    """Update render status with optional image URLs"""
    if render_status not in RENDER_STATUSES:
        raise ValueError(f"Invalid render_status. Must be one of: {', '.join(RENDER_STATUSES)}")
    
    update_parts = ["render_status = :render_status", "updated_at = NOW()"]
    params: Dict[str, Any] = {
        "render_id": render_id,
        "render_status": render_status,
    }
    
    if render_status == "processing":
        update_parts.append("processing_started_at = COALESCE(processing_started_at, NOW())")
    elif render_status == "completed":
        update_parts.append("processing_completed_at = COALESCE(processing_completed_at, NOW())")
    
    if after_image_url:
        update_parts.append("after_image_url = :after_image_url")
        params["after_image_url"] = after_image_url
    
    if thumbnail_url:
        update_parts.append("thumbnail_url = :thumbnail_url")
        params["thumbnail_url"] = thumbnail_url
    
    query = f"""
        UPDATE ar_visualizer 
        SET {', '.join(update_parts)}
        WHERE id = :render_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_render(render_id)


async def get_homeowner_renders(homeowner_id: int, limit: int = 20) -> List[ARVisualizer]:
    """Get all renders for a specific homeowner"""
    return await list_renders(homeowner_id=homeowner_id, limit=limit)


async def get_job_renders(job_id: int) -> List[ARVisualizer]:
    """Get all renders for a specific job"""
    return await list_renders(job_id=job_id, limit=100)
