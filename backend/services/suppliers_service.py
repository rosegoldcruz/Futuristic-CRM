"""
Suppliers service - synced with Supabase schema
"""
from typing import List, Optional, Dict, Any
import json
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.suppliers import Supplier, SupplierCreate, SupplierUpdate


def _row_to_supplier(row: Dict[str, Any]) -> Supplier:
    """Convert DB row to Supplier model - maps DB columns to model fields"""
    return Supplier(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        company_name=row["name"],  # DB uses 'name'
        contact_name=row.get("contact_name"),
        email=row.get("email"),
        phone=row.get("phone"),
        website=row.get("website"),
        supplier_type=row.get("supplier_type"),
        address_city=row.get("city"),  # DB uses 'city'
        address_state=row.get("state"),  # DB uses 'state'
        address_zip=row.get("postal_code"),  # DB uses 'postal_code'
        internal_notes=row.get("internal_notes"),
        is_active=row.get("is_active", True),
        metadata=row.get("metadata"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_suppliers(
    tenant_id: Optional[int] = None,
    active_only: bool = True,
    search: Optional[str] = None,
    supplier_type: Optional[str] = None,
    state: Optional[str] = None,
) -> List[Supplier]:
    query = """
        SELECT id, tenant_id, name, contact_name, email, phone, website,
               supplier_type, city, state, postal_code, internal_notes,
               is_active, metadata, created_at, updated_at, deleted_at
        FROM suppliers
        WHERE deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if active_only:
        query += " AND is_active = true"

    if supplier_type:
        query += " AND supplier_type = :supplier_type"
        params["supplier_type"] = supplier_type

    if state:
        query += " AND state = :state"
        params["state"] = state

    if search:
        query += " AND (name ILIKE :search OR contact_name ILIKE :search OR city ILIKE :search)"
        params["search"] = f"%{search}%"

    query += " ORDER BY name ASC"

    rows = await fetch_all(query, params)
    return [_row_to_supplier(r) for r in rows]


async def get_supplier(supplier_id: int) -> Optional[Supplier]:
    query = """
        SELECT id, tenant_id, name, contact_name, email, phone, website,
               supplier_type, city, state, postal_code, internal_notes,
               is_active, metadata, created_at, updated_at, deleted_at
        FROM suppliers
        WHERE id = :supplier_id AND deleted_at IS NULL
    """
    row = await fetch_one(query, {"supplier_id": supplier_id})
    return _row_to_supplier(row) if row else None


async def create_supplier(data: SupplierCreate) -> Supplier:
    query = """
        INSERT INTO suppliers (tenant_id, name, contact_name, email, phone, website,
            supplier_type, city, state, postal_code, internal_notes, is_active, metadata)
        VALUES (:tenant_id, :name, :contact_name, :email, :phone, :website,
            :supplier_type, :city, :state, :postal_code, :internal_notes, :is_active, 
            CAST(:metadata AS jsonb))
        RETURNING id, tenant_id, name, contact_name, email, phone, website,
               supplier_type, city, state, postal_code, internal_notes,
               is_active, metadata, created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "name": data.company_name,  # Model uses company_name, DB uses name
        "contact_name": data.contact_name,
        "email": data.email,
        "phone": data.phone,
        "website": str(data.website) if data.website else None,
        "supplier_type": data.supplier_type,
        "city": data.address_city,  # Model uses address_city, DB uses city
        "state": data.address_state,  # Model uses address_state, DB uses state
        "postal_code": data.address_zip,  # Model uses address_zip, DB uses postal_code
        "internal_notes": data.internal_notes,
        "is_active": data.is_active if data.is_active is not None else True,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    return _row_to_supplier(row)  # type: ignore


async def update_supplier(supplier_id: int, data: SupplierUpdate) -> Optional[Supplier]:
    updates = []
    params: Dict[str, Any] = {"supplier_id": supplier_id}
    
    # Map model field names to DB column names
    field_mapping = {
        "company_name": "name",
        "address_city": "city",
        "address_state": "state",
        "address_zip": "postal_code",
    }
    
    payload = data.model_dump(exclude_unset=True)
    for field_name, value in payload.items():
        if field_name == "website" and value is not None:
            value = str(value)
        if field_name == "metadata":
            updates.append("metadata = CAST(:metadata AS jsonb)")
            params["metadata"] = json.dumps(value) if value else "{}"
        else:
            db_field = field_mapping.get(field_name, field_name)
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = value

    if not updates:
        return await get_supplier(supplier_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE suppliers SET {set_clause}
        WHERE id = :supplier_id AND deleted_at IS NULL
        RETURNING id, tenant_id, name, contact_name, email, phone, website,
               supplier_type, city, state, postal_code, internal_notes,
               is_active, metadata, created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, params)
    return _row_to_supplier(row) if row else None


async def delete_supplier(supplier_id: int) -> bool:
    query = "UPDATE suppliers SET deleted_at = NOW() WHERE id = :supplier_id AND deleted_at IS NULL"
    count = await execute(query, {"supplier_id": supplier_id})
    return count > 0
