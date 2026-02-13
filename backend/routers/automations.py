from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from models.automations import (
    Automation, AutomationCreate, AutomationUpdate,
    AutomationRun, AuditLog,
    AUTOMATION_TYPES, TRIGGER_EVENTS, AUTOMATION_STATUSES
)
from services import automation_service

router = APIRouter(tags=["automations"])


# Automations
@router.get("/", response_model=List[Automation])
async def list_automations(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    automation_type: Optional[str] = Query(None, description="Filter by type"),
    trigger_event: Optional[str] = Query(None, description="Filter by trigger"),
    status: Optional[str] = Query(None, description="Filter by status"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List automations with optional filtering"""
    return await automation_service.list_automations(
        tenant_id=tenant_id,
        automation_type=automation_type,
        trigger_event=trigger_event,
        status=status,
        enabled=enabled,
        limit=limit,
        offset=offset,
    )


@router.get("/types", response_model=List[str])
async def get_automation_types():
    """Get list of valid automation types"""
    return AUTOMATION_TYPES


@router.get("/triggers", response_model=List[str])
async def get_trigger_events():
    """Get list of valid trigger events"""
    return TRIGGER_EVENTS


@router.get("/statuses", response_model=List[str])
async def get_automation_statuses():
    """Get list of valid automation statuses"""
    return AUTOMATION_STATUSES


@router.get("/{automation_id}", response_model=Automation)
async def get_automation(automation_id: int):
    """Get a specific automation by ID"""
    automation = await automation_service.get_automation(automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation


@router.post("/", response_model=Automation, status_code=201)
async def create_automation(payload: AutomationCreate):
    """Create a new automation"""
    try:
        return await automation_service.create_automation(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{automation_id}", response_model=Automation)
async def update_automation(automation_id: int, payload: AutomationUpdate):
    """Update an existing automation"""
    try:
        automation = await automation_service.update_automation(automation_id, payload)
        if not automation:
            raise HTTPException(status_code=404, detail="Automation not found")
        return automation
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{automation_id}", status_code=204)
async def delete_automation(automation_id: int):
    """Delete an automation"""
    ok = await automation_service.delete_automation(automation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Automation not found")
    return None


# Audit Logs
@router.get("/audit-logs/", response_model=List[AuditLog])
async def list_audit_logs(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List audit logs with filtering"""
    return await automation_service.list_audit_logs(
        tenant_id=tenant_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
        offset=offset,
    )


# Cron Tasks
@router.post("/cron/stale-leads")
async def run_stale_leads_task():
    """Run stale leads cron task"""
    return await automation_service.process_stale_leads()


@router.post("/cron/overdue-payments")
async def run_overdue_payments_task():
    """Run overdue payments cron task"""
    return await automation_service.process_overdue_payments()
