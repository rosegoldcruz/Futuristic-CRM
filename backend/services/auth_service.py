"""
Authentication and user synchronization service
"""
from typing import Optional, Dict, Any
from config.db import fetch_one, execute_returning
import json


async def sync_clerk_user(clerk_user_id: str, email: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Sync Clerk user to Supabase users table.
    On first login, creates user with tenant assignment.
    Returns user record with tenant_id.
    """
    
    # Check if user already exists
    existing_user = await fetch_one(
        "SELECT id, tenant_id, email, metadata FROM users WHERE clerk_id = :clerk_id",
        {"clerk_id": clerk_user_id}
    )
    
    if existing_user:
        return {
            "id": existing_user["id"],
            "tenant_id": existing_user["tenant_id"],
            "email": existing_user["email"],
            "clerk_id": clerk_user_id,
        }
    
    # Create new user on first login
    # In production, tenant_id should come from:
    # 1. Clerk user metadata (organization membership)
    # 2. Invitation token
    # 3. Default tenant assignment
    
    # For MVP: auto-assign to tenant 1 or create new tenant
    default_tenant_id = metadata.get("tenant_id", 1) if metadata else 1
    
    query = """
        INSERT INTO users (clerk_id, email, tenant_id, metadata, created_at, updated_at)
        VALUES (:clerk_id, :email, :tenant_id, CAST(:metadata AS jsonb), NOW(), NOW())
        RETURNING id, tenant_id, email
    """
    
    user = await execute_returning(query, {
        "clerk_id": clerk_user_id,
        "email": email,
        "tenant_id": default_tenant_id,
        "metadata": json.dumps(metadata or {}),
    })
    
    return {
        "id": user["id"],
        "tenant_id": user["tenant_id"],
        "email": user["email"],
        "clerk_id": clerk_user_id,
    }


async def get_user_by_clerk_id(clerk_id: str) -> Optional[Dict[str, Any]]:
    """Get user record from Supabase by Clerk ID"""
    user = await fetch_one(
        "SELECT id, tenant_id, email, metadata FROM users WHERE clerk_id = :clerk_id",
        {"clerk_id": clerk_id}
    )
    
    if not user:
        return None
    
    return {
        "id": user["id"],
        "tenant_id": user["tenant_id"],
        "email": user["email"],
        "clerk_id": clerk_id,
    }


async def update_user_tenant(user_id: int, tenant_id: int) -> bool:
    """Update user's tenant assignment"""
    from config.db import execute
    
    count = await execute(
        "UPDATE users SET tenant_id = :tenant_id, updated_at = NOW() WHERE id = :user_id",
        {"user_id": user_id, "tenant_id": tenant_id}
    )
    
    return count > 0
