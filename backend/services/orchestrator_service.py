"""
Orchestrator service - event bus, workflows, cross-module coordination
"""
from typing import List, Optional, Dict, Any
import json
import traceback
from datetime import datetime, timedelta
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.orchestrator import (
    EventBusMessage, EventBusRecord, DeadLetterRecord,
    WorkflowExecution, SystemHealth, SystemHeartbeat,
    OrchestrationResult
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


# Event Bus
async def publish_event(message: EventBusMessage) -> EventBusRecord:
    """Publish an event to the event bus"""
    query = """
        INSERT INTO event_bus (
            event_type, event_name, source_module, target_modules, payload, metadata, status
        )
        VALUES (
            :event_type, :event_name, :source_module, CAST(:target_modules AS jsonb), 
            CAST(:payload AS jsonb), CAST(:metadata AS jsonb), 'pending'
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "event_type": message.event_type,
        "event_name": message.event_name,
        "source_module": message.source_module,
        "target_modules": json.dumps(message.target_modules or []),
        "payload": json.dumps(message.payload),
        "metadata": json.dumps(message.metadata or {}),
    })
    
    event_id = row["id"]
    
    # Process event asynchronously
    await process_event(event_id)
    
    # Get the event record
    query = "SELECT * FROM event_bus WHERE id = :event_id"
    row = await fetch_one(query, {"event_id": event_id})
    
    if not row:
        return None  # type: ignore
    
    return EventBusRecord(
        id=row["id"],
        event_type=row["event_type"],
        event_name=row["event_name"],
        source_module=row["source_module"],
        target_modules=_parse_json_field(row["target_modules"]) or [],
        payload=_parse_json_field(row["payload"]) or {},
        metadata=_parse_json_field(row["metadata"]),
        status=row["status"],
        retry_count=row["retry_count"],
        max_retries=row["max_retries"],
        processed_at=row.get("processed_at"),
        created_at=row.get("created_at"),
    )


async def process_event(event_id: int):
    """Process an event from the bus"""
    # Get event
    query = "SELECT * FROM event_bus WHERE id = :event_id"
    row = await fetch_one(query, {"event_id": event_id})
    
    if not row:
        return
    
    # Update status to processing
    await execute(
        "UPDATE event_bus SET status = 'processing' WHERE id = :event_id",
        {"event_id": event_id}
    )
    
    try:
        event_type = row["event_type"]
        payload = _parse_json_field(row["payload"]) or {}
        
        # Route to appropriate workflow
        if event_type == "quote.approved":
            await handle_quote_approved(payload, event_id)
        elif event_type == "job.created":
            await handle_job_created(payload, event_id)
        elif event_type == "work_order.completed":
            await handle_work_order_completed(payload, event_id)
        elif event_type == "payment.completed":
            await handle_payment_completed(payload, event_id)
        
        # Mark as completed
        await execute(
            "UPDATE event_bus SET status = 'completed', processed_at = NOW() WHERE id = :event_id",
            {"event_id": event_id}
        )
    
    except Exception as e:
        # Retry logic
        retry_count = row["retry_count"]
        max_retries = row["max_retries"]
        
        if retry_count < max_retries:
            # Retry
            await execute(
                "UPDATE event_bus SET status = 'retry', retry_count = retry_count + 1 WHERE id = :event_id",
                {"event_id": event_id}
            )
        else:
            # Move to dead letter queue
            await move_to_dead_letter(event_id, str(e), traceback.format_exc())
            await execute(
                "UPDATE event_bus SET status = 'failed', processed_at = NOW() WHERE id = :event_id",
                {"event_id": event_id}
            )


async def move_to_dead_letter(event_id: int, error_message: str, error_stack: str):
    """Move failed event to dead letter queue"""
    query = "SELECT * FROM event_bus WHERE id = :event_id"
    row = await fetch_one(query, {"event_id": event_id})
    
    if not row:
        return
    
    query = """
        INSERT INTO dead_letter_queue (
            event_id, event_type, event_name, source_module, payload,
            error_message, error_stack, retry_count, metadata
        )
        VALUES (
            :event_id, :event_type, :event_name, :source_module, CAST(:payload AS jsonb),
            :error_message, :error_stack, :retry_count, CAST(:metadata AS jsonb)
        )
    """
    
    await execute(query, {
        "event_id": event_id,
        "event_type": row["event_type"],
        "event_name": row["event_name"],
        "source_module": row["source_module"],
        "payload": row["payload"],
        "error_message": error_message[:1000],  # Limit length
        "error_stack": error_stack[:5000],
        "retry_count": row["retry_count"],
        "metadata": row["metadata"],
    })


# Workflow Orchestration
async def handle_quote_approved(payload: Dict[str, Any], trigger_event_id: int) -> OrchestrationResult:
    """
    Orchestrate: Quote Approved → Job Created → Work Order Created → Payment Triggered
    """
    workflow_id = await start_workflow("quote_approved_flow", trigger_event_id, 4)
    
    try:
        quote_id = payload.get("quote_id")
        if not quote_id:
            raise ValueError("quote_id missing from payload")
        
        # Step 1: Create Job
        job_data = await create_job_from_quote(quote_id)
        await update_workflow_step(workflow_id, 1, "job_created", {"job_id": job_data["id"]})
        
        # Step 2: Create Work Order
        work_order_data = await create_work_order_from_job(job_data["id"])
        await update_workflow_step(workflow_id, 2, "work_order_created", {"work_order_id": work_order_data["id"]})
        
        # Step 3: Create Payment Schedule
        payment_data = await create_payment_schedule(job_data["id"], payload.get("total_price", 0))
        await update_workflow_step(workflow_id, 3, "payment_created", {"payment_id": payment_data["id"]})
        
        # Step 4: Send Notifications
        await send_job_notifications(job_data["id"])
        await update_workflow_step(workflow_id, 4, "notifications_sent", {})
        
        # Complete workflow
        await complete_workflow(workflow_id, {
            "job_id": job_data["id"],
            "work_order_id": work_order_data["id"],
            "payment_id": payment_data["id"],
        })
        
        return OrchestrationResult(
            success=True,
            workflow_id=workflow_id,
            steps_completed=4,
            results={
                "job_id": job_data["id"],
                "work_order_id": work_order_data["id"],
                "payment_id": payment_data["id"],
            }
        )
    
    except Exception as e:
        await fail_workflow(workflow_id, str(e))
        return OrchestrationResult(
            success=False,
            workflow_id=workflow_id,
            steps_completed=0,
            errors=[str(e)]
        )


async def handle_job_created(payload: Dict[str, Any], trigger_event_id: int):
    """Handle job created event"""
    job_id = payload.get("job_id")
    print(f"[Orchestrator] Job created: {job_id}")
    # Additional orchestration logic


async def handle_work_order_completed(payload: Dict[str, Any], trigger_event_id: int):
    """Handle work order completed event"""
    work_order_id = payload.get("work_order_id")
    print(f"[Orchestrator] Work order completed: {work_order_id}")
    # Trigger payment, update job status, etc.


async def handle_payment_completed(payload: Dict[str, Any], trigger_event_id: int):
    """Handle payment completed event"""
    payment_id = payload.get("payment_id")
    print(f"[Orchestrator] Payment completed: {payment_id}")
    # Update job, send receipts, etc.


# Workflow Management
async def start_workflow(workflow_name: str, trigger_event_id: int, total_steps: int) -> int:
    """Start a workflow execution"""
    query = """
        INSERT INTO workflow_executions (workflow_name, trigger_event_id, status, total_steps, steps_completed)
        VALUES (:workflow_name, :trigger_event_id, 'running', :total_steps, 0)
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "workflow_name": workflow_name,
        "trigger_event_id": trigger_event_id,
        "total_steps": total_steps,
    })
    
    return row["id"]


