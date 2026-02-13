from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from models.installers import Installer, InstallerCreate, InstallerUpdate
from models.jobs import Job
from services import installers_service

router = APIRouter(tags=["installers"])


# Valid tiers for installers
INSTALLER_TIERS = ["apprentice", "standard", "pro", "elite"]
INSTALLER_STATUSES = ["pending", "active", "inactive", "suspended", "terminated"]


@router.get("/", response_model=List[Installer])
async def list_installers(
    status: Optional[str] = Query(None, description="Filter by status"),
    tier: Optional[str] = Query(None, description="Filter by tier"),
    search: Optional[str] = Query(None, description="Search by name, email, phone, or company"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List all installers in the network."""
    return await installers_service.list_installers(
        status=status,
        tier=tier,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/{installer_id}", response_model=Installer)
async def get_installer(installer_id: int):
    """Get a single installer by ID."""
    installer = await installers_service.get_installer(installer_id)
    if not installer:
        raise HTTPException(status_code=404, detail="Installer not found")
    return installer


@router.post("/", response_model=Installer, status_code=201)
async def create_installer(payload: InstallerCreate):
    """Create a new installer."""
    return await installers_service.create_installer(payload)


@router.put("/{installer_id}", response_model=Installer)
async def update_installer(installer_id: int, payload: InstallerUpdate):
    """Update an existing installer."""
    installer = await installers_service.update_installer(installer_id, payload)
    if not installer:
        raise HTTPException(status_code=404, detail="Installer not found")
    return installer


@router.delete("/{installer_id}", status_code=204)
async def delete_installer(installer_id: int):
    """Soft-delete an installer."""
    ok = await installers_service.delete_installer(installer_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Installer not found")
    return None


@router.get("/{installer_id}/jobs", response_model=List[Job])
async def get_installer_jobs(
    installer_id: int,
    status: Optional[str] = Query(None, description="Filter by job status"),
    limit: int = Query(50, ge=1, le=200),
):
    """Get all jobs assigned to an installer."""
    installer = await installers_service.get_installer(installer_id)
    if not installer:
        raise HTTPException(status_code=404, detail="Installer not found")
    
    jobs = await installers_service.get_installer_jobs(installer_id, status=status, limit=limit)
    return jobs


@router.get("/tiers", response_model=List[str])
async def get_installer_tiers():
    """Get list of valid installer tiers."""
    return INSTALLER_TIERS


@router.get("/statuses", response_model=List[str])
async def get_installer_statuses():
    """Get list of valid installer statuses."""
    return INSTALLER_STATUSES


class InstallerAvailabilityResponse(BaseModel):
    installer_id: int
    available: bool
    current_jobs_today: int
    current_jobs_week: int
    max_jobs_per_day: int
    max_jobs_per_week: int
    message: str


@router.get("/{installer_id}/availability", response_model=InstallerAvailabilityResponse)
async def check_installer_availability(installer_id: int):
    """Check if an installer is available for new jobs."""
    installer = await installers_service.get_installer(installer_id)
    if not installer:
        raise HTTPException(status_code=404, detail="Installer not found")
    
    availability = await installers_service.check_availability(installer_id)
    return InstallerAvailabilityResponse(**availability)
