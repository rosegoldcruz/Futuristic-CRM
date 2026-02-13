"""
Supplier ordering service - material procurement and fulfillment
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.supplier_orders import (
    SupplierOrder, SupplierOrderCreate, SupplierOrderUpdate, SupplierOrderWithItems,
    SupplierOrderItem, SupplierOrderItemCreate, SupplierOrderItemUpdate,
    ShipmentLog, ShipmentLogCreate,
    MaterialMapping, AutoOrderRequest,
    ORDER_STATUSES, ITEM_STATUSES
)


def _parse_json_field(value: Any) -> Any:
    """Parse JSON string to Python object if needed."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _row_to_order(row: Dict[str, Any]) -> SupplierOrder:
    """Convert DB row to SupplierOrder model"""
    return SupplierOrder(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        job_id=row.get("job_id"),
        work_order_id=row.get("work_order_id"),
        supplier_id=row.get("supplier_id"),
        order_number=row.get("order_number"),
        status=row.get("status", "draft"),
        total_amount=float(row.get("total_amount", 0)),
        tax_amount=float(row.get("tax_amount", 0)),
        shipping_cost=float(row.get("shipping_cost", 0)),
        grand_total=float(row.get("grand_total", 0)),
        tracking_number=row.get("tracking_number"),
        carrier=row.get("carrier"),
        estimated_delivery_date=row.get("estimated_delivery_date"),
        actual_delivery_date=row.get("actual_delivery_date"),
        shipping_address=row.get("shipping_address"),
        billing_address=row.get("billing_address"),
        notes=row.get("notes"),
        metadata=_parse_json_field(row.get("metadata")),
        ordered_at=row.get("ordered_at"),
        shipped_at=row.get("shipped_at"),
        delivered_at=row.get("delivered_at"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
        supplier_name=row.get("supplier_name"),
        job_customer_name=row.get("job_customer_name"),
    )


def _row_to_order_item(row: Dict[str, Any]) -> SupplierOrderItem:
    """Convert DB row to SupplierOrderItem model"""
    return SupplierOrderItem(
        id=row["id"],
        supplier_order_id=row.get("supplier_order_id"),
        product_id=row.get("product_id"),
        sku=row.get("sku"),
        product_name=row.get("product_name"),
        description=row.get("description"),
        quantity=row.get("quantity", 1),
        unit_price=float(row.get("unit_price", 0)),
        total_price=float(row.get("total_price", 0)),
        received_quantity=row.get("received_quantity", 0),
        status=row.get("status", "pending"),
        notes=row.get("notes"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_shipment_log(row: Dict[str, Any]) -> ShipmentLog:
    """Convert DB row to ShipmentLog model"""
    return ShipmentLog(
        id=row["id"],
        supplier_order_id=row.get("supplier_order_id"),
        status=row.get("status"),
        location=row.get("location"),
        notes=row.get("notes"),
        metadata=_parse_json_field(row.get("metadata")),
        logged_at=row.get("logged_at"),
        created_at=row.get("created_at"),
    )


def _generate_order_number() -> str:
    """Generate unique order number"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"SO-{timestamp}"


async def list_supplier_orders(
    tenant_id: Optional[int] = None,
    job_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[SupplierOrder]:
    """List supplier orders with optional filtering"""
    query = """
        SELECT so.*, s.name as supplier_name
        FROM supplier_orders so
        LEFT JOIN suppliers s ON so.supplier_id = s.id
        WHERE so.deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if tenant_id:
        query += " AND so.tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if job_id:
        query += " AND so.job_id = :job_id"
        params["job_id"] = job_id

    if supplier_id:
        query += " AND so.supplier_id = :supplier_id"
        params["supplier_id"] = supplier_id

    if status:
        query += " AND so.status = :status"
        params["status"] = status

    query += " ORDER BY so.created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_order(r) for r in rows]


async def get_supplier_order(order_id: int) -> Optional[SupplierOrder]:
    """Get a single supplier order by ID"""
    query = """
        SELECT so.*, s.name as supplier_name
        FROM supplier_orders so
        LEFT JOIN suppliers s ON so.supplier_id = s.id
        WHERE so.id = :order_id AND so.deleted_at IS NULL
    """
    row = await fetch_one(query, {"order_id": order_id})
    return _row_to_order(row) if row else None


async def get_supplier_order_with_items(order_id: int) -> Optional[SupplierOrderWithItems]:
    """Get supplier order with all items"""
    order = await get_supplier_order(order_id)
    if not order:
        return None
    
    items = await list_order_items(order_id)
    
    return SupplierOrderWithItems(
        **order.model_dump(),
        items=items
    )


async def create_supplier_order(data: SupplierOrderCreate) -> SupplierOrderWithItems:
    """Create a new supplier order"""
    if data.status and data.status not in ORDER_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(ORDER_STATUSES)}")
    
    # Validate supplier exists
    supplier_query = "SELECT id FROM suppliers WHERE id = :supplier_id AND deleted_at IS NULL"
    supplier = await fetch_one(supplier_query, {"supplier_id": data.supplier_id})
    if not supplier:
        raise ValueError(f"Supplier {data.supplier_id} not found")
    
    # Validate job if provided
    if data.job_id:
        job_query = "SELECT id FROM jobs WHERE id = :job_id AND deleted_at IS NULL"
        job = await fetch_one(job_query, {"job_id": data.job_id})
        if not job:
            raise ValueError(f"Job {data.job_id} not found")
    
    # Generate order number if not provided
    order_number = data.order_number or _generate_order_number()
    
    # Calculate grand total
    grand_total = data.total_amount + data.tax_amount + data.shipping_cost
    
    # Create order
    query = """
        INSERT INTO supplier_orders (
            tenant_id, job_id, work_order_id, supplier_id, order_number,
            status, total_amount, tax_amount, shipping_cost, grand_total,
            shipping_address, billing_address, notes, metadata
        )
        VALUES (
            :tenant_id, :job_id, :work_order_id, :supplier_id, :order_number,
            :status, :total_amount, :tax_amount, :shipping_cost, :grand_total,
            :shipping_address, :billing_address, :notes, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "job_id": data.job_id,
        "work_order_id": data.work_order_id,
        "supplier_id": data.supplier_id,
        "order_number": order_number,
        "status": data.status or "draft",
        "total_amount": data.total_amount,
        "tax_amount": data.tax_amount,
        "shipping_cost": data.shipping_cost,
        "grand_total": grand_total,
        "shipping_address": data.shipping_address,
        "billing_address": data.billing_address,
        "notes": data.notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    order_id = row["id"]
    
    # Create order items if provided
    if data.items:
        for item_data in data.items:
            item_data.supplier_order_id = order_id
            await create_order_item(item_data)
    
    return await get_supplier_order_with_items(order_id)  # type: ignore


async def update_supplier_order(order_id: int, data: SupplierOrderUpdate) -> Optional[SupplierOrder]:
    """Update an existing supplier order"""
    updates = []
    params: Dict[str, Any] = {"order_id": order_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    if "status" in payload and payload["status"] not in ORDER_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(ORDER_STATUSES)}")
    
    # Handle status transitions with timestamps
    if "status" in payload:
        status = payload["status"]
        updates.append("status = :status")
        params["status"] = status
        
        if status == "pending":
            updates.append("ordered_at = NOW()")
        elif status == "shipped":
            updates.append("shipped_at = NOW()")
        elif status == "delivered":
            updates.append("delivered_at = NOW()")
    
    field_mappings = {
        "tracking_number": "tracking_number",
        "carrier": "carrier",
        "estimated_delivery_date": "estimated_delivery_date",
        "actual_delivery_date": "actual_delivery_date",
        "notes": "notes",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    if "metadata" in payload:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(payload["metadata"]) if payload["metadata"] else "{}"

    if not updates:
        return await get_supplier_order(order_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE supplier_orders SET {set_clause}
        WHERE id = :order_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_supplier_order(order_id)


async def delete_supplier_order(order_id: int) -> bool:
    """Soft delete a supplier order"""
    query = "UPDATE supplier_orders SET deleted_at = NOW() WHERE id = :order_id AND deleted_at IS NULL"
    count = await execute(query, {"order_id": order_id})
    return count > 0


# Order Items
async def list_order_items(order_id: int) -> List[SupplierOrderItem]:
    """List all items for an order"""
    query = "SELECT * FROM supplier_order_items WHERE supplier_order_id = :order_id ORDER BY id"
    rows = await fetch_all(query, {"order_id": order_id})
    return [_row_to_order_item(r) for r in rows]


async def create_order_item(data: SupplierOrderItemCreate) -> SupplierOrderItem:
    """Create a new order item"""
    # Calculate total price
    total_price = data.total_price if data.total_price else (data.quantity * data.unit_price)
    
    query = """
        INSERT INTO supplier_order_items (
            supplier_order_id, product_id, sku, product_name, description,
            quantity, unit_price, total_price, notes, metadata
        )
        VALUES (
            :supplier_order_id, :product_id, :sku, :product_name, :description,
            :quantity, :unit_price, :total_price, :notes, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "supplier_order_id": data.supplier_order_id,
        "product_id": data.product_id,
        "sku": data.sku,
        "product_name": data.product_name,
        "description": data.description,
        "quantity": data.quantity,
        "unit_price": data.unit_price,
        "total_price": total_price,
        "notes": data.notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    # Update order total
    await _recalculate_order_total(data.supplier_order_id)  # type: ignore
    
    query = "SELECT * FROM supplier_order_items WHERE id = :item_id"
    row = await fetch_one(query, {"item_id": row["id"]})
    return _row_to_order_item(row) if row else None  # type: ignore


async def update_order_item(item_id: int, data: SupplierOrderItemUpdate) -> Optional[SupplierOrderItem]:
    """Update an order item"""
    updates = []
    params: Dict[str, Any] = {"item_id": item_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    if "status" in payload and payload["status"] not in ITEM_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(ITEM_STATUSES)}")
    
    # Recalculate total if quantity or unit_price changes
    if "quantity" in payload or "unit_price" in payload:
        # Get current values
        current_query = "SELECT quantity, unit_price FROM supplier_order_items WHERE id = :item_id"
        current = await fetch_one(current_query, {"item_id": item_id})
        if current:
            quantity = payload.get("quantity", current["quantity"])
            unit_price = payload.get("unit_price", current["unit_price"])
            total_price = quantity * unit_price
            updates.append("total_price = :total_price")
            params["total_price"] = total_price
    
    field_mappings = {
        "quantity": "quantity",
        "unit_price": "unit_price",
        "received_quantity": "received_quantity",
        "status": "status",
        "notes": "notes",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    if "metadata" in payload:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(payload["metadata"]) if payload["metadata"] else "{}"

    if not updates:
        query = "SELECT * FROM supplier_order_items WHERE id = :item_id"
        row = await fetch_one(query, {"item_id": item_id})
        return _row_to_order_item(row) if row else None

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE supplier_order_items SET {set_clause}
        WHERE id = :item_id
        RETURNING supplier_order_id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    
    # Recalculate order total
    await _recalculate_order_total(row["supplier_order_id"])
    
    query = "SELECT * FROM supplier_order_items WHERE id = :item_id"
    row = await fetch_one(query, {"item_id": item_id})
    return _row_to_order_item(row) if row else None


async def _recalculate_order_total(order_id: int):
    """Recalculate order total from items"""
    query = """
        SELECT COALESCE(SUM(total_price), 0) as total
        FROM supplier_order_items
        WHERE supplier_order_id = :order_id
    """
    row = await fetch_one(query, {"order_id": order_id})
    total = float(row["total"]) if row else 0.0
    
    # Get current tax and shipping
    order_query = "SELECT tax_amount, shipping_cost FROM supplier_orders WHERE id = :order_id"
    order = await fetch_one(order_query, {"order_id": order_id})
    if order:
        tax = float(order.get("tax_amount", 0))
        shipping = float(order.get("shipping_cost", 0))
        grand_total = total + tax + shipping
        
        update_query = """
            UPDATE supplier_orders
            SET total_amount = :total, grand_total = :grand_total, updated_at = NOW()
            WHERE id = :order_id
        """
        await execute(update_query, {
            "order_id": order_id,
            "total": total,
            "grand_total": grand_total,
        })


# Shipment Tracking
async def create_shipment_log(data: ShipmentLogCreate) -> ShipmentLog:
    """Create a shipment tracking log"""
    query = """
        INSERT INTO shipment_logs (
            supplier_order_id, status, location, notes, metadata, logged_at
        )
        VALUES (
            :supplier_order_id, :status, :location, :notes, CAST(:metadata AS jsonb), :logged_at
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "supplier_order_id": data.supplier_order_id,
        "status": data.status,
        "location": data.location,
        "notes": data.notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
        "logged_at": data.logged_at or datetime.now(),
    })
    
    query = "SELECT * FROM shipment_logs WHERE id = :log_id"
    row = await fetch_one(query, {"log_id": row["id"]})
    return _row_to_shipment_log(row) if row else None  # type: ignore


async def list_shipment_logs(order_id: int) -> List[ShipmentLog]:
    """List shipment logs for an order"""
    query = """
        SELECT * FROM shipment_logs
        WHERE supplier_order_id = :order_id
        ORDER BY logged_at DESC
    """
    rows = await fetch_all(query, {"order_id": order_id})
    return [_row_to_shipment_log(r) for r in rows]


# Auto-generation
async def auto_generate_orders_from_job(request: AutoOrderRequest) -> List[SupplierOrderWithItems]:
    """Auto-generate supplier orders from job material list"""
    # Validate job
    job_query = "SELECT id FROM jobs WHERE id = :job_id AND deleted_at IS NULL"
    job = await fetch_one(job_query, {"job_id": request.job_id})
    if not job:
        raise ValueError(f"Job {request.job_id} not found")
    
    # Group materials by supplier
    supplier_materials: Dict[int, List[MaterialMapping]] = {}
    
    for mapping in request.material_mappings:
        supplier_id = mapping.supplier_id
        if not supplier_id:
            # Try to find supplier from product_id
            if mapping.product_id:
                product_query = "SELECT supplier_id FROM products WHERE id = :product_id"
                product = await fetch_one(product_query, {"product_id": mapping.product_id})
                if product:
                    supplier_id = product["supplier_id"]
        
        if not supplier_id:
            continue  # Skip unmapped materials
        
        if supplier_id not in supplier_materials:
            supplier_materials[supplier_id] = []
        supplier_materials[supplier_id].append(mapping)
    
    # Create orders for each supplier
    orders = []
    for supplier_id, materials in supplier_materials.items():
        # Calculate total
        total_amount = sum(
            (m.unit_price or 0) * m.quantity
            for m in materials
            if m.unit_price
        )
        
        # Create order
        order_data = SupplierOrderCreate(
            job_id=request.job_id,
            work_order_id=request.work_order_id,
            supplier_id=supplier_id,
            status="draft",
            total_amount=total_amount,
            shipping_address=request.shipping_address,
            notes=request.notes,
            items=[
                SupplierOrderItemCreate(
                    product_id=m.product_id,
                    sku=m.sku,
                    product_name=m.material_name,
                    quantity=m.quantity,
                    unit_price=m.unit_price or 0,
                )
                for m in materials
            ],
        )
        
        order = await create_supplier_order(order_data)
        orders.append(order)
    
    return orders


async def mark_materials_received(item_id: int, received_quantity: int, update_work_order: bool = True) -> SupplierOrderItem:
    """Mark order items as received and optionally update work order"""
    # Update item
    item = await update_order_item(item_id, SupplierOrderItemUpdate(
        received_quantity=received_quantity,
        status="received" if received_quantity > 0 else "pending",
    ))
    
    if not item:
        raise ValueError(f"Order item {item_id} not found")
    
    # Update work order if requested
    if update_work_order and item.supplier_order_id:
        order = await get_supplier_order_with_items(item.supplier_order_id)
        if order and order.work_order_id:
            # Update work order materials (implementation depends on work order structure)
            pass
    
    return item
