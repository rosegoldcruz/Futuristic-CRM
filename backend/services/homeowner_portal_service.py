"""
Homeowner portal service - dashboard, timeline, messages, notifications
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime, timedelta
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.homeowner_portal import (
    PortalSession, PortalSessionCreate,
    PortalMessage, PortalMessageCreate,
    PortalNotification, PortalNotificationCreate,
    PortalActivityLog, PortalActivityLogCreate,
    HomeownerDashboard, ProjectTimeline
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


def _row_to_portal_session(row: Dict[str, Any]) -> PortalSession:
    """Convert DB row to PortalSession model"""
    return PortalSession(
        id=row["id"],
        homeowner_id=row.get("homeowner_id"),
        job_id=row.get("job_id"),
        session_token=row.get("session_token"),
        expires_at=row.get("expires_at"),
        last_accessed_at=row.get("last_accessed_at"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


def _row_to_message(row: Dict[str, Any]) -> PortalMessage:
    """Convert DB row to PortalMessage model"""
    return PortalMessage(
        id=row["id"],
        job_id=row.get("job_id"),
        sender_type=row.get("sender_type"),
        sender_id=row.get("sender_id"),
        sender_name=row.get("sender_name"),
        message_text=row.get("message_text"),
        is_read=row.get("is_read", False),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


def _row_to_notification(row: Dict[str, Any]) -> PortalNotification:
    """Convert DB row to PortalNotification model"""
    return PortalNotification(
        id=row["id"],
        homeowner_id=row.get("homeowner_id"),
        job_id=row.get("job_id"),
        notification_type=row.get("notification_type"),
        title=row.get("title"),
        message=row.get("message"),
        action_url=row.get("action_url"),
        is_read=row.get("is_read", False),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


def _row_to_activity_log(row: Dict[str, Any]) -> PortalActivityLog:
    """Convert DB row to PortalActivityLog model"""
    return PortalActivityLog(
        id=row["id"],
        homeowner_id=row.get("homeowner_id"),
        job_id=row.get("job_id"),
        activity_type=row.get("activity_type"),
        activity_title=row.get("activity_title"),
        activity_description=row.get("activity_description"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


# Portal Sessions
async def create_portal_session(data: PortalSessionCreate) -> PortalSession:
    """Create a new portal session"""
    query = """
        INSERT INTO portal_sessions (
            homeowner_id, job_id, session_token, expires_at, metadata
        )
        VALUES (
            :homeowner_id, :job_id, :session_token, :expires_at, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "homeowner_id": data.homeowner_id,
        "job_id": data.job_id,
        "session_token": data.session_token,
        "expires_at": data.expires_at,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM portal_sessions WHERE id = :session_id"
    row = await fetch_one(query, {"session_id": row["id"]})
    return _row_to_portal_session(row) if row else None  # type: ignore


async def validate_session_token(session_token: str) -> Optional[PortalSession]:
    """Validate a portal session token"""
    query = """
        SELECT * FROM portal_sessions
        WHERE session_token = :session_token
        AND expires_at > NOW()
    """
    row = await fetch_one(query, {"session_token": session_token})
    
    if row:
        # Update last_accessed_at
        update_query = """
            UPDATE portal_sessions
            SET last_accessed_at = NOW()
            WHERE id = :session_id
        """
        await execute(update_query, {"session_id": row["id"]})
        return _row_to_portal_session(row)
    
    return None


# Messages
async def list_messages(job_id: int, limit: int = 50) -> List[PortalMessage]:
    """List messages for a job"""
    query = """
        SELECT * FROM portal_messages
        WHERE job_id = :job_id
        ORDER BY created_at DESC
        LIMIT :limit
    """
    rows = await fetch_all(query, {"job_id": job_id, "limit": limit})
    return [_row_to_message(r) for r in rows]


async def create_message(data: PortalMessageCreate) -> PortalMessage:
    """Create a new message"""
    query = """
        INSERT INTO portal_messages (
            job_id, sender_type, sender_id, sender_name, message_text, metadata
        )
        VALUES (
            :job_id, :sender_type, :sender_id, :sender_name, :message_text, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "job_id": data.job_id,
        "sender_type": data.sender_type,
        "sender_id": data.sender_id,
        "sender_name": data.sender_name,
        "message_text": data.message_text,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM portal_messages WHERE id = :msg_id"
    row = await fetch_one(query, {"msg_id": row["id"]})
    return _row_to_message(row) if row else None  # type: ignore


async def mark_messages_read(message_ids: List[int]) -> int:
    """Mark messages as read"""
    if not message_ids:
        return 0
    
    placeholders = ",".join([f":id{i}" for i in range(len(message_ids))])
    query = f"UPDATE portal_messages SET is_read = true WHERE id IN ({placeholders})"
    params = {f"id{i}": msg_id for i, msg_id in enumerate(message_ids)}
    
    return await execute(query, params)


# Notifications
async def list_notifications(homeowner_id: int, limit: int = 50) -> List[PortalNotification]:
    """List notifications for a homeowner"""
    query = """
        SELECT * FROM portal_notifications
        WHERE homeowner_id = :homeowner_id
        ORDER BY created_at DESC
        LIMIT :limit
    """
    rows = await fetch_all(query, {"homeowner_id": homeowner_id, "limit": limit})
    return [_row_to_notification(r) for r in rows]


async def create_notification(data: PortalNotificationCreate) -> PortalNotification:
    """Create a new notification"""
    query = """
        INSERT INTO portal_notifications (
            homeowner_id, job_id, notification_type, title, message, action_url, metadata
        )
        VALUES (
            :homeowner_id, :job_id, :notification_type, :title, :message, :action_url, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "homeowner_id": data.homeowner_id,
        "job_id": data.job_id,
        "notification_type": data.notification_type,
        "title": data.title,
        "message": data.message,
        "action_url": data.action_url,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM portal_notifications WHERE id = :notif_id"
    row = await fetch_one(query, {"notif_id": row["id"]})
    return _row_to_notification(row) if row else None  # type: ignore


async def mark_notifications_read(notification_ids: List[int]) -> int:
    """Mark notifications as read"""
    if not notification_ids:
        return 0
    
    placeholders = ",".join([f":id{i}" for i in range(len(notification_ids))])
    query = f"UPDATE portal_notifications SET is_read = true WHERE id IN ({placeholders})"
    params = {f"id{i}": notif_id for i, notif_id in enumerate(notification_ids)}
    
    return await execute(query, params)


# Activity Log
async def create_activity_log(data: PortalActivityLogCreate) -> PortalActivityLog:
    """Create an activity log entry"""
    query = """
        INSERT INTO portal_activity_log (
            homeowner_id, job_id, activity_type, activity_title, activity_description, metadata
        )
        VALUES (
            :homeowner_id, :job_id, :activity_type, :activity_title, :activity_description, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "homeowner_id": data.homeowner_id,
        "job_id": data.job_id,
        "activity_type": data.activity_type,
        "activity_title": data.activity_title,
        "activity_description": data.activity_description,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM portal_activity_log WHERE id = :log_id"
    row = await fetch_one(query, {"log_id": row["id"]})
    return _row_to_activity_log(row) if row else None  # type: ignore


async def get_project_timeline(job_id: int) -> List[ProjectTimeline]:
    """Get complete project timeline for a job"""
    timeline_items = []
    
    # Get homeowner_id from job
    job_query = "SELECT homeowner_id FROM jobs WHERE id = :job_id"
    job = await fetch_one(job_query, {"job_id": job_id})
    if not job:
        return timeline_items
    
    homeowner_id = job["homeowner_id"]
    
    # Get quote events (quotes use homeowner_id)
    quote_query = """
        SELECT id, status, total_price, created_at
        FROM quotes
        WHERE homeowner_id = :homeowner_id AND deleted_at IS NULL
        ORDER BY created_at
    """
    quotes = await fetch_all(quote_query, {"homeowner_id": homeowner_id})
    for quote in quotes:
        timeline_items.append(ProjectTimeline(
            id=quote["id"],
            event_type="quote",
            title="Quote Created",
            description=f"Quote for ${float(quote['total_price']):,.2f}",
            status=quote["status"],
            created_at=quote["created_at"],
            metadata={"quote_id": quote["id"]},
        ))
    
    # Get payment events
    payment_query = """
        SELECT id, amount, status, payment_type, created_at
        FROM payments
        WHERE job_id = :job_id AND deleted_at IS NULL
        ORDER BY created_at
    """
    payments = await fetch_all(payment_query, {"job_id": job_id})
    for payment in payments:
        timeline_items.append(ProjectTimeline(
            id=payment["id"],
            event_type="payment",
            title=f"{payment['payment_type'].title()} Payment",
            description=f"${float(payment['amount']):,.2f}",
            status=payment["status"],
            created_at=payment["created_at"],
            metadata={"payment_id": payment["id"]},
        ))
    
    # Get work order events
    wo_query = """
        SELECT id, status, scheduled_date, created_at
        FROM work_orders
        WHERE job_id = :job_id AND deleted_at IS NULL
        ORDER BY created_at
    """
    work_orders = await fetch_all(wo_query, {"job_id": job_id})
    for wo in work_orders:
        timeline_items.append(ProjectTimeline(
            id=wo["id"],
            event_type="work_order",
            title="Work Order Created",
            description=f"Scheduled for {wo['scheduled_date']}" if wo.get("scheduled_date") else "Installation scheduled",
            status=wo["status"],
            created_at=wo["created_at"],
            metadata={"work_order_id": wo["id"]},
        ))
    
    # Get document events (documents use entity_type + entity_id)
    doc_query = """
        SELECT id, document_type, status, created_at
        FROM documents
        WHERE entity_type = 'job' AND entity_id = :job_id AND deleted_at IS NULL
        ORDER BY created_at
    """
    documents = await fetch_all(doc_query, {"job_id": job_id})
    for doc in documents:
        timeline_items.append(ProjectTimeline(
            id=doc["id"],
            event_type="document",
            title=f"{doc['document_type'].title()} Document",
            description="Document created",
            status=doc["status"],
            created_at=doc["created_at"],
            metadata={"document_id": doc["id"]},
        ))
    
    # Sort by created_at
    timeline_items.sort(key=lambda x: x.created_at, reverse=True)
    
    return timeline_items


async def get_homeowner_dashboard(homeowner_id: int, job_id: Optional[int] = None) -> HomeownerDashboard:
    """Get complete homeowner dashboard data"""
    # If no job_id, get the most recent job for this homeowner
    if not job_id:
        job_query = """
            SELECT id FROM jobs
            WHERE homeowner_id = :homeowner_id AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
        """
        job_row = await fetch_one(job_query, {"homeowner_id": homeowner_id})
        if job_row:
            job_id = job_row["id"]
    
    if not job_id:
        # No jobs for this homeowner
        return HomeownerDashboard()
    
    # Get job
    job_query = "SELECT * FROM jobs WHERE id = :job_id AND deleted_at IS NULL"
    job = await fetch_one(job_query, {"job_id": job_id})
    
    # Get quote (quotes use homeowner_id, not job_id)
    quote_query = "SELECT * FROM quotes WHERE homeowner_id = :homeowner_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
    quote = await fetch_one(quote_query, {"homeowner_id": homeowner_id})
    
    # Get work order
    wo_query = "SELECT * FROM work_orders WHERE job_id = :job_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
    work_order = await fetch_one(wo_query, {"job_id": job_id})
    
    # Get payments
    payments_query = "SELECT * FROM payments WHERE job_id = :job_id AND deleted_at IS NULL ORDER BY created_at DESC"
    payments = await fetch_all(payments_query, {"job_id": job_id})
    
    # Get documents (documents use entity_type + entity_id)
    docs_query = "SELECT * FROM documents WHERE entity_type = 'job' AND entity_id = :job_id AND deleted_at IS NULL ORDER BY created_at DESC"
    documents = await fetch_all(docs_query, {"job_id": job_id})
    
    # Get timeline
    timeline = await get_project_timeline(job_id)
    
    # Get messages
    messages = await list_messages(job_id)
    
    # Get notifications
    notifications = await list_notifications(homeowner_id)
    
    # Count unread
    unread_messages = sum(1 for m in messages if not m.is_read)
    unread_notifications = sum(1 for n in notifications if not n.is_read)
    
    return HomeownerDashboard(
        job=dict(job) if job else None,
        quote=dict(quote) if quote else None,
        work_order=dict(work_order) if work_order else None,
        payments=[dict(p) for p in payments],
        documents=[dict(d) for d in documents],
        timeline=[t.model_dump() for t in timeline],
        messages=messages,
        notifications=notifications,
        unread_messages_count=unread_messages,
        unread_notifications_count=unread_notifications,
    )
