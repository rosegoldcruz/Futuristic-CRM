"""
Document e-sign service - templates, generation, signing, versioning
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.documents import (
    DocumentTemplate, DocumentTemplateCreate,
    DocumentSignature, DocumentSignatureCreate,
    DocumentVersion, DocumentAuditLog,
    GenerateFromTemplateRequest, SignDocumentRequest,
    DocumentWithSignatures
)
from services import pdf_generator_service


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


def _row_to_template(row: Dict[str, Any]) -> DocumentTemplate:
    """Convert DB row to DocumentTemplate model"""
    return DocumentTemplate(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        template_name=row.get("template_name"),
        template_type=row.get("template_type"),
        html_content=row.get("html_content"),
        css_content=row.get("css_content"),
        variables=_parse_json_field(row.get("variables")),
        default_values=_parse_json_field(row.get("default_values")),
        is_active=row.get("is_active", True),
        version=row.get("version", 1),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_signature(row: Dict[str, Any]) -> DocumentSignature:
    """Convert DB row to DocumentSignature model"""
    return DocumentSignature(
        id=row["id"],
        document_id=row.get("document_id"),
        signer_name=row.get("signer_name"),
        signer_email=row.get("signer_email"),
        signer_role=row.get("signer_role"),
        signature_order=row.get("signature_order", 1),
        signature_data=row.get("signature_data"),
        signed_at=row.get("signed_at"),
        ip_address=row.get("ip_address"),
        user_agent=row.get("user_agent"),
        status=row.get("status", "pending"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


def _row_to_version(row: Dict[str, Any]) -> DocumentVersion:
    """Convert DB row to DocumentVersion model"""
    return DocumentVersion(
        id=row["id"],
        document_id=row.get("document_id"),
        version_number=row.get("version_number"),
        file_url=row.get("file_url"),
        file_path=row.get("file_path"),
        changes_description=row.get("changes_description"),
        created_by=row.get("created_by"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


# Templates
async def list_templates(template_type: Optional[str] = None, is_active: Optional[bool] = True) -> List[DocumentTemplate]:
    """List document templates"""
    query = "SELECT * FROM document_templates WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if template_type:
        query += " AND template_type = :template_type"
        params["template_type"] = template_type
    
    if is_active is not None:
        query += " AND is_active = :is_active"
        params["is_active"] = is_active
    
    query += " ORDER BY template_name"
    
    rows = await fetch_all(query, params)
    return [_row_to_template(r) for r in rows]


async def get_template(template_id: int) -> Optional[DocumentTemplate]:
    """Get a template by ID"""
    query = "SELECT * FROM document_templates WHERE id = :template_id"
    row = await fetch_one(query, {"template_id": template_id})
    return _row_to_template(row) if row else None


async def create_template(data: DocumentTemplateCreate) -> DocumentTemplate:
    """Create a new document template"""
    query = """
        INSERT INTO document_templates (
            tenant_id, template_name, template_type, html_content, css_content,
            variables, default_values, is_active, metadata
        )
        VALUES (
            :tenant_id, :template_name, :template_type, :html_content, :css_content,
            CAST(:variables AS jsonb), CAST(:default_values AS jsonb), :is_active, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "template_name": data.template_name,
        "template_type": data.template_type,
        "html_content": data.html_content,
        "css_content": data.css_content,
        "variables": json.dumps(data.variables) if data.variables else "[]",
        "default_values": json.dumps(data.default_values) if data.default_values else "{}",
        "is_active": data.is_active,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_template(row["id"])  # type: ignore


# Document Generation
async def generate_document_from_template(request: GenerateFromTemplateRequest, tenant_id: Optional[int] = None) -> DocumentWithSignatures:
    """Generate a document from a template"""
    # Get template
    template = await get_template(request.template_id)
    if not template:
        raise ValueError(f"Template {request.template_id} not found")
    
    # Merge default values with provided variables
    variables = {**(template.default_values or {}), **request.variables}
    
    # Inject variables into HTML
    html_content = await pdf_generator_service.inject_variables(
        template.html_content,
        variables
    )
    
    # Generate PDF
    pdf_result = await pdf_generator_service.generate_pdf_from_html(
        html_content,
        template.css_content or "",
        output_filename=f"{request.entity_type}_{request.entity_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    )
    
    # Create document record
    doc_query = """
        INSERT INTO documents (
            tenant_id, document_type, entity_type, entity_id, title,
            file_path, storage_url, file_size, mime_type, status, sign_status,
            metadata, generated_at
        )
        VALUES (
            :tenant_id, :document_type, :entity_type, :entity_id, :title,
            :file_path, :storage_url, :file_size, :mime_type, :status, :sign_status,
            CAST(:metadata AS jsonb), NOW()
        )
        RETURNING id
    """
    
    title = request.title or f"{template.template_name} - {request.entity_type} #{request.entity_id}"
    
    doc_row = await execute_returning(doc_query, {
        "tenant_id": tenant_id,
        "document_type": template.template_type,
        "entity_type": request.entity_type,
        "entity_id": request.entity_id,
        "title": title,
        "file_path": pdf_result["file_path"],
        "storage_url": pdf_result["file_url"],
        "file_size": pdf_result["file_size"],
        "mime_type": pdf_result["mime_type"],
        "status": "pending_signature" if request.signers else "draft",
        "sign_status": "unsigned" if request.signers else "not_required",
        "metadata": json.dumps({
            "template_id": request.template_id,
            "variables": variables,
        }),
    })
    
    document_id = doc_row["id"]
    
    # Create version record
    version_query = """
        INSERT INTO document_versions (
            document_id, version_number, file_url, file_path, changes_description, metadata
        )
        VALUES (:document_id, 1, :file_url, :file_path, :description, CAST(:metadata AS jsonb))
    """
    
    await execute(version_query, {
        "document_id": document_id,
        "file_url": pdf_result["file_url"],
        "file_path": pdf_result["file_path"],
        "description": "Initial document generation from template",
        "metadata": json.dumps({"template_id": request.template_id}),
    })
    
    # Create signature records if provided
    signatures = []
    if request.signers:
        for signer in request.signers:
            signer.document_id = document_id
            signature = await create_signature(signer)
            signatures.append(signature)
    
    # Create audit log
    await create_audit_log(
        document_id=document_id,
        action="document_generated",
        details=f"Generated from template: {template.template_name}",
        metadata={"template_id": request.template_id},
    )
    
    # Get document
    doc = await get_document(document_id)
    versions = await list_document_versions(document_id)
    
    return DocumentWithSignatures(
        **doc.model_dump(),
        signatures=signatures,
        versions=versions,
        current_version=1,
        all_signed=False,
    )


# Signatures
async def create_signature(data: DocumentSignatureCreate) -> DocumentSignature:
    """Create a signature record"""
    query = """
        INSERT INTO document_signatures (
            document_id, signer_name, signer_email, signer_role,
            signature_order, status, metadata
        )
        VALUES (
            :document_id, :signer_name, :signer_email, :signer_role,
            :signature_order, :status, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "document_id": data.document_id,
        "signer_name": data.signer_name,
        "signer_email": data.signer_email,
        "signer_role": data.signer_role,
        "signature_order": data.signature_order,
        "status": "pending",
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM document_signatures WHERE id = :sig_id"
    row = await fetch_one(query, {"sig_id": row["id"]})
    return _row_to_signature(row) if row else None  # type: ignore


async def list_document_signatures(document_id: int) -> List[DocumentSignature]:
    """List signatures for a document"""
    query = """
        SELECT * FROM document_signatures
        WHERE document_id = :document_id
        ORDER BY signature_order, created_at
    """
    rows = await fetch_all(query, {"document_id": document_id})
    return [_row_to_signature(r) for r in rows]


async def sign_document(request: SignDocumentRequest) -> DocumentSignature:
    """Sign a document"""
    # Get signature record
    sig_query = "SELECT * FROM document_signatures WHERE id = :sig_id"
    sig_row = await fetch_one(sig_query, {"sig_id": request.signature_id})
    if not sig_row:
        raise ValueError(f"Signature {request.signature_id} not found")
    
    if sig_row["status"] == "signed":
        raise ValueError("Document already signed")
    
    document_id = sig_row["document_id"]
    
    # Check signature order
    prev_order_query = """
        SELECT COUNT(*) as count
        FROM document_signatures
        WHERE document_id = :document_id
        AND signature_order < :current_order
        AND status != 'signed'
    """
    prev_check = await fetch_one(prev_order_query, {
        "document_id": document_id,
        "current_order": sig_row["signature_order"],
    })
    
    if prev_check and prev_check["count"] > 0:
        raise ValueError("Previous signatures must be completed first")
    
    # Update signature
    update_query = """
        UPDATE document_signatures
        SET signature_data = :signature_data,
            signed_at = NOW(),
            ip_address = :ip_address,
            user_agent = :user_agent,
            status = 'signed'
        WHERE id = :sig_id
    """
    
    await execute(update_query, {
        "sig_id": request.signature_id,
        "signature_data": request.signature_data,
        "ip_address": request.ip_address,
        "user_agent": request.user_agent,
    })
    
    # Check if all signatures are complete
    all_sigs = await list_document_signatures(document_id)
    all_signed = all(sig.status == "signed" for sig in all_sigs)
    
    # Update document status
    if all_signed:
        doc_update = """
            UPDATE documents
            SET status = 'signed',
                sign_status = 'signed',
                updated_at = NOW()
            WHERE id = :document_id
        """
        await execute(doc_update, {"document_id": document_id})
    
    # Create audit log
    await create_audit_log(
        document_id=document_id,
        action="document_signed",
        performed_by_name=sig_row["signer_name"],
        details=f"Signature #{request.signature_id} completed",
    )
    
    # Get updated signature
    row = await fetch_one(sig_query, {"sig_id": request.signature_id})
    return _row_to_signature(row) if row else None  # type: ignore


# Versions
async def list_document_versions(document_id: int) -> List[DocumentVersion]:
    """List versions for a document"""
    query = """
        SELECT * FROM document_versions
        WHERE document_id = :document_id
        ORDER BY version_number DESC
    """
    rows = await fetch_all(query, {"document_id": document_id})
    return [_row_to_version(r) for r in rows]


# Audit
async def create_audit_log(
    document_id: int,
    action: str,
    performed_by: Optional[int] = None,
    performed_by_name: Optional[str] = None,
    details: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> DocumentAuditLog:
    """Create an audit log entry"""
    query = """
        INSERT INTO document_audit_log (
            document_id, action, performed_by, performed_by_name, details, metadata
        )
        VALUES (
            :document_id, :action, :performed_by, :performed_by_name, :details, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "document_id": document_id,
        "action": action,
        "performed_by": performed_by,
        "performed_by_name": performed_by_name,
        "details": details,
        "metadata": json.dumps(metadata) if metadata else "{}",
    })
    
    query = "SELECT * FROM document_audit_log WHERE id = :log_id"
    row = await fetch_one(query, {"log_id": row["id"]})
    
    if not row:
        return None  # type: ignore
    
    return DocumentAuditLog(
        id=row["id"],
        document_id=row["document_id"],
        action=row["action"],
        performed_by=row.get("performed_by"),
        performed_by_name=row.get("performed_by_name"),
        details=row.get("details"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


async def get_document(document_id: int):
    """Get document by ID"""
    from services import documents_service
    return await documents_service.get_document(document_id)
