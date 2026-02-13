"""
Documents service - handles document generation, storage, and signature tracking
"""
from typing import List, Optional, Dict, Any
import json
import os
from datetime import datetime
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.documents import (
    Document, DocumentCreate, DocumentUpdate,
    DOCUMENT_TYPES, DOCUMENT_STATUSES, SIGNATURE_STATUSES, ENTITY_TYPES
)
from services.pdf_generator import PDFGenerator


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


def _row_to_document(row: Dict[str, Any]) -> Document:
    """Convert DB row to Document model"""
    return Document(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        document_type=row.get("document_type"),
        entity_type=row.get("entity_type"),
        entity_id=row.get("entity_id"),
        title=row.get("title"),
        file_path=row.get("file_path"),
        storage_url=row.get("storage_url"),
        file_url=row.get("file_url"),
        file_size=row.get("file_size"),
        mime_type=row.get("mime_type", "application/pdf"),
        status=row.get("status", "draft"),
        sign_status=row.get("sign_status", "unsigned"),
        generated_by=row.get("generated_by"),
        signed_by=row.get("signed_by"),
        signed_at=row.get("signed_at"),
        signature_data=_parse_json_field(row.get("signature_data")),
        metadata=_parse_json_field(row.get("metadata")),
        generated_at=row.get("generated_at"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_documents(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    document_type: Optional[str] = None,
    status: Optional[str] = None,
    sign_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Document]:
    """List documents with optional filtering"""
    query = """
        SELECT * FROM documents
        WHERE deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if entity_type:
        query += " AND entity_type = :entity_type"
        params["entity_type"] = entity_type

    if entity_id:
        query += " AND entity_id = :entity_id"
        params["entity_id"] = entity_id

    if document_type:
        query += " AND document_type = :document_type"
        params["document_type"] = document_type

    if status:
        query += " AND status = :status"
        params["status"] = status

    if sign_status:
        query += " AND sign_status = :sign_status"
        params["sign_status"] = sign_status

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_document(r) for r in rows]


async def get_document(document_id: int) -> Optional[Document]:
    """Get a single document by ID"""
    query = "SELECT * FROM documents WHERE id = :document_id AND deleted_at IS NULL"
    row = await fetch_one(query, {"document_id": document_id})
    return _row_to_document(row) if row else None


async def create_document(data: DocumentCreate) -> Document:
    """Create a new document record"""
    # Validate document type
    if data.document_type not in DOCUMENT_TYPES:
        raise ValueError(f"Invalid document_type. Must be one of: {', '.join(DOCUMENT_TYPES)}")
    
    # Validate entity type if provided
    if data.entity_type and data.entity_type not in ENTITY_TYPES:
        raise ValueError(f"Invalid entity_type. Must be one of: {', '.join(ENTITY_TYPES)}")
    
    # Validate status if provided
    if data.status and data.status not in DOCUMENT_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(DOCUMENT_STATUSES)}")
    
    # Validate signature status if provided
    if data.sign_status and data.sign_status not in SIGNATURE_STATUSES:
        raise ValueError(f"Invalid sign_status. Must be one of: {', '.join(SIGNATURE_STATUSES)}")
    
    query = """
        INSERT INTO documents (
            tenant_id, document_type, entity_type, entity_id, title,
            status, sign_status, metadata
        )
        VALUES (
            :tenant_id, :document_type, :entity_type, :entity_id, :title,
            :status, :sign_status, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "document_type": data.document_type,
        "entity_type": data.entity_type,
        "entity_id": data.entity_id,
        "title": data.title,
        "status": data.status or "draft",
        "sign_status": data.sign_status or "unsigned",
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_document(row["id"])  # type: ignore


async def update_document(document_id: int, data: DocumentUpdate) -> Optional[Document]:
    """Update an existing document"""
    updates = []
    params: Dict[str, Any] = {"document_id": document_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    # Validate status if provided
    if "status" in payload and payload["status"] and payload["status"] not in DOCUMENT_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(DOCUMENT_STATUSES)}")
    
    # Validate signature status if provided
    if "sign_status" in payload and payload["sign_status"] and payload["sign_status"] not in SIGNATURE_STATUSES:
        raise ValueError(f"Invalid sign_status. Must be one of: {', '.join(SIGNATURE_STATUSES)}")
    
    field_mappings = {
        "title": "title",
        "status": "status",
        "sign_status": "sign_status",
        "file_path": "file_path",
        "storage_url": "storage_url",
        "file_url": "file_url",
        "file_size": "file_size",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    if "metadata" in payload:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(payload["metadata"]) if payload["metadata"] else "{}"

    if not updates:
        return await get_document(document_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE documents SET {set_clause}
        WHERE id = :document_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_document(document_id)


async def delete_document(document_id: int) -> bool:
    """Soft delete a document"""
    query = "UPDATE documents SET deleted_at = NOW() WHERE id = :document_id AND deleted_at IS NULL"
    count = await execute(query, {"document_id": document_id})
    return count > 0


async def update_signature_status(
    document_id: int,
    sign_status: str,
    signed_by: Optional[int] = None,
    signature_data: Optional[Dict[str, Any]] = None
) -> Optional[Document]:
    """Update signature status with validation"""
    if sign_status not in SIGNATURE_STATUSES:
        raise ValueError(f"Invalid sign_status. Must be one of: {', '.join(SIGNATURE_STATUSES)}")
    
    # Update signature status and related fields
    update_parts = [
        "sign_status = :sign_status",
        "updated_at = NOW()"
    ]
    
    params: Dict[str, Any] = {
        "document_id": document_id,
        "sign_status": sign_status,
    }
    
    if signed_by is not None:
        update_parts.append("signed_by = :signed_by")
        params["signed_by"] = signed_by
    
    if sign_status == "signed":
        update_parts.append("signed_at = COALESCE(signed_at, NOW())")
    
    if signature_data:
        update_parts.append("signature_data = CAST(:signature_data AS jsonb)")
        params["signature_data"] = json.dumps(signature_data)
    
    query = f"""
        UPDATE documents 
        SET {', '.join(update_parts)}
        WHERE id = :document_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    
    if not row:
        return None
    return await get_document(document_id)


async def generate_document_pdf(
    document_type: str,
    entity_type: str,
    entity_id: int,
    title: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate a PDF document for a given entity.
    Returns document metadata including file path.
    """
    # Validate inputs
    if document_type not in DOCUMENT_TYPES:
        raise ValueError(f"Invalid document_type. Must be one of: {', '.join(DOCUMENT_TYPES)}")
    
    if entity_type not in ENTITY_TYPES:
        raise ValueError(f"Invalid entity_type. Must be one of: {', '.join(ENTITY_TYPES)}")
    
    # Fetch entity data based on type
    entity_data = await _fetch_entity_data(entity_type, entity_id)
    if not entity_data:
        raise ValueError(f"{entity_type.capitalize()} #{entity_id} not found")
    
    # Generate PDF based on document type
    pdf_buffer = None
    if document_type == "quote_pdf":
        pdf_buffer = PDFGenerator.generate_quote_pdf(entity_data)
    elif document_type == "work_order_pdf":
        pdf_buffer = PDFGenerator.generate_work_order_pdf(entity_data)
    elif document_type in ["agreement", "contract"]:
        pdf_buffer = PDFGenerator.generate_agreement_pdf(entity_data)
    else:
        raise ValueError(f"PDF generation not supported for document_type: {document_type}")
    
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{entity_type}_{entity_id}_{document_type}_{timestamp}.pdf"
    
    # Save to local storage (in production, this would go to Supabase Storage)
    storage_dir = "/tmp/aeon_documents"
    os.makedirs(storage_dir, exist_ok=True)
    file_path = os.path.join(storage_dir, filename)
    
    with open(file_path, "wb") as f:
        f.write(pdf_buffer.read())
    
    file_size = os.path.getsize(file_path)
    
    # Create document record
    doc_title = title or f"{entity_type.capitalize()} {document_type.replace('_', ' ').title()} - {entity_id}"
    document = await create_document(DocumentCreate(
        document_type=document_type,
        entity_type=entity_type,
        entity_id=entity_id,
        title=doc_title,
        status="generated",
        sign_status="unsigned",
    ))
    
    # Update with file information
    await update_document(document.id, DocumentUpdate(
        file_path=file_path,
        file_url=f"/documents/{document.id}/download",
        storage_url=file_path,
        file_size=file_size,
    ))
    
    return {
        "document_id": document.id,
        "file_path": file_path,
        "file_size": file_size,
        "status": "generated",
    }


async def _fetch_entity_data(entity_type: str, entity_id: int) -> Optional[Dict[str, Any]]:
    """Fetch entity data for PDF generation"""
    if entity_type == "quote":
        query = """
            SELECT q.*, h.first_name, h.last_name
            FROM quotes q
            LEFT JOIN homeowners h ON q.homeowner_id = h.id
            WHERE q.id = :entity_id AND q.deleted_at IS NULL
        """
        row = await fetch_one(query, {"entity_id": entity_id})
        if not row:
            return None
        
        # Parse line items
        line_items = []
        if row.get("line_items"):
            line_items = _parse_json_field(row["line_items"]) or []
        
        return {
            "id": row["id"],
            "customer_name": f"{row.get('first_name', '')} {row.get('last_name', '')}".strip() or "N/A",
            "total_price": float(row["total_price"]) if row.get("total_price") else 0.0,
            "status": row.get("status"),
            "line_items": line_items,
            "created_at": row.get("created_at").strftime("%Y-%m-%d") if row.get("created_at") else None,
        }
    
    elif entity_type == "work_order":
        query = """
            SELECT wo.*, j.customer_name, CONCAT(i.first_name, ' ', i.last_name) as installer_name
            FROM work_orders wo
            LEFT JOIN jobs j ON wo.job_id = j.id
            LEFT JOIN installers i ON wo.installer_id = i.id
            WHERE wo.id = :entity_id AND wo.deleted_at IS NULL
        """
        row = await fetch_one(query, {"entity_id": entity_id})
        if not row:
            return None
        
        return {
            "work_order_number": row.get("work_order_number"),
            "customer_name": row.get("customer_name", "N/A"),
            "installer_name": row.get("installer_name", "Not assigned"),
            "status": row.get("status"),
            "materials": _parse_json_field(row.get("materials")) or [],
            "labor": _parse_json_field(row.get("labor")) or [],
            "instructions": row.get("instructions", "No special instructions."),
        }
    
    elif entity_type == "job":
        query = """
            SELECT j.*, h.first_name, h.last_name
            FROM jobs j
            LEFT JOIN homeowners h ON j.homeowner_id = h.id
            WHERE j.id = :entity_id AND j.deleted_at IS NULL
        """
        row = await fetch_one(query, {"entity_id": entity_id})
        if not row:
            return None
        
        return {
            "id": row["id"],
            "customer_name": row.get("customer_name") or f"{row.get('first_name', '')} {row.get('last_name', '')}".strip() or "N/A",
            "status": row.get("status"),
            "created_at": row.get("created_at").strftime("%Y-%m-%d") if row.get("created_at") else None,
            "terms": "Standard installation terms apply.",
            "scope": "Solar panel installation as specified.",
            "payment_terms": "As per agreed quote.",
        }
    
    return None
