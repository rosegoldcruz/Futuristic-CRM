"""
Automation service - handles workflows, triggers, and scheduled tasks
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime, timedelta
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.automations import (
    Automation, AutomationCreate, AutomationUpdate,
    AutomationRun, AutomationRunCreate,
    AuditLog, AuditLogCreate,
    AUTOMATION_TYPES, TRIGGER_EVENTS, AUTOMATION_STATUSES, RUN_STATUSES
)


def _parse_json_field(value: Any) -> Any:
    """Parse JSON string to Python object if needed."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _row_to_automation(row: Dict[str, Any]) -> Automation:
    """Convert DB row to Automation model"""
    return Automation(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        automation_name=row.get("automation_name"),
        automation_type=row.get("automation_type"),
        trigger_event=row.get("trigger_event"),
        trigger_conditions=_parse_json_field(row.get("trigger_conditions")),
        actions=_parse_json_field(row.get("actions")),
        status=row.get("status", "active"),
        enabled=row.get("enabled", True),
        schedule=row.get("schedule"),
        last_run_at=row.get("last_run_at"),
        next_run_at=row.get("next_run_at"),
        run_count=row.get("run_count", 0),
        success_count=row.get("success_count", 0),
        failure_count=row.get("failure_count", 0),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


def _row_to_run(row: Dict[str, Any]) -> AutomationRun:
    """Convert DB row to AutomationRun model"""
    return AutomationRun(
        id=row["id"],
        automation_id=row.get("automation_id"),
        tenant_id=row.get("tenant_id"),
        status=row.get("status"),
        trigger_data=_parse_json_field(row.get("trigger_data")),
        result_data=_parse_json_field(row.get("result_data")),
        error_message=row.get("error_message"),
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        duration_ms=row.get("duration_ms"),
        created_at=row.get("created_at"),
    )


def _row_to_audit_log(row: Dict[str, Any]) -> AuditLog:
    """Convert DB row to AuditLog model"""
    return AuditLog(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        event_type=row.get("event_type"),
        entity_type=row.get("entity_type"),
        entity_id=row.get("entity_id"),
        user_id=row.get("user_id"),
        action=row.get("action"),
        details=_parse_json_field(row.get("details")),
        ip_address=row.get("ip_address"),
        user_agent=row.get("user_agent"),
        created_at=row.get("created_at"),
    )


# Automation Management
async def list_automations(
    tenant_id: Optional[int] = None,
    automation_type: Optional[str] = None,
    trigger_event: Optional[str] = None,
    status: Optional[str] = None,
    enabled: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Automation]:
    """List automations with optional filtering"""
    query = "SELECT * FROM automations WHERE deleted_at IS NULL"
    params: Dict[str, Any] = {}

    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if automation_type:
        query += " AND automation_type = :automation_type"
        params["automation_type"] = automation_type

    if trigger_event:
        query += " AND trigger_event = :trigger_event"
        params["trigger_event"] = trigger_event

    if status:
        query += " AND status = :status"
        params["status"] = status

    if enabled is not None:
        query += " AND enabled = :enabled"
        params["enabled"] = enabled

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_automation(r) for r in rows]


async def get_automation(automation_id: int) -> Optional[Automation]:
    """Get a single automation by ID"""
    query = "SELECT * FROM automations WHERE id = :automation_id AND deleted_at IS NULL"
    row = await fetch_one(query, {"automation_id": automation_id})
    return _row_to_automation(row) if row else None


