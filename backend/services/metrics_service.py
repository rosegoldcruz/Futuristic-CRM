"""
Metrics service - optimized analytics and real-time metrics
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from config.db import fetch_all, fetch_one, execute
from models.metrics import (
    OverviewMetrics, JobMetrics, RevenueMetrics, LeadMetrics,
    InstallerMetrics, DashboardMetrics
)


async def get_overview_metrics(tenant_id: Optional[int] = None) -> OverviewMetrics:
    """Get overview metrics with optimized queries"""
    # Use indexed queries for fast aggregation
    
    # Total leads
    query = "SELECT COUNT(*) as count FROM leads WHERE deleted_at IS NULL"
    params = {}
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    row = await fetch_one(query, params)
    total_leads = row["count"] if row else 0
    
    # Total quotes
    query = "SELECT COUNT(*) as count FROM quotes WHERE deleted_at IS NULL"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    row = await fetch_one(query, params)
    total_quotes = row["count"] if row else 0
    
    # Total jobs
    query = "SELECT COUNT(*) as count FROM jobs WHERE deleted_at IS NULL"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    row = await fetch_one(query, params)
    total_jobs = row["count"] if row else 0
    
    # Active jobs
    query = "SELECT COUNT(*) as count FROM jobs WHERE status IN ('pending', 'in_progress') AND deleted_at IS NULL"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    row = await fetch_one(query, params)
    active_jobs = row["count"] if row else 0
    
    # Pending quotes
    query = "SELECT COUNT(*) as count FROM quotes WHERE status = 'pending' AND deleted_at IS NULL"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    row = await fetch_one(query, params)
    pending_quotes = row["count"] if row else 0
    
    # Work orders
    query = "SELECT COUNT(*) as count FROM work_orders WHERE deleted_at IS NULL"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    row = await fetch_one(query, params)
    total_work_orders = row["count"] if row else 0
    
    # Payments
    query = "SELECT COUNT(*) as count FROM payments WHERE deleted_at IS NULL"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    row = await fetch_one(query, params)
    total_payments = row["count"] if row else 0
    
    # Revenue this month
    first_day_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    query = """
        SELECT COALESCE(SUM(total_price), 0) as revenue
        FROM quotes
        WHERE status = 'approved' AND deleted_at IS NULL
        AND created_at >= :start_date
    """
    params_rev = {"start_date": first_day_month}
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params_rev["tenant_id"] = tenant_id
    row = await fetch_one(query, params_rev)
    revenue_month = float(row["revenue"]) if row else 0.0
    
    # Total revenue
    query = "SELECT COALESCE(SUM(total_price), 0) as revenue FROM quotes WHERE status = 'approved' AND deleted_at IS NULL"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    row = await fetch_one(query, params)
    revenue_total = float(row["revenue"]) if row else 0.0
    
    # Average quote value
    query = "SELECT COALESCE(AVG(total_price), 0) as avg_value FROM quotes WHERE deleted_at IS NULL"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    row = await fetch_one(query, params)
    avg_quote_value = float(row["avg_value"]) if row else 0.0
    
    # Conversion rate (jobs / quotes)
    conversion_rate = (total_jobs / total_quotes * 100) if total_quotes > 0 else 0.0
    
    return OverviewMetrics(
        total_leads=total_leads,
        total_quotes=total_quotes,
        total_jobs=total_jobs,
        total_work_orders=total_work_orders,
        total_payments=total_payments,
        active_jobs=active_jobs,
        pending_quotes=pending_quotes,
        revenue_month=revenue_month,
        revenue_total=revenue_total,
        conversion_rate=conversion_rate,
        avg_quote_value=avg_quote_value,
    )


async def get_job_metrics(tenant_id: Optional[int] = None) -> JobMetrics:
    """Get job metrics with status breakdown"""
    params: Dict[str, Any] = {}
    where_clause = "WHERE deleted_at IS NULL"
    if tenant_id:
        where_clause += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    # Total jobs
    query = f"SELECT COUNT(*) as count FROM jobs {where_clause}"
    row = await fetch_one(query, params)
    total_jobs = row["count"] if row else 0
    
    # Jobs by status
    query = f"""
        SELECT status, COUNT(*) as count
        FROM jobs
        {where_clause}
        GROUP BY status
        ORDER BY count DESC
    """
    rows = await fetch_all(query, params)
    jobs_by_status = [{"status": r["status"], "count": r["count"]} for r in rows]
    
    # Extract status counts
    pending_jobs = next((r["count"] for r in rows if r["status"] == "pending"), 0)
    in_progress_jobs = next((r["count"] for r in rows if r["status"] == "in_progress"), 0)
    completed_jobs = next((r["count"] for r in rows if r["status"] == "completed"), 0)
    cancelled_jobs = next((r["count"] for r in rows if r["status"] == "cancelled"), 0)
    
    # Jobs by installer
    query = f"""
        SELECT 
            installer_name,
            COUNT(*) as job_count,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_count
        FROM jobs
        {where_clause} AND installer_name IS NOT NULL
        GROUP BY installer_name
        ORDER BY job_count DESC
        LIMIT 10
    """
    rows = await fetch_all(query, params)
    jobs_by_installer = [
        {
            "installer": r["installer_name"],
            "job_count": r["job_count"],
            "completed": r["completed_count"]
        }
        for r in rows
    ]
    
    # Jobs timeline (last 30 days)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    query = f"""
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as count,
            status
        FROM jobs
        {where_clause} AND created_at >= :start_date
        GROUP BY DATE(created_at), status
        ORDER BY date DESC
        LIMIT 30
    """
    params_timeline = {**params, "start_date": thirty_days_ago}
    rows = await fetch_all(query, params_timeline)
    jobs_timeline = [
        {
            "date": r["date"].isoformat() if r["date"] else None,
            "count": r["count"],
            "status": r["status"]
        }
        for r in rows
    ]
    
    return JobMetrics(
        total_jobs=total_jobs,
        pending_jobs=pending_jobs,
        in_progress_jobs=in_progress_jobs,
        completed_jobs=completed_jobs,
        cancelled_jobs=cancelled_jobs,
        jobs_by_status=jobs_by_status,
        jobs_by_installer=jobs_by_installer,
        jobs_timeline=jobs_timeline,
    )


async def get_revenue_metrics(tenant_id: Optional[int] = None) -> RevenueMetrics:
    """Get revenue metrics with timeline"""
    params: Dict[str, Any] = {}
    where_clause = "WHERE deleted_at IS NULL"
    if tenant_id:
        where_clause += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    # Total revenue (approved quotes)
    query = f"""
        SELECT COALESCE(SUM(total_price), 0) as revenue
        FROM quotes
        {where_clause} AND status = 'approved'
    """
    row = await fetch_one(query, params)
    total_revenue = float(row["revenue"]) if row else 0.0
    
    # Revenue this month
    first_day_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    query = f"""
        SELECT COALESCE(SUM(total_price), 0) as revenue
        FROM quotes
        {where_clause} AND status = 'approved' AND created_at >= :start_date
    """
    params_month = {**params, "start_date": first_day_month}
    row = await fetch_one(query, params_month)
    revenue_this_month = float(row["revenue"]) if row else 0.0
    
    # Revenue this quarter
    current_month = datetime.now().month
    quarter_start_month = ((current_month - 1) // 3) * 3 + 1
    first_day_quarter = datetime.now().replace(month=quarter_start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    params_quarter = {**params, "start_date": first_day_quarter}
    row = await fetch_one(query, params_quarter)
    revenue_this_quarter = float(row["revenue"]) if row else 0.0
    
    # Revenue this year
    first_day_year = datetime.now().replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    params_year = {**params, "start_date": first_day_year}
    row = await fetch_one(query, params_year)
    revenue_this_year = float(row["revenue"]) if row else 0.0
    
    # Total quotes value
    query = f"SELECT COALESCE(SUM(total_price), 0) as total FROM quotes {where_clause}"
    row = await fetch_one(query, params)
    total_quotes_value = float(row["total"]) if row else 0.0
    
    # Approved quotes value
    query = f"SELECT COALESCE(SUM(total_price), 0) as total FROM quotes {where_clause} AND status = 'approved'"
    row = await fetch_one(query, params)
    approved_quotes_value = float(row["total"]) if row else 0.0
    
    # Pending quotes value
    query = f"SELECT COALESCE(SUM(total_price), 0) as total FROM quotes {where_clause} AND status = 'pending'"
    row = await fetch_one(query, params)
    pending_quotes_value = float(row["total"]) if row else 0.0
    
    # Average quote value
    query = f"SELECT COALESCE(AVG(total_price), 0) as avg_value FROM quotes {where_clause}"
    row = await fetch_one(query, params)
    avg_quote_value = float(row["avg_value"]) if row else 0.0
    
    # Revenue timeline (last 12 months)
    twelve_months_ago = datetime.now() - timedelta(days=365)
    query = f"""
        SELECT 
            DATE_TRUNC('month', created_at) as month,
            COALESCE(SUM(total_price), 0) as revenue,
            COUNT(*) as quote_count
        FROM quotes
        {where_clause} AND status = 'approved' AND created_at >= :start_date
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
    """
    params_timeline = {**params, "start_date": twelve_months_ago}
    rows = await fetch_all(query, params_timeline)
    revenue_timeline = [
        {
            "month": r["month"].isoformat() if r["month"] else None,
            "revenue": float(r["revenue"]),
            "quote_count": r["quote_count"]
        }
        for r in rows
    ]
    
    return RevenueMetrics(
        total_revenue=total_revenue,
        revenue_this_month=revenue_this_month,
        revenue_this_quarter=revenue_this_quarter,
        revenue_this_year=revenue_this_year,
        total_quotes_value=total_quotes_value,
        approved_quotes_value=approved_quotes_value,
        pending_quotes_value=pending_quotes_value,
        avg_quote_value=avg_quote_value,
        revenue_timeline=revenue_timeline,
    )


async def get_lead_metrics(tenant_id: Optional[int] = None) -> LeadMetrics:
    """Get lead metrics"""
    params: Dict[str, Any] = {}
    where_clause = "WHERE deleted_at IS NULL"
    if tenant_id:
        where_clause += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    # Total leads
    query = f"SELECT COUNT(*) as count FROM leads {where_clause}"
    row = await fetch_one(query, params)
    total_leads = row["count"] if row else 0
    
    # Qualified leads
    query = f"SELECT COUNT(*) as count FROM leads {where_clause} AND status = 'qualified'"
    row = await fetch_one(query, params)
    qualified_leads = row["count"] if row else 0
    
    # Converted leads
    query = f"SELECT COUNT(*) as count FROM leads {where_clause} AND status = 'converted'"
    row = await fetch_one(query, params)
    converted_leads = row["count"] if row else 0
    
    # Conversion rate
    lead_conversion_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0.0
    
    # Leads by source
    query = f"""
        SELECT source, COUNT(*) as count
        FROM leads
        {where_clause} AND source IS NOT NULL
        GROUP BY source
        ORDER BY count DESC
        LIMIT 10
    """
    rows = await fetch_all(query, params)
    leads_by_source = [{"source": r["source"], "count": r["count"]} for r in rows]
    
    # Leads timeline (last 30 days)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    query = f"""
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
        FROM leads
        {where_clause} AND created_at >= :start_date
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    """
    params_timeline = {**params, "start_date": thirty_days_ago}
    rows = await fetch_all(query, params_timeline)
    leads_timeline = [
        {
            "date": r["date"].isoformat() if r["date"] else None,
            "count": r["count"]
        }
        for r in rows
    ]
    
    return LeadMetrics(
        total_leads=total_leads,
        qualified_leads=qualified_leads,
        converted_leads=converted_leads,
        lead_conversion_rate=lead_conversion_rate,
        leads_by_source=leads_by_source,
        leads_timeline=leads_timeline,
    )


async def get_installer_metrics(tenant_id: Optional[int] = None) -> InstallerMetrics:
    """Get installer performance metrics"""
    params: Dict[str, Any] = {}
    where_clause = "WHERE deleted_at IS NULL"
    if tenant_id:
        where_clause += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    # Total installers
    query = f"SELECT COUNT(*) as count FROM installers {where_clause}"
    row = await fetch_one(query, params)
    total_installers = row["count"] if row else 0
    
    # Active installers
    query = f"SELECT COUNT(*) as count FROM installers {where_clause} AND status = 'active'"
    row = await fetch_one(query, params)
    active_installers = row["count"] if row else 0
    
    # Top installers by jobs completed
    query = f"""
        SELECT 
            CONCAT(first_name, ' ', last_name) as name,
            jobs_completed,
            rating_average
        FROM installers
        {where_clause} AND jobs_completed > 0
        ORDER BY jobs_completed DESC
        LIMIT 10
    """
    rows = await fetch_all(query, params)
    top_installers = [
        {
            "name": r["name"],
            "jobs_completed": r["jobs_completed"],
            "rating": float(r["rating_average"]) if r["rating_average"] else 0.0
        }
        for r in rows
    ]
    
    # Average jobs per installer
    avg_jobs_per_installer = 0.0
    if total_installers > 0:
        query = f"SELECT COALESCE(AVG(jobs_completed), 0) as avg_jobs FROM installers {where_clause}"
        row = await fetch_one(query, params)
        avg_jobs_per_installer = float(row["avg_jobs"]) if row else 0.0
    
    return InstallerMetrics(
        total_installers=total_installers,
        active_installers=active_installers,
        top_installers=top_installers,
        avg_jobs_per_installer=avg_jobs_per_installer,
    )


async def get_dashboard_metrics(tenant_id: Optional[int] = None) -> DashboardMetrics:
    """Get complete dashboard metrics"""
    overview = await get_overview_metrics(tenant_id)
    jobs = await get_job_metrics(tenant_id)
    revenue = await get_revenue_metrics(tenant_id)
    leads = await get_lead_metrics(tenant_id)
    installers = await get_installer_metrics(tenant_id)
    
    return DashboardMetrics(
        overview=overview,
        jobs=jobs,
        revenue=revenue,
        leads=leads,
        installers=installers,
        last_updated=datetime.now(),
    )


async def refresh_materialized_views():
    """Refresh all materialized views for updated metrics"""
    await execute("REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics", {})
    await execute("REFRESH MATERIALIZED VIEW CONCURRENTLY job_metrics", {})
    await execute("REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_metrics", {})
    return {"status": "refreshed", "timestamp": datetime.now()}
