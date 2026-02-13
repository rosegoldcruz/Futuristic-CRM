from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from models.supplier_orders import (
    SupplierOrder, SupplierOrderCreate, SupplierOrderUpdate, SupplierOrderWithItems,
    SupplierOrderItem, SupplierOrderItemUpdate,
    ShipmentLog, ShipmentLogCreate,
    AutoOrderRequest, OrderStatusTransition, MaterialReceiptRequest,
    ORDER_STATUSES, ITEM_STATUSES
)
from services import supplier_orders_service

router = APIRouter(tags=["supplier_orders"])


# Supplier Orders
@router.get("/", response_model=List[SupplierOrder])
async def list_supplier_orders(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    job_id: Optional[int] = Query(None, description="Filter by job"),
    supplier_id: Optional[int] = Query(None, description="Filter by supplier"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List supplier orders with optional filtering"""
    return await supplier_orders_service.list_supplier_orders(
        tenant_id=tenant_id,
        job_id=job_id,
        supplier_id=supplier_id,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.get("/statuses", response_model=List[str])
async def get_order_statuses():
    """Get list of valid order statuses"""
    return ORDER_STATUSES


@router.get("/item-statuses", response_model=List[str])
async def get_item_statuses():
    """Get list of valid item statuses"""
    return ITEM_STATUSES


@router.get("/{order_id}", response_model=SupplierOrderWithItems)
async def get_supplier_order(order_id: int):
    """Get a specific supplier order by ID with items"""
    order = await supplier_orders_service.get_supplier_order_with_items(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Supplier order not found")
    return order


@router.post("/", response_model=SupplierOrderWithItems, status_code=201)
async def create_supplier_order(payload: SupplierOrderCreate):
    """Create a new supplier order"""
    try:
        return await supplier_orders_service.create_supplier_order(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{order_id}", response_model=SupplierOrder)
async def update_supplier_order(order_id: int, payload: SupplierOrderUpdate):
    """Update an existing supplier order"""
    try:
        order = await supplier_orders_service.update_supplier_order(order_id, payload)
        if not order:
            raise HTTPException(status_code=404, detail="Supplier order not found")
        return order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{order_id}", status_code=204)
async def delete_supplier_order(order_id: int):
    """Delete a supplier order"""
    ok = await supplier_orders_service.delete_supplier_order(order_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Supplier order not found")
    return None


@router.post("/{order_id}/status", response_model=SupplierOrder)
async def transition_order_status(order_id: int, payload: OrderStatusTransition):
    """Transition order status (draft -> pending -> shipped -> delivered)"""
    try:
        update_data = SupplierOrderUpdate(
            status=payload.status,
            tracking_number=payload.tracking_number,
            carrier=payload.carrier,
            estimated_delivery_date=payload.estimated_delivery_date,
            notes=payload.notes,
        )
        order = await supplier_orders_service.update_supplier_order(order_id, update_data)
        if not order:
            raise HTTPException(status_code=404, detail="Supplier order not found")
        
        # Create shipment log
        if payload.status in ["shipped", "delivered"]:
            log_data = ShipmentLogCreate(
                supplier_order_id=order_id,
                status=payload.status,
                notes=payload.notes or f"Order {payload.status}",
            )
            await supplier_orders_service.create_shipment_log(log_data)
        
        return order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Order Items
@router.get("/{order_id}/items", response_model=List[SupplierOrderItem])
async def list_order_items(order_id: int):
    """List all items for a supplier order"""
    return await supplier_orders_service.list_order_items(order_id)


@router.patch("/items/{item_id}", response_model=SupplierOrderItem)
async def update_order_item(item_id: int, payload: SupplierOrderItemUpdate):
    """Update an order item"""
    try:
        item = await supplier_orders_service.update_order_item(item_id, payload)
        if not item:
            raise HTTPException(status_code=404, detail="Order item not found")
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/items/{item_id}/receive", response_model=SupplierOrderItem)
async def receive_materials(item_id: int, payload: MaterialReceiptRequest):
    """Mark materials as received"""
    try:
        return await supplier_orders_service.mark_materials_received(
            item_id=item_id,
            received_quantity=payload.received_quantity,
            update_work_order=payload.update_work_order,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Shipment Tracking
@router.get("/{order_id}/tracking", response_model=List[ShipmentLog])
async def get_shipment_tracking(order_id: int):
    """Get shipment tracking logs for an order"""
    return await supplier_orders_service.list_shipment_logs(order_id)


@router.post("/{order_id}/tracking", response_model=ShipmentLog, status_code=201)
async def add_shipment_log(order_id: int, payload: ShipmentLogCreate):
    """Add a shipment tracking log"""
    payload.supplier_order_id = order_id
    return await supplier_orders_service.create_shipment_log(payload)


# Auto-generation
@router.post("/auto-generate", response_model=List[SupplierOrderWithItems], status_code=201)
async def auto_generate_orders(payload: AutoOrderRequest):
    """Auto-generate supplier orders from job materials"""
    try:
        return await supplier_orders_service.auto_generate_orders_from_job(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
