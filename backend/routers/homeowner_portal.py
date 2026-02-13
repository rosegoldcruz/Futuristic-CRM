from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Header

from models.homeowner_portal import (
    PortalSession, PortalSessionCreate,
    PortalMessage, PortalMessageCreate,
    PortalNotification, PortalNotificationCreate,
    PortalActivityLog, PortalActivityLogCreate,
    HomeownerDashboard, ProjectTimeline,
    SendMessageRequest, MarkAsReadRequest
)
from services import homeowner_portal_service

router = APIRouter(tags=["homeowner_portal"])


# Portal Sessions
@router.post("/sessions", response_model=PortalSession, status_code=201)
async def create_portal_session(payload: PortalSessionCreate):
    """Create a new portal session"""
    return await homeowner_portal_service.create_portal_session(payload)


@router.get("/sessions/validate")
async def validate_session(session_token: str = Query(..., description="Session token to validate")):
    """Validate a portal session token"""
    session = await homeowner_portal_service.validate_session_token(session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return session


# Dashboard
@router.get("/dashboard/{homeowner_id}", response_model=HomeownerDashboard)
async def get_homeowner_dashboard(
    homeowner_id: int,
    job_id: Optional[int] = Query(None, description="Specific job ID"),
):
    """Get complete homeowner dashboard data"""
    return await homeowner_portal_service.get_homeowner_dashboard(homeowner_id, job_id)


# Timeline
@router.get("/timeline/{job_id}", response_model=List[ProjectTimeline])
async def get_project_timeline(job_id: int):
    """Get project timeline for a job"""
    return await homeowner_portal_service.get_project_timeline(job_id)


# Messages
@router.get("/messages/{job_id}", response_model=List[PortalMessage])
async def list_messages(
    job_id: int,
    limit: int = Query(50, ge=1, le=200),
):
    """List messages for a job"""
    return await homeowner_portal_service.list_messages(job_id, limit)


@router.post("/messages", response_model=PortalMessage, status_code=201)
async def send_message(payload: SendMessageRequest):
    """Send a message"""
    message_data = PortalMessageCreate(
        job_id=payload.job_id,
        sender_type="homeowner",
        sender_name=payload.sender_name,
        message_text=payload.message_text,
    )
    return await homeowner_portal_service.create_message(message_data)


@router.post("/messages/mark-read")
async def mark_messages_read(payload: MarkAsReadRequest):
    """Mark messages as read"""
    count = await homeowner_portal_service.mark_messages_read(payload.ids)
    return {"marked_read": count}


# Notifications
@router.get("/notifications/{homeowner_id}", response_model=List[PortalNotification])
async def list_notifications(
    homeowner_id: int,
    limit: int = Query(50, ge=1, le=200),
):
    """List notifications for a homeowner"""
    return await homeowner_portal_service.list_notifications(homeowner_id, limit)


@router.post("/notifications", response_model=PortalNotification, status_code=201)
async def create_notification(payload: PortalNotificationCreate):
    """Create a notification"""
    return await homeowner_portal_service.create_notification(payload)


@router.post("/notifications/mark-read")
async def mark_notifications_read(payload: MarkAsReadRequest):
    """Mark notifications as read"""
    count = await homeowner_portal_service.mark_notifications_read(payload.ids)
    return {"marked_read": count}


# Activity Log
@router.post("/activity", response_model=PortalActivityLog, status_code=201)
async def create_activity_log(payload: PortalActivityLogCreate):
    """Create an activity log entry"""
    return await homeowner_portal_service.create_activity_log(payload)
