"""
Supplier models - synced with Supabase schema
"""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


class SupplierBase(BaseModel):
    """Base supplier fields for create/update"""
    company_name: str = Field(..., max_length=255)
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    supplier_type: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    internal_notes: Optional[str] = None
    is_active: Optional[bool] = True
    metadata: Optional[dict[str, Any]] = None


class SupplierCreate(SupplierBase):
    """Create a new supplier"""
    tenant_id: Optional[int] = None


class SupplierUpdate(BaseModel):
    """Update an existing supplier"""
    tenant_id: Optional[int] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    supplier_type: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    internal_notes: Optional[str] = None
    is_active: Optional[bool] = None
    metadata: Optional[dict[str, Any]] = None


class Supplier(BaseModel):
    """Supplier response model - matches DB schema exactly"""
    id: int
    tenant_id: Optional[int] = None
    company_name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    supplier_type: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    internal_notes: Optional[str] = None
    is_active: Optional[bool] = True
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
