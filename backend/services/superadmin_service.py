"""
Superadmin service - tenant management, impersonation, global control
"""
from typing import Optional, List, Dict, Any
import json
from datetime import datetime, timedelta
from config.db import fetch_one, fetch_all, execute, execute_returning


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


# Superadmin User Management
async def is_superadmin(user_id: int) -> bool:
    """Check if user is a superadmin"""
    query = "SELECT id FROM superadmin_users WHERE user_id = :user_id AND is_active = true"
    row = await fetch_one(query, {"user_id": user_id})
    return row is not None


async def create_superadmin(email: str, user_id: Optional[int] = None, permissions: Optional[Dict[str, Any]] = None):
    """Create a superadmin user"""
    query = """
        INSERT INTO superadmin_users (user_id, email, permissions)
        VALUES (:user_id, :email, CAST(:permissions AS jsonb))
        RETURNING id
    """
    
    await execute_returning(query, {
        "user_id": user_id,
        "email": email,
        "permissions": json.dumps(permissions or {"all": True}),
    })


# Tenant Management
async def create_tenant(
    name: str,
    admin_email: str,
    domain: Optional[str] = None,
    subscription_tier: str = "free",
    settings: Optional[Dict[str, Any]] = None
) -> int:
    """Create a new tenant"""
    # Create tenant in tenants table
    tenant_query = """
        INSERT INTO tenants (name, domain, settings, created_at)
        VALUES (:name, :domain, CAST(:settings AS jsonb), NOW())
        RETURNING id
    """
    
    tenant_row = await execute_returning(tenant_query, {
        "name": name,
        "domain": domain,
        "settings": json.dumps(settings or {}),
    })
    
    tenant_id = tenant_row["id"]
    
    # Create tenant metadata
    metadata_query = """
        INSERT INTO tenant_metadata (
            tenant_id, name, status, subscription_tier, domain, settings
        )
        VALUES (:tenant_id, :name, 'active', :tier, :domain, CAST(:settings AS jsonb))
    """
    
    await execute(metadata_query, {
        "tenant_id": tenant_id,
        "name": name,
        "tier": subscription_tier,
        "domain": domain,
        "settings": json.dumps(settings or {}),
    })
    
    # Create admin user for tenant
    user_query = """
        INSERT INTO users (tenant_id, email, role, created_at)
        VALUES (:tenant_id, :email, 'admin', NOW())
    """
    
    await execute(user_query, {
        "tenant_id": tenant_id,
        "email": admin_email,
    })
    
    return tenant_id


async def get_tenant(tenant_id: int) -> Optional[Dict[str, Any]]:
    """Get tenant details"""
    query = """
        SELECT * FROM tenant_metadata WHERE tenant_id = :tenant_id
    """
    
    row = await fetch_one(query, {"tenant_id": tenant_id})
    
    if not row:
        return None
    
    return {
        "id": row[0],
        "tenant_id": row[1],
        "name": row[2],
        "status": row[3],
        "subscription_tier": row[4],
        "subscription_status": row[5],
        "user_count": row[6],
        "job_count": row[7],
        "mrr": float(row[8]) if row[8] else 0.0,
        "domain": row[9],
        "settings": _parse_json_field(row[10]),
        "created_at": row[11],
        "suspended_at": row[12],
        "deleted_at": row[13],
    }


