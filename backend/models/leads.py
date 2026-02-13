"""
Lead models - synced with Supabase schema
"""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class LeadBase(BaseModel):
    """Base lead fields for create/update"""
    customer_name: str = Field(..., max_length=200)
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = Field(None, max_length=32)
    source: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(default="new", max_length=50)
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class LeadCreate(LeadBase):
    """Create a new lead"""
    tenant_id: Optional[int] = None


class LeadUpdate(BaseModel):
    """Update an existing lead"""
    tenant_id: Optional[int] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = Field(None, max_length=32)
    source: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=50)
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Lead(BaseModel):
    """Lead response model - matches DB schema exactly"""
    id: int
    tenant_id: Optional[int] = None
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = "new"
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
