"""
Authentication endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from config.auth import get_current_user, ClerkUser
from services import auth_service

router = APIRouter(tags=["auth"])


class UserSyncRequest(BaseModel):
    """Request to sync Clerk user with Supabase"""
    clerk_user_id: str
    email: str
    metadata: Optional[dict] = None


class UserResponse(BaseModel):
    """User response with tenant info"""
    id: int
    tenant_id: int
    email: str
    clerk_id: str


@router.post("/sync-user", response_model=UserResponse)
async def sync_user(payload: UserSyncRequest):
    """
    Sync Clerk user to Supabase users table.
    Called by frontend after Clerk authentication.
    """
    try:
        user = await auth_service.sync_clerk_user(
            clerk_user_id=payload.clerk_user_id,
            email=payload.email,
            metadata=payload.metadata
        )
        
        return UserResponse(
            id=user["id"],
            tenant_id=user["tenant_id"],
            email=user["email"],
            clerk_id=user["clerk_id"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync user: {str(e)}")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: ClerkUser = Depends(get_current_user)):
    """
    Get current authenticated user information.
    Returns user with tenant context.
    """
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Fetch full user record from database
    db_user = await auth_service.get_user_by_clerk_id(user.user_id)
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found in database")
    
    return UserResponse(
        id=db_user["id"],
        tenant_id=db_user["tenant_id"],
        email=db_user["email"],
        clerk_id=db_user["clerk_id"]
    )


@router.get("/health")
async def health_check():
    """Public health check endpoint (no auth required)"""
    return {"status": "ok", "service": "auth"}
