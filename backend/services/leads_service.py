"""
Leads service - synced with Supabase schema
"""
from typing import List, Optional, Dict, Any
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.leads import Lead, LeadCreate, LeadUpdate


def _row_to_lead(row: Dict[str, Any]) -> Lead:
    """Convert DB row to Lead model"""
    return Lead(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        customer_name=row["customer_name"],
        customer_email=row.get("customer_email"),
        customer_phone=row.get("customer_phone"),
        source=row.get("source"),
        status=row.get("status", "new"),
        internal_notes=row.get("internal_notes"),
        metadata=row.get("metadata"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_leads(
    search: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Lead]:
    query = """
        SELECT id, tenant_id, customer_name, customer_email, customer_phone,
               source, status, internal_notes, metadata, created_at, updated_at, deleted_at
        FROM leads
        WHERE deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if search:
        query += " AND (customer_name ILIKE :search OR customer_email ILIKE :search OR customer_phone ILIKE :search)"
        params["search"] = f"%{search}%"

    if status:
        query += " AND status = :status"
        params["status"] = status

    if source:
        query += " AND source = :source"
        params["source"] = source

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_lead(r) for r in rows]


async def get_lead(lead_id: int) -> Optional[Lead]:
    query = """
        SELECT id, tenant_id, customer_name, customer_email, customer_phone,
               source, status, internal_notes, metadata, created_at, updated_at, deleted_at
        FROM leads
        WHERE id = :lead_id AND deleted_at IS NULL
    """
    row = await fetch_one(query, {"lead_id": lead_id})
    return _row_to_lead(row) if row else None


async def create_lead(data: LeadCreate) -> Lead:
    query = """
        INSERT INTO leads (tenant_id, customer_name, customer_email, customer_phone, source, status, internal_notes, metadata)
        VALUES (:tenant_id, :customer_name, :customer_email, :customer_phone, :source, :status, :internal_notes, :metadata)
        RETURNING id, tenant_id, customer_name, customer_email, customer_phone,
               source, status, internal_notes, metadata, created_at, updated_at, deleted_at
    """
    import json
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "customer_name": data.customer_name,
        "customer_email": data.customer_email,
        "customer_phone": data.customer_phone,
        "source": data.source,
        "status": data.status or "new",
        "internal_notes": data.internal_notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    return _row_to_lead(row)  # type: ignore


async def update_lead(lead_id: int, data: LeadUpdate) -> Optional[Lead]:
    import json
    updates = []
    params: Dict[str, Any] = {"lead_id": lead_id}
    
    if data.customer_name is not None:
        updates.append("customer_name = :customer_name")
        params["customer_name"] = data.customer_name
    if data.customer_email is not None:
        updates.append("customer_email = :customer_email")
        params["customer_email"] = data.customer_email
    if data.customer_phone is not None:
        updates.append("customer_phone = :customer_phone")
        params["customer_phone"] = data.customer_phone
    if data.source is not None:
        updates.append("source = :source")
        params["source"] = data.source
    if data.status is not None:
        updates.append("status = :status")
        params["status"] = data.status
    if data.internal_notes is not None:
        updates.append("internal_notes = :internal_notes")
        params["internal_notes"] = data.internal_notes
    if data.metadata is not None:
        updates.append("metadata = :metadata")
        params["metadata"] = json.dumps(data.metadata)

    if not updates:
        return await get_lead(lead_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE leads SET {set_clause}
        WHERE id = :lead_id AND deleted_at IS NULL
        RETURNING id, tenant_id, customer_name, customer_email, customer_phone,
               source, status, internal_notes, metadata, created_at, updated_at, deleted_at
    """
    row = await execute_returning(query, params)
    return _row_to_lead(row) if row else None


async def delete_lead(lead_id: int) -> bool:
    query = "UPDATE leads SET deleted_at = NOW() WHERE id = :lead_id AND deleted_at IS NULL"
    count = await execute(query, {"lead_id": lead_id})
    return count > 0
