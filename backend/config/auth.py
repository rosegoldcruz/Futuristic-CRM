# Filepath: /srv/vulpine-os/backend/config/auth.py
"""
Clerk Authentication Configuration and Middleware
"""
import os
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json

# Clerk configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY", "")

# Security scheme
security = HTTPBearer(auto_error=False)


class ClerkUser:
    """Represents an authenticated Clerk user"""
    def __init__(self, user_id: str, tenant_id: Optional[int] = None, email: Optional[str] = None):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.email = email


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[ClerkUser]:
    """
    Extract and validate Clerk JWT token from request.
    Returns ClerkUser with tenant_id for tenant isolation.
    
    For MVP/Development: Returns mock user if no auth configured.
    For Production: Validates Clerk JWT and syncs with Supabase users.
    """
    
    # Development mode - allow requests without auth
    if not CLERK_SECRET_KEY or CLERK_SECRET_KEY == "":
        # Return mock user for development
        return ClerkUser(
            user_id="dev_user_1",
            tenant_id=1,  # Default tenant for dev
            email="dev@example.com"
        )
    
    # Production mode - validate Clerk JWT
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = credentials.credentials
    
    try:
        # TODO: Implement full Clerk JWT validation
        # For now, this is a placeholder that should be replaced with:
        # 1. Clerk JWT verification using clerk-backend-api
        # 2. User sync to Supabase users table
        # 3. Tenant mapping from user metadata
        
        # Placeholder: Parse token and extract user info
        # In production, use Clerk SDK to verify and decode
        
        raise HTTPException(
            status_code=501,
            detail="Clerk authentication not fully implemented. Set CLERK_SECRET_KEY in .env for production."
        )
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(e)}")


async def require_auth(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
    """
    Dependency that requires authentication.
    Use this on protected routes.
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def get_tenant_id(user: ClerkUser = Depends(get_current_user)) -> Optional[int]:
    """
    Extract tenant_id from authenticated user.
    Used for tenant isolation in queries.
    """
    return user.tenant_id if user else None


def inject_tenant_context(user: ClerkUser) -> dict:
    """
    Create context dict with tenant_id for database queries.
    Use this to inject tenant isolation into all queries.
    """
    return {
        "tenant_id": user.tenant_id,
        "user_id": user.user_id,
    }
