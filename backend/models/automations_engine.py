"""
Automation engine models - triggers, actions, conditions, scheduler
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# Trigger types
TRIGGER_TYPES = [
    "schedule",  # Cron or interval-based
    "event",  # Database event (lead_created, quote_approved, etc.)
    "webhook",  # External webhook
    "manual",  # Manual trigger
]

# Event types
EVENT_TYPES = [
    "lead_created",
    "quote_created",
    "quote_approved",
    "job_created",
    "job_completed",
    "payment_received",
    "document_signed",
]

# Action types
ACTION_TYPES = [
    "send_email",
    "send_sms",
    "send_notification",
    "webhook",
    "update_record",
    "create_record",
    "ai_generate",
    "ai_classify",
    "delay",
]

# Condition operators
CONDITION_OPERATORS = ["equals", "not_equals", "contains", "greater_than", "less_than", "in", "not_in"]

# Automation status
AUTOMATION_STATUSES = ["active", "paused", "disabled"]

# Run status
RUN_STATUSES = ["pending", "running", "success", "failed", "cancelled"]


class AutomationCondition(BaseModel):
    """Automation trigger condition"""
    field: str
    operator: str
    value: Any


class AutomationAction(BaseModel):
    """Automation action configuration"""
    type: str
    config: Dict[str, Any]
    retry_on_failure: bool = True
    max_retries: int = 3


class AutomationBase(BaseModel):
    """Base automation fields"""
    automation_name: str
    automation_type: str  # "workflow", "notification", "data_sync", etc.
    trigger_event: str
    trigger_conditions: Optional[List[AutomationCondition]] = None
    actions: List[AutomationAction]
    enabled: bool = True
    schedule: Optional[str] = None  # Cron expression or interval
    metadata: Optional[Dict[str, Any]] = None


class AutomationCreate(AutomationBase):
    """Create an automation"""
    tenant_id: Optional[int] = None


class AutomationUpdate(BaseModel):
    """Update an automation"""
    automation_name: Optional[str] = None
    trigger_conditions: Optional[List[AutomationCondition]] = None
    actions: Optional[List[AutomationAction]] = None
    enabled: Optional[bool] = None
    schedule: Optional[str] = None


class Automation(AutomationBase):
    """Automation response model"""
    id: int
    tenant_id: Optional[int] = None
    status: str = "active"
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    run_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AutomationRunBase(BaseModel):
    """Base automation run fields"""
    automation_id: int
    trigger_data: Optional[Dict[str, Any]] = None


class AutomationRunCreate(AutomationRunBase):
    """Create an automation run"""
    tenant_id: Optional[int] = None


class AutomationRun(AutomationRunBase):
    """Automation run response model"""
    id: int
    tenant_id: Optional[int] = None
    status: str = "pending"
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AutomationActionLog(BaseModel):
    """Automation action execution log"""
    id: int
    automation_run_id: int
    action_type: str
    action_config: Optional[Dict[str, Any]] = None
    status: str
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None

    class Config:
        from_attributes = True


class TriggerAutomationRequest(BaseModel):
    """Request to manually trigger an automation"""
    automation_id: int
    trigger_data: Optional[Dict[str, Any]] = None


class AutomationStats(BaseModel):
    """Automation execution statistics"""
    automation_id: int
    automation_name: str
    total_runs: int
    successful_runs: int
    failed_runs: int
    success_rate: float
    avg_duration_ms: Optional[float] = None
    last_run_at: Optional[datetime] = None
    last_status: Optional[str] = None
