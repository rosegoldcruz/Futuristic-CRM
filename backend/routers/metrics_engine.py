from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from models.metrics_engine import (
    MetricDefinition, MetricDefinitionCreate,
    DashboardWidget, DashboardWidgetCreate,
    MetricValue, WidgetData, DashboardData,
    MetricQueryRequest, MetricsRegistryItem,
    METRIC_TYPES, WIDGET_TYPES
)
from services import metrics_engine_service

router = APIRouter(tags=["metrics_engine"])


# Metric Definitions
@router.post("/definitions", response_model=MetricDefinition, status_code=201)
async def create_metric_definition(payload: MetricDefinitionCreate):
    """Create a metric definition"""
    return await metrics_engine_service.create_metric_definition(payload)


@router.get("/definitions", response_model=List[MetricDefinition])
async def list_metric_definitions(
    category: Optional[str] = Query(None, description="Filter by category"),
):
    """List all metric definitions"""
    return await metrics_engine_service.list_metric_definitions(category)


@router.get("/definitions/{metric_key}", response_model=MetricDefinition)
async def get_metric_definition(metric_key: str):
    """Get metric definition by key"""
    definition = await metrics_engine_service.get_metric_definition(metric_key)
    if not definition:
        raise HTTPException(status_code=404, detail="Metric definition not found")
    return definition


# Metric Values
@router.get("/values/{metric_key}")
async def get_metric_value(metric_key: str):
    """Get current metric value"""
    definition = await metrics_engine_service.get_metric_definition(metric_key)
    if not definition:
        raise HTTPException(status_code=404, detail="Metric not found")
    
    value = await metrics_engine_service.calculate_metric(metric_key)
    formatted_value = metrics_engine_service.format_metric_value(value, definition)
    
    return {
        "metric_key": metric_key,
        "metric_name": definition.metric_name,
        "value": value,
        "formatted_value": formatted_value,
        "unit": definition.unit,
        "category": definition.category,
    }


@router.post("/query")
async def query_metric(payload: MetricQueryRequest):
    """Query metric with filters and comparisons"""
    value = await metrics_engine_service.calculate_metric(
        payload.metric_key,
        payload.dimensions
    )
    
    result = {"metric_key": payload.metric_key, "value": value}
    
    if payload.compare_to_previous:
        trend = await metrics_engine_service.calculate_metric_trend(payload.metric_key)
        result["trend"] = trend.dict()
    
    return result


# Widgets
@router.post("/widgets", response_model=DashboardWidget, status_code=201)
async def create_widget(payload: DashboardWidgetCreate):
    """Create a dashboard widget"""
    return await metrics_engine_service.create_widget(payload)


@router.get("/widgets/{widget_key}", response_model=WidgetData)
async def get_widget_data(widget_key: str):
    """Get widget data with calculated metrics"""
    widget_data = await metrics_engine_service.get_widget_data(widget_key)
    if not widget_data:
        raise HTTPException(status_code=404, detail="Widget not found")
    return widget_data


# Dashboard
@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard():
    """Get complete dashboard data"""
    return await metrics_engine_service.get_dashboard_data()


# Snapshots
@router.post("/snapshots/{metric_key}")
async def create_snapshot(metric_key: str):
    """Create a snapshot of current metric value"""
    snapshot = await metrics_engine_service.create_snapshot(metric_key)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Metric not found or value could not be calculated")
    return snapshot


# Registry
@router.get("/registry", response_model=List[MetricsRegistryItem])
async def get_metrics_registry(
    category: Optional[str] = Query(None, description="Filter by category"),
):
    """Get registry of available metrics"""
    definitions = await metrics_engine_service.list_metric_definitions(category)
    
    return [
        MetricsRegistryItem(
            metric_key=d.metric_key,
            metric_name=d.metric_name,
            category=d.category or "general",
            metric_type=d.metric_type,
            description=d.metadata.get("description") if d.metadata else None,
        )
        for d in definitions
    ]


# Meta endpoints
@router.get("/types", response_model=List[str])
async def get_metric_types():
    """Get list of metric types"""
    return METRIC_TYPES


@router.get("/widget-types", response_model=List[str])
async def get_widget_types():
    """Get list of widget types"""
    return WIDGET_TYPES
