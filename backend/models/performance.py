"""
Performance monitoring models - caching, query tracking, API metrics
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class QueryCacheEntry(BaseModel):
    """Query cache entry"""
    id: int
    cache_key: str
    cache_value: Dict[str, Any]
    query_hash: Optional[str] = None
    hit_count: int
    expires_at: datetime
    created_at: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QueryPerformance(BaseModel):
    """Query performance log"""
    id: int
    query_text: Optional[str] = None
    query_hash: Optional[str] = None
    execution_time_ms: float
    rows_returned: Optional[int] = None
    endpoint: Optional[str] = None
    user_id: Optional[int] = None
    parameters: Optional[Dict[str, Any]] = None
    is_slow: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class APIPerformance(BaseModel):
    """API request performance"""
    id: int
    method: str
    path: str
    status_code: int
    response_time_ms: float
    request_size_bytes: Optional[int] = None
    response_size_bytes: Optional[int] = None
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_slow: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PerformanceMetrics(BaseModel):
    """Performance metrics summary"""
    avg_response_time_ms: float
    p50_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    total_requests: int
    slow_requests: int
    slow_percentage: float
    requests_per_second: float
    cache_hit_rate: float


class PerformanceSnapshot(BaseModel):
    """Performance snapshot"""
    snapshot_type: str
    metrics: Dict[str, Any]
    timestamp: datetime


class CacheStats(BaseModel):
    """Cache statistics"""
    total_entries: int
    total_hits: int
    hit_rate: float
    avg_hit_count: float
    expired_count: int
    size_bytes: int


class SlowQuery(BaseModel):
    """Slow query report"""
    query_hash: str
    query_text: str
    avg_execution_time_ms: float
    max_execution_time_ms: float
    execution_count: int
    last_executed: datetime


class PerformanceReport(BaseModel):
    """Complete performance report"""
    api_metrics: PerformanceMetrics
    cache_stats: CacheStats
    slow_queries: List[SlowQuery]
    slowest_endpoints: List[Dict[str, Any]]
    timestamp: datetime
