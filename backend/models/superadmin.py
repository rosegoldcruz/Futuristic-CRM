"""
Superadmin models - multi-tenant management, system control
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# Tenant status
TENANT_STATUSES = ["active", "suspended", "trial", "churned", "deleted"]

# Error severity
ERROR_SEVERITIES = ["low", "medium", "high", "critical"]


class SuperadminUser(BaseModel):
    """Superadmin user"""
    id: int
    user_id: Optional[int] = None
    email: str
    is_active: bool = True
    permissions: Dict[str, Any] = {"all": True}
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantMetadata(BaseModel):
    """Tenant metadata and statistics"""
    id: int
    tenant_id: Optional[int] = None
    name: str
    status: str = "active"
    subscription_tier: Optional[str] = None
    subscription_status: Optional[str] = None
    user_count: int = 0
    job_count: int = 0
    mrr: float = 0.0
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    suspended_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantCreate(BaseModel):
    """Create a new tenant"""
    name: str
    domain: Optional[str] = None
    subscription_tier: Optional[str] = "free"
    admin_email: str
    admin_name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class TenantUpdate(BaseModel):
    """Update tenant"""
    name: Optional[str] = None
    status: Optional[str] = None
    subscription_tier: Optional[str] = None
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class ImpersonationLog(BaseModel):
    """User impersonation log"""
    id: int
    superadmin_id: Optional[int] = None
    target_user_id: Optional[int] = None
    target_tenant_id: Optional[int] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    actions_performed: List[str] = []

    class Config:
        from_attributes = True


class ImpersonationRequest(BaseModel):
    """Request to impersonate a user"""
    target_user_id: int
    reason: str


class SystemError(BaseModel):
    """System error record"""
    id: int
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    tenant_id: Optional[int] = None
    user_id: Optional[int] = None
    endpoint: Optional[str] = None
    request_data: Optional[Dict[str, Any]] = None
    severity: str = "medium"
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GlobalMetrics(BaseModel):
    """Global system metrics"""
    total_tenants: int
    active_tenants: int
    suspended_tenants: int
    total_users: int
    total_jobs: int
    total_revenue: float
    mrr: float
    active_subscriptions: int
    errors_24h: int
    critical_errors: int


class TenantStats(BaseModel):
    """Detailed tenant statistics"""
    tenant: TenantMetadata
    users: int
    jobs: int
    quotes: int
    revenue: float
    storage_used_gb: float
    api_calls_30d: int
    last_activity: Optional[datetime] = None


class SystemHealth(BaseModel):
    """System-wide health"""
    status: str  # healthy, degraded, critical
    database_status: str
    api_response_time_ms: float
    error_rate: float
    active_tenants: int
    total_requests_24h: int
    cache_hit_rate: float
