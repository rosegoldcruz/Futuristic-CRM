"""
Work Order models - execution pipeline for approved jobs
"""
from typing import Optional, Any, List
from pydantic import BaseModel, Field
from datetime import datetime, date


# Work order status constants
WORK_ORDER_STATUSES = ["created", "sent", "accepted", "in_progress", "completed", "cancelled"]

# Valid status transitions
WORK_ORDER_TRANSITIONS = {
    "created": ["sent", "cancelled"],
    "sent": ["accepted", "cancelled"],
    "accepted": ["in_progress", "cancelled"],
    "in_progress": ["completed", "cancelled"],
    "completed": [],  # Terminal state
    "cancelled": [],  # Terminal state
}


def is_valid_work_order_transition(current: str, new: str) -> bool:
    """Check if a work order status transition is valid."""
    if current == new:
        return True
    return new in WORK_ORDER_TRANSITIONS.get(current, [])


def get_allowed_work_order_transitions(current: str) -> List[str]:
    """Get list of allowed next statuses for a work order."""
    return WORK_ORDER_TRANSITIONS.get(current, [])


class WorkOrderMaterial(BaseModel):
    """Material item in work order snapshot"""
    description: str
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    sku: Optional[str] = None
    style: Optional[str] = None
    color: Optional[str] = None
    finish: Optional[str] = None
    quantity: float = 1
    unit: Optional[str] = "each"
    notes: Optional[str] = None


class WorkOrderLabor(BaseModel):
    """Labor instruction in work order"""
    description: str
    hours: float = 0
    installer_id: Optional[int] = None
    installer_name: Optional[str] = None
    notes: Optional[str] = None


class WorkOrderTimeline(BaseModel):
    """Timeline information for work order"""
    estimated_start: Optional[date] = None
    estimated_completion: Optional[date] = None
    actual_start: Optional[date] = None
    actual_completion: Optional[date] = None


class WorkOrderBase(BaseModel):
    """Base work order fields"""
    job_id: int
    installer_id: Optional[int] = None
    status: Optional[str] = "created"
    scheduled_date: Optional[date] = None
    scheduled_time_start: Optional[str] = None
    scheduled_time_end: Optional[str] = None
    # Snapshots stored as JSONB
    homeowner_info: Optional[dict[str, Any]] = None
    installer_info: Optional[dict[str, Any]] = None
    project_details: Optional[dict[str, Any]] = None
    materials_snapshot: Optional[List[dict]] = None
    labor_instructions: Optional[List[dict]] = None
    timeline: Optional[dict[str, Any]] = None
    special_instructions: Optional[str] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class WorkOrderCreate(WorkOrderBase):
    """Create a new work order"""
    tenant_id: Optional[int] = None


class WorkOrderUpdate(BaseModel):
    """Update an existing work order"""
    installer_id: Optional[int] = None
    status: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_time_start: Optional[str] = None
    scheduled_time_end: Optional[str] = None
    homeowner_info: Optional[dict[str, Any]] = None
    installer_info: Optional[dict[str, Any]] = None
    project_details: Optional[dict[str, Any]] = None
    materials_snapshot: Optional[List[dict]] = None
    labor_instructions: Optional[List[dict]] = None
    timeline: Optional[dict[str, Any]] = None
    special_instructions: Optional[str] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class WorkOrder(BaseModel):
    """Work order response model"""
    id: int
    tenant_id: Optional[int] = None
    job_id: int
    installer_id: Optional[int] = None
    # Joined fields
    customer_name: Optional[str] = None
    installer_name: Optional[str] = None
    job_status: Optional[str] = None
    # Core fields
    status: Optional[str] = "created"
    scheduled_date: Optional[date] = None
    scheduled_time_start: Optional[str] = None
    scheduled_time_end: Optional[str] = None
    # JSONB fields
    homeowner_info: Optional[dict[str, Any]] = None
    installer_info: Optional[dict[str, Any]] = None
    project_details: Optional[dict[str, Any]] = None
    materials_snapshot: Optional[List[dict]] = None
    labor_instructions: Optional[List[dict]] = None
    timeline: Optional[dict[str, Any]] = None
    special_instructions: Optional[str] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UpdateWorkOrderStatusRequest(BaseModel):
    """Request to update work order status"""
    status: str


class GenerateWorkOrderRequest(BaseModel):
    """Request to generate work order from job"""
    job_id: int
    installer_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time_start: Optional[str] = None
    scheduled_time_end: Optional[str] = None
    special_instructions: Optional[str] = None
