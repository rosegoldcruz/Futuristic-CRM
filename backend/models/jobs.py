"""
Job models - synced with Supabase schema
"""
from datetime import datetime, date, time
from typing import Optional, List, Any

from pydantic import BaseModel, Field


# Valid job statuses matching the SQL enum
JOB_STATUSES = [
    "pending",
    "ordered",
    "in_production",
    "shipped",
    "delivered",
    "scheduled",
    "in_progress",
    "completed",
    "on_hold",
    "cancelled",
    "issue",
]

# Status transition graph: from_status -> allowed_to_statuses
STATUS_TRANSITIONS = {
    "pending": ["ordered", "scheduled", "on_hold", "cancelled"],
    "ordered": ["in_production", "on_hold", "cancelled", "issue"],
    "in_production": ["shipped", "on_hold", "cancelled", "issue"],
    "shipped": ["delivered", "on_hold", "issue"],
    "delivered": ["scheduled", "on_hold", "issue"],
    "scheduled": ["in_progress", "on_hold", "cancelled", "issue"],
    "in_progress": ["completed", "on_hold", "issue"],
    "completed": [],  # Terminal state
    "on_hold": ["pending", "ordered", "in_production", "shipped", "delivered", "scheduled", "in_progress", "cancelled"],
    "cancelled": [],  # Terminal state
    "issue": ["pending", "ordered", "in_production", "shipped", "delivered", "scheduled", "in_progress", "on_hold", "cancelled"],
}


def get_allowed_transitions(current_status: str) -> List[str]:
    """Get list of allowed next statuses from current status."""
    return STATUS_TRANSITIONS.get(current_status, [])


def is_valid_transition(from_status: str, to_status: str) -> bool:
    """Check if a status transition is allowed."""
    if from_status == to_status:
        return True  # No change is always valid
    allowed = STATUS_TRANSITIONS.get(from_status, [])
    return to_status in allowed


class ProjectDetails(BaseModel):
    """Project details JSONB structure"""
    description: Optional[str] = None
    estimated_cabinets: Optional[int] = None
    estimated_drawers: Optional[int] = None
    style: Optional[str] = None
    materials: Optional[List[dict]] = None
    estimated_total: Optional[float] = None
    estimated_labor_hours: Optional[int] = None


class JobBase(BaseModel):
    """Base job fields for create/update"""
    customer_name: str = Field(..., max_length=255)
    status: Optional[str] = Field(default="pending", max_length=50)
    quote_id: Optional[int] = None
    lead_id: Optional[int] = None
    homeowner_id: Optional[int] = None
    installer_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time_start: Optional[time] = None
    scheduled_time_end: Optional[time] = None
    installer_name: Optional[str] = None
    project_details: Optional[dict[str, Any]] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class JobCreate(JobBase):
    """Create a new job"""
    tenant_id: Optional[int] = None


class JobUpdate(BaseModel):
    """Update an existing job"""
    tenant_id: Optional[int] = None
    customer_name: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, max_length=50)
    quote_id: Optional[int] = None
    lead_id: Optional[int] = None
    homeowner_id: Optional[int] = None
    installer_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time_start: Optional[time] = None
    scheduled_time_end: Optional[time] = None
    installer_name: Optional[str] = None
    project_details: Optional[dict[str, Any]] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Job(BaseModel):
    """Job response model - matches DB schema exactly"""
    id: int
    tenant_id: Optional[int] = None
    quote_id: Optional[int] = None
    lead_id: Optional[int] = None
    homeowner_id: Optional[int] = None
    installer_id: Optional[int] = None
    customer_name: str
    status: Optional[str] = "pending"
    scheduled_date: Optional[date] = None
    scheduled_time_start: Optional[time] = None
    scheduled_time_end: Optional[time] = None
    installer_name: Optional[str] = None
    project_details: Optional[dict[str, Any]] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssignInstallerRequest(BaseModel):
    installer_id: int


class UpdateJobStatusRequest(BaseModel):
    status: str = Field(..., description="New job status")
