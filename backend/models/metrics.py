"""
Metrics models for real-time analytics and dashboards
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class OverviewMetrics(BaseModel):
    """Overall system metrics"""
    total_leads: int = 0
    total_quotes: int = 0
    total_jobs: int = 0
    total_work_orders: int = 0
    total_payments: int = 0
    active_jobs: int = 0
    pending_quotes: int = 0
    revenue_month: float = 0.0
    revenue_total: float = 0.0
    conversion_rate: float = 0.0
    avg_quote_value: float = 0.0


class JobMetrics(BaseModel):
    """Job-related metrics"""
    total_jobs: int = 0
    pending_jobs: int = 0
    in_progress_jobs: int = 0
    completed_jobs: int = 0
    cancelled_jobs: int = 0
    jobs_by_status: List[dict] = []
    jobs_by_installer: List[dict] = []
    jobs_timeline: List[dict] = []
    avg_completion_time: Optional[float] = None


class RevenueMetrics(BaseModel):
    """Revenue-related metrics"""
    total_revenue: float = 0.0
    revenue_this_month: float = 0.0
    revenue_this_quarter: float = 0.0
    revenue_this_year: float = 0.0
    total_quotes_value: float = 0.0
    approved_quotes_value: float = 0.0
    pending_quotes_value: float = 0.0
    avg_quote_value: float = 0.0
    revenue_timeline: List[dict] = []
    revenue_by_source: List[dict] = []


class LeadMetrics(BaseModel):
    """Lead-related metrics"""
    total_leads: int = 0
    qualified_leads: int = 0
    converted_leads: int = 0
    lead_conversion_rate: float = 0.0
    leads_by_source: List[dict] = []
    leads_timeline: List[dict] = []


class InstallerMetrics(BaseModel):
    """Installer performance metrics"""
    total_installers: int = 0
    active_installers: int = 0
    top_installers: List[dict] = []
    avg_jobs_per_installer: float = 0.0


class DashboardMetrics(BaseModel):
    """Complete dashboard metrics"""
    overview: OverviewMetrics
    jobs: JobMetrics
    revenue: RevenueMetrics
    leads: LeadMetrics
    installers: InstallerMetrics
    last_updated: datetime


class MetricsTrend(BaseModel):
    """Trend data for metrics"""
    metric_name: str
    current_value: float
    previous_value: float
    change_percent: float
    trend: str  # "up", "down", "stable"
