from typing import List, Optional, Dict, Any
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.files import FileRecord, FileCreate


def _row_to_file(row: Dict[str, Any]) -> FileRecord:
    return FileRecord(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        filename=row.get("filename", ""),
        original_filename=row.get("original_filename"),
        file_type=row.get("file_type"),
        file_size=row.get("file_size"),
        mime_type=row.get("mime_type"),
        storage_path=row.get("storage_path"),
        entity_type=row.get("entity_type"),
        entity_id=row.get("entity_id"),
        uploaded_by=row.get("uploaded_by"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


async def list_files(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[FileRecord]:
    query = """
        SELECT id, tenant_id, filename, original_filename, file_type,
               file_size, mime_type, storage_path, entity_type, entity_id,
               uploaded_by, created_at, updated_at
        FROM files
        WHERE deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if entity_type:
        query += " AND entity_type = :entity_type"
        params["entity_type"] = entity_type

    if entity_id:
        query += " AND entity_id = :entity_id"
        params["entity_id"] = entity_id

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_file(r) for r in rows]


async def get_file(file_id: int) -> Optional[FileRecord]:
    query = """
        SELECT id, tenant_id, filename, original_filename, file_type,
               file_size, mime_type, storage_path, entity_type, entity_id,
               uploaded_by, created_at, updated_at
        FROM files
        WHERE id = :file_id AND deleted_at IS NULL
    """
    row = await fetch_one(query, {"file_id": file_id})
    return _row_to_file(row) if row else None


async def create_file(data: FileCreate) -> FileRecord:
    query = """
        INSERT INTO files (filename, original_filename, file_type, file_size,
            mime_type, storage_path, entity_type, entity_id, uploaded_by)
        VALUES (:filename, :original_filename, :file_type, :file_size,
            :mime_type, :storage_path, :entity_type, :entity_id, :uploaded_by)
        RETURNING id, tenant_id, filename, original_filename, file_type,
               file_size, mime_type, storage_path, entity_type, entity_id,
               uploaded_by, created_at, updated_at
    """
    row = await execute_returning(query, {
        "filename": data.filename,
        "original_filename": data.original_filename,
        "file_type": data.file_type,
        "file_size": data.file_size,
        "mime_type": data.mime_type,
        "storage_path": data.storage_path,
        "entity_type": data.entity_type,
        "entity_id": data.entity_id,
        "uploaded_by": data.uploaded_by,
    })
    return _row_to_file(row)  # type: ignore


async def delete_file(file_id: int) -> bool:
    query = "UPDATE files SET deleted_at = NOW() WHERE id = :file_id AND deleted_at IS NULL"
    count = await execute(query, {"file_id": file_id})
    return count > 0
