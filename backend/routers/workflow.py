"""
AEON Workflow Router - Job Pipeline API
========================================
Exposes workflow operations for the job lifecycle.
"""
from typing import Optional, List
from datetime import date, time

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services import workflow_service

router = APIRouter(prefix="/workflow", tags=["workflow"])


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class IntakeRequest(BaseModel):
    """Full intake submission request."""
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: str = Field(..., max_length=50)
    address_street: str = Field(..., max_length=255)
    address_city: str = Field(..., max_length=100)
    address_state: str = Field(..., max_length=50)
    address_zip: str = Field(..., max_length=20)
    project_description: str = Field(..., max_length=2000)
    cabinet_count: Optional[int] = Field(None, ge=1, le=100)
    drawer_count: Optional[int] = Field(None, ge=0, le=100)
    preferred_style: Optional[str] = Field(None, max_length=50)
    budget_range: Optional[str] = Field(None, max_length=50)
    tenant_id: Optional[int] = None


class IntakeResponse(BaseModel):
    """Response from intake processing."""
    homeowner_id: int
    lead_id: Optional[int]
    quote_id: Optional[int]
    scope: dict
    total_price: float
    status: str
    message: str


class QuoteActionRequest(BaseModel):
    """Request to approve or reject a quote."""
    reason: Optional[str] = None


class QuoteActionResponse(BaseModel):
    """Response from quote action."""
    quote_id: int
    job_id: Optional[int] = None
    status: str
    message: str


class AssignInstallerRequest(BaseModel):
    """Request to assign installer to job."""
    installer_id: int
    scheduled_date: Optional[date] = None
    scheduled_time_start: Optional[time] = None
    scheduled_time_end: Optional[time] = None


class AssignInstallerResponse(BaseModel):
    """Response from installer assignment."""
    job_id: int
    installer_id: int
    installer_name: str
    scheduled_date: Optional[str]
    status: str
    message: str


class StatusTransitionRequest(BaseModel):
    """Request to transition job status."""
    status: str = Field(..., description="New status to transition to")


class StatusTransitionResponse(BaseModel):
    """Response from status transition."""
    job_id: int
    previous_status: str
    status: str
    message: str


class WorkflowStateResponse(BaseModel):
    """Complete workflow state for a job."""
    job_id: int
    status: str
    customer_name: str
    homeowner: Optional[dict]
    installer: Optional[dict]
    quote: Optional[dict]
    scheduled_date: Optional[str]
    project_details: Optional[dict]
    allowed_transitions: List[str]


class PipelineSummaryResponse(BaseModel):
    """Pipeline summary counts."""
    jobs: dict
    quotes: dict
    leads: dict
    pipeline: dict


# ============================================
# INTAKE ENDPOINTS
# ============================================

@router.post("/intake", response_model=IntakeResponse)
async def submit_intake(data: IntakeRequest):
    """
    Submit a new intake form.
    Creates homeowner, lead, generates scope, and creates draft quote.
    """
    try:
        result = await workflow_service.process_intake(
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            phone=data.phone,
            address_street=data.address_street,
            address_city=data.address_city,
            address_state=data.address_state,
            address_zip=data.address_zip,
            project_description=data.project_description,
            cabinet_count=data.cabinet_count,
            drawer_count=data.drawer_count,
            preferred_style=data.preferred_style,
            budget_range=data.budget_range,
            tenant_id=data.tenant_id,
        )
        return IntakeResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intake processing failed: {str(e)}")


# ============================================
# QUOTE WORKFLOW ENDPOINTS
# ============================================

@router.post("/quotes/{quote_id}/approve", response_model=QuoteActionResponse)
async def approve_quote(quote_id: int):
    """
    Approve a quote and create a job.
    Transitions lead to 'converted' and creates work order.
    """
    try:
        result = await workflow_service.approve_quote(quote_id)
        return QuoteActionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quote approval failed: {str(e)}")


@router.post("/quotes/{quote_id}/reject", response_model=QuoteActionResponse)
async def reject_quote(quote_id: int, data: QuoteActionRequest = None):
    """
    Reject a quote.
    Transitions lead to 'lost'.
    """
    try:
        reason = data.reason if data else None
        result = await workflow_service.reject_quote(quote_id, reason)
        return QuoteActionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quote rejection failed: {str(e)}")


# ============================================
# JOB ASSIGNMENT ENDPOINTS
# ============================================

@router.post("/jobs/{job_id}/assign", response_model=AssignInstallerResponse)
async def assign_installer(job_id: int, data: AssignInstallerRequest):
    """
    Assign an installer to a job.
    Optionally set scheduled date/time.
    """
    try:
        result = await workflow_service.assign_installer_to_job(
            job_id=job_id,
            installer_id=data.installer_id,
            scheduled_date=data.scheduled_date,
            scheduled_time_start=data.scheduled_time_start,
            scheduled_time_end=data.scheduled_time_end,
        )
        return AssignInstallerResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assignment failed: {str(e)}")


# ============================================
# JOB STATUS ENDPOINTS
# ============================================

@router.post("/jobs/{job_id}/transition", response_model=StatusTransitionResponse)
async def transition_job_status(job_id: int, data: StatusTransitionRequest):
    """
    Transition a job to a new status.
    Validates the transition is allowed.
    """
    try:
        result = await workflow_service.transition_job_status(job_id, data.status)
        return StatusTransitionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status transition failed: {str(e)}")


# ============================================
# WORKFLOW STATE ENDPOINTS
# ============================================

@router.get("/jobs/{job_id}/state", response_model=WorkflowStateResponse)
async def get_job_workflow_state(job_id: int):
    """
    Get complete workflow state for a job.
    Includes homeowner, installer, quote info, and allowed transitions.
    """
    result = await workflow_service.get_job_workflow_state(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    return WorkflowStateResponse(**result)


@router.get("/pipeline", response_model=PipelineSummaryResponse)
async def get_pipeline_summary(tenant_id: Optional[int] = Query(None)):
    """
    Get summary of jobs in each pipeline stage.
    """
    result = await workflow_service.get_pipeline_summary(tenant_id)
    return PipelineSummaryResponse(**result)
