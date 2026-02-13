"""
Product models for supplier materials catalog
"""
from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel, Field


# Product categories
PRODUCT_CATEGORIES = ["doors", "panels", "hardware", "accessories", "finishes", "other"]

# Product status
PRODUCT_STATUSES = ["active", "discontinued", "out_of_stock", "coming_soon"]


class ProductVariant(BaseModel):
    """A product variant (style/color/finish combination)"""
    sku: str
    name: str
    style: Optional[str] = None
    color: Optional[str] = None
    finish: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    in_stock: bool = True
    lead_time_days: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None


class ProductBase(BaseModel):
    """Base product fields for create/update"""
    supplier_id: int
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    category: str = Field(default="other", max_length=50)
    sku_prefix: Optional[str] = Field(None, max_length=50)
    base_price: Optional[float] = None
    base_cost: Optional[float] = None
    unit: Optional[str] = Field(default="each", max_length=50)
    status: Optional[str] = Field(default="active", max_length=50)
    # Available options stored as JSONB
    available_styles: Optional[List[str]] = None
    available_colors: Optional[List[str]] = None
    available_finishes: Optional[List[str]] = None
    # Variants stored as JSONB array
    variants: Optional[List[ProductVariant]] = None
    # Additional metadata
    specifications: Optional[dict[str, Any]] = None
    images: Optional[List[str]] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class ProductCreate(ProductBase):
    """Create a new product"""
    tenant_id: Optional[int] = None


class ProductUpdate(BaseModel):
    """Update an existing product"""
    supplier_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    sku_prefix: Optional[str] = Field(None, max_length=50)
    base_price: Optional[float] = None
    base_cost: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=50)
    available_styles: Optional[List[str]] = None
    available_colors: Optional[List[str]] = None
    available_finishes: Optional[List[str]] = None
    variants: Optional[List[ProductVariant]] = None
    specifications: Optional[dict[str, Any]] = None
    images: Optional[List[str]] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Product(BaseModel):
    """Product response model"""
    id: int
    tenant_id: Optional[int] = None
    supplier_id: int
    supplier_name: Optional[str] = None  # Joined from suppliers table
    name: str
    description: Optional[str] = None
    category: str
    sku_prefix: Optional[str] = None
    base_price: Optional[float] = None
    base_cost: Optional[float] = None
    unit: Optional[str] = None
    status: Optional[str] = None
    available_styles: Optional[List[str]] = None
    available_colors: Optional[List[str]] = None
    available_finishes: Optional[List[str]] = None
    variants: Optional[List[ProductVariant]] = None
    specifications: Optional[dict[str, Any]] = None
    images: Optional[List[str]] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductSelection(BaseModel):
    """A product selection for a quote or job"""
    product_id: int
    product_name: Optional[str] = None
    variant_sku: Optional[str] = None
    style: Optional[str] = None
    color: Optional[str] = None
    finish: Optional[str] = None
    quantity: int = 1
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    notes: Optional[str] = None