async def list_tenants(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """List all tenants"""
    query = "SELECT * FROM tenant_metadata WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if status:
        query += " AND status = :status"
        params["status"] = status
    
    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset
    
    rows = await fetch_all(query, params)
    
    return [
        {
            "id": r[0],
            "tenant_id": r[1],
            "name": r[2],
            "status": r[3],
            "subscription_tier": r[4],
            "subscription_status": r[5],
            "user_count": r[6],
            "job_count": r[7],
            "mrr": float(r[8]) if r[8] else 0.0,
            "domain": r[9],
            "settings": _parse_json_field(r[10]),
            "created_at": r[11],
            "suspended_at": r[12],
            "deleted_at": r[13],
        }
        for r in rows
    ]


async def suspend_tenant(tenant_id: int, reason: Optional[str] = None):
    """Suspend a tenant"""
    query = """
        UPDATE tenant_metadata
        SET status = 'suspended', suspended_at = NOW(),
            settings = settings || CAST(:reason AS jsonb)
        WHERE tenant_id = :tenant_id
    """
    
    await execute(query, {
        "tenant_id": tenant_id,
        "reason": json.dumps({"suspension_reason": reason}),
    })


async def activate_tenant(tenant_id: int):
    """Activate a suspended tenant"""
    query = """
        UPDATE tenant_metadata
        SET status = 'active', suspended_at = NULL
        WHERE tenant_id = :tenant_id
    """
    
    await execute(query, {"tenant_id": tenant_id})


async def delete_tenant(tenant_id: int):
    """Soft delete a tenant"""
    query = """
        UPDATE tenant_metadata
        SET status = 'deleted', deleted_at = NOW()
        WHERE tenant_id = :tenant_id
    """
    
    await execute(query, {"tenant_id": tenant_id})


# User Impersonation
async def start_impersonation(
    superadmin_id: int,
    target_user_id: int,
    reason: str,
    ip_address: Optional[str] = None
) -> int:
    """Start user impersonation session"""
    # Get target user's tenant
    user_query = "SELECT tenant_id FROM users WHERE id = :user_id"
    user_row = await fetch_one(user_query, {"user_id": target_user_id})
    
    target_tenant_id = user_row[0] if user_row else None
    
    # Log impersonation
    query = """
        INSERT INTO impersonation_logs (
            superadmin_id, target_user_id, target_tenant_id, reason, ip_address
        )
        VALUES (:admin_id, :user_id, :tenant_id, :reason, :ip_address)
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "admin_id": superadmin_id,
        "user_id": target_user_id,
        "tenant_id": target_tenant_id,
        "reason": reason,
        "ip_address": ip_address,
    })
    
    return row["id"]


async def end_impersonation(impersonation_id: int, actions: Optional[List[str]] = None):
    """End user impersonation session"""
    query = """
        UPDATE impersonation_logs
        SET ended_at = NOW(), actions_performed = CAST(:actions AS jsonb)
        WHERE id = :id
    """
    
    await execute(query, {
        "id": impersonation_id,
        "actions": json.dumps(actions or []),
    })


async def get_impersonation_logs(limit: int = 50) -> List[Dict[str, Any]]:
    """Get recent impersonation logs"""
    query = """
        SELECT * FROM impersonation_logs
        ORDER BY started_at DESC
        LIMIT :limit
    """
    
    rows = await fetch_all(query, {"limit": limit})
    
    return [
        {
            "id": r[0],
            "superadmin_id": r[1],
            "target_user_id": r[2],
            "target_tenant_id": r[3],
            "reason": r[4],
            "ip_address": r[5],
            "started_at": r[6],
            "ended_at": r[7],
            "actions_performed": _parse_json_field(r[8]),
        }
        for r in rows
    ]


# Global Metrics
async def get_global_metrics() -> Dict[str, Any]:
    """Get system-wide metrics"""
    # Check cache first
    cache_query = """
        SELECT metric_value FROM global_metrics_cache
        WHERE metric_key = 'global_overview' AND expires_at > NOW()
    """
    cache_row = await fetch_one(cache_query, {})
    
    if cache_row:
        return _parse_json_field(cache_row[0]) or {}
    
    # Calculate metrics
    tenants_query = """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
            SUM(user_count) as total_users,
            SUM(job_count) as total_jobs,
            SUM(mrr) as total_mrr
        FROM tenant_metadata
        WHERE status != 'deleted'
    """
    
    metrics_row = await fetch_one(tenants_query, {})
    
    # Error count
    errors_query = """
        SELECT COUNT(*) as count
        FROM system_errors
        WHERE created_at > NOW() - INTERVAL '24 hours'
    """
    errors_row = await fetch_one(errors_query, {})
    
    # Critical errors
    critical_query = """
        SELECT COUNT(*) as count
        FROM system_errors
        WHERE severity = 'critical' AND resolved = false
    """
    critical_row = await fetch_one(critical_query, {})
    
    metrics = {
        "total_tenants": metrics_row[0] if metrics_row else 0,
        "active_tenants": metrics_row[1] if metrics_row else 0,
        "suspended_tenants": metrics_row[2] if metrics_row else 0,
        "total_users": metrics_row[3] if metrics_row else 0,
        "total_jobs": metrics_row[4] if metrics_row else 0,
        "total_revenue": 0.0,  # Would calculate from payments
        "mrr": float(metrics_row[5]) if metrics_row and metrics_row[5] else 0.0,
        "active_subscriptions": 0,  # Would calculate from subscriptions
        "errors_24h": errors_row[0] if errors_row else 0,
        "critical_errors": critical_row[0] if critical_row else 0,
    }
    
    # Cache for 5 minutes
    cache_insert = """
        INSERT INTO global_metrics_cache (metric_key, metric_value, expires_at)
        VALUES ('global_overview', CAST(:value AS jsonb), NOW() + INTERVAL '5 minutes')
        ON CONFLICT (metric_key) DO UPDATE SET
            metric_value = CAST(:value AS jsonb),
            calculated_at = NOW(),
            expires_at = NOW() + INTERVAL '5 minutes'
    """
    
    await execute(cache_insert, {"value": json.dumps(metrics)})
    
    return metrics


# System Errors
async def log_system_error(
    error_type: str,
    error_message: str,
    stack_trace: Optional[str] = None,
    tenant_id: Optional[int] = None,
    user_id: Optional[int] = None,
    endpoint: Optional[str] = None,
    request_data: Optional[Dict[str, Any]] = None,
    severity: str = "medium"
):
    """Log a system error"""
    query = """
        INSERT INTO system_errors (
            error_type, error_message, stack_trace, tenant_id, user_id,
            endpoint, request_data, severity
        )
        VALUES (
            :error_type, :error_message, :stack_trace, :tenant_id, :user_id,
            :endpoint, CAST(:request_data AS jsonb), :severity
        )
    """
    
    await execute(query, {
        "error_type": error_type,
        "error_message": error_message[:1000],
        "stack_trace": stack_trace[:5000] if stack_trace else None,
        "tenant_id": tenant_id,
        "user_id": user_id,
        "endpoint": endpoint,
        "request_data": json.dumps(request_data) if request_data else None,
        "severity": severity,
    })


async def get_system_errors(
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Get system errors"""
    query = "SELECT * FROM system_errors WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if severity:
        query += " AND severity = :severity"
        params["severity"] = severity
    
    if resolved is not None:
        query += " AND resolved = :resolved"
        params["resolved"] = resolved
    
    query += " ORDER BY created_at DESC LIMIT :limit"
    params["limit"] = limit
    
    rows = await fetch_all(query, params)
    
    return [
        {
            "id": r[0],
            "error_type": r[1],
            "error_message": r[2],
            "stack_trace": r[3],
            "tenant_id": r[4],
            "user_id": r[5],
            "endpoint": r[6],
            "request_data": _parse_json_field(r[7]),
            "severity": r[8],
            "resolved": r[9],
            "resolved_at": r[10],
            "created_at": r[11],
        }
        for r in rows
    ]


async def resolve_error(error_id: int):
    """Mark an error as resolved"""
    query = """
        UPDATE system_errors
        SET resolved = true, resolved_at = NOW()
        WHERE id = :error_id
    """
    
    await execute(query, {"error_id": error_id})


# System Logs
async def get_system_logs(
    tenant_id: Optional[int] = None,
    log_type: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Get system activity logs"""
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    if log_type:
        query += " AND action = :log_type"
        params["log_type"] = log_type
    
    query += " ORDER BY created_at DESC LIMIT :limit"
    params["limit"] = limit
    
    rows = await fetch_all(query, params)
    
    return [{"id": r[0], "action": r[1], "created_at": r[2]} for r in rows if r]
