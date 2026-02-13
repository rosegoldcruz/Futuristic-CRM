from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from models.orchestrator import (
    EventBusMessage, EventBusRecord, DeadLetterRecord,
    SystemHeartbeat, WorkflowExecution, OrchestrationResult,
    EVENT_TYPES, MODULES
)
from services import orchestrator_service

router = APIRouter(tags=["orchestrator"])


# Event Bus
@router.post("/events", response_model=EventBusRecord, status_code=201)
async def publish_event(payload: EventBusMessage):
    """Publish an event to the event bus"""
    return await orchestrator_service.publish_event(payload)


@router.post("/events/{event_id}/retry")
async def retry_event(event_id: int):
    """Retry a failed event"""
    await orchestrator_service.process_event(event_id)
    return {"status": "retried", "event_id": event_id}


# Health & Heartbeat
@router.get("/health", response_model=SystemHeartbeat)
async def get_system_health():
    """Get system-wide health check"""
    return await orchestrator_service.check_system_health()


@router.get("/heartbeat")
async def heartbeat():
    """Simple heartbeat endpoint"""
    return {
        "status": "alive",
        "timestamp": "2025-11-30T11:05:00Z",
        "version": "1.0.0"
    }


# Dead Letter Queue
@router.get("/dead-letter-queue", response_model=List[DeadLetterRecord])
async def get_dead_letter_queue(
    limit: int = Query(50, ge=1, le=200),
):
    """Get dead letter queue entries"""
    return await orchestrator_service.get_dead_letter_queue(limit)


@router.post("/dead-letter-queue/{dead_letter_id}/retry")
async def retry_dead_letter(dead_letter_id: int):
    """Retry a dead letter event"""
    success = await orchestrator_service.retry_dead_letter_event(dead_letter_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dead letter event not found")
    return {"status": "retried", "dead_letter_id": dead_letter_id}


# Workflows
@router.post("/workflows/quote-approved", response_model=OrchestrationResult)
async def trigger_quote_approved_workflow(quote_id: int):
    """Trigger the quote approved workflow"""
    # Publish event which will trigger the workflow
    event = await orchestrator_service.publish_event(EventBusMessage(
        event_type="quote.approved",
        event_name=f"Quote {quote_id} approved",
        source_module="api",
        target_modules=["jobs", "work_orders", "payments", "notifications"],
        payload={"quote_id": quote_id},
    ))
    
    return OrchestrationResult(
        success=True,
        workflow_id=event.id,
        steps_completed=0,
        results={"event_id": event.id}
    )


# Meta endpoints
@router.get("/meta/event-types", response_model=List[str])
async def get_event_types():
    """Get list of event types"""
    return EVENT_TYPES


@router.get("/meta/modules", response_model=List[str])
async def get_modules():
    """Get list of modules"""
    return MODULES


@router.get("/stats")
async def get_orchestrator_stats():
    """Get orchestrator statistics"""
    from config.db import fetch_one
    
    # Get event counts
    event_stats_query = """
        SELECT 
            status,
            COUNT(*) as count
        FROM event_bus
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY status
    """
    event_stats = await fetch_one(event_stats_query, {})
    
    # Get workflow stats
    workflow_stats_query = """
        SELECT 
            status,
            COUNT(*) as count,
            AVG(duration_ms) as avg_duration_ms
        FROM workflow_executions
        WHERE started_at > NOW() - INTERVAL '24 hours'
        GROUP BY status
    """
    workflow_stats = await fetch_one(workflow_stats_query, {})
    
    # Get dead letter count
    dlq_query = "SELECT COUNT(*) as count FROM dead_letter_queue"
    dlq_row = await fetch_one(dlq_query, {})
    
    return {
        "event_bus": {
            "total_24h": sum(event_stats.values()) if event_stats else 0,
            "by_status": dict(event_stats) if event_stats else {},
        },
        "workflows": {
            "total_24h": sum(workflow_stats.values()) if workflow_stats else 0,
            "by_status": dict(workflow_stats) if workflow_stats else {},
        },
        "dead_letter_queue": {
            "total": dlq_row["count"] if dlq_row else 0,
        }
    }