async def update_workflow_step(workflow_id: int, step_number: int, step_name: str, result: Dict[str, Any]):
    """Update workflow step"""
    query = """
        UPDATE workflow_executions
        SET steps_completed = :step_number, current_step = :step_name,
            result_data = COALESCE(result_data, '{}'::jsonb) || CAST(:result AS jsonb)
        WHERE id = :workflow_id
    """
    
    await execute(query, {
        "workflow_id": workflow_id,
        "step_number": step_number,
        "step_name": step_name,
        "result": json.dumps(result),
    })


async def complete_workflow(workflow_id: int, final_result: Dict[str, Any]):
    """Complete a workflow"""
    query = """
        UPDATE workflow_executions
        SET status = 'completed', completed_at = NOW(),
            duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
            result_data = CAST(:result AS jsonb)
        WHERE id = :workflow_id
    """
    
    await execute(query, {
        "workflow_id": workflow_id,
        "result": json.dumps(final_result),
    })


async def fail_workflow(workflow_id: int, error_message: str):
    """Fail a workflow"""
    query = """
        UPDATE workflow_executions
        SET status = 'failed', completed_at = NOW(), error_message = :error_message,
            duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
        WHERE id = :workflow_id
    """
    
    await execute(query, {
        "workflow_id": workflow_id,
        "error_message": error_message[:1000],
    })


