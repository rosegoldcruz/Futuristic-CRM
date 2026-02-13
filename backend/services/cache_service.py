"""
Caching service - query result caching with TTL
"""
from typing import Optional, Dict, Any
import json
import hashlib
from datetime import datetime, timedelta
from config.db import fetch_one, execute, execute_returning


def generate_cache_key(*args, **kwargs) -> str:
    """Generate a cache key from arguments"""
    key_parts = [str(arg) for arg in args]
    key_parts.extend([f"{k}={v}" for k, v in sorted(kwargs.items())])
    key_string = ":".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()


def generate_query_hash(query: str) -> str:
    """Generate hash for a query"""
    # Normalize query (remove whitespace variations)
    normalized = " ".join(query.split())
    return hashlib.sha256(normalized.encode()).hexdigest()


async def get_cached(cache_key: str) -> Optional[Dict[str, Any]]:
    """Get cached value if exists and not expired"""
    query = """
        SELECT cache_value, expires_at 
        FROM query_cache 
        WHERE cache_key = :cache_key AND expires_at > NOW()
    """
    
    row = await fetch_one(query, {"cache_key": cache_key})
    
    if row:
        # Update hit count and last accessed
        await execute(
            """
            UPDATE query_cache 
            SET hit_count = hit_count + 1, last_accessed_at = NOW()
            WHERE cache_key = :cache_key
            """,
            {"cache_key": cache_key}
        )
        
        # Parse JSON value
        value = row["cache_value"]
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                pass
        
        return value
    
    return None


async def set_cached(
    cache_key: str,
    value: Dict[str, Any],
    ttl_seconds: int = 300,
    query_hash: Optional[str] = None
):
    """Set a cached value with TTL"""
    expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
    
    query = """
        INSERT INTO query_cache (cache_key, cache_value, query_hash, expires_at)
        VALUES (:cache_key, CAST(:cache_value AS jsonb), :query_hash, :expires_at)
        ON CONFLICT (cache_key) 
        DO UPDATE SET 
            cache_value = CAST(:cache_value AS jsonb),
            expires_at = :expires_at,
            query_hash = :query_hash
    """
    
    await execute(query, {
        "cache_key": cache_key,
        "cache_value": json.dumps(value),
        "query_hash": query_hash,
        "expires_at": expires_at,
    })


async def invalidate_cache(cache_key: str):
    """Invalidate a specific cache entry"""
    await execute("DELETE FROM query_cache WHERE cache_key = :cache_key", {"cache_key": cache_key})


async def invalidate_cache_pattern(pattern: str):
    """Invalidate all cache entries matching a pattern"""
    await execute("DELETE FROM query_cache WHERE cache_key LIKE :pattern", {"pattern": f"%{pattern}%"})


async def clear_expired_cache():
    """Clear all expired cache entries"""
    result = await execute("DELETE FROM query_cache WHERE expires_at < NOW()")
    return result


async def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    stats_query = """
        SELECT 
            COUNT(*) as total_entries,
            SUM(hit_count) as total_hits,
            AVG(hit_count) as avg_hit_count,
            SUM(CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END) as expired_count,
            SUM(LENGTH(cache_value::text)) as size_bytes
        FROM query_cache
    """
    
    row = await fetch_one(stats_query, {})
    
    if not row:
        return {
            "total_entries": 0,
            "total_hits": 0,
            "hit_rate": 0.0,
            "avg_hit_count": 0.0,
            "expired_count": 0,
            "size_bytes": 0,
        }
    
    total_entries = row["total_entries"] or 0
    total_hits = row["total_hits"] or 0
    
    # Estimate cache hit rate (hits / (hits + entries))
    hit_rate = (total_hits / (total_hits + total_entries)) * 100 if (total_hits + total_entries) > 0 else 0.0
    
    return {
        "total_entries": total_entries,
        "total_hits": total_hits,
        "hit_rate": hit_rate,
        "avg_hit_count": float(row["avg_hit_count"] or 0),
        "expired_count": row["expired_count"] or 0,
        "size_bytes": row["size_bytes"] or 0,
    }


# Decorator for caching query results
def cached_query(ttl_seconds: int = 300):
    """Decorator to cache query results"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{func.__name__}:{generate_cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            cached_result = await get_cached(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            if result is not None:
                await set_cached(cache_key, result, ttl_seconds)
            
            return result
        
        return wrapper
    return decorator
