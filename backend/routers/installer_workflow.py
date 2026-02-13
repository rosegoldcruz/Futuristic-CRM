from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from models.installer_workflow import (
    WorkOrderTask, WorkOrderTaskCreate, WorkOrderTaskUpdate,
    WorkOrderPhoto, WorkOrderPhotoCreate,
    WorkOrderTimeEntry, WorkOrderTimeEntryCreate, WorkOrderTimeEntryUpdate,
    WorkOrderSignature, WorkOrderSignatureCreate,
    WorkOrderProgress,
    TaskCompletion, TimeEntryStart, TimeEntryStop,
    TASK_STATUSES, TIME_ENTRY_TYPES, PHOTO_TYPES, SIGNATURE_TYPES
)
from services import installer_workflow_service

router = APIRouter(tags=["installer_workflow"])


# Work Order Tasks
@router.get("/work-orders/{work_order_id}/tasks", response_model=List[WorkOrderTask])
async def list_work_order_tasks(work_order_id: int):
    """List all tasks for a work order"""
    return await installer_workflow_service.list_work_order_tasks(work_order_id)


@router.post("/work-orders/{work_order_id}/tasks", response_model=WorkOrderTask, status_code=201)
async def create_work_order_task(work_order_id: int, payload: WorkOrderTaskCreate):
    """Create a new task for a work order"""
    payload.work_order_id = work_order_id
    try:
        return await installer_workflow_service.create_work_order_task(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/tasks/{task_id}", response_model=WorkOrderTask)
async def update_work_order_task(task_id: int, payload: WorkOrderTaskUpdate):
    """Update a work order task"""
    try:
        task = await installer_workflow_service.update_work_order_task(task_id, payload)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/{task_id}/complete", response_model=WorkOrderTask)
async def complete_task(task_id: int, payload: TaskCompletion):
    """Mark a task as completed"""
    try:
        update_data = WorkOrderTaskUpdate(
            status="completed",
            completed_by=payload.completed_by,
            notes=payload.notes,
            checklist_items=payload.checklist_items,
        )
        task = await installer_workflow_service.update_work_order_task(task_id, update_data)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/task-statuses", response_model=List[str])
async def get_task_statuses():
    """Get list of valid task statuses"""
    return TASK_STATUSES


# Work Order Photos
@router.get("/work-orders/{work_order_id}/photos", response_model=List[WorkOrderPhoto])
async def list_work_order_photos(
    work_order_id: int,
    photo_type: Optional[str] = Query(None, description="Filter by photo type"),
):
    """List all photos for a work order"""
    return await installer_workflow_service.list_work_order_photos(work_order_id, photo_type)


@router.post("/work-orders/{work_order_id}/photos", response_model=WorkOrderPhoto, status_code=201)
async def upload_work_order_photo(work_order_id: int, payload: WorkOrderPhotoCreate):
    """Upload a photo for a work order"""
    payload.work_order_id = work_order_id
    try:
        return await installer_workflow_service.create_work_order_photo(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/photo-types", response_model=List[str])
async def get_photo_types():
    """Get list of valid photo types"""
    return PHOTO_TYPES


# Time Entries
@router.get("/work-orders/{work_order_id}/time-entries", response_model=List[WorkOrderTimeEntry])
async def list_work_order_time_entries(
    work_order_id: int,
    installer_id: Optional[int] = Query(None, description="Filter by installer"),
):
    """List all time entries for a work order"""
    return await installer_workflow_service.list_work_order_time_entries(work_order_id, installer_id)


@router.post("/work-orders/{work_order_id}/time-entries/start", response_model=WorkOrderTimeEntry, status_code=201)
async def start_time_entry(work_order_id: int, installer_id: int, payload: TimeEntryStart):
    """Start a new time entry"""
    try:
        from datetime import datetime
        entry_data = WorkOrderTimeEntryCreate(
            work_order_id=work_order_id,
            installer_id=installer_id,
            entry_type=payload.entry_type,
            started_at=datetime.now(),
            notes=payload.notes,
        )
        return await installer_workflow_service.create_time_entry(entry_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/time-entries/{entry_id}/stop", response_model=WorkOrderTimeEntry)
async def stop_time_entry(entry_id: int, payload: TimeEntryStop):
    """Stop a time entry"""
    try:
        from datetime import datetime
        update_data = WorkOrderTimeEntryUpdate(
            ended_at=datetime.now(),
            notes=payload.notes,
        )
        entry = await installer_workflow_service.update_time_entry(entry_id, update_data)
        if not entry:
            raise HTTPException(status_code=404, detail="Time entry not found")
        return entry
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/time-entry-types", response_model=List[str])
async def get_time_entry_types():
    """Get list of valid time entry types"""
    return TIME_ENTRY_TYPES


# Signatures
@router.get("/work-orders/{work_order_id}/signatures", response_model=List[WorkOrderSignature])
async def list_work_order_signatures(work_order_id: int):
    """List all signatures for a work order"""
    return await installer_workflow_service.list_work_order_signatures(work_order_id)


@router.post("/work-orders/{work_order_id}/signatures", response_model=WorkOrderSignature, status_code=201)
async def create_signature(work_order_id: int, payload: WorkOrderSignatureCreate):
    """Create a signature for a work order"""
    payload.work_order_id = work_order_id
    try:
        return await installer_workflow_service.create_signature(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/signature-types", response_model=List[str])
async def get_signature_types():
    """Get list of valid signature types"""
    return SIGNATURE_TYPES


# Progress
@router.get("/work-orders/{work_order_id}/progress", response_model=WorkOrderProgress)
async def get_work_order_progress(work_order_id: int):
    """Get progress summary for a work order"""
    try:
        return await installer_workflow_service.get_work_order_progress(work_order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
