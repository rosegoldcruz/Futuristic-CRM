"""
Metrics engine models - definitions, snapshots, dashboards, widgets
"""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# Metric types
METRIC_TYPES = [
    "counter",  # Simple count
    "gauge",  # Current value
    "rate",  # Change over time
    "percentage",  # Percentage value
    "currency",  # Money value
    "duration",  # Time duration
]

# Aggregation types
AGGREGATION_TYPES = ["sum", "avg", "min", "max", "count", "count_distinct"]

# Widget types
WIDGET_TYPES = [
    "number",  # Single number display
    "trend",  # Number with trend indicator
    "chart",  # Line/bar chart
    "pie",  # Pie chart
    "table",  # Data table
    "progress",  # Progress bar
    "gauge",  # Circular gauge
]

# Time periods
TIME_PERIODS = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_quarter", "this_year", "custom"]


class MetricDefinitionBase(BaseModel):
    """Base metric definition fields"""
    metric_key: str
    metric_name: str
    metric_type: str
    calculation_query: Optional[str] = None
    calculation_function: Optional[str] = None
    aggregation_type: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    format_string: Optional[str] = None
    cache_duration_seconds: int = 300
    is_active: bool = True
    metadata: Optional[Dict[str, Any]] = None


class MetricDefinitionCreate(MetricDefinitionBase):
    """Create a metric definition"""
    pass


class MetricDefinition(MetricDefinitionBase):
    """Metric definition response model"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MetricSnapshotBase(BaseModel):
    """Base metric snapshot fields"""
    metric_key: str
    metric_value: float
    dimensions: Optional[Dict[str, Any]] = None
    snapshot_date: date
    metadata: Optional[Dict[str, Any]] = None


class MetricSnapshotCreate(MetricSnapshotBase):
    """Create a metric snapshot"""
    pass


class MetricSnapshot(MetricSnapshotBase):
    """Metric snapshot response model"""
    id: int
    snapshot_timestamp: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DashboardWidgetBase(BaseModel):
    """Base dashboard widget fields"""
    widget_key: str
    widget_name: str
    widget_type: str
    metric_keys: List[str]
    config: Optional[Dict[str, Any]] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    width: int = 1
    height: int = 1
    is_active: bool = True


class DashboardWidgetCreate(DashboardWidgetBase):
    """Create a dashboard widget"""
    pass


class DashboardWidget(DashboardWidgetBase):
    """Dashboard widget response model"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MetricValue(BaseModel):
    """Calculated metric value"""
    metric_key: str
    metric_name: str
    value: Optional[float] = None
    formatted_value: Optional[str] = None
    unit: Optional[str] = None
    timestamp: datetime
    trend: Optional[Dict[str, Any]] = None


class MetricTrend(BaseModel):
    """Metric trend data"""
    metric_key: str
    current_value: float
    previous_value: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    direction: Optional[str] = None  # "up", "down", "flat"


class WidgetData(BaseModel):
    """Widget data with metrics"""
    widget_key: str
    widget_name: str
    widget_type: str
    metrics: List[MetricValue] = []
    chart_data: Optional[List[Dict[str, Any]]] = None
    config: Optional[Dict[str, Any]] = None


class DashboardData(BaseModel):
    """Complete dashboard data"""
    widgets: List[WidgetData] = []
    last_updated: datetime
    refresh_interval: int = 60


class MetricQueryRequest(BaseModel):
    """Request to query a metric"""
    metric_key: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    dimensions: Optional[Dict[str, Any]] = None
    compare_to_previous: bool = False


class MetricsRegistryItem(BaseModel):
    """Registry item for available metrics"""
    metric_key: str
    metric_name: str
    category: str
    metric_type: str
    description: Optional[str] = None
