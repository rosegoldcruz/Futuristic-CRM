"""
Quotes service - synced with Supabase schema
Enhanced with line items, materials, labor, and cost calculations
"""
from typing import List, Optional, Dict, Any
import json
from decimal import Decimal, ROUND_HALF_UP
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.quotes import (
    Quote, QuoteCreate, QuoteUpdate, QuoteLineItem, QuoteLaborItem,
    QuoteCostBreakdown, QUOTE_STATUSES, is_valid_quote_transition
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


def _to_float(value: Any, default: float = 0) -> float:
    """Safely convert value to float."""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _row_to_quote(row: Dict[str, Any]) -> Quote:
    """Convert DB row to Quote model"""
    return Quote(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        lead_id=row.get("lead_id"),
        homeowner_id=row.get("homeowner_id"),
        homeowner_name=row.get("homeowner_name"),
        lead_name=row.get("lead_name"),
        status=row.get("status", "draft"),
        valid_until=row.get("valid_until"),
        internal_notes=row.get("internal_notes"),
        line_items=_parse_json_field(row.get("line_items")),
        labor_items=_parse_json_field(row.get("labor_items")),
        materials_subtotal=_to_float(row.get("materials_subtotal")),
        labor_subtotal=_to_float(row.get("labor_subtotal")),
        adjustments_total=_to_float(row.get("adjustments_total")),
        discount_total=_to_float(row.get("discount_total")),
        tax_rate=_to_float(row.get("tax_rate")),
        tax_amount=_to_float(row.get("tax_amount")),
        total_price=_to_float(row.get("total_price")),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_quotes(
    search: Optional[str] = None,
    status: Optional[str] = None,
    homeowner_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Quote]:
    query = """
        SELECT q.id, q.tenant_id, q.lead_id, q.homeowner_id, q.status, q.total_price,
               q.valid_until, q.internal_notes, q.line_items, q.labor_items,
               q.materials_subtotal, q.labor_subtotal, q.adjustments_total,
               q.discount_total, q.tax_rate, q.tax_amount, q.metadata,
               q.created_at, q.updated_at, q.deleted_at,
               CONCAT(h.first_name, ' ', h.last_name) as homeowner_name,
               l.customer_name as lead_name
        FROM quotes q
        LEFT JOIN homeowners h ON q.homeowner_id = h.id
        LEFT JOIN leads l ON q.lead_id = l.id
        WHERE q.deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if status:
        query += " AND q.status = :status"
        params["status"] = status

    if homeowner_id:
        query += " AND q.homeowner_id = :homeowner_id"
        params["homeowner_id"] = homeowner_id

    if lead_id:
        query += " AND q.lead_id = :lead_id"
        params["lead_id"] = lead_id

    if search:
        query += " AND (q.internal_notes ILIKE :search OR h.first_name ILIKE :search OR h.last_name ILIKE :search OR l.customer_name ILIKE :search)"
        params["search"] = f"%{search}%"

    query += " ORDER BY q.created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_quote(r) for r in rows]


async def get_quote(quote_id: int) -> Optional[Quote]:
    query = """
        SELECT q.id, q.tenant_id, q.lead_id, q.homeowner_id, q.status, q.total_price,
               q.valid_until, q.internal_notes, q.line_items, q.labor_items,
               q.materials_subtotal, q.labor_subtotal, q.adjustments_total,
               q.discount_total, q.tax_rate, q.tax_amount, q.metadata,
               q.created_at, q.updated_at, q.deleted_at,
               CONCAT(h.first_name, ' ', h.last_name) as homeowner_name,
               l.customer_name as lead_name
        FROM quotes q
        LEFT JOIN homeowners h ON q.homeowner_id = h.id
        LEFT JOIN leads l ON q.lead_id = l.id
        WHERE q.id = :quote_id AND q.deleted_at IS NULL
    """
    row = await fetch_one(query, {"quote_id": quote_id})
    return _row_to_quote(row) if row else None


async def create_quote(data: QuoteCreate) -> Quote:
    query = """
        INSERT INTO quotes (tenant_id, lead_id, homeowner_id, status, total_price, 
                           valid_until, internal_notes, line_items, labor_items,
                           materials_subtotal, labor_subtotal, adjustments_total,
                           discount_total, tax_rate, tax_amount, metadata)
        VALUES (:tenant_id, :lead_id, :homeowner_id, :status, :total_price, 
                :valid_until, :internal_notes, CAST(:line_items AS jsonb), CAST(:labor_items AS jsonb),
                :materials_subtotal, :labor_subtotal, :adjustments_total,
                :discount_total, :tax_rate, :tax_amount, CAST(:metadata AS jsonb))
        RETURNING id
    """
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "lead_id": data.lead_id,
        "homeowner_id": data.homeowner_id,
        "status": data.status or "draft",
        "total_price": data.total_price or 0,
        "valid_until": data.valid_until,
        "internal_notes": data.internal_notes,
        "line_items": json.dumps(data.line_items) if data.line_items else "[]",
        "labor_items": json.dumps(data.labor_items) if data.labor_items else "[]",
        "materials_subtotal": data.materials_subtotal or 0,
        "labor_subtotal": data.labor_subtotal or 0,
        "adjustments_total": data.adjustments_total or 0,
        "discount_total": data.discount_total or 0,
        "tax_rate": data.tax_rate or 0,
        "tax_amount": data.tax_amount or 0,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    # Fetch with joins
    return await get_quote(row["id"])  # type: ignore


async def update_quote(quote_id: int, data: QuoteUpdate) -> Optional[Quote]:
    updates = []
    params: Dict[str, Any] = {"quote_id": quote_id}
    
    field_mappings = {
        "status": "status",
        "total_price": "total_price",
        "internal_notes": "internal_notes",
        "valid_until": "valid_until",
        "materials_subtotal": "materials_subtotal",
        "labor_subtotal": "labor_subtotal",
        "adjustments_total": "adjustments_total",
        "discount_total": "discount_total",
        "tax_rate": "tax_rate",
        "tax_amount": "tax_amount",
        "lead_id": "lead_id",
        "homeowner_id": "homeowner_id",
    }
    
    payload = data.model_dump(exclude_unset=True)
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    if "line_items" in payload:
        updates.append("line_items = CAST(:line_items AS jsonb)")
        params["line_items"] = json.dumps(payload["line_items"]) if payload["line_items"] else "[]"
    
    if "labor_items" in payload:
        updates.append("labor_items = CAST(:labor_items AS jsonb)")
        params["labor_items"] = json.dumps(payload["labor_items"]) if payload["labor_items"] else "[]"
    
    if "metadata" in payload:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(payload["metadata"]) if payload["metadata"] else "{}"

    if not updates:
        return await get_quote(quote_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE quotes SET {set_clause}
        WHERE id = :quote_id AND deleted_at IS NULL
        RETURNING id
    """
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_quote(quote_id)


async def delete_quote(quote_id: int) -> bool:
    query = "UPDATE quotes SET deleted_at = NOW() WHERE id = :quote_id AND deleted_at IS NULL"
    count = await execute(query, {"quote_id": quote_id})
    return count > 0


async def update_quote_status(quote_id: int, new_status: str) -> Optional[Quote]:
    """Update quote status with transition validation."""
    if new_status not in QUOTE_STATUSES:
        raise ValueError(f"Invalid status: {new_status}. Must be one of: {', '.join(QUOTE_STATUSES)}")
    
    quote = await get_quote(quote_id)
    if not quote:
        return None
    
    current_status = quote.status or "draft"
    
    if not is_valid_quote_transition(current_status, new_status):
        raise ValueError(f"Invalid status transition from '{current_status}' to '{new_status}'")
    
    query = """
        UPDATE quotes SET status = :status, updated_at = NOW()
        WHERE id = :quote_id AND deleted_at IS NULL
        RETURNING id
    """
    row = await execute_returning(query, {"quote_id": quote_id, "status": new_status})
    if not row:
        return None
    return await get_quote(quote_id)


def calculate_line_item_total(item: Dict[str, Any]) -> float:
    """Calculate total for a single line item."""
    quantity = _to_float(item.get("quantity", 1))
    unit_price = _to_float(item.get("unit_price", 0))
    return round(quantity * unit_price, 2)


def calculate_labor_item_total(item: Dict[str, Any]) -> float:
    """Calculate total for a single labor item."""
    hours = _to_float(item.get("hours", 0))
    hourly_rate = _to_float(item.get("hourly_rate", 0))
    return round(hours * hourly_rate, 2)


def calculate_quote_totals(
    line_items: List[Dict[str, Any]],
    labor_items: List[Dict[str, Any]],
    tax_rate: float = 0
) -> QuoteCostBreakdown:
    """Calculate all quote totals from line items and labor."""
    materials_subtotal = 0.0
    adjustments_subtotal = 0.0
    discounts_subtotal = 0.0
    
    for item in line_items:
        item_type = item.get("item_type", "material")
        total = calculate_line_item_total(item)
        
        if item_type == "material":
            materials_subtotal += total
        elif item_type == "adjustment":
            adjustments_subtotal += total
        elif item_type == "discount":
            discounts_subtotal += total
    
    labor_subtotal = 0.0
    for item in labor_items:
        labor_subtotal += calculate_labor_item_total(item)
    
    subtotal = materials_subtotal + labor_subtotal + adjustments_subtotal - discounts_subtotal
    tax_amount = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax_amount, 2)
    
    return QuoteCostBreakdown(
        materials_subtotal=round(materials_subtotal, 2),
        labor_subtotal=round(labor_subtotal, 2),
        adjustments_subtotal=round(adjustments_subtotal, 2),
        discounts_subtotal=round(discounts_subtotal, 2),
        subtotal=round(subtotal, 2),
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total=total,
    )


async def recalculate_quote(quote_id: int, tax_rate: Optional[float] = None) -> Optional[Quote]:
    """Recalculate all quote totals from line items and labor items."""
    quote = await get_quote(quote_id)
    if not quote:
        return None
    
    line_items = quote.line_items or []
    labor_items = quote.labor_items or []
    
    # Use provided tax rate or existing
    effective_tax_rate = tax_rate if tax_rate is not None else (quote.tax_rate or 0)
    
    # Update line item totals
    for item in line_items:
        item["total"] = calculate_line_item_total(item)
    
    # Update labor item totals
    for item in labor_items:
        item["total"] = calculate_labor_item_total(item)
    
    # Calculate overall totals
    breakdown = calculate_quote_totals(line_items, labor_items, effective_tax_rate)
    
    # Update quote
    query = """
        UPDATE quotes SET 
            line_items = CAST(:line_items AS jsonb),
            labor_items = CAST(:labor_items AS jsonb),
            materials_subtotal = :materials_subtotal,
            labor_subtotal = :labor_subtotal,
            adjustments_total = :adjustments_total,
            discount_total = :discount_total,
            tax_rate = :tax_rate,
            tax_amount = :tax_amount,
            total_price = :total_price,
            updated_at = NOW()
        WHERE id = :quote_id AND deleted_at IS NULL
        RETURNING id
    """
    row = await execute_returning(query, {
        "quote_id": quote_id,
        "line_items": json.dumps(line_items),
        "labor_items": json.dumps(labor_items),
        "materials_subtotal": breakdown.materials_subtotal,
        "labor_subtotal": breakdown.labor_subtotal,
        "adjustments_total": breakdown.adjustments_subtotal,
        "discount_total": breakdown.discounts_subtotal,
        "tax_rate": breakdown.tax_rate,
        "tax_amount": breakdown.tax_amount,
        "total_price": breakdown.total,
    })
    if not row:
        return None
    return await get_quote(quote_id)


async def add_line_item(quote_id: int, item: Dict[str, Any]) -> Optional[Quote]:
    """Add a line item to a quote and recalculate totals."""
    quote = await get_quote(quote_id)
    if not quote:
        return None
    
    # Validate product exists if product_id provided
    if item.get("product_id"):
        from services import products_service
        product = await products_service.get_product(item["product_id"])
        if product:
            item["product_name"] = product.name
            item["sku"] = product.sku_prefix
            if not item.get("unit_price") and product.base_price:
                item["unit_price"] = product.base_price
            if not item.get("unit") and product.unit:
                item["unit"] = product.unit
    
    # Calculate item total
    item["total"] = calculate_line_item_total(item)
    
    # Add to line items
    line_items = quote.line_items or []
    line_items.append(item)
    
    # Update and recalculate
    query = """
        UPDATE quotes SET line_items = CAST(:line_items AS jsonb), updated_at = NOW()
        WHERE id = :quote_id AND deleted_at IS NULL
    """
    await execute(query, {"quote_id": quote_id, "line_items": json.dumps(line_items)})
    
    return await recalculate_quote(quote_id)


async def add_labor_item(quote_id: int, item: Dict[str, Any]) -> Optional[Quote]:
    """Add a labor item to a quote and recalculate totals."""
    quote = await get_quote(quote_id)
    if not quote:
        return None
    
    # Get installer name if installer_id provided
    if item.get("installer_id"):
        from services import installers_service
        installer = await installers_service.get_installer(item["installer_id"])
        if installer:
            item["installer_name"] = f"{installer.first_name} {installer.last_name}"
            if not item.get("hourly_rate") and installer.base_hourly_rate:
                item["hourly_rate"] = installer.base_hourly_rate
    
    # Calculate item total
    item["total"] = calculate_labor_item_total(item)
    
    # Add to labor items
    labor_items = quote.labor_items or []
    labor_items.append(item)
    
    # Update and recalculate
    query = """
        UPDATE quotes SET labor_items = CAST(:labor_items AS jsonb), updated_at = NOW()
        WHERE id = :quote_id AND deleted_at IS NULL
    """
    await execute(query, {"quote_id": quote_id, "labor_items": json.dumps(labor_items)})
    
    return await recalculate_quote(quote_id)


async def remove_line_item(quote_id: int, item_index: int) -> Optional[Quote]:
    """Remove a line item from a quote by index."""
    quote = await get_quote(quote_id)
    if not quote:
        return None
    
    line_items = quote.line_items or []
    if 0 <= item_index < len(line_items):
        line_items.pop(item_index)
        
        query = """
            UPDATE quotes SET line_items = CAST(:line_items AS jsonb), updated_at = NOW()
            WHERE id = :quote_id AND deleted_at IS NULL
        """
        await execute(query, {"quote_id": quote_id, "line_items": json.dumps(line_items)})
    
    return await recalculate_quote(quote_id)


async def remove_labor_item(quote_id: int, item_index: int) -> Optional[Quote]:
    """Remove a labor item from a quote by index."""
    quote = await get_quote(quote_id)
    if not quote:
        return None
    
    labor_items = quote.labor_items or []
    if 0 <= item_index < len(labor_items):
        labor_items.pop(item_index)
        
        query = """
            UPDATE quotes SET labor_items = CAST(:labor_items AS jsonb), updated_at = NOW()
            WHERE id = :quote_id AND deleted_at IS NULL
        """
        await execute(query, {"quote_id": quote_id, "labor_items": json.dumps(labor_items)})
    
    return await recalculate_quote(quote_id)
