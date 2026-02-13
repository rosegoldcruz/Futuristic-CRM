from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from models.notifications import (
    NotificationTemplate, NotificationTemplateCreate,
    NotificationPreference, NotificationPreferenceCreate,
    NotificationQueue,
    SendNotificationRequest, BulkNotificationRequest,
    NOTIFICATION_CHANNELS, NOTIFICATION_TYPES
)
from services import notification_service

router = APIRouter(tags=["notifications"])


# Templates
@router.post("/templates", response_model=NotificationTemplate, status_code=201)
async def create_template(payload: NotificationTemplateCreate):
    """Create a notification template"""
    return await notification_service.create_template(payload)


@router.get("/templates/{template_name}/{channel}", response_model=NotificationTemplate)
async def get_template(template_name: str, channel: str):
    """Get a template by name and channel"""
    template = await notification_service.get_template(template_name, channel)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


# Preferences
@router.post("/preferences", response_model=NotificationPreference, status_code=201)
async def set_preference(payload: NotificationPreferenceCreate):
    """Set notification preference"""
    return await notification_service.set_preference(payload)


@router.get("/preferences/{user_id}/{user_type}", response_model=List[NotificationPreference])
async def get_user_preferences(user_id: int, user_type: str):
    """Get all preferences for a user"""
    return await notification_service.get_user_preferences(user_id, user_type)


# Send Notifications
@router.post("/send")
async def send_notification(payload: SendNotificationRequest):
    """Send notification via multiple channels"""
    results = await notification_service.send_notification(payload)
    return results


@router.post("/send/bulk")
async def send_bulk_notification(payload: BulkNotificationRequest):
    """Send bulk notifications"""
    results = {"sent": 0, "failed": 0, "skipped": 0}
    
    for recipient in payload.recipients:
        request = SendNotificationRequest(
            template_name=payload.template_name,
            recipient_id=recipient["id"],
            recipient_type=recipient["type"],
            channels=payload.channels,
            variables=recipient.get("variables", {}),
        )
        
        result = await notification_service.send_notification(request)
        results["sent"] += len(result["sent"])
        results["failed"] += len(result["failed"])
        results["skipped"] += len(result["skipped"])
    
    return results


# Meta endpoints
@router.get("/channels", response_model=List[str])
async def get_channels():
    """Get list of available notification channels"""
    return NOTIFICATION_CHANNELS


@router.get("/types", response_model=List[str])
async def get_notification_types():
    """Get list of notification types"""
    return NOTIFICATION_TYPES