# Cross-Module Operations (Mock implementations)
async def create_job_from_quote(quote_id: int) -> Dict[str, Any]:
    """Create a job from an approved quote"""
    # Get quote details
    query = "SELECT * FROM quotes WHERE id = :quote_id"
    quote = await fetch_one(query, {"quote_id": quote_id})
    
    if not quote:
        raise ValueError(f"Quote {quote_id} not found")
    
    # Create job
    job_query = """
        INSERT INTO jobs (
            homeowner_id, quote_id, status, start_date, metadata
        )
        VALUES (
            :homeowner_id, :quote_id, 'scheduled', CURRENT_DATE + INTERVAL '7 days', '{}'::jsonb
        )
        RETURNING id
    """
    
    job_row = await execute_returning(job_query, {
        "homeowner_id": quote["homeowner_id"],
        "quote_id": quote_id,
    })
    
    # Publish event
    await publish_event(EventBusMessage(
        event_type="job.created",
        event_name=f"Job created from quote {quote_id}",
        source_module="orchestrator",
        target_modules=["work_orders", "notifications"],
        payload={"job_id": job_row["id"], "quote_id": quote_id},
    ))
    
    return {"id": job_row["id"], "status": "scheduled"}


async def create_work_order_from_job(job_id: int) -> Dict[str, Any]:
    """Create a work order from a job"""
    query = """
        INSERT INTO work_orders (job_id, status, metadata)
        VALUES (:job_id, 'pending', '{}'::jsonb)
        RETURNING id
    """
    
    row = await execute_returning(query, {"job_id": job_id})
    
    return {"id": row["id"], "status": "pending"}


