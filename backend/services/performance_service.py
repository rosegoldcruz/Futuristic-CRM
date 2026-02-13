"""
Performance monitoring service - query tracking, API metrics, optimization
"""
from typing import List, Dict, Any, Optional
import json
from datetime import datetime, timedelta
from config.db import fetch_all, fetch_one, execute
from services.cache_service import generate_query_hash


SLOW_QUERY_THRESHOLD_MS = 120
SLOW_API_THRESHOLD_MS = 120


async def log_query_performance(
    query_text: str,
    execution_time_ms: float,
    rows_returned: Optional[int] = None,
    endpoint: Optional[str] = None,
    user_id: Optional[int] = None,
    parameters: Optional[Dict[str, Any]] = None,
):
    """Log query performance"""
    query_hash = generate_query_hash(query_text)
    is_slow = execution_time_ms > SLOW_QUERY_THRESHOLD_MS
    
    query = """
        INSERT INTO query_performance (
            query_text, query_hash, execution_time_ms, rows_returned,
            endpoint, user_id, parameters, is_slow
        )
        VALUES (
            :query_text, :query_hash, :execution_time_ms, :rows_returned,
            :endpoint, :user_id, CAST(:parameters AS jsonb), :is_slow
        )
    """
    
    await execute(query, {
        "query_text": query_text[:5000],  # Limit length
        "query_hash": query_hash,
        "execution_time_ms": execution_time_ms,
        "rows_returned": rows_returned,
        "endpoint": endpoint,
        "user_id": user_id,
        "parameters": json.dumps(parameters) if parameters else None,
        "is_slow": is_slow,
    })


async def log_api_performance(
    method: str,
    path: str,
    status_code: int,
    response_time_ms: float,
    request_size_bytes: Optional[int] = None,
    response_size_bytes: Optional[int] = None,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """Log API request performance"""
    is_slow = response_time_ms > SLOW_API_THRESHOLD_MS
    
    query = """
        INSERT INTO api_performance (
            method, path, status_code, response_time_ms,
            request_size_bytes, response_size_bytes,
            user_id, ip_address, user_agent, is_slow
        )
        VALUES (
            :method, :path, :status_code, :response_time_ms,
            :request_size_bytes, :response_size_bytes,
            :user_id, :ip_address, :user_agent, :is_slow
        )
    """
    
    await execute(query, {
        "method": method,
        "path": path[:500],
        "status_code": status_code,
        "response_time_ms": response_time_ms,
        "request_size_bytes": request_size_bytes,
        "response_size_bytes": response_size_bytes,
        "user_id": user_id,
        "ip_address": ip_address,
        "user_agent": user_agent[:1000] if user_agent else None,
        "is_slow": is_slow,
    })


async def get_performance_metrics(hours: int = 24) -> Dict[str, Any]:
    """Get performance metrics for the last N hours"""
    cutoff = datetime.now() - timedelta(hours=hours)
    
    query = """
        SELECT 
            AVG(response_time_ms) as avg_response_time,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms) as p50,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99,
            COUNT(*) as total_requests,
            SUM(CASE WHEN is_slow THEN 1 ELSE 0 END) as slow_requests
        FROM api_performance
        WHERE created_at > :cutoff
    """
    
    row = await fetch_one(query, {"cutoff": cutoff})
    
    if not row or row["total_requests"] == 0:
        return {
            "avg_response_time_ms": 0.0,
            "p50_response_time_ms": 0.0,
            "p95_response_time_ms": 0.0,
            "p99_response_time_ms": 0.0,
            "total_requests": 0,
            "slow_requests": 0,
            "slow_percentage": 0.0,
            "requests_per_second": 0.0,
        }
    
    total_requests = row["total_requests"]
    slow_requests = row["slow_requests"] or 0
    slow_percentage = (slow_requests / total_requests * 100) if total_requests > 0 else 0.0
    requests_per_second = total_requests / (hours * 3600)
    
    return {
        "avg_response_time_ms": float(row["avg_response_time"] or 0),
        "p50_response_time_ms": float(row["p50"] or 0),
        "p95_response_time_ms": float(row["p95"] or 0),
        "p99_response_time_ms": float(row["p99"] or 0),
        "total_requests": total_requests,
        "slow_requests": slow_requests,
        "slow_percentage": slow_percentage,
        "requests_per_second": requests_per_second,
    }


async def get_slow_queries(limit: int = 20) -> List[Dict[str, Any]]:
    """Get slowest queries"""
    query = """
        SELECT 
            query_hash,
            query_text,
            AVG(execution_time_ms) as avg_execution_time,
            MAX(execution_time_ms) as max_execution_time,
            COUNT(*) as execution_count,
            MAX(created_at) as last_executed
        FROM query_performance
        WHERE is_slow = true
        AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY query_hash, query_text
        ORDER BY avg_execution_time DESC
        LIMIT :limit
    """
    
    rows = await fetch_all(query, {"limit": limit})
    
    return [
        {
            "query_hash": r["query_hash"],
            "query_text": r["query_text"][:200] + "..." if len(r["query_text"]) > 200 else r["query_text"],
            "avg_execution_time_ms": float(r["avg_execution_time"]),
            "max_execution_time_ms": float(r["max_execution_time"]),
            "execution_count": r["execution_count"],
            "last_executed": r["last_executed"],
        }
        for r in rows
    ]


async def get_slowest_endpoints(limit: int = 10) -> List[Dict[str, Any]]:
    """Get slowest API endpoints"""
    query = """
        SELECT 
            path,
            method,
            AVG(response_time_ms) as avg_response_time,
            MAX(response_time_ms) as max_response_time,
            COUNT(*) as request_count,
            SUM(CASE WHEN is_slow THEN 1 ELSE 0 END) as slow_count
        FROM api_performance
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY path, method
        ORDER BY avg_response_time DESC
        LIMIT :limit
    """
    
    rows = await fetch_all(query, {"limit": limit})
    
    return [
        {
            "path": r["path"],
            "method": r["method"],
            "avg_response_time_ms": float(r["avg_response_time"]),
            "max_response_time_ms": float(r["max_response_time"]),
            "request_count": r["request_count"],
            "slow_count": r["slow_count"] or 0,
        }
        for r in rows
    ]


async def refresh_materialized_views():
    """Refresh all materialized views"""
    views = [
        "mv_job_statistics",
        "mv_revenue_summary",
        "mv_quote_conversion",
    ]
    
    for view in views:
        await execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}", {})
    
    return {"refreshed": views, "timestamp": datetime.now()}


