from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.work_orders import (
    WorkOrder, WorkOrderCreate, WorkOrderUpdate,
    UpdateWorkOrderStatusRequest, GenerateWorkOrderRequest,
    WORK_ORDER_STATUSES, get_allowed_work_order_transitions
)
from services import work_orders_service

router = APIRouter(tags=["work_orders"])


@router.get("/", response_model=List[WorkOrder])
async def list_work_orders(
    search: Optional[str] = Query(None, description="Search work orders"),
    status: Optional[str] = Query(None, description="Filter by status"),
    job_id: Optional[int] = Query(None, description="Filter by job"),
    installer_id: Optional[int] = Query(None, description="Filter by installer"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await work_orders_service.list_work_orders(
        search=search,
        status=status,
        job_id=job_id,
        installer_id=installer_id,
        limit=limit,
        offset=offset,
    )


@router.get("/statuses", response_model=List[str])
async def get_statuses():
    """Get list of valid work order statuses."""
    return WORK_ORDER_STATUSES


@router.get("/{work_order_id}", response_model=WorkOrder)
async def get_work_order(work_order_id: int):
    work_order = await work_orders_service.get_work_order(work_order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    return work_order


@router.get("/by-job/{job_id}", response_model=WorkOrder)
async def get_work_order_by_job(job_id: int):
    """Get work order for a specific job."""
    work_order = await work_orders_service.get_work_order_by_job(job_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found for this job")
    return work_order


@router.post("/", response_model=WorkOrder, status_code=201)
async def create_work_order(payload: WorkOrderCreate):
    return await work_orders_service.create_work_order(payload)


@router.patch("/{work_order_id}", response_model=WorkOrder)
async def update_work_order(work_order_id: int, payload: WorkOrderUpdate):
    work_order = await work_orders_service.update_work_order(work_order_id, payload)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    return work_order


@router.delete("/{work_order_id}", status_code=204)
async def delete_work_order(work_order_id: int):
    ok = await work_orders_service.delete_work_order(work_order_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Work order not found")
    return None


@router.get("/{work_order_id}/allowed-statuses", response_model=List[str])
async def get_allowed_statuses(work_order_id: int):
    """Get list of allowed next statuses for a work order."""
    work_order = await work_orders_service.get_work_order(work_order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    return get_allowed_work_order_transitions(work_order.status or "created")


@router.post("/{work_order_id}/status", response_model=WorkOrder)
async def update_work_order_status(work_order_id: int, payload: UpdateWorkOrderStatusRequest):
    """Update work order status with transition validation."""
    try:
        work_order = await work_orders_service.update_work_order_status(work_order_id, payload.status)
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        return work_order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/generate", response_model=WorkOrder, status_code=201)
async def generate_work_order(payload: GenerateWorkOrderRequest):
    """Generate work order from job with all required data."""
    try:
        work_order = await work_orders_service.generate_work_order_from_job(
            job_id=payload.job_id,
            installer_id=payload.installer_id,
            scheduled_date=payload.scheduled_date,
            scheduled_time_start=payload.scheduled_time_start,
            scheduled_time_end=payload.scheduled_time_end,
            special_instructions=payload.special_instructions,
        )
        return work_order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
