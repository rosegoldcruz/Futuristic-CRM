# Filepath: /srv/vulpine-os/backend/models/homeowners.py
"""
Homeowner models - synced with Supabase schema
"""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


class HomeownerBase(BaseModel):
    """Base homeowner fields for create/update"""
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class HomeownerCreate(HomeownerBase):
    """Create a new homeowner"""
    tenant_id: Optional[int] = None


class HomeownerUpdate(BaseModel):
    """Update an existing homeowner"""
    tenant_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Homeowner(BaseModel):
    """Homeowner response model - matches DB schema exactly"""
    id: int
    tenant_id: Optional[int] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
