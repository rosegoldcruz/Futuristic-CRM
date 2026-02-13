"""
Installer models - synced with Supabase schema
"""
from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel, Field


class InstallerBase(BaseModel):
    """Base installer fields for create/update"""
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: str = Field(..., max_length=50)
    phone_secondary: Optional[str] = Field(None, max_length=50)
    company_name: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(default="pending", max_length=50)
    tier: Optional[str] = Field(default="apprentice", max_length=50)
    skills: Optional[List[str]] = None
    service_area_zips: Optional[List[str]] = None
    service_radius_miles: Optional[int] = 25
    max_jobs_per_day: Optional[int] = 1
    max_jobs_per_week: Optional[int] = 5
    base_hourly_rate: Optional[float] = None
    base_job_rate: Optional[float] = None
    has_insurance: Optional[bool] = False
    has_vehicle: Optional[bool] = True
    has_tools: Optional[bool] = True
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class InstallerCreate(InstallerBase):
    """Create a new installer"""
    tenant_id: Optional[int] = None


class InstallerUpdate(BaseModel):
    """Update an existing installer"""
    tenant_id: Optional[int] = None
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    phone_secondary: Optional[str] = Field(None, max_length=50)
    company_name: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, max_length=50)
    tier: Optional[str] = Field(None, max_length=50)
    skills: Optional[List[str]] = None
    service_area_zips: Optional[List[str]] = None
    service_radius_miles: Optional[int] = None
    max_jobs_per_day: Optional[int] = None
    max_jobs_per_week: Optional[int] = None
    base_hourly_rate: Optional[float] = None
    base_job_rate: Optional[float] = None
    has_insurance: Optional[bool] = None
    has_vehicle: Optional[bool] = None
    has_tools: Optional[bool] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Installer(BaseModel):
    """Installer response model - matches DB schema exactly"""
    id: int
    tenant_id: Optional[int] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: str
    phone_secondary: Optional[str] = None
    company_name: Optional[str] = None
    status: Optional[str] = None
    tier: Optional[str] = None
    skills: Optional[List[str]] = None
    service_area_zips: Optional[List[str]] = None
    service_radius_miles: Optional[int] = None
    max_jobs_per_day: Optional[int] = None
    max_jobs_per_week: Optional[int] = None
    base_hourly_rate: Optional[float] = None
    base_job_rate: Optional[float] = None
    has_insurance: Optional[bool] = False
    has_vehicle: Optional[bool] = True
    has_tools: Optional[bool] = True
    jobs_completed: Optional[int] = 0
    jobs_cancelled: Optional[int] = 0
    rating_average: Optional[float] = None
    rating_count: Optional[int] = 0
    total_earnings: Optional[float] = None
    pending_payout: Optional[float] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
