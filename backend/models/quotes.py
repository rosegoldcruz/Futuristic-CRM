"""
Quote models - synced with Supabase schema
"""
from typing import Optional, Any, List
from pydantic import BaseModel, Field
from datetime import datetime, date


# Quote status constants
QUOTE_STATUSES = ["draft", "pending", "sent", "approved", "rejected", "expired", "cancelled"]

# Valid status transitions
QUOTE_TRANSITIONS = {
    "draft": ["pending", "cancelled"],
    "pending": ["sent", "draft", "cancelled"],
    "sent": ["approved", "rejected", "expired", "cancelled"],
    "approved": ["cancelled"],  # Can only cancel after approval
    "rejected": ["draft"],  # Can revise and resubmit
    "expired": ["draft"],  # Can revise and resubmit
    "cancelled": [],  # Terminal state
}


def is_valid_quote_transition(current: str, new: str) -> bool:
    """Check if a status transition is valid."""
    if current == new:
        return True
    return new in QUOTE_TRANSITIONS.get(current, [])


def get_allowed_quote_transitions(current: str) -> List[str]:
    """Get list of allowed next statuses."""
    return QUOTE_TRANSITIONS.get(current, [])


class QuoteLineItem(BaseModel):
    """Line item in a quote - can be material, labor, or adjustment"""
    item_type: str = Field(default="material", description="material, labor, adjustment, discount")
    description: str
    product_id: Optional[int] = None  # Link to products table
    product_name: Optional[str] = None
    sku: Optional[str] = None
    style: Optional[str] = None
    color: Optional[str] = None
    finish: Optional[str] = None
    quantity: float = 1
    unit: Optional[str] = "each"
    unit_price: float = 0
    unit_cost: Optional[float] = None  # Cost to company
    total: float = 0
    notes: Optional[str] = None


class QuoteLaborItem(BaseModel):
    """Labor line item"""
    description: str
    hours: float = 0
    hourly_rate: float = 0
    installer_id: Optional[int] = None
    installer_name: Optional[str] = None
    total: float = 0


class QuoteCostBreakdown(BaseModel):
    """Cost breakdown for a quote"""
    materials_subtotal: float = 0
    labor_subtotal: float = 0
    adjustments_subtotal: float = 0
    discounts_subtotal: float = 0
    subtotal: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total: float = 0


class QuoteBase(BaseModel):
    """Base quote fields for create/update"""
    lead_id: Optional[int] = None
    homeowner_id: Optional[int] = None
    status: Optional[str] = "draft"
    valid_until: Optional[date] = None
    internal_notes: Optional[str] = None
    # Line items stored as JSONB
    line_items: Optional[List[dict]] = None
    labor_items: Optional[List[dict]] = None
    # Pricing
    materials_subtotal: Optional[float] = 0
    labor_subtotal: Optional[float] = 0
    adjustments_total: Optional[float] = 0
    discount_total: Optional[float] = 0
    tax_rate: Optional[float] = 0
    tax_amount: Optional[float] = 0
    total_price: Optional[float] = 0
    # Metadata
    metadata: Optional[dict[str, Any]] = None


class QuoteCreate(QuoteBase):
    """Create a new quote"""
    tenant_id: Optional[int] = None


class QuoteUpdate(BaseModel):
    """Update an existing quote"""
    tenant_id: Optional[int] = None
    lead_id: Optional[int] = None
    homeowner_id: Optional[int] = None
    status: Optional[str] = None
    valid_until: Optional[date] = None
    internal_notes: Optional[str] = None
    line_items: Optional[List[dict]] = None
    labor_items: Optional[List[dict]] = None
    materials_subtotal: Optional[float] = None
    labor_subtotal: Optional[float] = None
    adjustments_total: Optional[float] = None
    discount_total: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total_price: Optional[float] = None
    metadata: Optional[dict[str, Any]] = None


class Quote(BaseModel):
    """Quote response model - matches DB schema exactly"""
    id: int
    tenant_id: Optional[int] = None
    lead_id: Optional[int] = None
    homeowner_id: Optional[int] = None
    homeowner_name: Optional[str] = None  # Joined from homeowners
    lead_name: Optional[str] = None  # Joined from leads
    status: Optional[str] = "draft"
    valid_until: Optional[date] = None
    internal_notes: Optional[str] = None
    line_items: Optional[List[dict]] = None
    labor_items: Optional[List[dict]] = None
    materials_subtotal: Optional[float] = 0
    labor_subtotal: Optional[float] = 0
    adjustments_total: Optional[float] = 0
    discount_total: Optional[float] = 0
    tax_rate: Optional[float] = 0
    tax_amount: Optional[float] = 0
    total_price: Optional[float] = 0
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UpdateQuoteStatusRequest(BaseModel):
    """Request to update quote status"""
    status: str


class AddLineItemRequest(BaseModel):
    """Request to add a line item to a quote"""
    item_type: str = "material"
    description: str
    product_id: Optional[int] = None
    style: Optional[str] = None
    color: Optional[str] = None
    finish: Optional[str] = None
    quantity: float = 1
    unit: Optional[str] = "each"
    unit_price: float = 0
    notes: Optional[str] = None


class AddLaborItemRequest(BaseModel):
    """Request to add a labor item to a quote"""
    description: str
    hours: float
    hourly_rate: float
    installer_id: Optional[int] = None


class RecalculateRequest(BaseModel):
    """Request to recalculate quote totals"""
    tax_rate: Optional[float] = None
