"""
Work orders service - execution pipeline for approved jobs
"""
from typing import List, Optional, Dict, Any
import json
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.work_orders import (
    WorkOrder, WorkOrderCreate, WorkOrderUpdate,
    WORK_ORDER_STATUSES, is_valid_work_order_transition
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


def _row_to_work_order(row: Dict[str, Any]) -> WorkOrder:
    """Convert DB row to WorkOrder model"""
    return WorkOrder(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        job_id=row["job_id"],
        installer_id=row.get("installer_id"),
        customer_name=row.get("customer_name"),
        installer_name=row.get("installer_name"),
        job_status=row.get("job_status"),
        status=row.get("status", "created"),
        scheduled_date=row.get("scheduled_date"),
        scheduled_time_start=row.get("scheduled_time_start"),
        scheduled_time_end=row.get("scheduled_time_end"),
        homeowner_info=_parse_json_field(row.get("homeowner_info")),
        installer_info=_parse_json_field(row.get("installer_info")),
        project_details=_parse_json_field(row.get("project_details")),
        materials_snapshot=_parse_json_field(row.get("materials_snapshot")),
        labor_instructions=_parse_json_field(row.get("labor_instructions")),
        timeline=_parse_json_field(row.get("timeline")),
        special_instructions=row.get("special_instructions"),
        internal_notes=row.get("internal_notes"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_work_orders(
    search: Optional[str] = None,
    status: Optional[str] = None,
    job_id: Optional[int] = None,
    installer_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[WorkOrder]:
    query = """
        SELECT wo.id, wo.tenant_id, wo.job_id, wo.installer_id, wo.status,
               wo.scheduled_date, wo.scheduled_time_start, wo.scheduled_time_end,
               wo.homeowner_info, wo.installer_info, wo.project_details,
               wo.materials_snapshot, wo.labor_instructions, wo.timeline,
               wo.special_instructions, wo.internal_notes, wo.metadata,
               wo.created_at, wo.updated_at, wo.deleted_at,
               j.customer_name, j.status as job_status,
               CONCAT(i.first_name, ' ', i.last_name) as installer_name
        FROM work_orders wo
        LEFT JOIN jobs j ON wo.job_id = j.id
        LEFT JOIN installers i ON wo.installer_id = i.id
        WHERE wo.deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if status:
        query += " AND wo.status = :status"
        params["status"] = status

    if job_id:
        query += " AND wo.job_id = :job_id"
        params["job_id"] = job_id

    if installer_id:
        query += " AND wo.installer_id = :installer_id"
        params["installer_id"] = installer_id

    if search:
        query += " AND (j.customer_name ILIKE :search OR wo.special_instructions ILIKE :search OR wo.internal_notes ILIKE :search)"
        params["search"] = f"%{search}%"

    query += " ORDER BY wo.created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_work_order(r) for r in rows]


async def get_work_order(work_order_id: int) -> Optional[WorkOrder]:
    query = """
        SELECT wo.id, wo.tenant_id, wo.job_id, wo.installer_id, wo.status,
               wo.scheduled_date, wo.scheduled_time_start, wo.scheduled_time_end,
               wo.homeowner_info, wo.installer_info, wo.project_details,
               wo.materials_snapshot, wo.labor_instructions, wo.timeline,
               wo.special_instructions, wo.internal_notes, wo.metadata,
               wo.created_at, wo.updated_at, wo.deleted_at,
               j.customer_name, j.status as job_status,
               CONCAT(i.first_name, ' ', i.last_name) as installer_name
        FROM work_orders wo
        LEFT JOIN jobs j ON wo.job_id = j.id
        LEFT JOIN installers i ON wo.installer_id = i.id
        WHERE wo.id = :work_order_id AND wo.deleted_at IS NULL
    """
    row = await fetch_one(query, {"work_order_id": work_order_id})
    return _row_to_work_order(row) if row else None


async def get_work_order_by_job(job_id: int) -> Optional[WorkOrder]:
    """Get work order for a specific job"""
    query = """
        SELECT wo.id, wo.tenant_id, wo.job_id, wo.installer_id, wo.status,
               wo.scheduled_date, wo.scheduled_time_start, wo.scheduled_time_end,
               wo.homeowner_info, wo.installer_info, wo.project_details,
               wo.materials_snapshot, wo.labor_instructions, wo.timeline,
               wo.special_instructions, wo.internal_notes, wo.metadata,
               wo.created_at, wo.updated_at, wo.deleted_at,
               j.customer_name, j.status as job_status,
               CONCAT(i.first_name, ' ', i.last_name) as installer_name
        FROM work_orders wo
        LEFT JOIN jobs j ON wo.job_id = j.id
        LEFT JOIN installers i ON wo.installer_id = i.id
        WHERE wo.job_id = :job_id AND wo.deleted_at IS NULL
        ORDER BY wo.created_at DESC
        LIMIT 1
    """
    row = await fetch_one(query, {"job_id": job_id})
    return _row_to_work_order(row) if row else None


async def create_work_order(data: WorkOrderCreate) -> WorkOrder:
    query = """
        INSERT INTO work_orders (
            tenant_id, job_id, installer_id, status,
            scheduled_date, scheduled_time_start, scheduled_time_end,
            homeowner_info, installer_info, project_details,
            materials_snapshot, labor_instructions, timeline,
            special_instructions, internal_notes, metadata
        )
        VALUES (
            :tenant_id, :job_id, :installer_id, :status,
            :scheduled_date, :scheduled_time_start, :scheduled_time_end,
            CAST(:homeowner_info AS jsonb), CAST(:installer_info AS jsonb), CAST(:project_details AS jsonb),
            CAST(:materials_snapshot AS jsonb), CAST(:labor_instructions AS jsonb), CAST(:timeline AS jsonb),
            :special_instructions, :internal_notes, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "job_id": data.job_id,
        "installer_id": data.installer_id,
        "status": data.status or "created",
        "scheduled_date": data.scheduled_date,
        "scheduled_time_start": data.scheduled_time_start,
        "scheduled_time_end": data.scheduled_time_end,
        "homeowner_info": json.dumps(data.homeowner_info) if data.homeowner_info else "{}",
        "installer_info": json.dumps(data.installer_info) if data.installer_info else "{}",
        "project_details": json.dumps(data.project_details) if data.project_details else "{}",
        "materials_snapshot": json.dumps(data.materials_snapshot) if data.materials_snapshot else "[]",
        "labor_instructions": json.dumps(data.labor_instructions) if data.labor_instructions else "[]",
        "timeline": json.dumps(data.timeline) if data.timeline else "{}",
        "special_instructions": data.special_instructions,
        "internal_notes": data.internal_notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    return await get_work_order(row["id"])  # type: ignore


async def update_work_order(work_order_id: int, data: WorkOrderUpdate) -> Optional[WorkOrder]:
    updates = []
    params: Dict[str, Any] = {"work_order_id": work_order_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    field_mappings = {
        "installer_id": "installer_id",
        "status": "status",
        "scheduled_date": "scheduled_date",
        "scheduled_time_start": "scheduled_time_start",
        "scheduled_time_end": "scheduled_time_end",
        "special_instructions": "special_instructions",
        "internal_notes": "internal_notes",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    jsonb_fields = [
        "homeowner_info", "installer_info", "project_details",
        "materials_snapshot", "labor_instructions", "timeline", "metadata"
    ]
    
    for field in jsonb_fields:
        if field in payload:
            updates.append(f"{field} = CAST(:{field} AS jsonb)")
            params[field] = json.dumps(payload[field]) if payload[field] else "{}"

    if not updates:
        return await get_work_order(work_order_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE work_orders SET {set_clause}
        WHERE id = :work_order_id AND deleted_at IS NULL
        RETURNING id
    """
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_work_order(work_order_id)


async def delete_work_order(work_order_id: int) -> bool:
    query = "UPDATE work_orders SET deleted_at = NOW() WHERE id = :work_order_id AND deleted_at IS NULL"
    count = await execute(query, {"work_order_id": work_order_id})
    return count > 0


async def update_work_order_status(work_order_id: int, new_status: str) -> Optional[WorkOrder]:
    """Update work order status with transition validation."""
    if new_status not in WORK_ORDER_STATUSES:
        raise ValueError(f"Invalid status: {new_status}. Must be one of: {', '.join(WORK_ORDER_STATUSES)}")
    
    work_order = await get_work_order(work_order_id)
    if not work_order:
        return None
    
    current_status = work_order.status or "created"
    
    if not is_valid_work_order_transition(current_status, new_status):
        raise ValueError(f"Invalid status transition from '{current_status}' to '{new_status}'")
    
    query = """
        UPDATE work_orders SET status = :status, updated_at = NOW()
        WHERE id = :work_order_id AND deleted_at IS NULL
        RETURNING id
    """
    row = await execute_returning(query, {"work_order_id": work_order_id, "status": new_status})
    if not row:
        return None
    return await get_work_order(work_order_id)


async def generate_work_order_from_job(job_id: int, **kwargs) -> WorkOrder:
    """Auto-generate work order from job with all required data."""
    from services import jobs_service, homeowners_service, installers_service
    
    # Get job data
    job = await jobs_service.get_job(job_id)
    if not job:
        raise ValueError(f"Job #{job_id} not found")
    
    # Get homeowner info
    homeowner_info = {}
    if job.homeowner_id:
        homeowner = await homeowners_service.get_homeowner(job.homeowner_id)
        if homeowner:
            homeowner_info = {
                "id": homeowner.id,
                "name": f"{homeowner.first_name} {homeowner.last_name}",
                "email": homeowner.email,
                "phone": homeowner.phone,
                "address": {
                    "street": homeowner.address_street,
                    "city": homeowner.address_city,
                    "state": homeowner.address_state,
                    "zip": homeowner.address_zip,
                }
            }
    
    # Get installer info
    installer_id = kwargs.get("installer_id") or job.installer_id
    installer_info = {}
    if installer_id:
        installer = await installers_service.get_installer(installer_id)
        if installer:
            installer_info = {
                "id": installer.id,
                "name": f"{installer.first_name} {installer.last_name}",
                "email": installer.email,
                "phone": installer.phone,
                "skills": installer.skills or [],
                "tier": installer.tier,
            }
    
    # Extract materials and labor from job project_details
    project_details = job.project_details or {}
    materials_snapshot = project_details.get("materials", [])
    labor_instructions = project_details.get("labor", [])
    
    # Create timeline
    scheduled_date = kwargs.get("scheduled_date")
    timeline = {
        "estimated_start": scheduled_date.isoformat() if scheduled_date else None,
        "estimated_completion": None,
        "actual_start": None,
        "actual_completion": None,
    }
    
    # Create work order
    work_order_data = WorkOrderCreate(
        tenant_id=job.tenant_id,
        job_id=job_id,
        installer_id=installer_id,
        status="created",
        scheduled_date=kwargs.get("scheduled_date"),
        scheduled_time_start=kwargs.get("scheduled_time_start"),
        scheduled_time_end=kwargs.get("scheduled_time_end"),
        homeowner_info=homeowner_info,
        installer_info=installer_info,
        project_details=project_details,
        materials_snapshot=materials_snapshot,
        labor_instructions=labor_instructions,
        timeline=timeline,
        special_instructions=kwargs.get("special_instructions"),
        internal_notes=kwargs.get("internal_notes"),
    )
    
    return await create_work_order(work_order_data)
