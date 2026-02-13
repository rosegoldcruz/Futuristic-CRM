from typing import List, Optional, Dict, Any
import json
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.installers import Installer, InstallerCreate, InstallerUpdate


def _parse_array_field(value: Any) -> Optional[List[str]]:
    """Parse PostgreSQL array or JSON to List[str]."""
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        # Handle PostgreSQL array format {a,b,c}
        if value.startswith('{') and value.endswith('}'):
            return value[1:-1].split(',') if value != '{}' else []
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else None
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _row_to_installer(row: Dict[str, Any]) -> Installer:
    """Convert DB row to Installer model"""
    return Installer(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        first_name=row["first_name"],
        last_name=row["last_name"],
        email=row.get("email"),
        phone=row["phone"],
        phone_secondary=row.get("phone_secondary"),
        company_name=row.get("company_name"),
        status=row.get("status"),
        tier=row.get("tier"),
        skills=_parse_array_field(row.get("skills")),
        service_area_zips=_parse_array_field(row.get("service_area_zips")),
        service_radius_miles=row.get("service_radius_miles"),
        max_jobs_per_day=row.get("max_jobs_per_day"),
        max_jobs_per_week=row.get("max_jobs_per_week"),
        base_hourly_rate=float(row["base_hourly_rate"]) if row.get("base_hourly_rate") else None,
        base_job_rate=float(row["base_job_rate"]) if row.get("base_job_rate") else None,
        has_insurance=row.get("has_insurance", False),
        has_vehicle=row.get("has_vehicle", True),
        has_tools=row.get("has_tools", True),
        jobs_completed=row.get("jobs_completed", 0),
        jobs_cancelled=row.get("jobs_cancelled", 0),
        rating_average=float(row["rating_average"]) if row.get("rating_average") else None,
        rating_count=row.get("rating_count", 0),
        total_earnings=float(row["total_earnings"]) if row.get("total_earnings") else None,
        pending_payout=float(row["pending_payout"]) if row.get("pending_payout") else None,
        internal_notes=row.get("internal_notes"),
        metadata=row.get("metadata"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_installers(
    tenant_id: Optional[int] = None,
    status: Optional[str] = None,
    tier: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Installer]:
    query = """
        SELECT 
            id, tenant_id, first_name, last_name,
            email, phone, phone_secondary, company_name,
            status, tier, skills, service_area_zips,
            service_radius_miles, max_jobs_per_day, max_jobs_per_week,
            base_hourly_rate, base_job_rate,
            has_insurance, has_vehicle, has_tools,
            jobs_completed, jobs_cancelled, rating_average, rating_count,
            total_earnings, pending_payout, internal_notes, metadata,
            created_at, updated_at, deleted_at
        FROM installers
        WHERE deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if status:
        query += " AND status = :status"
        params["status"] = status

    if tier:
        query += " AND tier = :tier"
        params["tier"] = tier

    if search:
        query += """ AND (
            first_name ILIKE :search OR 
            last_name ILIKE :search OR 
            email ILIKE :search OR 
            phone ILIKE :search OR
            company_name ILIKE :search
        )"""
        params["search"] = f"%{search}%"

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_installer(r) for r in rows]


async def get_installer(installer_id: int) -> Optional[Installer]:
    query = """
        SELECT 
            id, tenant_id, first_name, last_name,
            email, phone, phone_secondary, company_name,
            status, tier, skills, service_area_zips,
            service_radius_miles, max_jobs_per_day, max_jobs_per_week,
            base_hourly_rate, base_job_rate,
            has_insurance, has_vehicle, has_tools,
            jobs_completed, jobs_cancelled, rating_average, rating_count,
            total_earnings, pending_payout, internal_notes, metadata,
            created_at, updated_at, deleted_at
        FROM installers
        WHERE id = :installer_id AND deleted_at IS NULL
    """
    row = await fetch_one(query, {"installer_id": installer_id})
    return _row_to_installer(row) if row else None


async def create_installer(data: InstallerCreate) -> Installer:
    query = """
        INSERT INTO installers (
            tenant_id, first_name, last_name, email, phone, phone_secondary,
            company_name, status, tier, skills, service_area_zips,
            service_radius_miles, max_jobs_per_day, max_jobs_per_week,
            base_hourly_rate, base_job_rate,
            has_insurance, has_vehicle, has_tools, internal_notes, metadata
        ) VALUES (
            :tenant_id, :first_name, :last_name, :email, :phone, :phone_secondary,
            :company_name, :status, :tier, :skills, :service_area_zips,
            :service_radius_miles, :max_jobs_per_day, :max_jobs_per_week,
            :base_hourly_rate, :base_job_rate,
            :has_insurance, :has_vehicle, :has_tools, :internal_notes, CAST(:metadata AS jsonb)
        )
        RETURNING id, tenant_id, first_name, last_name,
            email, phone, phone_secondary, company_name,
            status, tier, skills, service_area_zips,
            service_radius_miles, max_jobs_per_day, max_jobs_per_week,
            base_hourly_rate, base_job_rate,
            has_insurance, has_vehicle, has_tools,
            jobs_completed, jobs_cancelled, rating_average, rating_count,
            total_earnings, pending_payout, internal_notes, metadata,
            created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "email": data.email,
        "phone": data.phone,
        "phone_secondary": data.phone_secondary,
        "company_name": data.company_name,
        "status": data.status or "pending",
        "tier": data.tier or "apprentice",
        "skills": data.skills,
        "service_area_zips": data.service_area_zips,
        "service_radius_miles": data.service_radius_miles,
        "max_jobs_per_day": data.max_jobs_per_day,
        "max_jobs_per_week": data.max_jobs_per_week,
        "base_hourly_rate": data.base_hourly_rate,
        "base_job_rate": data.base_job_rate,
        "has_insurance": data.has_insurance,
        "has_vehicle": data.has_vehicle,
        "has_tools": data.has_tools,
        "internal_notes": data.internal_notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    return _row_to_installer(row)  # type: ignore


async def update_installer(installer_id: int, data: InstallerUpdate) -> Optional[Installer]:
    updates = []
    params: Dict[str, Any] = {"installer_id": installer_id}
    
    payload = data.model_dump(exclude_unset=True)
    for field_name, value in payload.items():
        if field_name == "metadata":
            updates.append("metadata = CAST(:metadata AS jsonb)")
            params["metadata"] = json.dumps(value) if value else "{}"
        else:
            updates.append(f"{field_name} = :{field_name}")
            params[field_name] = value

    if not updates:
        return await get_installer(installer_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE installers SET {set_clause}
        WHERE id = :installer_id AND deleted_at IS NULL
        RETURNING id, tenant_id, first_name, last_name,
            email, phone, phone_secondary, company_name,
            status, tier, skills, service_area_zips,
            service_radius_miles, max_jobs_per_day, max_jobs_per_week,
            base_hourly_rate, base_job_rate,
            has_insurance, has_vehicle, has_tools,
            jobs_completed, jobs_cancelled, rating_average, rating_count,
            total_earnings, pending_payout, internal_notes, metadata,
            created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, params)
    return _row_to_installer(row) if row else None


async def delete_installer(installer_id: int) -> bool:
    query = "UPDATE installers SET deleted_at = NOW(), status = 'terminated' WHERE id = :installer_id AND deleted_at IS NULL"
    count = await execute(query, {"installer_id": installer_id})
    return count > 0


async def get_installer_jobs(
    installer_id: int,
    status: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Get all jobs assigned to an installer."""
    from models.jobs import Job
    
    query = """
        SELECT 
            id, tenant_id, quote_id, lead_id, homeowner_id, installer_id,
            customer_name, status, scheduled_date, scheduled_time_start, scheduled_time_end,
            installer_name, project_details, internal_notes, metadata,
            created_at, updated_at, deleted_at
        FROM jobs
        WHERE installer_id = :installer_id AND deleted_at IS NULL
    """
    params: Dict[str, Any] = {"installer_id": installer_id}
    
    if status:
        query += " AND status = :status"
        params["status"] = status
    
    query += " ORDER BY scheduled_date DESC NULLS LAST, created_at DESC LIMIT :limit"
    params["limit"] = limit
    
    rows = await fetch_all(query, params)
    
    # Convert rows to Job models
    jobs = []
    for row in rows:
        jobs.append(Job(
            id=row["id"],
            tenant_id=row.get("tenant_id"),
            quote_id=row.get("quote_id"),
            lead_id=row.get("lead_id"),
            homeowner_id=row.get("homeowner_id"),
            installer_id=row.get("installer_id"),
            customer_name=row["customer_name"],
            status=row.get("status"),
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
        ))
    
    return jobs


async def check_availability(installer_id: int) -> Dict[str, Any]:
    """Check if an installer is available for new jobs."""
    from datetime import date, timedelta
    
    installer = await get_installer(installer_id)
    if not installer:
        return {
            "installer_id": installer_id,
            "available": False,
            "current_jobs_today": 0,
            "current_jobs_week": 0,
            "max_jobs_per_day": 0,
            "max_jobs_per_week": 0,
            "message": "Installer not found",
        }
    
    if installer.status != "active":
        return {
            "installer_id": installer_id,
            "available": False,
            "current_jobs_today": 0,
            "current_jobs_week": 0,
            "max_jobs_per_day": installer.max_jobs_per_day or 1,
            "max_jobs_per_week": installer.max_jobs_per_week or 5,
            "message": f"Installer is not active (status: {installer.status})",
        }
    
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    
    # Count jobs today
    today_query = """
        SELECT COUNT(*) as count FROM jobs
        WHERE installer_id = :installer_id 
        AND scheduled_date = :today
        AND status NOT IN ('cancelled', 'completed')
        AND deleted_at IS NULL
    """
    today_result = await fetch_one(today_query, {"installer_id": installer_id, "today": today})
    jobs_today = today_result["count"] if today_result else 0
    
    # Count jobs this week
    week_query = """
        SELECT COUNT(*) as count FROM jobs
        WHERE installer_id = :installer_id 
        AND scheduled_date >= :week_start AND scheduled_date <= :week_end
        AND status NOT IN ('cancelled', 'completed')
        AND deleted_at IS NULL
    """
    week_result = await fetch_one(week_query, {
        "installer_id": installer_id,
        "week_start": week_start,
        "week_end": week_end,
    })
    jobs_week = week_result["count"] if week_result else 0
    
    max_day = installer.max_jobs_per_day or 1
    max_week = installer.max_jobs_per_week or 5
    
    available = jobs_today < max_day and jobs_week < max_week
    
    if not available:
        if jobs_today >= max_day:
            message = f"At daily capacity ({jobs_today}/{max_day} jobs today)"
        else:
            message = f"At weekly capacity ({jobs_week}/{max_week} jobs this week)"
    else:
        message = f"Available ({jobs_today}/{max_day} today, {jobs_week}/{max_week} this week)"
    
    return {
        "installer_id": installer_id,
        "available": available,
        "current_jobs_today": jobs_today,
        "current_jobs_week": jobs_week,
        "max_jobs_per_day": max_day,
        "max_jobs_per_week": max_week,
        "message": message,
    }
