from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class QuoteItemBase(BaseModel):
    name: str = Field(..., max_length=255)
    sku: Optional[str] = Field(None, max_length=100)
    supplier_id: Optional[int] = None
    unit_cost: float = 0.0
    quantity: float = 1.0
    notes: Optional[str] = None


class QuoteItemCreate(QuoteItemBase):
    pass


class QuoteItemUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    sku: Optional[str] = Field(None, max_length=100)
    supplier_id: Optional[int] = None
    unit_cost: Optional[float] = None
    quantity: Optional[float] = None
    notes: Optional[str] = None


class QuoteItem(QuoteItemBase):
    id: int
    quote_id: int
    line_total: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
