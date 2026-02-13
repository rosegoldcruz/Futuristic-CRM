from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from models.documents import (
    Document, DocumentCreate, DocumentUpdate, GenerateDocumentRequest,
    SignatureUpdate, DocumentGenerateResponse,
    DocumentTemplate, DocumentTemplateCreate,
    DocumentSignature, DocumentSignatureCreate,
    DocumentVersion, DocumentAuditLog,
    GenerateFromTemplateRequest, SignDocumentRequest, DocumentWithSignatures,
    DOCUMENT_TYPES, DOCUMENT_STATUSES, SIGNATURE_STATUSES, ENTITY_TYPES
)
from services import documents_service, document_esign_service

router = APIRouter(tags=["documents"])


@router.get("/", response_model=List[Document])
async def list_documents(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    sign_status: Optional[str] = Query(None, description="Filter by signature status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List documents with optional filtering"""
    return await documents_service.list_documents(
        entity_type=entity_type,
        entity_id=entity_id,
        document_type=document_type,
        status=status,
        sign_status=sign_status,
        limit=limit,
        offset=offset,
    )


@router.get("/types", response_model=List[str])
async def get_document_types():
    """Get list of valid document types"""
    return DOCUMENT_TYPES


@router.get("/statuses", response_model=List[str])
async def get_document_statuses():
    """Get list of valid document statuses"""
    return DOCUMENT_STATUSES


@router.get("/signature-statuses", response_model=List[str])
async def get_signature_statuses():
    """Get list of valid signature statuses"""
    return SIGNATURE_STATUSES


@router.get("/entity-types", response_model=List[str])
async def get_entity_types():
    """Get list of valid entity types"""
    return ENTITY_TYPES


@router.get("/{document_id}", response_model=Document)
async def get_document(document_id: int):
    """Get a specific document by ID"""
    document = await documents_service.get_document(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post("/", response_model=Document, status_code=201)
async def create_document(payload: DocumentCreate):
    """Create a new document record"""
    try:
        return await documents_service.create_document(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{document_id}", response_model=Document)
async def update_document(document_id: int, payload: DocumentUpdate):
    """Update an existing document"""
    try:
        document = await documents_service.update_document(document_id, payload)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: int):
    """Delete a document"""
    ok = await documents_service.delete_document(document_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return None


@router.post("/{document_id}/signature", response_model=Document)
async def update_signature_status(document_id: int, payload: SignatureUpdate):
    """Update document signature status"""
    try:
        document = await documents_service.update_signature_status(
            document_id,
            payload.sign_status,
            payload.signed_by,
            payload.signature_data
        )
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/generate", response_model=DocumentGenerateResponse, status_code=201)
async def generate_document(payload: GenerateDocumentRequest):
    """Generate a PDF document for a given entity"""
    try:
        result = await documents_service.generate_document_pdf(
            document_type=payload.document_type,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            title=payload.title
        )
        
        return DocumentGenerateResponse(
            document_id=result["document_id"],
            status=result["status"],
            file_url=f"/documents/{result['document_id']}/download",
            message=f"Document generated successfully (ID: {result['document_id']})"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")


@router.get("/{document_id}/download")
async def download_document(document_id: int):
    """Download a document PDF"""
    document = await documents_service.get_document(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not document.file_path:
        raise HTTPException(status_code=404, detail="Document file not found")
    
    import os
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="Document file not available")
    
    return FileResponse(
        path=document.file_path,
        media_type="application/pdf",
        filename=f"document_{document_id}.pdf"
    )


# Templates
@router.get("/templates", response_model=List[DocumentTemplate])
async def list_templates(
    template_type: Optional[str] = Query(None, description="Filter by template type"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
):
    """List document templates"""
    return await document_esign_service.list_templates(template_type, is_active)


@router.get("/templates/{template_id}", response_model=DocumentTemplate)
async def get_template(template_id: int):
    """Get a template by ID"""
    template = await document_esign_service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/templates", response_model=DocumentTemplate, status_code=201)
async def create_template(payload: DocumentTemplateCreate):
    """Create a new document template"""
    return await document_esign_service.create_template(payload)


# Generate from Template
@router.post("/generate-from-template", response_model=DocumentWithSignatures, status_code=201)
async def generate_from_template(payload: GenerateFromTemplateRequest):
    """Generate a document from a template with variable injection"""
    try:
        return await document_esign_service.generate_document_from_template(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Signatures
@router.get("/{document_id}/signatures", response_model=List[DocumentSignature])
async def list_document_signatures(document_id: int):
    """List signatures for a document"""
    return await document_esign_service.list_document_signatures(document_id)


@router.post("/{document_id}/signatures", response_model=DocumentSignature, status_code=201)
async def create_signature(document_id: int, payload: DocumentSignatureCreate):
    """Add a signature requirement to a document"""
    payload.document_id = document_id
    return await document_esign_service.create_signature(payload)


@router.post("/sign", response_model=DocumentSignature)
async def sign_document(payload: SignDocumentRequest):
    """Sign a document"""
    try:
        return await document_esign_service.sign_document(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Versions
@router.get("/{document_id}/versions", response_model=List[DocumentVersion])
async def list_document_versions(document_id: int):
    """List versions for a document"""
    return await document_esign_service.list_document_versions(document_id)


# Audit
@router.get("/{document_id}/audit", response_model=List[DocumentAuditLog])
async def get_document_audit_log(document_id: int):
    """Get audit log for a document"""
    query = """
        SELECT * FROM document_audit_log
        WHERE document_id = :document_id
        ORDER BY created_at DESC
    """
    from config.db import fetch_all
    rows = await fetch_all(query, {"document_id": document_id})
    return [
        DocumentAuditLog(
            id=r["id"],
            document_id=r["document_id"],
            action=r["action"],
            performed_by=r.get("performed_by"),
            performed_by_name=r.get("performed_by_name"),
            details=r.get("details"),
            metadata=document_esign_service._parse_json_field(r.get("metadata")),
            created_at=r.get("created_at"),
        )
        for r in rows
    ]
