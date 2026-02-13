from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from models.jobs import Job, JobCreate, JobUpdate, AssignInstallerRequest, UpdateJobStatusRequest, get_allowed_transitions
from models.products import ProductSelection
from services import jobs_service


class UpdateMaterialsRequest(BaseModel):
    """Request to update job materials selection."""
    materials: List[ProductSelection]

router = APIRouter(tags=["jobs"])


@router.get("/", response_model=List[Job])
async def list_jobs(
    search: Optional[str] = Query(None, description="Search by title or notes"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await jobs_service.list_jobs(
        search=search,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: int):
    job = await jobs_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/", response_model=Job, status_code=201)
async def create_job(payload: JobCreate):
    return await jobs_service.create_job(payload)


@router.put("/{job_id}", response_model=Job)
async def update_job(job_id: int, payload: JobUpdate):
    job = await jobs_service.update_job(job_id, payload)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/{job_id}", status_code=204)
async def delete_job(job_id: int):
    ok = await jobs_service.delete_job(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found")
    return None


@router.post("/{job_id}/assign-installer", response_model=Job)
async def assign_installer(job_id: int, payload: AssignInstallerRequest):
    """Assign an installer to a job."""
    job = await jobs_service.assign_installer(job_id, payload.installer_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job or installer not found")
    return job


@router.post("/{job_id}/status", response_model=Job)
async def update_job_status(job_id: int, payload: UpdateJobStatusRequest):
    """Update job status with transition validation."""
    try:
        job = await jobs_service.update_job_status(job_id, payload.status)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{job_id}/allowed-statuses", response_model=List[str])
async def get_allowed_statuses(job_id: int):
    """Get list of allowed next statuses for a job."""
    job = await jobs_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return get_allowed_transitions(job.status)


@router.get("/{job_id}/materials", response_model=List[Dict[str, Any]])
async def get_job_materials(job_id: int):
    """Get materials selection for a job."""
    job = await jobs_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return await jobs_service.get_job_materials(job_id)


@router.put("/{job_id}/materials", response_model=Job)
async def update_job_materials(job_id: int, payload: UpdateMaterialsRequest):
    """Update materials selection for a job."""
    materials_data = [m.model_dump() for m in payload.materials]
    job = await jobs_service.update_job_materials(job_id, materials_data)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
