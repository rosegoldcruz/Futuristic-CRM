from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.files import FileRecord, FileCreate
from services import files_service

router = APIRouter(tags=["files"])


@router.get("/", response_model=List[FileRecord])
async def list_files(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await files_service.list_files(
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{file_id}", response_model=FileRecord)
async def get_file(file_id: int):
    file = await files_service.get_file(file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.post("/", response_model=FileRecord, status_code=201)
async def create_file(payload: FileCreate):
    return await files_service.create_file(payload)


@router.delete("/{file_id}", status_code=204)
async def delete_file(file_id: int):
    ok = await files_service.delete_file(file_id)
    if not ok:
        raise HTTPException(status_code=404, detail="File not found")
    return None
