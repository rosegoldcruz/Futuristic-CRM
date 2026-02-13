# Filepath: /srv/vulpine-os/backend/models/ar_visualizer.py

"""
AR Visualizer models for before/after rendering and AR sessions
"""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


# Render type constants
RENDER_TYPES = [
    "before_after",     # Before/after comparison
    "ar_overlay",       # AR overlay on live image
    "3d_model",         # 3D model render
    "roof_analysis",    # Roof analysis visualization
    "panel_layout",     # Panel layout visualization
]

# Render status constants
RENDER_STATUSES = [
    "pending",          # Waiting to start
    "processing",       # Currently processing
    "completed",        # Successfully completed
    "failed",           # Processing failed
    "cancelled",        # Cancelled by user
]


class ARVisualizerBase(BaseModel):
    """Base AR visualizer fields"""
    homeowner_id: Optional[int] = None
    job_id: Optional[int] = None
    render_type: str = "before_after"
    before_image_url: Optional[str] = None
    after_image_url: Optional[str] = None
    ar_session_id: Optional[str] = None
    panel_selection: Optional[dict[str, Any]] = None
    roof_analysis: Optional[dict[str, Any]] = None
    ar_metadata: Optional[dict[str, Any]] = None
    render_settings: Optional[dict[str, Any]] = None


class ARVisualizerCreate(ARVisualizerBase):
    """Create a new AR visualizer render"""
    tenant_id: Optional[int] = None
    render_status: Optional[str] = "pending"


class ARVisualizerUpdate(BaseModel):
    """Update an existing AR visualizer render"""
    render_status: Optional[str] = None
    before_image_url: Optional[str] = None
    after_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    panel_selection: Optional[dict[str, Any]] = None
    roof_analysis: Optional[dict[str, Any]] = None
    ar_metadata: Optional[dict[str, Any]] = None
    render_settings: Optional[dict[str, Any]] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    metadata: Optional[dict[str, Any]] = None


class ARVisualizer(BaseModel):
    """AR visualizer response model"""
    id: int
    tenant_id: Optional[int] = None
    homeowner_id: Optional[int] = None
    job_id: Optional[int] = None
    # Joined fields
    homeowner_name: Optional[str] = None
    job_customer_name: Optional[str] = None
    # Core fields
    render_type: str = "before_after"
    before_image_url: Optional[str] = None
    after_image_url: Optional[str] = None
    render_status: str = "pending"
    ar_session_id: Optional[str] = None
    panel_selection: Optional[dict[str, Any]] = None
    roof_analysis: Optional[dict[str, Any]] = None
    ar_metadata: Optional[dict[str, Any]] = None
    render_settings: Optional[dict[str, Any]] = None
    thumbnail_url: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    metadata: Optional[dict[str, Any]] = None
    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RenderRequest(BaseModel):
    """Request to create a new render job"""
    homeowner_id: int
    job_id: Optional[int] = None
    render_type: str = "before_after"
    before_image_url: str
    panel_selection: Optional[dict[str, Any]] = None
    render_settings: Optional[dict[str, Any]] = None
    ar_session_id: Optional[str] = None


class RenderStatusUpdate(BaseModel):
    """Request to update render status"""
    render_status: str
    after_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class ARSessionMetadata(BaseModel):
    """AR session metadata"""
    session_id: str
    device_info: Optional[dict[str, Any]] = None
    camera_info: Optional[dict[str, Any]] = None
    tracking_quality: Optional[str] = None
    timestamp: Optional[datetime] = None