async def create_performance_snapshot():
    """Create a performance snapshot"""
    metrics = await get_performance_metrics(1)  # Last hour
    
    query = """
        INSERT INTO performance_snapshots (snapshot_type, metrics)
        VALUES ('hourly', CAST(:metrics AS jsonb))
    """
    
    await execute(query, {"metrics": json.dumps(metrics)})
    
    return metrics


async def get_performance_report() -> Dict[str, Any]:
    """Get comprehensive performance report"""
    from services.cache_service import get_cache_stats
    
    api_metrics = await get_performance_metrics(24)
    cache_stats = await get_cache_stats()
    slow_queries = await get_slow_queries(10)
    slowest_endpoints = await get_slowest_endpoints(10)
    
    return {
        "api_metrics": api_metrics,
        "cache_stats": cache_stats,
        "slow_queries": slow_queries,
        "slowest_endpoints": slowest_endpoints,
        "timestamp": datetime.now(),
    }


async def cleanup_old_performance_data(days: int = 7):
    """Clean up old performance data"""
    cutoff = datetime.now() - timedelta(days=days)
    
    # Clean query performance
    await execute(
        "DELETE FROM query_performance WHERE created_at < :cutoff",
        {"cutoff": cutoff}
    )
    
    # Clean API performance
    await execute(
        "DELETE FROM api_performance WHERE created_at < :cutoff",
        {"cutoff": cutoff}
    )
    
    # Clean old snapshots
    await execute(
        "DELETE FROM performance_snapshots WHERE created_at < :cutoff",
        {"cutoff": cutoff}
    )
    
    return {"cleaned_before": cutoff}