async def create_automation(data: AutomationCreate) -> Automation:
    """Create a new automation"""
    if data.automation_type not in AUTOMATION_TYPES:
        raise ValueError(f"Invalid automation_type. Must be one of: {', '.join(AUTOMATION_TYPES)}")
    
    if data.trigger_event not in TRIGGER_EVENTS:
        raise ValueError(f"Invalid trigger_event. Must be one of: {', '.join(TRIGGER_EVENTS)}")
    
    query = """
        INSERT INTO automations (
            tenant_id, automation_name, automation_type, trigger_event,
            trigger_conditions, actions, status, enabled, schedule, metadata
        )
        VALUES (
            :tenant_id, :automation_name, :automation_type, :trigger_event,
            CAST(:trigger_conditions AS jsonb), CAST(:actions AS jsonb),
            :status, :enabled, :schedule, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "automation_name": data.automation_name,
        "automation_type": data.automation_type,
        "trigger_event": data.trigger_event,
        "trigger_conditions": json.dumps(data.trigger_conditions) if data.trigger_conditions else "{}",
        "actions": json.dumps(data.actions) if data.actions else "[]",
        "status": data.status or "active",
        "enabled": data.enabled if data.enabled is not None else True,
        "schedule": data.schedule,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_automation(row["id"])  # type: ignore


async def update_automation(automation_id: int, data: AutomationUpdate) -> Optional[Automation]:
    """Update an existing automation"""
    updates = []
    params: Dict[str, Any] = {"automation_id": automation_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    if "status" in payload and payload["status"] and payload["status"] not in AUTOMATION_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(AUTOMATION_STATUSES)}")
    
    field_mappings = {
        "automation_name": "automation_name",
        "status": "status",
        "enabled": "enabled",
        "schedule": "schedule",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    jsonb_fields = ["trigger_conditions", "actions", "metadata"]
    for field_name in jsonb_fields:
        if field_name in payload:
            updates.append(f"{field_name} = CAST(:{field_name} AS jsonb)")
            params[field_name] = json.dumps(payload[field_name]) if payload[field_name] else "{}"

    if not updates:
        return await get_automation(automation_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE automations SET {set_clause}
        WHERE id = :automation_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_automation(automation_id)


async def delete_automation(automation_id: int) -> bool:
    """Soft delete an automation"""
    query = "UPDATE automations SET deleted_at = NOW() WHERE id = :automation_id AND deleted_at IS NULL"
    count = await execute(query, {"automation_id": automation_id})
    return count > 0


# Automation Runs
async def create_run(data: AutomationRunCreate) -> AutomationRun:
    """Create a new automation run"""
    query = """
        INSERT INTO automation_runs (
            automation_id, tenant_id, status, trigger_data, result_data, error_message
        )
        VALUES (
            :automation_id, :tenant_id, :status,
            CAST(:trigger_data AS jsonb), CAST(:result_data AS jsonb), :error_message
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "automation_id": data.automation_id,
        "tenant_id": data.tenant_id,
        "status": data.status,
        "trigger_data": json.dumps(data.trigger_data) if data.trigger_data else "{}",
        "result_data": json.dumps(data.result_data) if data.result_data else "{}",
        "error_message": data.error_message,
    })
    
    query = "SELECT * FROM automation_runs WHERE id = :run_id"
    row = await fetch_one(query, {"run_id": row["id"]})
    return _row_to_run(row) if row else None  # type: ignore


async def complete_run(run_id: int, status: str, result_data: Optional[Dict[str, Any]] = None, error_message: Optional[str] = None) -> Optional[AutomationRun]:
    """Complete an automation run"""
    if status not in RUN_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(RUN_STATUSES)}")
    
    query = """
        UPDATE automation_runs
        SET status = :status,
            result_data = CAST(:result_data AS jsonb),
            error_message = :error_message,
            completed_at = NOW(),
            duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
        WHERE id = :run_id
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "run_id": run_id,
        "status": status,
        "result_data": json.dumps(result_data) if result_data else "{}",
        "error_message": error_message,
    })
    
    if not row:
        return None
    
    query = "SELECT * FROM automation_runs WHERE id = :run_id"
    row = await fetch_one(query, {"run_id": run_id})
    return _row_to_run(row) if row else None


async def update_automation_stats(automation_id: int, success: bool):
    """Update automation run statistics"""
    if success:
        query = """
            UPDATE automations
            SET run_count = run_count + 1,
                success_count = success_count + 1,
                last_run_at = NOW()
            WHERE id = :automation_id
        """
    else:
        query = """
            UPDATE automations
            SET run_count = run_count + 1,
                failure_count = failure_count + 1,
                last_run_at = NOW()
            WHERE id = :automation_id
        """
    
    await execute(query, {"automation_id": automation_id})


# Audit Logs
async def create_audit_log(data: AuditLogCreate) -> AuditLog:
    """Create a new audit log"""
    query = """
        INSERT INTO audit_logs (
            tenant_id, event_type, entity_type, entity_id, user_id,
            action, details, ip_address, user_agent
        )
        VALUES (
            :tenant_id, :event_type, :entity_type, :entity_id, :user_id,
            :action, CAST(:details AS jsonb), :ip_address, :user_agent
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "event_type": data.event_type,
        "entity_type": data.entity_type,
        "entity_id": data.entity_id,
        "user_id": data.user_id,
        "action": data.action,
        "details": json.dumps(data.details) if data.details else "{}",
        "ip_address": data.ip_address,
        "user_agent": data.user_agent,
    })
    
    query = "SELECT * FROM audit_logs WHERE id = :log_id"
    row = await fetch_one(query, {"log_id": row["id"]})
    return _row_to_audit_log(row) if row else None  # type: ignore


