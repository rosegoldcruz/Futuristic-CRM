"""
Installer workflow service - tasks, photos, time tracking, signatures
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.installer_workflow import (
    WorkOrderTask, WorkOrderTaskCreate, WorkOrderTaskUpdate,
    WorkOrderPhoto, WorkOrderPhotoCreate,
    WorkOrderTimeEntry, WorkOrderTimeEntryCreate, WorkOrderTimeEntryUpdate,
    WorkOrderSignature, WorkOrderSignatureCreate,
    WorkOrderProgress,
    TASK_STATUSES, TIME_ENTRY_TYPES, PHOTO_TYPES, SIGNATURE_TYPES
)


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


def _row_to_task(row: Dict[str, Any]) -> WorkOrderTask:
    """Convert DB row to WorkOrderTask model"""
    return WorkOrderTask(
        id=row["id"],
        work_order_id=row.get("work_order_id"),
        task_name=row.get("task_name"),
        description=row.get("description"),
        category=row.get("category"),
        status=row.get("status", "pending"),
        is_required=row.get("is_required", True),
        checklist_items=_parse_json_field(row.get("checklist_items")),
        completed_by=row.get("completed_by"),
        completed_at=row.get("completed_at"),
        notes=row.get("notes"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_photo(row: Dict[str, Any]) -> WorkOrderPhoto:
    """Convert DB row to WorkOrderPhoto model"""
    return WorkOrderPhoto(
        id=row["id"],
        work_order_id=row.get("work_order_id"),
        task_id=row.get("task_id"),
        photo_type=row.get("photo_type", "other"),
        file_url=row.get("file_url"),
        file_name=row.get("file_name"),
        file_size=row.get("file_size"),
        mime_type=row.get("mime_type"),
        caption=row.get("caption"),
        uploaded_by=row.get("uploaded_by"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


def _row_to_time_entry(row: Dict[str, Any]) -> WorkOrderTimeEntry:
    """Convert DB row to WorkOrderTimeEntry model"""
    return WorkOrderTimeEntry(
        id=row["id"],
        work_order_id=row.get("work_order_id"),
        installer_id=row.get("installer_id"),
        entry_type=row.get("entry_type"),
        started_at=row.get("started_at"),
        ended_at=row.get("ended_at"),
        duration_minutes=row.get("duration_minutes"),
        notes=row.get("notes"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


def _row_to_signature(row: Dict[str, Any]) -> WorkOrderSignature:
    """Convert DB row to WorkOrderSignature model"""
    return WorkOrderSignature(
        id=row["id"],
        work_order_id=row.get("work_order_id"),
        signature_type=row.get("signature_type"),
        signature_data=row.get("signature_data"),
        signer_name=row.get("signer_name"),
        signer_email=row.get("signer_email"),
        signed_at=row.get("signed_at"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


# Work Order Tasks
async def list_work_order_tasks(work_order_id: int) -> List[WorkOrderTask]:
    """List all tasks for a work order"""
    query = """
        SELECT * FROM work_order_tasks
        WHERE work_order_id = :work_order_id
        ORDER BY id
    """
    rows = await fetch_all(query, {"work_order_id": work_order_id})
    return [_row_to_task(r) for r in rows]


async def create_work_order_task(data: WorkOrderTaskCreate) -> WorkOrderTask:
    """Create a new work order task"""
    if data.status not in TASK_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(TASK_STATUSES)}")
    
    # Validate work order exists
    wo_query = "SELECT id FROM work_orders WHERE id = :work_order_id AND deleted_at IS NULL"
    wo = await fetch_one(wo_query, {"work_order_id": data.work_order_id})
    if not wo:
        raise ValueError(f"Work order {data.work_order_id} not found")
    
    query = """
        INSERT INTO work_order_tasks (
            work_order_id, task_name, description, category, status,
            is_required, checklist_items, notes, metadata
        )
        VALUES (
            :work_order_id, :task_name, :description, :category, :status,
            :is_required, CAST(:checklist_items AS jsonb), :notes, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "work_order_id": data.work_order_id,
        "task_name": data.task_name,
        "description": data.description,
        "category": data.category,
        "status": data.status,
        "is_required": data.is_required,
        "checklist_items": json.dumps(data.checklist_items) if data.checklist_items else "[]",
        "notes": data.notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM work_order_tasks WHERE id = :task_id"
    row = await fetch_one(query, {"task_id": row["id"]})
    return _row_to_task(row) if row else None  # type: ignore


async def update_work_order_task(task_id: int, data: WorkOrderTaskUpdate) -> Optional[WorkOrderTask]:
    """Update a work order task"""
    updates = []
    params: Dict[str, Any] = {"task_id": task_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    if "status" in payload and payload["status"] not in TASK_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(TASK_STATUSES)}")
    
    # Auto-set completed_at when status is completed
    if "status" in payload and payload["status"] == "completed":
        updates.append("completed_at = NOW()")
    
    field_mappings = {
        "status": "status",
        "completed_by": "completed_by",
        "notes": "notes",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    jsonb_fields = ["checklist_items", "metadata"]
    for field_name in jsonb_fields:
        if field_name in payload:
            updates.append(f"{field_name} = CAST(:{field_name} AS jsonb)")
            params[field_name] = json.dumps(payload[field_name]) if payload[field_name] else "{}"

    if not updates:
        query = "SELECT * FROM work_order_tasks WHERE id = :task_id"
        row = await fetch_one(query, {"task_id": task_id})
        return _row_to_task(row) if row else None

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE work_order_tasks SET {set_clause}
        WHERE id = :task_id
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    
    query = "SELECT * FROM work_order_tasks WHERE id = :task_id"
    row = await fetch_one(query, {"task_id": task_id})
    return _row_to_task(row) if row else None


# Work Order Photos
async def list_work_order_photos(work_order_id: int, photo_type: Optional[str] = None) -> List[WorkOrderPhoto]:
    """List all photos for a work order"""
    query = "SELECT * FROM work_order_photos WHERE work_order_id = :work_order_id"
    params: Dict[str, Any] = {"work_order_id": work_order_id}
    
    if photo_type:
        query += " AND photo_type = :photo_type"
        params["photo_type"] = photo_type
    
    query += " ORDER BY created_at DESC"
    
    rows = await fetch_all(query, params)
    return [_row_to_photo(r) for r in rows]


async def create_work_order_photo(data: WorkOrderPhotoCreate) -> WorkOrderPhoto:
    """Create a new work order photo"""
    if data.photo_type not in PHOTO_TYPES:
        raise ValueError(f"Invalid photo_type. Must be one of: {', '.join(PHOTO_TYPES)}")
    
    # Validate work order exists
    wo_query = "SELECT id FROM work_orders WHERE id = :work_order_id AND deleted_at IS NULL"
    wo = await fetch_one(wo_query, {"work_order_id": data.work_order_id})
    if not wo:
        raise ValueError(f"Work order {data.work_order_id} not found")
    
    query = """
        INSERT INTO work_order_photos (
            work_order_id, task_id, photo_type, file_url, file_name,
            file_size, mime_type, caption, uploaded_by, metadata
        )
        VALUES (
            :work_order_id, :task_id, :photo_type, :file_url, :file_name,
            :file_size, :mime_type, :caption, :uploaded_by, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "work_order_id": data.work_order_id,
        "task_id": data.task_id,
        "photo_type": data.photo_type,
        "file_url": data.file_url,
        "file_name": data.file_name,
        "file_size": data.file_size,
        "mime_type": data.mime_type,
        "caption": data.caption,
        "uploaded_by": data.uploaded_by,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM work_order_photos WHERE id = :photo_id"
    row = await fetch_one(query, {"photo_id": row["id"]})
    return _row_to_photo(row) if row else None  # type: ignore


# Time Entries
async def list_work_order_time_entries(work_order_id: int, installer_id: Optional[int] = None) -> List[WorkOrderTimeEntry]:
    """List all time entries for a work order"""
    query = "SELECT * FROM work_order_time_entries WHERE work_order_id = :work_order_id"
    params: Dict[str, Any] = {"work_order_id": work_order_id}
    
    if installer_id:
        query += " AND installer_id = :installer_id"
        params["installer_id"] = installer_id
    
    query += " ORDER BY started_at DESC"
    
    rows = await fetch_all(query, params)
    return [_row_to_time_entry(r) for r in rows]


async def create_time_entry(data: WorkOrderTimeEntryCreate) -> WorkOrderTimeEntry:
    """Create a new time entry"""
    if data.entry_type not in TIME_ENTRY_TYPES:
        raise ValueError(f"Invalid entry_type. Must be one of: {', '.join(TIME_ENTRY_TYPES)}")
    
    # Validate work order exists
    wo_query = "SELECT id FROM work_orders WHERE id = :work_order_id AND deleted_at IS NULL"
    wo = await fetch_one(wo_query, {"work_order_id": data.work_order_id})
    if not wo:
        raise ValueError(f"Work order {data.work_order_id} not found")
    
    # Validate installer exists
    installer_query = "SELECT id FROM installers WHERE id = :installer_id AND deleted_at IS NULL"
    installer = await fetch_one(installer_query, {"installer_id": data.installer_id})
    if not installer:
        raise ValueError(f"Installer {data.installer_id} not found")
    
    # Calculate duration if both start and end are provided
    duration_minutes = data.duration_minutes
    if data.ended_at and not duration_minutes:
        duration_minutes = int((data.ended_at - data.started_at).total_seconds() / 60)
    
    query = """
        INSERT INTO work_order_time_entries (
            work_order_id, installer_id, entry_type, started_at, ended_at,
            duration_minutes, notes, metadata
        )
        VALUES (
            :work_order_id, :installer_id, :entry_type, :started_at, :ended_at,
            :duration_minutes, :notes, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "work_order_id": data.work_order_id,
        "installer_id": data.installer_id,
        "entry_type": data.entry_type,
        "started_at": data.started_at,
        "ended_at": data.ended_at,
        "duration_minutes": duration_minutes,
        "notes": data.notes,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM work_order_time_entries WHERE id = :entry_id"
    row = await fetch_one(query, {"entry_id": row["id"]})
    return _row_to_time_entry(row) if row else None  # type: ignore


async def update_time_entry(entry_id: int, data: WorkOrderTimeEntryUpdate) -> Optional[WorkOrderTimeEntry]:
    """Update a time entry (usually to stop it)"""
    updates = []
    params: Dict[str, Any] = {"entry_id": entry_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    # Auto-calculate duration if ended_at is set
    if "ended_at" in payload and payload["ended_at"]:
        # Get started_at
        start_query = "SELECT started_at FROM work_order_time_entries WHERE id = :entry_id"
        start_row = await fetch_one(start_query, {"entry_id": entry_id})
        if start_row:
            started_at = start_row["started_at"]
            duration_minutes = int((payload["ended_at"] - started_at).total_seconds() / 60)
            updates.append("duration_minutes = :duration_minutes")
            params["duration_minutes"] = duration_minutes
    
    field_mappings = {
        "ended_at": "ended_at",
        "duration_minutes": "duration_minutes",
        "notes": "notes",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload and field_name not in params:  # Skip if already added
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    if "metadata" in payload:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(payload["metadata"]) if payload["metadata"] else "{}"

    if not updates:
        query = "SELECT * FROM work_order_time_entries WHERE id = :entry_id"
        row = await fetch_one(query, {"entry_id": entry_id})
        return _row_to_time_entry(row) if row else None

    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE work_order_time_entries SET {set_clause}
        WHERE id = :entry_id
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    
    query = "SELECT * FROM work_order_time_entries WHERE id = :entry_id"
    row = await fetch_one(query, {"entry_id": entry_id})
    return _row_to_time_entry(row) if row else None


# Signatures
async def list_work_order_signatures(work_order_id: int) -> List[WorkOrderSignature]:
    """List all signatures for a work order"""
    query = "SELECT * FROM work_order_signatures WHERE work_order_id = :work_order_id ORDER BY signed_at"
    rows = await fetch_all(query, {"work_order_id": work_order_id})
    return [_row_to_signature(r) for r in rows]


async def create_signature(data: WorkOrderSignatureCreate) -> WorkOrderSignature:
    """Create a new signature"""
    if data.signature_type not in SIGNATURE_TYPES:
        raise ValueError(f"Invalid signature_type. Must be one of: {', '.join(SIGNATURE_TYPES)}")
    
    # Validate work order exists
    wo_query = "SELECT id FROM work_orders WHERE id = :work_order_id AND deleted_at IS NULL"
    wo = await fetch_one(wo_query, {"work_order_id": data.work_order_id})
    if not wo:
        raise ValueError(f"Work order {data.work_order_id} not found")
    
    query = """
        INSERT INTO work_order_signatures (
            work_order_id, signature_type, signature_data, signer_name,
            signer_email, metadata
        )
        VALUES (
            :work_order_id, :signature_type, :signature_data, :signer_name,
            :signer_email, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "work_order_id": data.work_order_id,
        "signature_type": data.signature_type,
        "signature_data": data.signature_data,
        "signer_name": data.signer_name,
        "signer_email": data.signer_email,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM work_order_signatures WHERE id = :sig_id"
    row = await fetch_one(query, {"sig_id": row["id"]})
    return _row_to_signature(row) if row else None  # type: ignore


# Progress Calculation
async def get_work_order_progress(work_order_id: int) -> WorkOrderProgress:
    """Calculate work order progress"""
    # Get work order status
    wo_query = "SELECT status FROM work_orders WHERE id = :work_order_id AND deleted_at IS NULL"
    wo = await fetch_one(wo_query, {"work_order_id": work_order_id})
    if not wo:
        raise ValueError(f"Work order {work_order_id} not found")
    
    # Count tasks
    tasks_query = """
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'pending') as pending
        FROM work_order_tasks
        WHERE work_order_id = :work_order_id
    """
    tasks = await fetch_one(tasks_query, {"work_order_id": work_order_id})
    
    total_tasks = tasks["total"] if tasks else 0
    completed_tasks = tasks["completed"] if tasks else 0
    pending_tasks = tasks["pending"] if tasks else 0
    
    progress_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0
    
    # Sum time entries
    time_query = """
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM work_order_time_entries
        WHERE work_order_id = :work_order_id
    """
    time_row = await fetch_one(time_query, {"work_order_id": work_order_id})
    total_time_minutes = int(time_row["total_minutes"]) if time_row else 0
    
    # Count photos
    photos_query = "SELECT COUNT(*) as count FROM work_order_photos WHERE work_order_id = :work_order_id"
    photos_row = await fetch_one(photos_query, {"work_order_id": work_order_id})
    photos_count = photos_row["count"] if photos_row else 0
    
    # Count signatures
    sig_query = "SELECT COUNT(*) as count FROM work_order_signatures WHERE work_order_id = :work_order_id"
    sig_row = await fetch_one(sig_query, {"work_order_id": work_order_id})
    signatures_count = sig_row["count"] if sig_row else 0
    
    return WorkOrderProgress(
        work_order_id=work_order_id,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        pending_tasks=pending_tasks,
        progress_percentage=progress_percentage,
        total_time_minutes=total_time_minutes,
        photos_count=photos_count,
        signatures_count=signatures_count,
        status=wo["status"],
    )
