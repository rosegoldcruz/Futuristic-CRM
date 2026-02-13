"""
Orchestrator models - event bus, workflows, system health
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# Event types
EVENT_TYPES = [
    "lead.created",
    "quote.created",
    "quote.approved",
    "quote.rejected",
    "job.created",
    "job.started",
    "job.completed",
    "work_order.created",
    "work_order.completed",
    "payment.created",
    "payment.completed",
    "document.signed",
    "notification.sent",
]

# Module names
MODULES = [
    "intake",
    "leads",
    "quotes",
    "jobs",
    "work_orders",
    "payments",
    "documents",
    "notifications",
    "marketing",
    "metrics",
    "automations",
]

# Event status
EVENT_STATUSES = ["pending", "processing", "completed", "failed", "retry"]

# Workflow status
WORKFLOW_STATUSES = ["running", "completed", "failed", "cancelled"]


class EventBusMessage(BaseModel):
    """Event bus message"""
    event_type: str
    event_name: str
    source_module: str
    target_modules: Optional[List[str]] = None
    payload: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


class EventBusRecord(BaseModel):
    """Event bus record"""
    id: int
    event_type: str
    event_name: str
    source_module: str
    target_modules: List[str]
    payload: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None
    status: str
    retry_count: int
    max_retries: int
    processed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeadLetterRecord(BaseModel):
    """Dead letter queue record"""
    id: int
    event_id: Optional[int] = None
    event_type: str
    event_name: str
    source_module: str
    payload: Dict[str, Any]
    error_message: Optional[str] = None
    error_stack: Optional[str] = None
    retry_count: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    failed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkflowExecution(BaseModel):
    """Workflow execution tracking"""
    id: int
    workflow_name: str
    trigger_event_id: Optional[int] = None
    status: str
    steps_completed: int
    total_steps: Optional[int] = None
    current_step: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None

    class Config:
        from_attributes = True


class SystemHealth(BaseModel):
    """System health check result"""
    module_name: str
    status: str  # "healthy", "degraded", "down"
    response_time_ms: Optional[int] = None
    last_check_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class SystemHeartbeat(BaseModel):
    """System-wide heartbeat"""
    status: str  # "healthy", "degraded", "critical"
    total_modules: int
    healthy_modules: int
    degraded_modules: int
    down_modules: int
    modules: List[SystemHealth]
    event_bus_pending: int
    dead_letter_count: int
    active_workflows: int
    timestamp: datetime


class WorkflowDefinition(BaseModel):
    """Workflow definition"""
    name: str
    trigger_event: str
    steps: List[Dict[str, Any]]
    retry_policy: Optional[Dict[str, Any]] = None


class CrossModuleValidation(BaseModel):
    """Cross-module validation result"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []


class OrchestrationResult(BaseModel):
    """Result of orchestration"""
    success: bool
    workflow_id: Optional[int] = None
    steps_completed: int
    errors: List[str] = []
    results: Dict[str, Any] = {}
