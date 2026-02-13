# Filepath: /srv/vulpine-os/backend/models/documents.py
"""
Document models for PDF generation and e-signature tracking
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


# Document type constants
DOCUMENT_TYPES = [
    "quote_pdf",
    "work_order_pdf", 
    "agreement",
    "contract",
    "invoice",
    "receipt",
    "installation_guide",
    "warranty",
    "other"
]

# Document status constants
DOCUMENT_STATUSES = [
    "draft",
    "generating",
    "generated",
    "sent",
    "viewed",
    "archived",
    "cancelled"
]

# Signature status constants
SIGNATURE_STATUSES = [
    "unsigned",
    "pending_signature",
    "partially_signed",
    "signed",
    "declined",
    "expired"
]

# Entity types for documents
ENTITY_TYPES = ["quote", "job", "work_order", "homeowner", "installer"]


class DocumentTemplateBase(BaseModel):
    """Base document template fields"""
    template_name: str
    template_type: str
    html_content: str
    css_content: Optional[str] = None
    variables: Optional[List[str]] = None
    default_values: Optional[dict[str, Any]] = None
    is_active: bool = True
    metadata: Optional[dict[str, Any]] = None


class DocumentTemplateCreate(DocumentTemplateBase):
    """Create a document template"""
    tenant_id: Optional[int] = None


class DocumentTemplate(DocumentTemplateBase):
    """Document template response model"""
    id: int
    tenant_id: Optional[int] = None
    version: int = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentSignatureBase(BaseModel):
    """Base document signature fields"""
    signer_name: str
    signer_email: Optional[str] = None
    signer_role: Optional[str] = None
    signature_order: int = 1
    metadata: Optional[dict[str, Any]] = None


class DocumentSignatureCreate(DocumentSignatureBase):
    """Create a document signature"""
    document_id: int


class DocumentSignature(DocumentSignatureBase):
    """Document signature response model"""
    id: int
    document_id: int
    signature_data: Optional[str] = None
    signed_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str = "pending"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    """Base document fields"""
    document_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    title: str
    metadata: Optional[dict[str, Any]] = None


class DocumentCreate(DocumentBase):
    """Create a new document"""
    tenant_id: Optional[int] = None
    status: Optional[str] = "draft"
    sign_status: Optional[str] = "unsigned"


class DocumentUpdate(BaseModel):
    """Update an existing document"""
    title: Optional[str] = None
    status: Optional[str] = None
    sign_status: Optional[str] = None
    file_path: Optional[str] = None
    storage_url: Optional[str] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None


class Document(BaseModel):
    """Document response model"""
    id: int
    tenant_id: Optional[int] = None
    document_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    title: str
    file_path: Optional[str] = None
    storage_url: Optional[str] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = "application/pdf"
    status: Optional[str] = "draft"
    sign_status: Optional[str] = "unsigned"
    generated_by: Optional[int] = None
    signed_by: Optional[int] = None
    signed_at: Optional[datetime] = None
    signature_data: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None
    generated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerateDocumentRequest(BaseModel):
    """Request to generate a document"""
    document_type: str
    entity_type: str
    entity_id: int
    title: Optional[str] = None


class SignatureUpdate(BaseModel):
    """Request to update signature status"""
    sign_status: str
    signed_by: Optional[int] = None
    signature_data: Optional[dict[str, Any]] = None


class DocumentGenerateResponse(BaseModel):
    """Response after document generation"""
    document_id: int
    status: str
    file_url: Optional[str] = None
    message: str


class GenerateFromTemplateRequest(BaseModel):
    """Request to generate document from template"""
    template_id: int
    entity_type: str
    entity_id: int
    variables: dict[str, Any]
    title: Optional[str] = None
    signers: Optional[List[DocumentSignatureCreate]] = None


class SignDocumentRequest(BaseModel):
    """Request to sign a document"""
    signature_id: int
    signature_data: str  # Base64 encoded signature image
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class DocumentVersion(BaseModel):
    """Document version model"""
    id: int
    document_id: int
    version_number: int
    file_url: Optional[str] = None
    file_path: Optional[str] = None
    changes_description: Optional[str] = None
    created_by: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentAuditLog(BaseModel):
    """Document audit log model"""
    id: int
    document_id: int
    action: str
    performed_by: Optional[int] = None
    performed_by_name: Optional[str] = None
    details: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentWithSignatures(Document):
    """Document with signature details"""
    signatures: List[DocumentSignature] = []
    versions: List[DocumentVersion] = []
    current_version: int = 1
    all_signed: bool = False
