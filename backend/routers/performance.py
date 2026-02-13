from typing import List, Dict, Any
from fastapi import APIRouter, Query

from models.performance import PerformanceMetrics, CacheStats, SlowQuery, PerformanceReport
from services import performance_service, cache_service

router = APIRouter(tags=["performance"])


# Performance Metrics
@router.get("/metrics", response_model=PerformanceMetrics)
async def get_performance_metrics(
    hours: int = Query(24, ge=1, le=168, description="Time window in hours"),
):
    """Get API performance metrics"""
    metrics = await performance_service.get_performance_metrics(hours)
    
    # Add cache stats
    cache_stats = await cache_service.get_cache_stats()
    metrics["cache_hit_rate"] = cache_stats["hit_rate"]
    
    return PerformanceMetrics(**metrics)


@router.get("/report")
async def get_performance_report():
    """Get comprehensive performance report"""
    return await performance_service.get_performance_report()


# Slow Queries
@router.get("/slow-queries")
async def get_slow_queries(
    limit: int = Query(20, ge=1, le=100),
):
    """Get slowest queries"""
    return await performance_service.get_slow_queries(limit)


@router.get("/slow-endpoints")
async def get_slowest_endpoints(
    limit: int = Query(10, ge=1, le=50),
):
    """Get slowest API endpoints"""
    return await performance_service.get_slowest_endpoints(limit)


# Cache Management
@router.get("/cache/stats", response_model=CacheStats)
async def get_cache_stats():
    """Get cache statistics"""
    return await cache_service.get_cache_stats()


@router.post("/cache/clear")
async def clear_cache():
    """Clear expired cache entries"""
    result = await cache_service.clear_expired_cache()
    return {"status": "cleared", "result": str(result)}


@router.delete("/cache/{cache_key}")
async def invalidate_cache_key(cache_key: str):
    """Invalidate a specific cache key"""
    await cache_service.invalidate_cache(cache_key)
    return {"status": "invalidated", "cache_key": cache_key}


# Materialized Views
@router.post("/materialized-views/refresh")
async def refresh_materialized_views():
    """Refresh all materialized views"""
    result = await performance_service.refresh_materialized_views()
    return result


@router.get("/materialized-views/job-statistics")
async def get_job_statistics():
    """Get job statistics from materialized view"""
    from config.db import fetch_all
    
    query = """
        SELECT * FROM mv_job_statistics 
        ORDER BY date DESC 
        LIMIT 30
    """
    rows = await fetch_all(query, {})
    return rows


@router.get("/materialized-views/revenue-summary")
async def get_revenue_summary():
    """Get revenue summary from materialized view"""
    from config.db import fetch_all
    
    query = """
        SELECT * FROM mv_revenue_summary 
        ORDER BY month DESC 
        LIMIT 12
    """
    rows = await fetch_all(query, {})
    return rows


@router.get("/materialized-views/quote-conversion")
async def get_quote_conversion():
    """Get quote conversion from materialized view"""
    from config.db import fetch_all
    
    query = """
        SELECT * FROM mv_quote_conversion 
        ORDER BY week DESC 
        LIMIT 12
    """
    rows = await fetch_all(query, {})
    return rows


# Snapshots
@router.post("/snapshot")
async def create_performance_snapshot():
    """Create a performance snapshot"""
    return await performance_service.create_performance_snapshot()


# Maintenance
@router.post("/cleanup")
async def cleanup_old_data(
    days: int = Query(7, ge=1, le=90, description="Keep data newer than N days"),
):
    """Clean up old performance data"""
    return await performance_service.cleanup_old_performance_data(days)


# Health check
@router.get("/health")
async def performance_health():
    """Check performance system health"""
    metrics = await performance_service.get_performance_metrics(1)
    cache_stats = await cache_service.get_cache_stats()
    
    # Determine health
    is_healthy = (
        metrics["avg_response_time_ms"] < 200 and
        metrics["slow_percentage"] < 10
    )
    
    return {
        "status": "healthy" if is_healthy else "degraded",
        "avg_response_time_ms": metrics["avg_response_time_ms"],
        "slow_percentage": metrics["slow_percentage"],
        "cache_hit_rate": cache_stats["hit_rate"],
        "total_requests": metrics["total_requests"],
    }
