"""
Settings and integrations models - system config, branding, feature flags
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel


# Setting types
SETTING_TYPES = ["string", "number", "boolean", "json", "color", "url", "file"]

# Setting categories
SETTING_CATEGORIES = [
    "general",
    "branding",
    "email",
    "sms",
    "integrations",
    "security",
    "billing",
    "features",
]

# Integration types
INTEGRATION_TYPES = [
    "payment",  # Stripe, Square
    "sms",  # Twilio, Plivo
    "email",  # SendGrid, Mailgun
    "ai",  # OpenAI, Anthropic
    "crm",  # Salesforce, HubSpot
    "calendar",  # Google Calendar, Outlook
    "storage",  # AWS S3, Google Cloud Storage
    "analytics",  # Google Analytics, Mixpanel
    "custom",  # Qwikkit, custom webhooks
]

# Integration status
INTEGRATION_STATUSES = ["inactive", "active", "error", "testing"]


class SystemSettingBase(BaseModel):
    """Base system setting fields"""
    setting_key: str
    setting_value: Optional[str] = None
    setting_type: str = "string"
    is_encrypted: bool = False
    is_public: bool = False
    category: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SystemSettingCreate(SystemSettingBase):
    """Create a system setting"""
    tenant_id: Optional[int] = None


class SystemSettingUpdate(BaseModel):
    """Update a system setting"""
    setting_value: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SystemSetting(SystemSettingBase):
    """System setting response model"""
    id: int
    tenant_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IntegrationBase(BaseModel):
    """Base integration fields"""
    integration_key: str
    integration_name: str
    integration_type: str
    status: str = "inactive"
    credentials: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
    is_active: bool = False
    metadata: Optional[Dict[str, Any]] = None


class IntegrationCreate(IntegrationBase):
    """Create an integration"""
    tenant_id: Optional[int] = None


class IntegrationUpdate(BaseModel):
    """Update an integration"""
    status: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class Integration(IntegrationBase):
    """Integration response model"""
    id: int
    tenant_id: Optional[int] = None
    last_sync_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeatureFlagBase(BaseModel):
    """Base feature flag fields"""
    flag_key: str
    flag_name: str
    is_enabled: bool = False
    rollout_percentage: int = 0
    conditions: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class FeatureFlagCreate(FeatureFlagBase):
    """Create a feature flag"""
    tenant_id: Optional[int] = None


class FeatureFlagUpdate(BaseModel):
    """Update a feature flag"""
    is_enabled: Optional[bool] = None
    rollout_percentage: Optional[int] = None
    conditions: Optional[Dict[str, Any]] = None


class FeatureFlag(FeatureFlagBase):
    """Feature flag response model"""
    id: int
    tenant_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SettingsAuditLog(BaseModel):
    """Settings audit log entry"""
    id: int
    tenant_id: Optional[int] = None
    setting_key: Optional[str] = None
    action: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[int] = None
    changed_by_name: Optional[str] = None
    ip_address: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BrandingSettings(BaseModel):
    """Branding settings group"""
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = "#3b82f6"
    secondary_color: Optional[str] = "#10b981"
    accent_color: Optional[str] = "#f59e0b"
    font_family: Optional[str] = "Inter"
    custom_css: Optional[str] = None


class EmailSettings(BaseModel):
    """Email settings group"""
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    use_tls: bool = True


class TestIntegrationRequest(BaseModel):
    """Request to test an integration"""
    integration_key: str
    credentials: Optional[Dict[str, Any]] = None


class BulkSettingsUpdate(BaseModel):
    """Bulk update multiple settings"""
    settings: Dict[str, str]
    category: Optional[str] = None
