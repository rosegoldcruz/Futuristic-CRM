from typing import Optional
from fastapi import APIRouter, Query

from models.metrics import (
    OverviewMetrics, JobMetrics, RevenueMetrics, LeadMetrics,
    InstallerMetrics, DashboardMetrics
)
from services import metrics_service

router = APIRouter(tags=["metrics"])


@router.get("/overview", response_model=OverviewMetrics)
async def get_overview_metrics(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant")
):
    """Get overview metrics for dashboard"""
    return await metrics_service.get_overview_metrics(tenant_id)


@router.get("/jobs", response_model=JobMetrics)
async def get_job_metrics(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant")
):
    """Get job-related metrics"""
    return await metrics_service.get_job_metrics(tenant_id)


@router.get("/revenue", response_model=RevenueMetrics)
async def get_revenue_metrics(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant")
):
    """Get revenue-related metrics"""
    return await metrics_service.get_revenue_metrics(tenant_id)


@router.get("/leads", response_model=LeadMetrics)
async def get_lead_metrics(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant")
):
    """Get lead-related metrics"""
    return await metrics_service.get_lead_metrics(tenant_id)


@router.get("/installers", response_model=InstallerMetrics)
async def get_installer_metrics(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant")
):
    """Get installer performance metrics"""
    return await metrics_service.get_installer_metrics(tenant_id)


@router.get("/dashboard", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant")
):
    """Get complete dashboard metrics"""
    return await metrics_service.get_dashboard_metrics(tenant_id)


@router.post("/refresh")
async def refresh_materialized_views():
    """Refresh materialized views for updated metrics"""
    return await metrics_service.refresh_materialized_views()
