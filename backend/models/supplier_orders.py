"""
Supplier order models for material procurement and fulfillment
"""
from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel


# Order status constants
ORDER_STATUSES = ["draft", "pending", "confirmed", "shipped", "delivered", "cancelled"]

# Item status constants
ITEM_STATUSES = ["pending", "ordered", "shipped", "received", "cancelled"]


class SupplierOrderItemBase(BaseModel):
    """Base supplier order item fields"""
    product_id: Optional[int] = None
    sku: Optional[str] = None
    product_name: str
    description: Optional[str] = None
    quantity: int = 1
    unit_price: float
    total_price: Optional[float] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class SupplierOrderItemCreate(SupplierOrderItemBase):
    """Create a supplier order item"""
    supplier_order_id: Optional[int] = None


class SupplierOrderItemUpdate(BaseModel):
    """Update a supplier order item"""
    quantity: Optional[int] = None
    unit_price: Optional[float] = None
    received_quantity: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class SupplierOrderItem(SupplierOrderItemBase):
    """Supplier order item response model"""
    id: int
    supplier_order_id: int
    received_quantity: int = 0
    status: str = "pending"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupplierOrderBase(BaseModel):
    """Base supplier order fields"""
    job_id: Optional[int] = None
    work_order_id: Optional[int] = None
    supplier_id: int
    order_number: Optional[str] = None
    status: str = "draft"
    total_amount: float = 0.0
    tax_amount: float = 0.0
    shipping_cost: float = 0.0
    grand_total: Optional[float] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery_date: Optional[date] = None
    shipping_address: Optional[str] = None
    billing_address: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class SupplierOrderCreate(SupplierOrderBase):
    """Create a supplier order"""
    tenant_id: Optional[int] = None
    items: Optional[List[SupplierOrderItemCreate]] = None


class SupplierOrderUpdate(BaseModel):
    """Update a supplier order"""
    status: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class SupplierOrder(SupplierOrderBase):
    """Supplier order response model"""
    id: int
    tenant_id: Optional[int] = None
    actual_delivery_date: Optional[date] = None
    ordered_at: Optional[datetime] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    # Joined fields
    supplier_name: Optional[str] = None
    job_customer_name: Optional[str] = None

    class Config:
        from_attributes = True


class SupplierOrderWithItems(SupplierOrder):
    """Supplier order with items"""
    items: List[SupplierOrderItem] = []


class ShipmentLogBase(BaseModel):
    """Base shipment log fields"""
    supplier_order_id: int
    status: str
    location: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class ShipmentLogCreate(ShipmentLogBase):
    """Create a shipment log"""
    logged_at: Optional[datetime] = None


class ShipmentLog(ShipmentLogBase):
    """Shipment log response model"""
    id: int
    logged_at: datetime
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MaterialMapping(BaseModel):
    """Map job materials to supplier products/SKUs"""
    material_name: str
    quantity: int
    product_id: Optional[int] = None
    sku: Optional[str] = None
    supplier_id: Optional[int] = None
    unit_price: Optional[float] = None


class AutoOrderRequest(BaseModel):
    """Request to auto-generate supplier orders from job materials"""
    job_id: int
    work_order_id: Optional[int] = None
    material_mappings: List[MaterialMapping]
    shipping_address: Optional[str] = None
    notes: Optional[str] = None


class OrderStatusTransition(BaseModel):
    """Request to transition order status"""
    status: str
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery_date: Optional[date] = None
    notes: Optional[str] = None


class MaterialReceiptRequest(BaseModel):
    """Request to mark materials as received"""
    item_id: int
    received_quantity: int
    notes: Optional[str] = None
    update_work_order: bool = True