async def list_audit_logs(
    tenant_id: Optional[int] = None,
    event_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[AuditLog]:
    """List audit logs with filtering"""
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params: Dict[str, Any] = {}

    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if event_type:
        query += " AND event_type = :event_type"
        params["event_type"] = event_type

    if entity_type:
        query += " AND entity_type = :entity_type"
        params["entity_type"] = entity_type

    if entity_id:
        query += " AND entity_id = :entity_id"
        params["entity_id"] = entity_id

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_audit_log(r) for r in rows]


# Trigger Handlers
async def handle_trigger(trigger_event: str, entity_data: Dict[str, Any]):
    """Handle a triggered event and execute matching automations"""
    # Find all enabled automations for this trigger
    automations = await list_automations(
        trigger_event=trigger_event,
        enabled=True,
        status="active"
    )
    
    for automation in automations:
        # Check if conditions match
        if automation.trigger_conditions:
            # Simple condition matching (can be extended)
            if not _check_conditions(automation.trigger_conditions, entity_data):
                continue
        
        # Create run record
        run = await create_run(AutomationRunCreate(
            automation_id=automation.id,
            tenant_id=automation.tenant_id,
            status="running",
            trigger_data=entity_data,
        ))
        
        try:
            # Execute actions
            result = await _execute_actions(automation.actions or [], entity_data)
            
            # Complete run
            await complete_run(run.id, "completed", result_data=result)
            await update_automation_stats(automation.id, success=True)
            
            # Create audit log
            await create_audit_log(AuditLogCreate(
                tenant_id=automation.tenant_id,
                event_type="automation_executed",
                entity_type="automation",
                entity_id=automation.id,
                action=f"{trigger_event}_handled",
                details={
                    "automation_name": automation.automation_name,
                    "trigger_data": entity_data,
                    "result": result,
                },
            ))
        except Exception as e:
            # Handle failure
            await complete_run(run.id, "failed", error_message=str(e))
            await update_automation_stats(automation.id, success=False)


def _check_conditions(conditions: Dict[str, Any], data: Dict[str, Any]) -> bool:
    """Check if trigger conditions match"""
    # Simple field matching
    for field, expected_value in conditions.items():
        if data.get(field) != expected_value:
            return False
    return True


async def _execute_actions(actions: List[Dict[str, Any]], trigger_data: Dict[str, Any]) -> Dict[str, Any]:
    """Execute automation actions"""
    results = []
    
    for action in actions:
        action_type = action.get("type")
        action_params = action.get("params", {})
        
        if action_type == "send_email":
            # Placeholder for email sending
            result = {"sent": True, "recipient": action_params.get("to")}
        elif action_type == "create_work_order":
            # Placeholder for work order creation
            result = {"created": True, "job_id": trigger_data.get("job_id")}
        elif action_type == "update_status":
            # Placeholder for status update
            result = {"updated": True, "entity": action_params.get("entity")}
        else:
            result = {"executed": True, "action_type": action_type}
        
        results.append(result)
    
    return {"actions_executed": len(actions), "results": results}


# Cron Tasks
async def process_stale_leads():
    """Process stale leads (no activity for 7 days)"""
    seven_days_ago = datetime.now() - timedelta(days=7)
    
    query = """
        SELECT id
        FROM leads
        WHERE status = 'new'
        AND created_at < :stale_date
        AND deleted_at IS NULL
    """
    
    rows = await fetch_all(query, {"stale_date": seven_days_ago})
    
    for row in rows:
        # Create audit log for stale lead
        await create_audit_log(AuditLogCreate(
            event_type="stale_lead_detected",
            entity_type="lead",
            entity_id=row["id"],
            action="marked_stale",
            details={
                "days_inactive": 7,
                "detected_at": datetime.now().isoformat(),
            },
        ))
    
    return {"stale_leads_found": len(rows)}


async def process_overdue_payments():
    """Process overdue payments (placeholder - adjust based on payments schema)"""
    query = """
        SELECT id
        FROM payments
        WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL
    """
    
    rows = await fetch_all(query, {})
    
    for row in rows:
        # Create audit log for overdue payment
        await create_audit_log(AuditLogCreate(
            event_type="payment_overdue",
            entity_type="payment",
            entity_id=row["id"],
            action="marked_overdue",
            details={
                "detected_at": datetime.now().isoformat(),
                "days_overdue": 30,
            },
        ))
    
    return {"overdue_payments_found": len(rows)}
