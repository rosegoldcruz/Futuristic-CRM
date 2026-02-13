# Filepath: /srv/vulpine-os/backend/models/homeowner_portal.py
"""
Homeowner portal models for sessions, messages, notifications, and timeline
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel


class PortalSessionBase(BaseModel):
    """Base portal session fields"""
    homeowner_id: int
    job_id: Optional[int] = None
    session_token: str
    expires_at: datetime
    metadata: Optional[dict[str, Any]] = None


class PortalSessionCreate(PortalSessionBase):
    """Create a portal session"""
    pass


class PortalSession(PortalSessionBase):
    """Portal session response model"""
    id: int
    last_accessed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PortalMessageBase(BaseModel):
    """Base portal message fields"""
    job_id: int
    sender_type: str  # "homeowner", "admin", "installer", "system"
    sender_id: Optional[int] = None
    sender_name: str
    message_text: str
    metadata: Optional[dict[str, Any]] = None


class PortalMessageCreate(PortalMessageBase):
    """Create a portal message"""
    pass


class PortalMessage(PortalMessageBase):
    """Portal message response model"""
    id: int
    is_read: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PortalNotificationBase(BaseModel):
    """Base portal notification fields"""
    homeowner_id: int
    job_id: Optional[int] = None
    notification_type: str
    title: str
    message: str
    action_url: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class PortalNotificationCreate(PortalNotificationBase):
    """Create a portal notification"""
    pass


class PortalNotification(PortalNotificationBase):
    """Portal notification response model"""
    id: int
    is_read: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PortalActivityLogBase(BaseModel):
    """Base portal activity log fields"""
    homeowner_id: int
    job_id: Optional[int] = None
    activity_type: str
    activity_title: str
    activity_description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class PortalActivityLogCreate(PortalActivityLogBase):
    """Create a portal activity log"""
    pass


class PortalActivityLog(PortalActivityLogBase):
    """Portal activity log response model"""
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HomeownerDashboard(BaseModel):
    """Complete homeowner portal dashboard data"""
    job: Optional[dict[str, Any]] = None
    quote: Optional[dict[str, Any]] = None
    work_order: Optional[dict[str, Any]] = None
    payments: List[dict[str, Any]] = []
    documents: List[dict[str, Any]] = []
    timeline: List[dict[str, Any]] = []
    messages: List[PortalMessage] = []
    notifications: List[PortalNotification] = []
    unread_messages_count: int = 0
    unread_notifications_count: int = 0


class ProjectTimeline(BaseModel):
    """Project timeline item"""
    id: int
    event_type: str
    title: str
    description: Optional[str] = None
    status: Optional[str] = None
    created_at: datetime
    metadata: Optional[dict[str, Any]] = None


class SendMessageRequest(BaseModel):
    """Request to send a message"""
    job_id: int
    message_text: str
    sender_name: str


class MarkAsReadRequest(BaseModel):
    """Request to mark items as read"""
    ids: List[int]
