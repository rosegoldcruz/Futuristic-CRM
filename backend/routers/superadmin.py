from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends

from models.superadmin import (
    TenantMetadata, TenantCreate, TenantUpdate,
    ImpersonationRequest, ImpersonationLog,
    SystemError, GlobalMetrics
)
from services import superadmin_service

router = APIRouter(tags=["superadmin"])


# Middleware to check superadmin access
async def verify_superadmin(user_id: int = Query(...)):
    """Verify user is a superadmin"""
    is_admin = await superadmin_service.is_superadmin(user_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return user_id


# Tenant Management
@router.get("/tenants")
async def list_tenants(
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin_id: int = Depends(verify_superadmin),
):
    """List all tenants"""
    return await superadmin_service.list_tenants(status, limit, offset)


@router.get("/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: int,
    admin_id: int = Depends(verify_superadmin),
):
    """Get tenant details"""
    tenant = await superadmin_service.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/tenants", status_code=201)
async def create_tenant(
    payload: TenantCreate,
    admin_id: int = Depends(verify_superadmin),
):
    """Create a new tenant"""
    tenant_id = await superadmin_service.create_tenant(
        name=payload.name,
        admin_email=payload.admin_email,
        domain=payload.domain,
        subscription_tier=payload.subscription_tier or "free",
        settings=payload.settings,
    )
    
    return {"tenant_id": tenant_id, "status": "created"}


@router.patch("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    admin_id: int = Depends(verify_superadmin),
):
    """Update tenant (placeholder - would implement full update logic)"""
    # In full implementation, would update tenant_metadata fields
    return {"status": "updated", "tenant_id": tenant_id}


@router.post("/tenants/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: int,
    reason: Optional[str] = Query(None),
    admin_id: int = Depends(verify_superadmin),
):
    """Suspend a tenant"""
    await superadmin_service.suspend_tenant(tenant_id, reason)
    return {"status": "suspended", "tenant_id": tenant_id}


@router.post("/tenants/{tenant_id}/activate")
async def activate_tenant(
    tenant_id: int,
    admin_id: int = Depends(verify_superadmin),
):
    """Activate a suspended tenant"""
    await superadmin_service.activate_tenant(tenant_id)
    return {"status": "activated", "tenant_id": tenant_id}


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: int,
    admin_id: int = Depends(verify_superadmin),
):
    """Delete a tenant (soft delete)"""
    await superadmin_service.delete_tenant(tenant_id)
    return {"status": "deleted", "tenant_id": tenant_id}


# User Impersonation
@router.post("/impersonate")
async def start_impersonation(
    payload: ImpersonationRequest,
    admin_id: int = Depends(verify_superadmin),
):
    """Start impersonating a user"""
    impersonation_id = await superadmin_service.start_impersonation(
        superadmin_id=admin_id,
        target_user_id=payload.target_user_id,
        reason=payload.reason,
    )
    
    # Generate impersonation token (in production, use JWT)
    token = f"impersonate_{impersonation_id}_{payload.target_user_id}"
    
    return {
        "impersonation_id": impersonation_id,
        "token": token,
        "target_user_id": payload.target_user_id,
        "message": "Impersonation started. Use this token for requests."
    }


@router.post("/impersonate/{impersonation_id}/end")
async def end_impersonation(
    impersonation_id: int,
    actions: Optional[List[str]] = None,
    admin_id: int = Depends(verify_superadmin),
):
    """End impersonation session"""
    await superadmin_service.end_impersonation(impersonation_id, actions)
    return {"status": "ended", "impersonation_id": impersonation_id}


@router.get("/impersonation-logs")
async def get_impersonation_logs(
    limit: int = Query(50, ge=1, le=200),
    admin_id: int = Depends(verify_superadmin),
):
    """Get impersonation logs"""
    return await superadmin_service.get_impersonation_logs(limit)


# Global Metrics
@router.get("/metrics/global", response_model=GlobalMetrics)
async def get_global_metrics(
    admin_id: int = Depends(verify_superadmin),
):
    """Get global system metrics"""
    return await superadmin_service.get_global_metrics()


@router.get("/metrics/tenant/{tenant_id}")
async def get_tenant_metrics(
    tenant_id: int,
    admin_id: int = Depends(verify_superadmin),
):
    """Get detailed tenant metrics"""
    from config.db import fetch_one
    
    # Get user count
    users_query = "SELECT COUNT(*) FROM users WHERE tenant_id = :tenant_id"
    users_row = await fetch_one(users_query, {"tenant_id": tenant_id})
    
    # Get job count
    jobs_query = "SELECT COUNT(*) FROM jobs WHERE tenant_id = :tenant_id"
    jobs_row = await fetch_one(jobs_query, {"tenant_id": tenant_id})
    
    # Get quote count
    quotes_query = "SELECT COUNT(*) FROM quotes WHERE tenant_id = :tenant_id"
    quotes_row = await fetch_one(quotes_query, {"tenant_id": tenant_id})
    
    return {
        "tenant_id": tenant_id,
        "users": users_row[0] if users_row else 0,
        "jobs": jobs_row[0] if jobs_row else 0,
        "quotes": quotes_row[0] if quotes_row else 0,
        "revenue": 0.0,
        "storage_used_gb": 0.0,
        "api_calls_30d": 0,
    }


# System Errors
@router.get("/errors")
async def get_system_errors(
    severity: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    admin_id: int = Depends(verify_superadmin),
):
    """Get system errors"""
    return await superadmin_service.get_system_errors(severity, resolved, limit)


@router.post("/errors/{error_id}/resolve")
async def resolve_error(
    error_id: int,
    admin_id: int = Depends(verify_superadmin),
):
    """Mark error as resolved"""
    await superadmin_service.resolve_error(error_id)
    return {"status": "resolved", "error_id": error_id}


@router.post("/errors/log")
async def log_error(
    error_type: str,
    error_message: str,
    severity: str = "medium",
    tenant_id: Optional[int] = None,
    admin_id: int = Depends(verify_superadmin),
):
    """Manually log a system error"""
    await superadmin_service.log_system_error(
        error_type=error_type,
        error_message=error_message,
        severity=severity,
        tenant_id=tenant_id,
    )
    return {"status": "logged"}


# System Logs
@router.get("/logs")
async def get_system_logs(
    tenant_id: Optional[int] = Query(None),
    log_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    admin_id: int = Depends(verify_superadmin),
):
    """Get system activity logs"""
    return await superadmin_service.get_system_logs(tenant_id, log_type, limit)


# System Health
@router.get("/health")
async def get_system_health(
    admin_id: int = Depends(verify_superadmin),
):
    """Get system-wide health status"""
    # Combine multiple health checks
    from services.performance_service import get_performance_metrics
    from services.security_service import log_security_event
    
    metrics = await get_performance_metrics(1)
    global_metrics = await superadmin_service.get_global_metrics()
    
    # Determine health status
    is_healthy = (
        metrics["avg_response_time_ms"] < 200 and
        global_metrics["critical_errors"] == 0
    )
    
    return {
        "status": "healthy" if is_healthy else "degraded",
        "database_status": "connected",
        "api_response_time_ms": metrics["avg_response_time_ms"],
        "error_rate": metrics["slow_percentage"] / 100,
        "active_tenants": global_metrics["active_tenants"],
        "total_requests_24h": metrics["total_requests"],
        "cache_hit_rate": 0.0,  # Would get from cache service
    }


# Superadmin Management
@router.post("/superadmin/create")
async def create_superadmin(
    email: str,
    user_id: Optional[int] = None,
    admin_id: int = Depends(verify_superadmin),
):
    """Create a new superadmin user"""
    await superadmin_service.create_superadmin(email, user_id)
    return {"status": "created", "email": email}
