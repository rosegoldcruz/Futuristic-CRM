"""
Products service for supplier materials catalog
"""
from typing import List, Optional, Dict, Any
import json
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.products import Product, ProductCreate, ProductUpdate, ProductVariant


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


def _parse_variants(value: Any) -> Optional[List[ProductVariant]]:
    """Parse variants JSONB to list of ProductVariant."""
    parsed = _parse_json_field(value)
    if not parsed or not isinstance(parsed, list):
        return None
    return [ProductVariant(**v) if isinstance(v, dict) else v for v in parsed]


def _row_to_product(row: Dict[str, Any]) -> Product:
    """Convert DB row to Product model"""
    return Product(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        supplier_id=row["supplier_id"],
        supplier_name=row.get("supplier_name"),
        name=row["name"],
        description=row.get("description"),
        category=row.get("category", "other"),
        sku_prefix=row.get("sku_prefix"),
        base_price=float(row["base_price"]) if row.get("base_price") else None,
        base_cost=float(row["base_cost"]) if row.get("base_cost") else None,
        unit=row.get("unit"),
        status=row.get("status"),
        available_styles=_parse_json_field(row.get("available_styles")),
        available_colors=_parse_json_field(row.get("available_colors")),
        available_finishes=_parse_json_field(row.get("available_finishes")),
        variants=_parse_variants(row.get("variants")),
        specifications=_parse_json_field(row.get("specifications")),
        images=_parse_json_field(row.get("images")),
        internal_notes=row.get("internal_notes"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_products(
    tenant_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    style: Optional[str] = None,
    color: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Product]:
    """List products with optional filters."""
    query = """
        SELECT p.id, p.tenant_id, p.supplier_id, s.name as supplier_name,
               p.name, p.description, p.category, p.sku_prefix,
               p.base_price, p.base_cost, p.unit, p.status,
               p.available_styles, p.available_colors, p.available_finishes,
               p.variants, p.specifications, p.images,
               p.internal_notes, p.metadata, p.created_at, p.updated_at, p.deleted_at
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if tenant_id is not None:
        query += " AND p.tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if supplier_id is not None:
        query += " AND p.supplier_id = :supplier_id"
        params["supplier_id"] = supplier_id

    if category:
        query += " AND p.category = :category"
        params["category"] = category

    if status:
        query += " AND p.status = :status"
        params["status"] = status

    if style:
        query += " AND p.available_styles @> :style::jsonb"
        params["style"] = json.dumps([style])

    if color:
        query += " AND p.available_colors @> :color::jsonb"
        params["color"] = json.dumps([color])

    if search:
        query += " AND (p.name ILIKE :search OR p.description ILIKE :search OR p.sku_prefix ILIKE :search)"
        params["search"] = f"%{search}%"

    query += " ORDER BY p.category, p.name LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_product(r) for r in rows]


async def get_product(product_id: int) -> Optional[Product]:
    """Get a single product by ID."""
    query = """
        SELECT p.id, p.tenant_id, p.supplier_id, s.name as supplier_name,
               p.name, p.description, p.category, p.sku_prefix,
               p.base_price, p.base_cost, p.unit, p.status,
               p.available_styles, p.available_colors, p.available_finishes,
               p.variants, p.specifications, p.images,
               p.internal_notes, p.metadata, p.created_at, p.updated_at, p.deleted_at
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = :product_id AND p.deleted_at IS NULL
    """
    row = await fetch_one(query, {"product_id": product_id})
    return _row_to_product(row) if row else None


async def create_product(data: ProductCreate) -> Product:
    """Create a new product."""
    query = """
        INSERT INTO products (
            tenant_id, supplier_id, name, description, category, sku_prefix,
            base_price, base_cost, unit, status,
            available_styles, available_colors, available_finishes,
            variants, specifications, images, internal_notes, metadata
        ) VALUES (
            :tenant_id, :supplier_id, :name, :description, :category, :sku_prefix,
            :base_price, :base_cost, :unit, :status,
            CAST(:available_styles AS jsonb), CAST(:available_colors AS jsonb), 
            CAST(:available_finishes AS jsonb), CAST(:variants AS jsonb),
            CAST(:specifications AS jsonb), CAST(:images AS jsonb),
            :internal_notes, CAST(:metadata AS jsonb)
        )
        RETURNING id, tenant_id, supplier_id, name, description, category, sku_prefix,
            base_price, base_cost, unit, status,
            available_styles, available_colors, available_finishes,
            variants, specifications, images, internal_notes, metadata,
            created_at, updated_at, deleted_at
    """
    
    variants_json = None
    if data.variants:
        variants_json = json.dumps([v.model_dump() for v in data.variants])
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "supplier_id": data.supplier_id,
        "name": data.name,
        "description": data.description,
        "category": data.category or "other",
        "sku_prefix": data.sku_prefix,
        "base_price": data.base_price,
        "base_cost": data.base_cost,
        "unit": data.unit or "each",
        "status": data.status or "active",
        "available_styles": json.dumps(data.available_styles) if data.available_styles else "[]",
        "available_colors": json.dumps(data.available_colors) if data.available_colors else "[]",
        "available_finishes": json.dumps(data.available_finishes) if data.available_finishes else "[]",
        "variants": variants_json or "[]",
        "specifications": json.dumps(data.specifications) if data.specifications else "{}",
        "images": json.dumps(data.images) if data.images else "[]",
        "internal_notes": data.internal_notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    # Fetch with supplier name
    return await get_product(row["id"])  # type: ignore


async def update_product(product_id: int, data: ProductUpdate) -> Optional[Product]:
    """Update an existing product."""
    updates = []
    params: Dict[str, Any] = {"product_id": product_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    jsonb_fields = ["available_styles", "available_colors", "available_finishes", 
                    "specifications", "images", "metadata"]
    
    for field_name, value in payload.items():
        if field_name == "variants":
            updates.append("variants = CAST(:variants AS jsonb)")
            if value:
                params["variants"] = json.dumps([v.model_dump() if hasattr(v, 'model_dump') else v for v in value])
            else:
                params["variants"] = "[]"
        elif field_name in jsonb_fields:
            updates.append(f"{field_name} = CAST(:{field_name} AS jsonb)")
            params[field_name] = json.dumps(value) if value else ("[]" if field_name in ["available_styles", "available_colors", "available_finishes", "images"] else "{}")
        else:
            updates.append(f"{field_name} = :{field_name}")
            params[field_name] = value

    if not updates:
        return await get_product(product_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE products SET {set_clause}
        WHERE id = :product_id AND deleted_at IS NULL
        RETURNING id
    """
    row = await execute_returning(query, params)
    if not row:
        return None
    
    return await get_product(product_id)


async def delete_product(product_id: int) -> bool:
    """Soft-delete a product."""
    query = "UPDATE products SET deleted_at = NOW() WHERE id = :product_id AND deleted_at IS NULL"
    count = await execute(query, {"product_id": product_id})
    return count > 0


async def get_products_by_supplier(supplier_id: int) -> List[Product]:
    """Get all products for a supplier."""
    return await list_products(supplier_id=supplier_id)


async def get_available_options() -> Dict[str, List[str]]:
    """Get all unique styles, colors, and finishes across all products."""
    query = """
        SELECT 
            COALESCE(
                (SELECT jsonb_agg(DISTINCT style) 
                 FROM products, jsonb_array_elements_text(available_styles) as style
                 WHERE deleted_at IS NULL),
                '[]'::jsonb
            ) as styles,
            COALESCE(
                (SELECT jsonb_agg(DISTINCT color) 
                 FROM products, jsonb_array_elements_text(available_colors) as color
                 WHERE deleted_at IS NULL),
                '[]'::jsonb
            ) as colors,
            COALESCE(
                (SELECT jsonb_agg(DISTINCT finish) 
                 FROM products, jsonb_array_elements_text(available_finishes) as finish
                 WHERE deleted_at IS NULL),
                '[]'::jsonb
            ) as finishes
    """
    row = await fetch_one(query, {})
    if not row:
        return {"styles": [], "colors": [], "finishes": []}
    
    return {
        "styles": _parse_json_field(row.get("styles")) or [],
        "colors": _parse_json_field(row.get("colors")) or [],
        "finishes": _parse_json_field(row.get("finishes")) or [],
    }


async def get_categories() -> List[str]:
    """Get all unique product categories."""
    query = """
        SELECT DISTINCT category FROM products 
        WHERE deleted_at IS NULL AND category IS NOT NULL
        ORDER BY category
    """
    rows = await fetch_all(query, {})
    return [r["category"] for r in rows]
