"""
Unified notification service - email, SMS, in-app delivery
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.notifications import (
    NotificationTemplate, NotificationTemplateCreate,
    NotificationPreference, NotificationPreferenceCreate,
    NotificationQueue, NotificationQueueCreate,
    NotificationDeliveryLog,
    SendNotificationRequest
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


def _row_to_template(row: Dict[str, Any]) -> NotificationTemplate:
    """Convert DB row to NotificationTemplate model"""
    return NotificationTemplate(
        id=row["id"],
        template_name=row.get("template_name"),
        template_type=row.get("template_type"),
        channel=row.get("channel"),
        subject_template=row.get("subject_template"),
        body_template=row.get("body_template"),
        variables=_parse_json_field(row.get("variables")),
        is_active=row.get("is_active", True),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_preference(row: Dict[str, Any]) -> NotificationPreference:
    """Convert DB row to NotificationPreference model"""
    return NotificationPreference(
        id=row["id"],
        user_id=row.get("user_id"),
        user_type=row.get("user_type"),
        channel=row.get("channel"),
        notification_type=row.get("notification_type"),
        is_enabled=row.get("is_enabled", True),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_queue(row: Dict[str, Any]) -> NotificationQueue:
    """Convert DB row to NotificationQueue model"""
    return NotificationQueue(
        id=row["id"],
        notification_id=row.get("notification_id"),
        channel=row.get("channel"),
        recipient=row.get("recipient"),
        subject=row.get("subject"),
        body=row.get("body"),
        status=row.get("status", "pending"),
        attempts=row.get("attempts", 0),
        max_attempts=row.get("max_attempts", 3),
        scheduled_at=row.get("scheduled_at"),
        sent_at=row.get("sent_at"),
        failed_at=row.get("failed_at"),
        error_message=row.get("error_message"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


# Templates
async def create_template(data: NotificationTemplateCreate) -> NotificationTemplate:
    """Create a notification template"""
    query = """
        INSERT INTO notification_templates (
            template_name, template_type, channel, subject_template, body_template,
            variables, is_active, metadata
        )
        VALUES (
            :template_name, :template_type, :channel, :subject_template, :body_template,
            CAST(:variables AS jsonb), :is_active, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "template_name": data.template_name,
        "template_type": data.template_type,
        "channel": data.channel,
        "subject_template": data.subject_template,
        "body_template": data.body_template,
        "variables": json.dumps(data.variables) if data.variables else "[]",
        "is_active": data.is_active,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM notification_templates WHERE id = :template_id"
    row = await fetch_one(query, {"template_id": row["id"]})
    return _row_to_template(row) if row else None  # type: ignore


async def get_template(template_name: str, channel: str) -> Optional[NotificationTemplate]:
    """Get a template by name and channel"""
    query = """
        SELECT * FROM notification_templates
        WHERE template_name = :template_name AND channel = :channel AND is_active = true
    """
    row = await fetch_one(query, {"template_name": template_name, "channel": channel})
    return _row_to_template(row) if row else None


# Preferences
async def set_preference(data: NotificationPreferenceCreate) -> NotificationPreference:
    """Set notification preference"""
    query = """
        INSERT INTO notification_preferences (
            user_id, user_type, channel, notification_type, is_enabled, metadata
        )
        VALUES (
            :user_id, :user_type, :channel, :notification_type, :is_enabled, CAST(:metadata AS jsonb)
        )
        ON CONFLICT (user_id, user_type, channel, notification_type)
        DO UPDATE SET is_enabled = :is_enabled, updated_at = NOW()
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "user_id": data.user_id,
        "user_type": data.user_type,
        "channel": data.channel,
        "notification_type": data.notification_type,
        "is_enabled": data.is_enabled,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM notification_preferences WHERE id = :pref_id"
    row = await fetch_one(query, {"pref_id": row["id"]})
    return _row_to_preference(row) if row else None  # type: ignore


async def get_user_preferences(user_id: int, user_type: str) -> List[NotificationPreference]:
    """Get all preferences for a user"""
    query = """
        SELECT * FROM notification_preferences
        WHERE user_id = :user_id AND user_type = :user_type
    """
    rows = await fetch_all(query, {"user_id": user_id, "user_type": user_type})
    return [_row_to_preference(r) for r in rows]


async def check_preference(user_id: int, user_type: str, channel: str, notification_type: str) -> bool:
    """Check if user has enabled this channel for this notification type"""
    query = """
        SELECT is_enabled FROM notification_preferences
        WHERE user_id = :user_id AND user_type = :user_type
        AND channel = :channel AND notification_type = :notification_type
    """
    row = await fetch_one(query, {
        "user_id": user_id,
        "user_type": user_type,
        "channel": channel,
        "notification_type": notification_type,
    })
    
    # Default to enabled if no preference set
    return row["is_enabled"] if row else True


# Variable Injection
def inject_variables(template: str, variables: Dict[str, Any]) -> str:
    """Inject variables into template using {{variable}} syntax"""
    result = template
    for key, value in variables.items():
        placeholder = f"{{{{{key}}}}}"
        result = result.replace(placeholder, str(value))
    return result


# Multi-Channel Delivery
async def send_notification(request: SendNotificationRequest) -> Dict[str, Any]:
    """Send notification via multiple channels"""
    results = {"sent": [], "failed": [], "skipped": []}
    
    for channel in request.channels:
        # Check user preference
        if not await check_preference(
            request.recipient_id,
            request.recipient_type,
            channel,
            request.template_name
        ):
            results["skipped"].append({
                "channel": channel,
                "reason": "user_preference_disabled"
            })
            continue
        
        # Get template
        template = await get_template(request.template_name, channel)
        if not template:
            results["failed"].append({
                "channel": channel,
                "reason": "template_not_found"
            })
            continue
        
        # Inject variables
        subject = inject_variables(template.subject_template, request.variables) if template.subject_template else None
        body = inject_variables(template.body_template, request.variables)
        
        # Get recipient contact info
        recipient_contact = await get_recipient_contact(request.recipient_id, request.recipient_type, channel)
        if not recipient_contact:
            results["failed"].append({
                "channel": channel,
                "reason": "recipient_contact_not_found"
            })
            continue
        
        # Create in-app notification if channel is in_app
        notification_id = None
        if channel == "in_app":
            notification_id = await create_in_app_notification(
                homeowner_id=request.recipient_id if request.recipient_type == "homeowner" else None,
                notification_type=template.template_type,
                title=subject or request.template_name,
                message=body,
                entity_type=request.entity_type,
                entity_id=request.entity_id,
            )
        
        # Queue for delivery
        queue_item = await queue_notification(NotificationQueueCreate(
            notification_id=notification_id,
            channel=channel,
            recipient=recipient_contact,
            subject=subject,
            body=body,
            metadata={"template": request.template_name, "variables": request.variables},
        ))
        
        # Attempt delivery
        delivery_result = await deliver_notification(queue_item)
        
        if delivery_result["success"]:
            results["sent"].append({
                "channel": channel,
                "queue_id": queue_item.id,
                "notification_id": notification_id,
            })
        else:
            results["failed"].append({
                "channel": channel,
                "error": delivery_result.get("error"),
            })
    
    return results


async def get_recipient_contact(user_id: int, user_type: str, channel: str) -> Optional[str]:
    """Get recipient contact information for a channel"""
    if user_type == "homeowner":
        table = "homeowners"
    elif user_type == "installer":
        table = "installers"
    else:
        return None
    
    if channel == "email":
        query = f"SELECT email FROM {table} WHERE id = :user_id"
        row = await fetch_one(query, {"user_id": user_id})
        return row["email"] if row and row.get("email") else None
    elif channel == "sms":
        query = f"SELECT phone FROM {table} WHERE id = :user_id"
        row = await fetch_one(query, {"user_id": user_id})
        return row["phone"] if row and row.get("phone") else None
    elif channel == "in_app":
        return str(user_id)  # For in-app, we use user_id
    
    return None


# Queue Management
async def queue_notification(data: NotificationQueueCreate) -> NotificationQueue:
    """Add notification to queue"""
    query = """
        INSERT INTO notification_queue (
            notification_id, channel, recipient, subject, body, scheduled_at, metadata
        )
        VALUES (
            :notification_id, :channel, :recipient, :subject, :body, :scheduled_at, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "notification_id": data.notification_id,
        "channel": data.channel,
        "recipient": data.recipient,
        "subject": data.subject,
        "body": data.body,
        "scheduled_at": data.scheduled_at or datetime.now(),
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM notification_queue WHERE id = :queue_id"
    row = await fetch_one(query, {"queue_id": row["id"]})
    return _row_to_queue(row) if row else None  # type: ignore


async def deliver_notification(queue_item: NotificationQueue) -> Dict[str, Any]:
    """Attempt to deliver a queued notification"""
    try:
        if queue_item.channel == "email":
            success = await send_email(queue_item.recipient, queue_item.subject, queue_item.body)
        elif queue_item.channel == "sms":
            success = await send_sms(queue_item.recipient, queue_item.body)
        elif queue_item.channel == "in_app":
            success = True  # Already created in portal_notifications
        else:
            success = False
        
        if success:
            # Mark as sent
            query = """
                UPDATE notification_queue
                SET status = 'sent', sent_at = NOW(), attempts = attempts + 1
                WHERE id = :queue_id
            """
            await execute(query, {"queue_id": queue_item.id})
            
            # Log delivery
            if queue_item.notification_id:
                await log_delivery(
                    queue_item.notification_id,
                    queue_item.channel,
                    "delivered",
                    queue_item.recipient,
                )
            
            return {"success": True}
        else:
            raise Exception("Delivery failed")
    
    except Exception as e:
        # Mark as failed
        query = """
            UPDATE notification_queue
            SET status = 'failed', failed_at = NOW(), attempts = attempts + 1, error_message = :error
            WHERE id = :queue_id
        """
        await execute(query, {"queue_id": queue_item.id, "error": str(e)})
        
        return {"success": False, "error": str(e)}


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send email (mock implementation - integrate with SendGrid/AWS SES in production)"""
    # In production:
    # import sendgrid
    # sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
    # message = Mail(from_email='noreply@aeon.solar', to_emails=to, subject=subject, html_content=body)
    # sg.send(message)
    
    print(f"📧 [MOCK] Sending email to {to}: {subject}")
    return True


async def send_sms(to: str, body: str) -> bool:
    """Send SMS (mock implementation - integrate with Twilio in production)"""
    # In production:
    # from twilio.rest import Client
    # client = Client(account_sid, auth_token)
    # client.messages.create(to=to, from_='+1234567890', body=body)
    
    print(f"📱 [MOCK] Sending SMS to {to}: {body[:50]}...")
    return True


# In-App Notifications
async def create_in_app_notification(
    homeowner_id: Optional[int],
    notification_type: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
) -> int:
    """Create in-app notification (uses existing portal_notifications table)"""
    query = """
        INSERT INTO portal_notifications (
            homeowner_id, job_id, notification_type, title, message, metadata
        )
        VALUES (
            :homeowner_id, :job_id, :notification_type, :title, :message, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "homeowner_id": homeowner_id,
        "job_id": entity_id if entity_type == "job" else None,
        "notification_type": notification_type,
        "title": title,
        "message": message,
        "metadata": json.dumps({"entity_type": entity_type, "entity_id": entity_id}),
    })
    
    return row["id"]


# Delivery Logging
async def log_delivery(
    notification_id: int,
    channel: str,
    status: str,
    recipient: Optional[str] = None,
    error: Optional[str] = None,
):
    """Log notification delivery attempt"""
    query = """
        INSERT INTO notification_delivery_log (
            notification_id, channel, status, recipient, delivered_at, error_message, metadata
        )
        VALUES (
            :notification_id, :channel, :status, :recipient, :delivered_at, :error_message, CAST(:metadata AS jsonb)
        )
    """
    
    await execute(query, {
        "notification_id": notification_id,
        "channel": channel,
        "status": status,
        "recipient": recipient,
        "delivered_at": datetime.now() if status == "delivered" else None,
        "error_message": error,
        "metadata": "{}",
    })
