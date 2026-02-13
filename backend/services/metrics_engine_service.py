"""
Metrics engine service - calculations, caching, dashboards
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime, date, timedelta
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.metrics_engine import (
    MetricDefinition, MetricDefinitionCreate,
    MetricSnapshot, MetricSnapshotCreate,
    DashboardWidget, DashboardWidgetCreate,
    MetricValue, MetricTrend, WidgetData, DashboardData
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


def _row_to_metric_definition(row: Dict[str, Any]) -> MetricDefinition:
    """Convert DB row to MetricDefinition model"""
    return MetricDefinition(
        id=row["id"],
        metric_key=row.get("metric_key"),
        metric_name=row.get("metric_name"),
        metric_type=row.get("metric_type"),
        calculation_query=row.get("calculation_query"),
        calculation_function=row.get("calculation_function"),
        aggregation_type=row.get("aggregation_type"),
        category=row.get("category"),
        unit=row.get("unit"),
        format_string=row.get("format_string"),
        cache_duration_seconds=row.get("cache_duration_seconds", 300),
        is_active=row.get("is_active", True),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_dashboard_widget(row: Dict[str, Any]) -> DashboardWidget:
    """Convert DB row to DashboardWidget model"""
    return DashboardWidget(
        id=row["id"],
        widget_key=row.get("widget_key"),
        widget_name=row.get("widget_name"),
        widget_type=row.get("widget_type"),
        metric_keys=_parse_json_field(row.get("metric_keys")) or [],
        config=_parse_json_field(row.get("config")),
        position_x=row.get("position_x"),
        position_y=row.get("position_y"),
        width=row.get("width", 1),
        height=row.get("height", 1),
        is_active=row.get("is_active", True),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


# Metric Definitions
async def create_metric_definition(data: MetricDefinitionCreate) -> MetricDefinition:
    """Create a metric definition"""
    query = """
        INSERT INTO metric_definitions (
            metric_key, metric_name, metric_type, calculation_query, calculation_function,
            aggregation_type, category, unit, format_string, cache_duration_seconds, is_active, metadata
        )
        VALUES (
            :metric_key, :metric_name, :metric_type, :calculation_query, :calculation_function,
            :aggregation_type, :category, :unit, :format_string, :cache_duration_seconds, :is_active, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "metric_key": data.metric_key,
        "metric_name": data.metric_name,
        "metric_type": data.metric_type,
        "calculation_query": data.calculation_query,
        "calculation_function": data.calculation_function,
        "aggregation_type": data.aggregation_type,
        "category": data.category,
        "unit": data.unit,
        "format_string": data.format_string,
        "cache_duration_seconds": data.cache_duration_seconds,
        "is_active": data.is_active,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM metric_definitions WHERE id = :metric_id"
    row = await fetch_one(query, {"metric_id": row["id"]})
    return _row_to_metric_definition(row) if row else None  # type: ignore


async def get_metric_definition(metric_key: str) -> Optional[MetricDefinition]:
    """Get metric definition by key"""
    query = "SELECT * FROM metric_definitions WHERE metric_key = :metric_key AND is_active = true"
    row = await fetch_one(query, {"metric_key": metric_key})
    return _row_to_metric_definition(row) if row else None


async def list_metric_definitions(category: Optional[str] = None) -> List[MetricDefinition]:
    """List all metric definitions"""
    query = "SELECT * FROM metric_definitions WHERE is_active = true"
    params: Dict[str, Any] = {}
    
    if category:
        query += " AND category = :category"
        params["category"] = category
    
    query += " ORDER BY category, metric_name"
    
    rows = await fetch_all(query, params)
    return [_row_to_metric_definition(r) for r in rows]


# Metric Calculations
async def calculate_metric(metric_key: str, dimensions: Optional[Dict[str, Any]] = None) -> Optional[float]:
    """Calculate a metric value"""
    definition = await get_metric_definition(metric_key)
    if not definition:
        return None
    
    # Check cache first
    cached_value = await get_cached_metric(metric_key, dimensions)
    if cached_value is not None:
        return cached_value
    
    # Execute calculation
    if definition.calculation_query:
        value = await execute_calculation_query(definition.calculation_query, dimensions)
    elif definition.calculation_function:
        value = await execute_calculation_function(definition.calculation_function, dimensions)
    else:
        value = None
    
    # Cache the result
    if value is not None:
        await cache_metric(metric_key, value, dimensions, definition.cache_duration_seconds)
    
    return value


async def execute_calculation_query(query: str, dimensions: Optional[Dict[str, Any]] = None) -> Optional[float]:
    """Execute a SQL calculation query"""
    try:
        params = dimensions or {}
        row = await fetch_one(query, params)
        if row:
            # Get the first column value
            value = list(row.values())[0]
            return float(value) if value is not None else None
    except Exception as e:
        print(f"Error executing calculation query: {e}")
    return None


async def execute_calculation_function(function_name: str, dimensions: Optional[Dict[str, Any]] = None) -> Optional[float]:
    """Execute a pre-defined calculation function"""
    # Registry of calculation functions
    functions = {
        "total_leads": calc_total_leads,
        "total_quotes": calc_total_quotes,
        "total_jobs": calc_total_jobs,
        "total_revenue": calc_total_revenue,
        "avg_quote_value": calc_avg_quote_value,
        "conversion_rate": calc_conversion_rate,
        "active_jobs": calc_active_jobs,
        "completed_jobs_this_month": calc_completed_jobs_this_month,
    }
    
    calc_func = functions.get(function_name)
    if calc_func:
        return await calc_func(dimensions)
    
    return None


# Pre-defined calculation functions
async def calc_total_leads(dimensions: Optional[Dict[str, Any]] = None) -> float:
    """Calculate total leads"""
    query = "SELECT COUNT(*) as count FROM leads WHERE deleted_at IS NULL"
    row = await fetch_one(query, {})
    return float(row["count"]) if row else 0.0


async def calc_total_quotes(dimensions: Optional[Dict[str, Any]] = None) -> float:
    """Calculate total quotes"""
    query = "SELECT COUNT(*) as count FROM quotes WHERE deleted_at IS NULL"
    row = await fetch_one(query, {})
    return float(row["count"]) if row else 0.0


async def calc_total_jobs(dimensions: Optional[Dict[str, Any]] = None) -> float:
    """Calculate total jobs"""
    query = "SELECT COUNT(*) as count FROM jobs WHERE deleted_at IS NULL"
    row = await fetch_one(query, {})
    return float(row["count"]) if row else 0.0


async def calc_total_revenue(dimensions: Optional[Dict[str, Any]] = None) -> float:
    """Calculate total revenue"""
    query = "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'"
    row = await fetch_one(query, {})
    return float(row["total"]) if row else 0.0


async def calc_avg_quote_value(dimensions: Optional[Dict[str, Any]] = None) -> float:
    """Calculate average quote value"""
    query = "SELECT COALESCE(AVG(total_price), 0) as avg_value FROM quotes WHERE deleted_at IS NULL"
    row = await fetch_one(query, {})
    return float(row["avg_value"]) if row else 0.0


async def calc_conversion_rate(dimensions: Optional[Dict[str, Any]] = None) -> float:
    """Calculate lead to job conversion rate"""
    leads_query = "SELECT COUNT(*) as count FROM leads WHERE deleted_at IS NULL"
    jobs_query = "SELECT COUNT(*) as count FROM jobs WHERE deleted_at IS NULL"
    
    leads_row = await fetch_one(leads_query, {})
    jobs_row = await fetch_one(jobs_query, {})
    
    leads = float(leads_row["count"]) if leads_row else 0.0
    jobs = float(jobs_row["count"]) if jobs_row else 0.0
    
    return (jobs / leads * 100) if leads > 0 else 0.0


async def calc_active_jobs(dimensions: Optional[Dict[str, Any]] = None) -> float:
    """Calculate active jobs"""
    query = """
        SELECT COUNT(*) as count FROM jobs
        WHERE status IN ('in_progress', 'scheduled')
        AND deleted_at IS NULL
    """
    row = await fetch_one(query, {})
    return float(row["count"]) if row else 0.0


async def calc_completed_jobs_this_month(dimensions: Optional[Dict[str, Any]] = None) -> float:
    """Calculate completed jobs this month"""
    query = """
        SELECT COUNT(*) as count FROM jobs
        WHERE status = 'completed'
        AND updated_at >= DATE_TRUNC('month', CURRENT_DATE)
        AND deleted_at IS NULL
    """
    row = await fetch_one(query, {})
    return float(row["count"]) if row else 0.0


# Caching
async def get_cached_metric(metric_key: str, dimensions: Optional[Dict[str, Any]] = None) -> Optional[float]:
    """Get cached metric value"""
    cache_key = generate_cache_key(metric_key, dimensions)
    
    query = """
        SELECT cached_value FROM metric_cache
        WHERE cache_key = :cache_key AND expires_at > NOW()
    """
    row = await fetch_one(query, {"cache_key": cache_key})
    
    if row:
        cached_data = _parse_json_field(row["cached_value"])
        return cached_data.get("value") if cached_data else None
    
    return None


async def cache_metric(metric_key: str, value: float, dimensions: Optional[Dict[str, Any]] = None, duration_seconds: int = 300):
    """Cache a metric value"""
    cache_key = generate_cache_key(metric_key, dimensions)
    expires_at = datetime.now() + timedelta(seconds=duration_seconds)
    
    query = """
        INSERT INTO metric_cache (cache_key, metric_key, cached_value, expires_at)
        VALUES (:cache_key, :metric_key, CAST(:cached_value AS jsonb), :expires_at)
        ON CONFLICT (cache_key)
        DO UPDATE SET cached_value = CAST(:cached_value AS jsonb), expires_at = :expires_at
    """
    
    await execute(query, {
        "cache_key": cache_key,
        "metric_key": metric_key,
        "cached_value": json.dumps({"value": value, "timestamp": datetime.now().isoformat()}),
        "expires_at": expires_at,
    })


def generate_cache_key(metric_key: str, dimensions: Optional[Dict[str, Any]] = None) -> str:
    """Generate cache key"""
    if dimensions:
        dim_str = json.dumps(dimensions, sort_keys=True)
        return f"{metric_key}:{dim_str}"
    return metric_key


# Trends
async def calculate_metric_trend(metric_key: str, current_period: str = "this_month", compare_period: str = "last_month") -> MetricTrend:
    """Calculate metric trend with comparison"""
    current_value = await calculate_metric(metric_key)
    
    # For now, return trend without comparison (can be enhanced with time-based queries)
    return MetricTrend(
        metric_key=metric_key,
        current_value=current_value or 0.0,
        previous_value=None,
        change=None,
        change_percent=None,
        direction="flat",
    )


# Widgets
async def create_widget(data: DashboardWidgetCreate) -> DashboardWidget:
    """Create a dashboard widget"""
    query = """
        INSERT INTO dashboard_widgets (
            widget_key, widget_name, widget_type, metric_keys, config,
            position_x, position_y, width, height, is_active
        )
        VALUES (
            :widget_key, :widget_name, :widget_type, CAST(:metric_keys AS jsonb), CAST(:config AS jsonb),
            :position_x, :position_y, :width, :height, :is_active
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "widget_key": data.widget_key,
        "widget_name": data.widget_name,
        "widget_type": data.widget_type,
        "metric_keys": json.dumps(data.metric_keys),
        "config": json.dumps(data.config) if data.config else "{}",
        "position_x": data.position_x,
        "position_y": data.position_y,
        "width": data.width,
        "height": data.height,
        "is_active": data.is_active,
    })
    
    query = "SELECT * FROM dashboard_widgets WHERE id = :widget_id"
    row = await fetch_one(query, {"widget_id": row["id"]})
    return _row_to_dashboard_widget(row) if row else None  # type: ignore


async def get_widget_data(widget_key: str) -> Optional[WidgetData]:
    """Get widget data with calculated metrics"""
    query = "SELECT * FROM dashboard_widgets WHERE widget_key = :widget_key AND is_active = true"
    row = await fetch_one(query, {"widget_key": widget_key})
    
    if not row:
        return None
    
    widget = _row_to_dashboard_widget(row)
    
    # Calculate metrics
    metrics = []
    for metric_key in widget.metric_keys:
        definition = await get_metric_definition(metric_key)
        if definition:
            value = await calculate_metric(metric_key)
            
            # Format value
            formatted_value = format_metric_value(value, definition)
            
            metrics.append(MetricValue(
                metric_key=metric_key,
                metric_name=definition.metric_name,
                value=value,
                formatted_value=formatted_value,
                unit=definition.unit,
                timestamp=datetime.now(),
            ))
    
    return WidgetData(
        widget_key=widget.widget_key,
        widget_name=widget.widget_name,
        widget_type=widget.widget_type,
        metrics=metrics,
        config=widget.config,
    )


async def get_dashboard_data() -> DashboardData:
    """Get complete dashboard data"""
    query = "SELECT * FROM dashboard_widgets WHERE is_active = true ORDER BY position_y, position_x"
    rows = await fetch_all(query, {})
    
    widgets_data = []
    for row in rows:
        widget = _row_to_dashboard_widget(row)
        widget_data = await get_widget_data(widget.widget_key)
        if widget_data:
            widgets_data.append(widget_data)
    
    return DashboardData(
        widgets=widgets_data,
        last_updated=datetime.now(),
        refresh_interval=60,
    )


def format_metric_value(value: Optional[float], definition: MetricDefinition) -> str:
    """Format metric value based on definition"""
    if value is None:
        return "N/A"
    
    if definition.metric_type == "currency":
        return f"${value:,.2f}"
    elif definition.metric_type == "percentage":
        return f"{value:.1f}%"
    elif definition.metric_type == "duration":
        return f"{value:.0f}s"
    elif definition.format_string:
        return definition.format_string.format(value)
    else:
        return f"{value:,.0f}"


# Snapshots
async def create_snapshot(metric_key: str) -> Optional[MetricSnapshot]:
    """Create a snapshot of current metric value"""
    value = await calculate_metric(metric_key)
    if value is None:
        return None
    
    query = """
        INSERT INTO metric_snapshots (metric_key, metric_value, snapshot_date)
        VALUES (:metric_key, :metric_value, CURRENT_DATE)
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "metric_key": metric_key,
        "metric_value": value,
    })
    
    query = "SELECT * FROM metric_snapshots WHERE id = :snapshot_id"
    row = await fetch_one(query, {"snapshot_id": row["id"]})
    
    if not row:
        return None
    
    return MetricSnapshot(
        id=row["id"],
        metric_key=row["metric_key"],
        metric_value=float(row["metric_value"]),
        dimensions=_parse_json_field(row.get("dimensions")),
        snapshot_date=row["snapshot_date"],
        snapshot_timestamp=row.get("snapshot_timestamp"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )
