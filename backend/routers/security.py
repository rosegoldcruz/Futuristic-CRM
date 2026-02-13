from typing import List, Optional
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from config.db import fetch_all

router = APIRouter(tags=["security"])


# Security Events
@router.get("/events")
async def get_security_events(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    limit: int = Query(100, ge=1, le=500),
):
    """Get security events"""
    query = "SELECT * FROM security_events WHERE 1=1"
    params = {}
    
    if severity:
        query += " AND severity = :severity"
        params["severity"] = severity
    
    query += " ORDER BY created_at DESC LIMIT :limit"
    params["limit"] = limit
    
    rows = await fetch_all(query, params)
    return rows


@router.get("/events/summary")
async def get_security_summary(hours: int = Query(24, ge=1, le=168)):
    """Get security events summary"""
    cutoff = datetime.now() - timedelta(hours=hours)
    
    query = """
        SELECT 
            event_type,
            severity,
            COUNT(*) as count
        FROM security_events
        WHERE created_at > :cutoff
        GROUP BY event_type, severity
        ORDER BY count DESC
    """
    
    rows = await fetch_all(query, {"cutoff": cutoff})
    
    # Calculate totals
    total = sum(r[2] for r in rows)
    critical = sum(r[2] for r in rows if r[1] == "CRITICAL")
    high = sum(r[2] for r in rows if r[1] == "HIGH")
    medium = sum(r[2] for r in rows if r[1] == "MEDIUM")
    low = sum(r[2] for r in rows if r[1] == "LOW")
    
    return {
        "total_events": total,
        "by_severity": {
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
        },
        "by_type": [
            {
                "event_type": r[0],
                "severity": r[1],
                "count": r[2]
            }
            for r in rows
        ]
    }


# Rate Limits
@router.get("/rate-limits")
async def get_rate_limits(limit: int = Query(50, ge=1, le=200)):
    """Get rate limit entries"""
    query = """
        SELECT * FROM rate_limits 
        ORDER BY created_at DESC 
        LIMIT :limit
    """
    rows = await fetch_all(query, {"limit": limit})
    return rows


@router.get("/rate-limits/blocked")
async def get_blocked_ips():
    """Get currently blocked IPs"""
    query = """
        SELECT identifier, endpoint, blocked_until
        FROM rate_limits
        WHERE blocked_until > NOW()
        ORDER BY blocked_until DESC
    """
    rows = await fetch_all(query, {})
    return rows


# Audit Findings
@router.get("/audit/findings")
async def get_audit_findings(
    severity: Optional[str] = Query(None),
    is_resolved: Optional[bool] = Query(None),
):
    """Get security audit findings"""
    query = "SELECT * FROM security_audit_findings WHERE 1=1"
    params = {}
    
    if severity:
        query += " AND severity = :severity"
        params["severity"] = severity
    
    if is_resolved is not None:
        query += " AND is_resolved = :is_resolved"
        params["is_resolved"] = is_resolved
    
    query += " ORDER BY severity, created_at DESC"
    
    rows = await fetch_all(query, params)
    return rows


@router.post("/audit/findings/{finding_id}/resolve")
async def resolve_finding(finding_id: int):
    """Mark a security finding as resolved"""
    from config.db import execute
    
    await execute(
        "UPDATE security_audit_findings SET is_resolved = true, resolved_at = NOW() WHERE id = :id",
        {"id": finding_id}
    )
    
    return {"status": "resolved", "finding_id": finding_id}


# Security Health
@router.get("/health")
async def security_health():
    """Get security system health"""
    # Check recent critical events
    critical_query = """
        SELECT COUNT(*) as count
        FROM security_events
        WHERE severity = 'CRITICAL'
        AND created_at > NOW() - INTERVAL '24 hours'
    """
    critical_row = await fetch_all(critical_query, {})
    critical_count = critical_row[0][0] if critical_row else 0
    
    # Check unresolved findings
    findings_query = """
        SELECT COUNT(*) as count
        FROM security_audit_findings
        WHERE severity IN ('CRITICAL', 'HIGH')
        AND is_resolved = false
    """
    findings_row = await fetch_all(findings_query, {})
    findings_count = findings_row[0][0] if findings_row else 0
    
    # Determine health
    is_healthy = critical_count == 0 and findings_count == 0
    
    return {
        "status": "healthy" if is_healthy else "at_risk",
        "critical_events_24h": critical_count,
        "unresolved_critical_findings": findings_count,
        "rls_enabled": True,  # From audit
        "rate_limiting_active": True,
        "input_validation_active": True,
    }


# Security Configuration
@router.get("/config")
async def get_security_config():
    """Get current security configuration"""
    return {
        "rate_limiting": {
            "enabled": True,
            "requests_per_minute": 100,
            "block_duration_seconds": 60,
        },
        "input_validation": {
            "sql_injection_detection": True,
            "xss_detection": True,
            "file_upload_validation": True,
        },
        "session_security": {
            "session_timeout_hours": 24,
            "csrf_protection": True,
        },
        "password_policy": {
            "min_length": 8,
            "require_special_chars": True,
            "hashing_algorithm": "bcrypt",
        },
        "cors": {
            "allowed_origins": ["*"],  # TODO: Restrict in production
        },
    }
