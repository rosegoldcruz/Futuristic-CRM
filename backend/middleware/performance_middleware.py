"""
Performance tracking middleware - automatically log all API requests
"""
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from services import performance_service


class PerformanceMiddleware(BaseHTTPMiddleware):
    """Middleware to track API performance"""
    
    async def dispatch(self, request: Request, call_next):
        # Start timer
        start_time = time.time()
        
        # Get request size
        request_size = 0
        if request.headers.get("content-length"):
            try:
                request_size = int(request.headers.get("content-length"))
            except ValueError:
                pass
        
        # Process request
        response = await call_next(request)
        
        # Calculate response time
        response_time_ms = (time.time() - start_time) * 1000
        
        # Get response size
        response_size = 0
        if response.headers.get("content-length"):
            try:
                response_size = int(response.headers.get("content-length"))
            except ValueError:
                pass
        
        # Log performance (async, don't wait)
        try:
            # Extract info
            method = request.method
            path = str(request.url.path)
            status_code = response.status_code
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            
            # Skip logging for health checks and static assets
            if not path.startswith(("/health", "/static", "/favicon")):
                await performance_service.log_api_performance(
                    method=method,
                    path=path,
                    status_code=status_code,
                    response_time_ms=response_time_ms,
                    request_size_bytes=request_size,
                    response_size_bytes=response_size,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
        except Exception as e:
            # Don't let performance logging break the request
            print(f"[Performance] Error logging: {e}")
        
        # Add performance header
        response.headers["X-Response-Time"] = f"{response_time_ms:.2f}ms"
        
        return response
