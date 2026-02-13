"""
AEON Workflow Service - Job Pipeline Management
================================================
Handles the full job lifecycle:
  Intake → Lead → Quote → Job → Assignment → Completion

Status Flow:
  1. intake_submitted - Initial homeowner submission
  2. scope_generated - AI scope created
  3. quote_pending - Awaiting quote approval
  4. quote_approved - Customer approved quote
  5. job_created - Work order created
  6. installer_assigned - Installer assigned
  7. scheduled - Installation date set
  8. in_progress - Work underway
  9. completed - Job finished
"""
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, date, time

from config.db import fetch_one, fetch_all, execute, execute_returning
from models.jobs import is_valid_transition, get_allowed_transitions


# ============================================
# WORKFLOW STATUS CONSTANTS
# ============================================

LEAD_STATUSES = ["new", "contacted", "qualified", "quoted", "converted", "lost"]
QUOTE_STATUSES = ["draft", "sent", "approved", "rejected", "expired"]
JOB_STATUSES = [
    "pending", "ordered", "in_production", "shipped", "delivered",
    "scheduled", "in_progress", "completed", "on_hold", "cancelled", "issue"
]


# ============================================
# INTAKE WORKFLOW
# ============================================

async def process_intake(
    first_name: str,
    last_name: str,
    email: Optional[str],
    phone: str,
    address_street: str,
    address_city: str,
    address_state: str,
    address_zip: str,
    project_description: str,
    cabinet_count: Optional[int] = None,
    drawer_count: Optional[int] = None,
    preferred_style: Optional[str] = None,
    budget_range: Optional[str] = None,
    tenant_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Process a new intake submission:
    1. Create or find homeowner
    2. Create lead
    3. Generate scope
    4. Create draft quote
    5. Return workflow state
    """
    from services.ai_scope_service import generate_scope
    
    # 1. Create homeowner
    homeowner_query = """
        INSERT INTO homeowners (
            tenant_id, first_name, last_name, email, phone,
            address_street, address_city, address_state, address_zip
        )
        VALUES (:tenant_id, :first_name, :last_name, :email, :phone,
            :address_street, :address_city, :address_state, :address_zip)
        RETURNING id, first_name, last_name, email, phone
    """
    homeowner = await execute_returning(homeowner_query, {
        "tenant_id": tenant_id,
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "address_street": address_street,
        "address_city": address_city,
        "address_state": address_state,
        "address_zip": address_zip,
    })
    
    if not homeowner:
        raise ValueError("Failed to create homeowner")
    
    homeowner_id = homeowner["id"]
    customer_name = f"{first_name} {last_name}"
    
    # 2. Create lead
    lead_query = """
        INSERT INTO leads (
            tenant_id, customer_name, customer_email, customer_phone, source, status
        )
        VALUES (:tenant_id, :customer_name, :customer_email, :customer_phone, 'intake', 'new')
        RETURNING id
    """
    lead = await execute_returning(lead_query, {
        "tenant_id": tenant_id,
        "customer_name": customer_name,
        "customer_email": email,
        "customer_phone": phone,
    })
    
    lead_id = lead["id"] if lead else None
    
    # 3. Generate AI scope
    scope_input = {
        "project_description": project_description,
        "cabinet_count": cabinet_count,
        "drawer_count": drawer_count,
        "preferred_style": preferred_style,
        "budget_range": budget_range,
    }
    
    try:
        scope = await generate_scope(scope_input)
    except Exception:
        # Fallback scope
        cab_count = cabinet_count or 10
        drw_count = drawer_count or 5
        scope = {
            "description": project_description,
            "estimated_cabinets": cab_count,
            "estimated_drawers": drw_count,
            "style": preferred_style or "shaker",
            "materials": [
                {"item": "Cabinet doors", "qty": cab_count, "unit_price": 150},
                {"item": "Drawer fronts", "qty": drw_count, "unit_price": 75},
                {"item": "Hardware", "qty": cab_count + drw_count, "unit_price": 15},
            ],
            "estimated_total": (cab_count * 150) + (drw_count * 75) + ((cab_count + drw_count) * 15),
            "estimated_labor_hours": cab_count * 2,
        }
    
    # 4. Create draft quote
    total_price = scope.get("estimated_total", 0)
    line_items = scope.get("materials", [])
    
    quote_query = """
        INSERT INTO quotes (
            tenant_id, lead_id, homeowner_id, status, total_price, line_items, internal_notes
        )
        VALUES (:tenant_id, :lead_id, :homeowner_id, 'draft', :total_price, 
                CAST(:line_items AS jsonb), :internal_notes)
        RETURNING id, status, total_price
    """
    quote = await execute_returning(quote_query, {
        "tenant_id": tenant_id,
        "lead_id": lead_id,
        "homeowner_id": homeowner_id,
        "total_price": total_price,
        "line_items": json.dumps(line_items),
        "internal_notes": f"Auto-generated from intake: {project_description[:100]}",
    })
    
    quote_id = quote["id"] if quote else None
    
    # 5. Update lead status to quoted
    if lead_id:
        await execute(
            "UPDATE leads SET status = 'quoted' WHERE id = :lead_id",
            {"lead_id": lead_id}
        )
    
    return {
        "homeowner_id": homeowner_id,
        "lead_id": lead_id,
        "quote_id": quote_id,
        "scope": scope,
        "total_price": total_price,
        "status": "quote_pending",
        "message": "Intake processed successfully. Quote ready for review.",
    }


# ============================================
# QUOTE WORKFLOW
# ============================================

async def approve_quote(quote_id: int) -> Dict[str, Any]:
    """
    Approve a quote and create a job:
    1. Update quote status to approved
    2. Create job from quote
    3. Update lead status to converted
    """
    # Get quote details
    quote = await fetch_one("""
        SELECT id, tenant_id, lead_id, homeowner_id, total_price, line_items
        FROM quotes WHERE id = :quote_id AND deleted_at IS NULL
    """, {"quote_id": quote_id})
    
    if not quote:
        raise ValueError("Quote not found")
    
    # Get homeowner name
    homeowner = await fetch_one("""
        SELECT first_name, last_name FROM homeowners WHERE id = :homeowner_id
    """, {"homeowner_id": quote["homeowner_id"]})
    
    customer_name = f"{homeowner['first_name']} {homeowner['last_name']}" if homeowner else "Unknown"
    
    # 1. Update quote status
    await execute(
        "UPDATE quotes SET status = 'approved', updated_at = NOW() WHERE id = :quote_id",
        {"quote_id": quote_id}
    )
    
    # 2. Create job
    project_details = {
        "quote_total": float(quote["total_price"]) if quote["total_price"] else 0,
        "line_items": quote["line_items"],
        "approved_at": datetime.utcnow().isoformat(),
    }
    
    job = await execute_returning("""
        INSERT INTO jobs (
            tenant_id, quote_id, lead_id, homeowner_id, customer_name, status, project_details
        )
        VALUES (:tenant_id, :quote_id, :lead_id, :homeowner_id, :customer_name, 'pending',
                CAST(:project_details AS jsonb))
        RETURNING id, status
    """, {
        "tenant_id": quote["tenant_id"],
        "quote_id": quote_id,
        "lead_id": quote["lead_id"],
        "homeowner_id": quote["homeowner_id"],
        "customer_name": customer_name,
        "project_details": json.dumps(project_details),
    })
    
    # 3. Update lead status
    if quote["lead_id"]:
        await execute(
            "UPDATE leads SET status = 'converted' WHERE id = :lead_id",
            {"lead_id": quote["lead_id"]}
        )
    
    return {
        "quote_id": quote_id,
        "job_id": job["id"] if job else None,
        "status": "job_created",
        "message": "Quote approved. Job created and ready for installer assignment.",
    }


async def reject_quote(quote_id: int, reason: Optional[str] = None) -> Dict[str, Any]:
    """Reject a quote and update lead status."""
    quote = await fetch_one("""
        SELECT lead_id FROM quotes WHERE id = :quote_id AND deleted_at IS NULL
    """, {"quote_id": quote_id})
    
    if not quote:
        raise ValueError("Quote not found")
    
    # Update quote
    await execute("""
        UPDATE quotes SET status = 'rejected', 
            internal_notes = COALESCE(internal_notes, '') || :reason,
            updated_at = NOW() 
        WHERE id = :quote_id
    """, {"quote_id": quote_id, "reason": f"\nRejected: {reason}" if reason else ""})
    
    # Update lead
    if quote["lead_id"]:
        await execute(
            "UPDATE leads SET status = 'lost' WHERE id = :lead_id",
            {"lead_id": quote["lead_id"]}
        )
    
    return {
        "quote_id": quote_id,
        "status": "quote_rejected",
        "message": "Quote rejected.",
    }


# ============================================
# JOB ASSIGNMENT WORKFLOW
# ============================================

async def assign_installer_to_job(
    job_id: int,
    installer_id: int,
    scheduled_date: Optional[date] = None,
    scheduled_time_start: Optional[time] = None,
    scheduled_time_end: Optional[time] = None,
) -> Dict[str, Any]:
    """
    Assign an installer to a job:
    1. Validate installer exists and is active
    2. Update job with installer info
    3. Set status to scheduled if date provided
    """
    # Validate installer
    installer = await fetch_one("""
        SELECT id, first_name, last_name, status 
        FROM installers WHERE id = :installer_id AND deleted_at IS NULL
    """, {"installer_id": installer_id})
    
    if not installer:
        raise ValueError("Installer not found")
    
    if installer["status"] != "active":
        raise ValueError(f"Installer is not active (status: {installer['status']})")
    
    installer_name = f"{installer['first_name']} {installer['last_name']}"
    
    # Determine new status
    new_status = "scheduled" if scheduled_date else "pending"
    
    # Update job
    job = await execute_returning("""
        UPDATE jobs SET 
            installer_id = :installer_id,
            installer_name = :installer_name,
            scheduled_date = :scheduled_date,
            scheduled_time_start = :scheduled_time_start,
            scheduled_time_end = :scheduled_time_end,
            status = :status,
            updated_at = NOW()
        WHERE id = :job_id AND deleted_at IS NULL
        RETURNING id, status, installer_name, scheduled_date
    """, {
        "job_id": job_id,
        "installer_id": installer_id,
        "installer_name": installer_name,
        "scheduled_date": scheduled_date,
        "scheduled_time_start": scheduled_time_start,
        "scheduled_time_end": scheduled_time_end,
        "status": new_status,
    })
    
    if not job:
        raise ValueError("Job not found")
    
    return {
        "job_id": job_id,
        "installer_id": installer_id,
        "installer_name": installer_name,
        "scheduled_date": str(scheduled_date) if scheduled_date else None,
        "status": new_status,
        "message": f"Installer {installer_name} assigned to job.",
    }


# ============================================
# JOB STATUS WORKFLOW
# ============================================

async def transition_job_status(job_id: int, new_status: str) -> Dict[str, Any]:
    """
    Transition a job to a new status with validation.
    """
    if new_status not in JOB_STATUSES:
        raise ValueError(f"Invalid status: {new_status}")
    
    # Get current job
    job = await fetch_one("""
        SELECT id, status, installer_id FROM jobs WHERE id = :job_id AND deleted_at IS NULL
    """, {"job_id": job_id})
    
    if not job:
        raise ValueError("Job not found")
    
    current_status = job["status"]
    
    # Validate transition
    if not is_valid_transition(current_status, new_status):
        allowed = get_allowed_transitions(current_status)
        raise ValueError(
            f"Cannot transition from '{current_status}' to '{new_status}'. "
            f"Allowed: {allowed}"
        )
    
    # Additional validation
    if new_status == "in_progress" and not job["installer_id"]:
        raise ValueError("Cannot start job without an assigned installer")
    
    # Update status
    updated = await execute_returning("""
        UPDATE jobs SET status = :status, updated_at = NOW()
        WHERE id = :job_id
        RETURNING id, status
    """, {"job_id": job_id, "status": new_status})
    
    # Handle completion
    if new_status == "completed":
        await _handle_job_completion(job_id)
    
    return {
        "job_id": job_id,
        "previous_status": current_status,
        "status": new_status,
        "message": f"Job status updated to '{new_status}'.",
    }


async def _handle_job_completion(job_id: int):
    """Handle post-completion tasks like updating installer stats."""
    job = await fetch_one("""
        SELECT installer_id FROM jobs WHERE id = :job_id
    """, {"job_id": job_id})
    
    if job and job["installer_id"]:
        # Increment installer's completed jobs count
        await execute("""
            UPDATE installers SET 
                jobs_completed = COALESCE(jobs_completed, 0) + 1,
                updated_at = NOW()
            WHERE id = :installer_id
        """, {"installer_id": job["installer_id"]})


# ============================================
# WORKFLOW STATE QUERIES
# ============================================

async def get_job_workflow_state(job_id: int) -> Dict[str, Any]:
    """Get complete workflow state for a job."""
    job = await fetch_one("""
        SELECT j.*, 
               h.first_name as ho_first, h.last_name as ho_last, h.phone as ho_phone,
               i.first_name as inst_first, i.last_name as inst_last,
               q.total_price as quote_total, q.status as quote_status
        FROM jobs j
        LEFT JOIN homeowners h ON j.homeowner_id = h.id
        LEFT JOIN installers i ON j.installer_id = i.id
        LEFT JOIN quotes q ON j.quote_id = q.id
        WHERE j.id = :job_id AND j.deleted_at IS NULL
    """, {"job_id": job_id})
    
    if not job:
        return None
    
    return {
        "job_id": job["id"],
        "status": job["status"],
        "customer_name": job["customer_name"],
        "homeowner": {
            "id": job["homeowner_id"],
            "name": f"{job['ho_first']} {job['ho_last']}" if job.get("ho_first") else None,
            "phone": job.get("ho_phone"),
        } if job.get("homeowner_id") else None,
        "installer": {
            "id": job["installer_id"],
            "name": f"{job['inst_first']} {job['inst_last']}" if job.get("inst_first") else None,
        } if job.get("installer_id") else None,
        "quote": {
            "id": job["quote_id"],
            "total": job.get("quote_total"),
            "status": job.get("quote_status"),
        } if job.get("quote_id") else None,
        "scheduled_date": str(job["scheduled_date"]) if job.get("scheduled_date") else None,
        "project_details": job.get("project_details"),
        "allowed_transitions": get_allowed_transitions(job["status"]),
    }


async def get_pipeline_summary(tenant_id: Optional[int] = None) -> Dict[str, Any]:
    """Get summary of jobs in each pipeline stage."""
    where_clause = "WHERE deleted_at IS NULL"
    params = {}
    
    if tenant_id:
        where_clause += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    # Count jobs by status
    rows = await fetch_all(f"""
        SELECT status, COUNT(*) as count
        FROM jobs {where_clause}
        GROUP BY status
    """, params)
    
    status_counts = {row["status"]: row["count"] for row in rows}
    
    # Count quotes by status
    quote_rows = await fetch_all(f"""
        SELECT status, COUNT(*) as count
        FROM quotes {where_clause}
        GROUP BY status
    """, params)
    
    quote_counts = {row["status"]: row["count"] for row in quote_rows}
    
    # Count leads by status
    lead_rows = await fetch_all(f"""
        SELECT status, COUNT(*) as count
        FROM leads {where_clause}
        GROUP BY status
    """, params)
    
    lead_counts = {row["status"]: row["count"] for row in lead_rows}
    
    return {
        "jobs": status_counts,
        "quotes": quote_counts,
        "leads": lead_counts,
        "pipeline": {
            "intake": lead_counts.get("new", 0),
            "quoting": quote_counts.get("draft", 0) + quote_counts.get("sent", 0),
            "pending_approval": quote_counts.get("sent", 0),
            "ready_to_schedule": status_counts.get("pending", 0),
            "scheduled": status_counts.get("scheduled", 0),
            "in_progress": status_counts.get("in_progress", 0),
            "completed": status_counts.get("completed", 0),
        }
    }
