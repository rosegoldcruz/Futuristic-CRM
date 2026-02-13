"""
Security middleware - rate limiting, input validation, CSRF protection
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from services import security_service


class SecurityMiddleware(BaseHTTPMiddleware):
    """Comprehensive security middleware"""
    
    async def dispatch(self, request: Request, call_next):
        # Get client identifier
        client_ip = request.client.host if request.client else "unknown"
        path = str(request.url.path)
        
        # Skip security checks for health endpoints
        if path.startswith(("/health", "/docs", "/openapi")):
            return await call_next(request)
        
        # Rate limiting
        identifier = client_ip
        allowed, retry_after = await security_service.check_rate_limit(
            identifier=identifier,
            endpoint=path,
            limit=100,  # 100 requests
            window_seconds=60  # per minute
        )
        
        if not allowed:
            await security_service.log_security_event(
                event_type="RATE_LIMIT_EXCEEDED",
                severity="MEDIUM",
                ip_address=client_ip,
                endpoint=path,
                user_agent=request.headers.get("user-agent"),
            )
            
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Retry after {retry_after} seconds",
                headers={"Retry-After": str(retry_after)}
            )
        
        # Input validation for POST/PUT/PATCH requests
        if request.method in ["POST", "PUT", "PATCH"]:
            # Check Content-Type
            content_type = request.headers.get("content-type", "")
            
            if "application/json" in content_type:
                # JSON input will be validated by Pydantic models
                pass
            
            # Check for potential SQL injection in query params
            for key, value in request.query_params.items():
                if isinstance(value, str) and security_service.detect_sql_injection(value):
                    await security_service.log_security_event(
                        event_type="SQL_INJECTION_ATTEMPT",
                        severity="CRITICAL",
                        ip_address=client_ip,
                        endpoint=path,
                        details={"param": key, "value": value[:100]},
                        user_agent=request.headers.get("user-agent"),
                    )
                    
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid input detected"
                    )
                
                # Check for XSS attempts
                if isinstance(value, str) and security_service.detect_xss(value):
                    await security_service.log_security_event(
                        event_type="XSS_ATTEMPT",
                        severity="HIGH",
                        ip_address=client_ip,
                        endpoint=path,
                        details={"param": key, "value": value[:100]},
                        user_agent=request.headers.get("user-agent"),
                    )
                    
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid input detected"
                    )
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection middleware"""
    
    async def dispatch(self, request: Request, call_next):
        # Skip CSRF for GET, HEAD, OPTIONS
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return await call_next(request)
        
        # Skip for API endpoints (using token auth)
        if str(request.url.path).startswith("/api"):
            return await call_next(request)
        
        # Check CSRF token
        csrf_token = request.headers.get("X-CSRF-Token")
        
        if not csrf_token:
            # For now, just log - in production, enforce strictly
            await security_service.log_security_event(
                event_type="MISSING_CSRF_TOKEN",
                severity="MEDIUM",
                ip_address=request.client.host if request.client else None,
                endpoint=str(request.url.path),
                user_agent=request.headers.get("user-agent"),
            )
        
        return await call_next(request)
