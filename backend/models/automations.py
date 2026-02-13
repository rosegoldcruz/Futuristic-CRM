# Filepath: /srv/vulpine-os/backend/models/automations.py

"""
Automation models for workflows, triggers, and scheduled tasks
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel


# Automation type constants
AUTOMATION_TYPES = [
    "trigger",           # Event-triggered automation
    "scheduled",         # Cron/scheduled automation
    "webhook",           # Webhook-triggered automation
]

# Trigger event constants
TRIGGER_EVENTS = [
    "lead_created",
    "lead_qualified",
    "quote_created",
    "quote_approved",
    "quote_rejected",
    "job_created",
    "job_assigned",
    "job_completed",
    "installer_assigned",
    "payment_received",
    "payment_overdue",
]

# Automation status constants
AUTOMATION_STATUSES = ["active", "paused", "disabled", "error"]

# Run status constants
RUN_STATUSES = ["pending", "running", "completed", "failed", "cancelled"]

# Action type constants
ACTION_TYPES = [
    "send_email",
    "send_notification",
    "create_work_order",
    "update_status",
    "webhook_call",
    "create_task",
]


class AutomationBase(BaseModel):
    """Base automation fields"""
    automation_name: str
    automation_type: str
    trigger_event: str
    trigger_conditions: Optional[dict[str, Any]] = None
    actions: Optional[List[dict[str, Any]]] = None
    status: Optional[str] = "active"
    enabled: Optional[bool] = True
    schedule: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class AutomationCreate(AutomationBase):
    """Create a new automation"""
    tenant_id: Optional[int] = None


class AutomationUpdate(BaseModel):
    """Update an existing automation"""
    automation_name: Optional[str] = None
    status: Optional[str] = None
    enabled: Optional[bool] = None
    trigger_conditions: Optional[dict[str, Any]] = None
    actions: Optional[List[dict[str, Any]]] = None
    schedule: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Automation(BaseModel):
    """Automation response model"""
    id: int
    tenant_id: Optional[int] = None
    automation_name: str
    automation_type: str
    trigger_event: str
    trigger_conditions: Optional[dict[str, Any]] = None
    actions: Optional[List[dict[str, Any]]] = None
    status: str = "active"
    enabled: bool = True
    schedule: Optional[str] = None
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    run_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AutomationRunBase(BaseModel):
    """Base automation run fields"""
    automation_id: int
    status: str
    trigger_data: Optional[dict[str, Any]] = None
    result_data: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None


class AutomationRunCreate(AutomationRunBase):
    """Create a new automation run"""
    tenant_id: Optional[int] = None


class AutomationRun(BaseModel):
    """Automation run response model"""
    id: int
    automation_id: int
    tenant_id: Optional[int] = None
    status: str
    trigger_data: Optional[dict[str, Any]] = None
    result_data: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    """Base audit log fields"""
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    user_id: Optional[int] = None
    action: str
    details: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    """Create a new audit log"""
    tenant_id: Optional[int] = None


class AuditLog(BaseModel):
    """Audit log response model"""
    id: int
    tenant_id: Optional[int] = None
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    user_id: Optional[int] = None
    action: str
    details: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AutomationStats(BaseModel):
    """Automation statistics"""
    total_automations: int = 0
    active_automations: int = 0
    total_runs: int = 0
    successful_runs: int = 0
    failed_runs: int = 0
    success_rate: float = 0.0