async def create_payment_schedule(job_id: int, total_amount: float) -> Dict[str, Any]:
    """Create payment schedule for a job"""
    # Create initial deposit payment
    query = """
        INSERT INTO payments (job_id, amount, status, payment_type, due_date)
        VALUES (:job_id, :amount, 'pending', 'deposit', CURRENT_DATE + INTERVAL '3 days')
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "job_id": job_id,
        "amount": total_amount * 0.3,  # 30% deposit
    })
    
    return {"id": row["id"], "amount": total_amount * 0.3}


async def send_job_notifications(job_id: int):
    """Send notifications about new job"""
    # Get job details
    query = """
        SELECT j.*, h.email, h.first_name, h.last_name
        FROM jobs j
        JOIN homeowners h ON j.homeowner_id = h.id
        WHERE j.id = :job_id
    """
    job = await fetch_one(query, {"job_id": job_id})
    
    if job:
        # Create notification
        notif_query = """
            INSERT INTO portal_notifications (homeowner_id, notification_type, title, message)
            VALUES (:homeowner_id, 'job_scheduled', 'Job Scheduled', :message)
        """
        
        await execute(notif_query, {
            "homeowner_id": job["homeowner_id"],
            "message": f"Your solar installation job has been scheduled!",
        })


# System Health
async def check_system_health() -> SystemHeartbeat:
    """Check health of all modules"""
    modules = []
    
    # Check database
    db_health = await check_database_health()
    modules.append(db_health)
    
    # Check event bus
    event_bus_health = await check_event_bus_health()
    modules.append(event_bus_health)
    
    # Count status
    healthy = sum(1 for m in modules if m.status == "healthy")
    degraded = sum(1 for m in modules if m.status == "degraded")
    down = sum(1 for m in modules if m.status == "down")
    
    # Get metrics
    pending_query = "SELECT COUNT(*) as count FROM event_bus WHERE status = 'pending'"
    pending_row = await fetch_one(pending_query, {})
    
    dead_letter_query = "SELECT COUNT(*) as count FROM dead_letter_queue"
    dead_letter_row = await fetch_one(dead_letter_query, {})
    
    active_workflow_query = "SELECT COUNT(*) as count FROM workflow_executions WHERE status = 'running'"
    workflow_row = await fetch_one(active_workflow_query, {})
    
    # Determine overall status
    if down > 0:
        status = "critical"
    elif degraded > 0:
        status = "degraded"
    else:
        status = "healthy"
    
    return SystemHeartbeat(
        status=status,
        total_modules=len(modules),
        healthy_modules=healthy,
        degraded_modules=degraded,
        down_modules=down,
        modules=modules,
        event_bus_pending=pending_row["count"] if pending_row else 0,
        dead_letter_count=dead_letter_row["count"] if dead_letter_row else 0,
        active_workflows=workflow_row["count"] if workflow_row else 0,
        timestamp=datetime.now(),
    )


async def check_database_health() -> SystemHealth:
    """Check database health"""
    try:
        start = datetime.now()
        await fetch_one("SELECT 1", {})
        duration = (datetime.now() - start).total_seconds() * 1000
        
        return SystemHealth(
            module_name="database",
            status="healthy" if duration < 100 else "degraded",
            response_time_ms=int(duration),
            last_check_at=datetime.now(),
        )
    except Exception:
        return SystemHealth(
            module_name="database",
            status="down",
            last_check_at=datetime.now(),
        )


async def check_event_bus_health() -> SystemHealth:
    """Check event bus health"""
    try:
        # Check for stuck events
        query = """
            SELECT COUNT(*) as count FROM event_bus
            WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes'
        """
        row = await fetch_one(query, {})
        stuck_count = row["count"] if row else 0
        
        status = "healthy" if stuck_count == 0 else "degraded"
        
        return SystemHealth(
            module_name="event_bus",
            status=status,
            last_check_at=datetime.now(),
            metadata={"stuck_events": stuck_count},
        )
    except Exception:
        return SystemHealth(
            module_name="event_bus",
            status="down",
            last_check_at=datetime.now(),
        )


# Dead Letter Queue Management
async def get_dead_letter_queue(limit: int = 50) -> List[DeadLetterRecord]:
    """Get dead letter queue entries"""
    query = "SELECT * FROM dead_letter_queue ORDER BY failed_at DESC LIMIT :limit"
    rows = await fetch_all(query, {"limit": limit})
    
    return [
        DeadLetterRecord(
            id=r["id"],
            event_id=r.get("event_id"),
            event_type=r["event_type"],
            event_name=r["event_name"],
            source_module=r["source_module"],
            payload=_parse_json_field(r["payload"]) or {},
            error_message=r.get("error_message"),
            error_stack=r.get("error_stack"),
            retry_count=r.get("retry_count"),
            metadata=_parse_json_field(r.get("metadata")),
            failed_at=r.get("failed_at"),
        )
        for r in rows
    ]


async def retry_dead_letter_event(dead_letter_id: int) -> bool:
    """Retry a dead letter event"""
    query = "SELECT * FROM dead_letter_queue WHERE id = :dead_letter_id"
    row = await fetch_one(query, {"dead_letter_id": dead_letter_id})
    
    if not row:
        return False
    
    # Republish to event bus
    payload = _parse_json_field(row["payload"]) or {}
    
    await publish_event(EventBusMessage(
        event_type=row["event_type"],
        event_name=row["event_name"] + " (retried)",
        source_module=row["source_module"],
        payload=payload,
        metadata={"retried_from_dlq": dead_letter_id},
    ))
    
    # Delete from DLQ
    await execute("DELETE FROM dead_letter_queue WHERE id = :dead_letter_id", {"dead_letter_id": dead_letter_id})
    
    return True
