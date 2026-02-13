"""
Jobs service - synced with Supabase schema
"""
from typing import List, Optional, Dict, Any
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.jobs import Job, JobCreate, JobUpdate, JOB_STATUSES, is_valid_transition


def _row_to_job(row: Dict[str, Any]) -> Job:
    """Convert DB row to Job model"""
    return Job(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        quote_id=row.get("quote_id"),
        lead_id=row.get("lead_id"),
        homeowner_id=row.get("homeowner_id"),
        installer_id=row.get("installer_id"),
        customer_name=row["customer_name"],
        status=row.get("status", "pending"),
        scheduled_date=row.get("scheduled_date"),
        scheduled_time_start=row.get("scheduled_time_start"),
        scheduled_time_end=row.get("scheduled_time_end"),
        installer_name=row.get("installer_name"),
        project_details=row.get("project_details"),
        internal_notes=row.get("internal_notes"),
        metadata=row.get("metadata"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_jobs(
    search: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Job]:
    query = """
        SELECT id, tenant_id, quote_id, lead_id, homeowner_id, installer_id,
               customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
               installer_name, project_details, internal_notes, metadata,
               created_at, updated_at, deleted_at
        FROM jobs
        WHERE deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if search:
        query += " AND (customer_name ILIKE :search OR internal_notes ILIKE :search)"
        params["search"] = f"%{search}%"

    if status:
        query += " AND status = :status"
        params["status"] = status

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_job(r) for r in rows]


async def get_job(job_id: int) -> Optional[Job]:
    query = """
        SELECT id, tenant_id, quote_id, lead_id, homeowner_id, installer_id,
               customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
               installer_name, project_details, internal_notes, metadata,
               created_at, updated_at, deleted_at
        FROM jobs
        WHERE id = :job_id AND deleted_at IS NULL
    """
    row = await fetch_one(query, {"job_id": job_id})
    return _row_to_job(row) if row else None


async def create_job(data: JobCreate) -> Job:
    import json
    query = """
        INSERT INTO jobs (
            tenant_id, quote_id, lead_id, homeowner_id, installer_id,
            customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
            installer_name, project_details, internal_notes, metadata
        )
        VALUES (:tenant_id, :quote_id, :lead_id, :homeowner_id, :installer_id,
                :customer_name, :status, :scheduled_date, :scheduled_time_start, :scheduled_time_end,
                :installer_name, CAST(:project_details AS jsonb), :internal_notes, CAST(:metadata AS jsonb))
        RETURNING id, tenant_id, quote_id, lead_id, homeowner_id, installer_id,
               customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
               installer_name, project_details, internal_notes, metadata,
               created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "quote_id": data.quote_id,
        "lead_id": data.lead_id,
        "homeowner_id": data.homeowner_id,
        "installer_id": data.installer_id,
        "customer_name": data.customer_name,
        "status": data.status or "pending",
        "scheduled_date": data.scheduled_date,
        "scheduled_time_start": data.scheduled_time_start,
        "scheduled_time_end": data.scheduled_time_end,
        "installer_name": data.installer_name,
        "project_details": json.dumps(data.project_details) if data.project_details else "{}",
        "internal_notes": data.internal_notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    return _row_to_job(row)  # type: ignore


async def update_job(job_id: int, data: JobUpdate) -> Optional[Job]:
    import json
    updates = []
    params: Dict[str, Any] = {"job_id": job_id}
    
    if data.customer_name is not None:
        updates.append("customer_name = :customer_name")
        params["customer_name"] = data.customer_name
    if data.status is not None:
        updates.append("status = :status")
        params["status"] = data.status
    if data.quote_id is not None:
        updates.append("quote_id = :quote_id")
        params["quote_id"] = data.quote_id
    if data.lead_id is not None:
        updates.append("lead_id = :lead_id")
        params["lead_id"] = data.lead_id
    if data.homeowner_id is not None:
        updates.append("homeowner_id = :homeowner_id")
        params["homeowner_id"] = data.homeowner_id
    if data.installer_id is not None:
        updates.append("installer_id = :installer_id")
        params["installer_id"] = data.installer_id
    if data.scheduled_date is not None:
        updates.append("scheduled_date = :scheduled_date")
        params["scheduled_date"] = data.scheduled_date
    if data.scheduled_time_start is not None:
        updates.append("scheduled_time_start = :scheduled_time_start")
        params["scheduled_time_start"] = data.scheduled_time_start
    if data.scheduled_time_end is not None:
        updates.append("scheduled_time_end = :scheduled_time_end")
        params["scheduled_time_end"] = data.scheduled_time_end
    if data.installer_name is not None:
        updates.append("installer_name = :installer_name")
        params["installer_name"] = data.installer_name
    if data.project_details is not None:
        updates.append("project_details = CAST(:project_details AS jsonb)")
        params["project_details"] = json.dumps(data.project_details)
    if data.internal_notes is not None:
        updates.append("internal_notes = :internal_notes")
        params["internal_notes"] = data.internal_notes
    if data.metadata is not None:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(data.metadata)

    if not updates:
        return await get_job(job_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE jobs SET {set_clause}
        WHERE id = :job_id AND deleted_at IS NULL
        RETURNING id, tenant_id, quote_id, lead_id, homeowner_id, installer_id,
               customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
               installer_name, project_details, internal_notes, metadata,
               created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, params)
    return _row_to_job(row) if row else None


async def delete_job(job_id: int) -> bool:
    # Soft delete
    query = "UPDATE jobs SET deleted_at = NOW() WHERE id = :job_id AND deleted_at IS NULL"
    count = await execute(query, {"job_id": job_id})
    return count > 0


async def assign_installer(job_id: int, installer_id: int) -> Optional[Job]:
    """Assign an installer to a job."""
    # Verify installer exists
    installer = await fetch_one(
        "SELECT id, first_name || ' ' || last_name as full_name FROM installers WHERE id = :id AND deleted_at IS NULL",
        {"id": installer_id}
    )
    if not installer:
        return None
    
    installer_name = installer.get("full_name", "")
    
    query = """
        UPDATE jobs 
        SET installer_id = :installer_id, installer_name = :installer_name, updated_at = NOW()
        WHERE id = :job_id AND deleted_at IS NULL
        RETURNING id, tenant_id, quote_id, lead_id, homeowner_id, installer_id,
               customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
               installer_name, project_details, internal_notes, metadata,
               created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, {
        "job_id": job_id,
        "installer_id": installer_id,
        "installer_name": installer_name,
    })
    return _row_to_job(row) if row else None


async def update_job_materials(job_id: int, materials: List[Dict[str, Any]]) -> Optional[Job]:
    """Update job materials selection in project_details.materials JSONB."""
    import json
    
    job = await get_job(job_id)
    if not job:
        return None
    
    # Merge materials into project_details
    project_details = job.project_details or {}
    project_details["materials"] = materials
    
    query = """
        UPDATE jobs SET project_details = CAST(:project_details AS jsonb), updated_at = NOW()
        WHERE id = :job_id AND deleted_at IS NULL
        RETURNING id, tenant_id, quote_id, lead_id, homeowner_id, installer_id,
               customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
               installer_name, project_details, internal_notes, metadata,
               created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, {
        "job_id": job_id,
        "project_details": json.dumps(project_details),
    })
    return _row_to_job(row) if row else None


async def get_job_materials(job_id: int) -> List[Dict[str, Any]]:
    """Get materials selection from job project_details."""
    job = await get_job(job_id)
    if not job or not job.project_details:
        return []
    return job.project_details.get("materials", [])


async def update_job_status(job_id: int, new_status: str) -> Optional[Job]:
    """Update job status with transition validation."""
    if new_status not in JOB_STATUSES:
        raise ValueError(f"Invalid status: {new_status}. Must be one of: {', '.join(JOB_STATUSES)}")
    
    # Get current status
    job = await fetch_one("SELECT id, status FROM jobs WHERE id = :job_id", {"job_id": job_id})
    if not job:
        return None
    
    current_status = job["status"]
    
    # Validate transition
    if not is_valid_transition(current_status, new_status):
        raise ValueError(f"Invalid status transition from '{current_status}' to '{new_status}'")
    
    # Update status
    query = """
        UPDATE jobs SET status = :status, updated_at = NOW()
        WHERE id = :job_id AND deleted_at IS NULL
        RETURNING id, tenant_id, quote_id, lead_id, homeowner_id, installer_id,
               customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
               installer_name, project_details, internal_notes, metadata,
               created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, {"job_id": job_id, "status": new_status})
    return _row_to_job(row) if row else None
