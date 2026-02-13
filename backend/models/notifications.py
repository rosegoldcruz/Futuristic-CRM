"""
Notification models for multi-channel delivery (email, SMS, in-app)
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# Channel types
NOTIFICATION_CHANNELS = ["email", "sms", "in_app", "push"]

# Notification types
NOTIFICATION_TYPES = [
    "quote_ready",
    "quote_approved",
    "payment_received",
    "job_scheduled",
    "job_completed",
    "document_ready",
    "signature_required",
    "message_received",
    "system_alert",
]

# Queue status
QUEUE_STATUSES = ["pending", "sent", "failed", "cancelled"]


class NotificationTemplateBase(BaseModel):
    """Base notification template fields"""
    template_name: str
    template_type: str
    channel: str
    subject_template: Optional[str] = None
    body_template: str
    variables: Optional[List[str]] = None
    is_active: bool = True
    metadata: Optional[Dict[str, Any]] = None


class NotificationTemplateCreate(NotificationTemplateBase):
    """Create a notification template"""
    pass


class NotificationTemplate(NotificationTemplateBase):
    """Notification template response model"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationPreferenceBase(BaseModel):
    """Base notification preference fields"""
    user_id: int
    user_type: str  # "homeowner", "installer", "admin"
    channel: str
    notification_type: str
    is_enabled: bool = True
    metadata: Optional[Dict[str, Any]] = None


class NotificationPreferenceCreate(NotificationPreferenceBase):
    """Create a notification preference"""
    pass


class NotificationPreference(NotificationPreferenceBase):
    """Notification preference response model"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationQueueBase(BaseModel):
    """Base notification queue fields"""
    channel: str
    recipient: str
    subject: Optional[str] = None
    body: str
    scheduled_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class NotificationQueueCreate(NotificationQueueBase):
    """Create a queued notification"""
    notification_id: Optional[int] = None


class NotificationQueue(NotificationQueueBase):
    """Notification queue response model"""
    id: int
    notification_id: Optional[int] = None
    status: str = "pending"
    attempts: int = 0
    max_attempts: int = 3
    sent_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationDeliveryLog(BaseModel):
    """Notification delivery log"""
    id: int
    notification_id: int
    channel: str
    status: str
    recipient: Optional[str] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SendNotificationRequest(BaseModel):
    """Request to send a notification"""
    template_name: str
    recipient_id: int
    recipient_type: str  # "homeowner", "installer", "admin"
    channels: List[str]  # ["email", "sms", "in_app"]
    variables: Dict[str, Any]
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None


class NotificationFeed(BaseModel):
    """Notification feed for in-app display"""
    notifications: List[Any] = []  # Will be portal_notifications
    unread_count: int = 0
    total_count: int = 0


class BulkNotificationRequest(BaseModel):
    """Request to send bulk notifications"""
    template_name: str
    recipients: List[Dict[str, Any]]  # [{"id": 1, "type": "homeowner", "variables": {...}}]
    channels: List[str]
