"""
Installer workflow models for tasks, photos, time tracking, and signatures
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel


# Task status constants
TASK_STATUSES = ["pending", "in_progress", "completed", "skipped"]

# Time entry types
TIME_ENTRY_TYPES = ["work", "travel", "setup", "break", "teardown"]

# Photo types
PHOTO_TYPES = ["before", "during", "after", "issue", "completion", "other"]

# Signature types
SIGNATURE_TYPES = ["installer", "homeowner", "supervisor"]


class WorkOrderTaskBase(BaseModel):
    """Base work order task fields"""
    task_name: str
    description: Optional[str] = None
    category: Optional[str] = None
    is_required: bool = True
    checklist_items: Optional[List[dict[str, Any]]] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class WorkOrderTaskCreate(WorkOrderTaskBase):
    """Create a work order task"""
    work_order_id: int
    status: str = "pending"


class WorkOrderTaskUpdate(BaseModel):
    """Update a work order task"""
    status: Optional[str] = None
    completed_by: Optional[int] = None
    checklist_items: Optional[List[dict[str, Any]]] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class WorkOrderTask(WorkOrderTaskBase):
    """Work order task response model"""
    id: int
    work_order_id: int
    status: str = "pending"
    completed_by: Optional[int] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkOrderPhotoBase(BaseModel):
    """Base work order photo fields"""
    photo_type: str = "other"
    file_url: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    caption: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class WorkOrderPhotoCreate(WorkOrderPhotoBase):
    """Create a work order photo"""
    work_order_id: int
    task_id: Optional[int] = None
    uploaded_by: Optional[int] = None


class WorkOrderPhoto(WorkOrderPhotoBase):
    """Work order photo response model"""
    id: int
    work_order_id: int
    task_id: Optional[int] = None
    uploaded_by: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkOrderTimeEntryBase(BaseModel):
    """Base time entry fields"""
    entry_type: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class WorkOrderTimeEntryCreate(WorkOrderTimeEntryBase):
    """Create a time entry"""
    work_order_id: int
    installer_id: int


class WorkOrderTimeEntryUpdate(BaseModel):
    """Update a time entry"""
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class WorkOrderTimeEntry(WorkOrderTimeEntryBase):
    """Time entry response model"""
    id: int
    work_order_id: int
    installer_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkOrderSignatureBase(BaseModel):
    """Base signature fields"""
    signature_type: str
    signature_data: str  # Base64 encoded signature image
    signer_name: str
    signer_email: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class WorkOrderSignatureCreate(WorkOrderSignatureBase):
    """Create a signature"""
    work_order_id: int


class WorkOrderSignature(WorkOrderSignatureBase):
    """Signature response model"""
    id: int
    work_order_id: int
    signed_at: datetime
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InstallerWorkOrderStatus(BaseModel):
    """Request to update work order status"""
    status: str
    notes: Optional[str] = None


class TimeEntryStart(BaseModel):
    """Request to start a time entry"""
    entry_type: str
    notes: Optional[str] = None


class TimeEntryStop(BaseModel):
    """Request to stop a time entry"""
    notes: Optional[str] = None


class TaskCompletion(BaseModel):
    """Request to mark task as complete"""
    completed_by: int
    notes: Optional[str] = None
    checklist_items: Optional[List[dict[str, Any]]] = None


class WorkOrderProgress(BaseModel):
    """Work order progress summary"""
    work_order_id: int
    total_tasks: int = 0
    completed_tasks: int = 0
    pending_tasks: int = 0
    progress_percentage: float = 0.0
    total_time_minutes: int = 0
    photos_count: int = 0
    signatures_count: int = 0
    status: str = "assigned"
