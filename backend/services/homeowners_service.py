"""
Homeowners service - synced with Supabase schema
"""
from typing import List, Optional, Dict, Any
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.homeowners import Homeowner, HomeownerCreate, HomeownerUpdate


def _row_to_homeowner(row: Dict[str, Any]) -> Homeowner:
    """Convert DB row to Homeowner model"""
    return Homeowner(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        first_name=row["first_name"],
        last_name=row["last_name"],
        email=row.get("email"),
        phone=row.get("phone"),
        address_street=row.get("address_street"),
        address_city=row.get("address_city"),
        address_state=row.get("address_state"),
        address_zip=row.get("address_zip"),
        internal_notes=row.get("internal_notes"),
        metadata=row.get("metadata"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_homeowners(
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Homeowner]:
    query = """
        SELECT id, tenant_id, first_name, last_name, email, phone,
               address_street, address_city, address_state, address_zip,
               internal_notes, metadata, created_at, updated_at, deleted_at
        FROM homeowners
        WHERE deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if search:
        query += """ AND (
            first_name ILIKE :search OR 
            last_name ILIKE :search OR 
            email ILIKE :search OR 
            phone ILIKE :search
        )"""
        params["search"] = f"%{search}%"

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_homeowner(r) for r in rows]


async def get_homeowner(homeowner_id: int) -> Optional[Homeowner]:
    query = """
        SELECT id, tenant_id, first_name, last_name, email, phone,
               address_street, address_city, address_state, address_zip,
               internal_notes, metadata, created_at, updated_at, deleted_at
        FROM homeowners
        WHERE id = :homeowner_id AND deleted_at IS NULL
    """
    row = await fetch_one(query, {"homeowner_id": homeowner_id})
    return _row_to_homeowner(row) if row else None


async def create_homeowner(data: HomeownerCreate) -> Homeowner:
    import json
    query = """
        INSERT INTO homeowners (tenant_id, first_name, last_name, email, phone, 
            address_street, address_city, address_state, address_zip, internal_notes, metadata)
        VALUES (:tenant_id, :first_name, :last_name, :email, :phone, 
                :address_street, :address_city, :address_state, :address_zip, :internal_notes,
                CAST(:metadata AS jsonb))
        RETURNING id, tenant_id, first_name, last_name, email, phone,
               address_street, address_city, address_state, address_zip,
               internal_notes, metadata, created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "email": data.email,
        "phone": data.phone,
        "address_street": data.address_street,
        "address_city": data.address_city,
        "address_state": data.address_state,
        "address_zip": data.address_zip,
        "internal_notes": data.internal_notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    return _row_to_homeowner(row)  # type: ignore


async def update_homeowner(homeowner_id: int, data: HomeownerUpdate) -> Optional[Homeowner]:
    import json
    updates = []
    params: Dict[str, Any] = {"homeowner_id": homeowner_id}
    
    if data.first_name is not None:
        updates.append("first_name = :first_name")
        params["first_name"] = data.first_name
    if data.last_name is not None:
        updates.append("last_name = :last_name")
        params["last_name"] = data.last_name
    if data.email is not None:
        updates.append("email = :email")
        params["email"] = data.email
    if data.phone is not None:
        updates.append("phone = :phone")
        params["phone"] = data.phone
    if data.address_street is not None:
        updates.append("address_street = :address_street")
        params["address_street"] = data.address_street
    if data.address_city is not None:
        updates.append("address_city = :address_city")
        params["address_city"] = data.address_city
    if data.address_state is not None:
        updates.append("address_state = :address_state")
        params["address_state"] = data.address_state
    if data.address_zip is not None:
        updates.append("address_zip = :address_zip")
        params["address_zip"] = data.address_zip
    if data.internal_notes is not None:
        updates.append("internal_notes = :internal_notes")
        params["internal_notes"] = data.internal_notes
    if data.metadata is not None:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(data.metadata)

    if not updates:
        return await get_homeowner(homeowner_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE homeowners SET {set_clause}
        WHERE id = :homeowner_id AND deleted_at IS NULL
        RETURNING id, tenant_id, first_name, last_name, email, phone,
               address_street, address_city, address_state, address_zip,
               internal_notes, metadata, created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, params)
    return _row_to_homeowner(row) if row else None


async def delete_homeowner(homeowner_id: int) -> bool:
    query = "UPDATE homeowners SET deleted_at = NOW() WHERE id = :homeowner_id AND deleted_at IS NULL"
    count = await execute(query, {"homeowner_id": homeowner_id})
    return count > 0
