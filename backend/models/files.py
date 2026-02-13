# Filepath: /srv/vulpine-os/backend/models/files.py

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


# Valid entity types for file attachments
ENTITY_TYPES = ["homeowner", "job", "quote", "work_order", "installer", "lead", "visualizer"]

# Valid file types
FILE_TYPES = ["image", "document", "pdf", "video", "other"]

# File size limits (in bytes)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Allowed MIME types
ALLOWED_MIME_TYPES = [
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
    "video/mp4", "video/quicktime",
]


class FileCreate(BaseModel):
    filename: str
    original_filename: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    storage_path: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    uploaded_by: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None


class FileUpdate(BaseModel):
    """Update file metadata"""
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None


class FileRecord(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    filename: str
    original_filename: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    storage_path: Optional[str] = None
    storage_url: Optional[str] = None  # Public URL
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    uploaded_by: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FileUploadResponse(BaseModel):
    """Response after successful file upload"""
    file_id: int
    filename: str
    storage_path: str
    storage_url: Optional[str] = None
    file_size: int
    mime_type: str
    message: str = "File uploaded successfully"
