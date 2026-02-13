from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from models.ar_visualizer import (
    ARVisualizer, ARVisualizerCreate, ARVisualizerUpdate,
    RenderRequest, RenderStatusUpdate,
    RENDER_TYPES, RENDER_STATUSES
)
from services import ar_visualizer_service

router = APIRouter(tags=["ar_visualizer"])


@router.get("/", response_model=List[ARVisualizer])
async def list_renders(
    homeowner_id: Optional[int] = Query(None, description="Filter by homeowner"),
    job_id: Optional[int] = Query(None, description="Filter by job"),
    render_type: Optional[str] = Query(None, description="Filter by render type"),
    render_status: Optional[str] = Query(None, description="Filter by status"),
    ar_session_id: Optional[str] = Query(None, description="Filter by AR session"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List AR visualizer renders with optional filtering"""
    return await ar_visualizer_service.list_renders(
        homeowner_id=homeowner_id,
        job_id=job_id,
        render_type=render_type,
        render_status=render_status,
        ar_session_id=ar_session_id,
        limit=limit,
        offset=offset,
    )


@router.get("/types", response_model=List[str])
async def get_render_types():
    """Get list of valid render types"""
    return RENDER_TYPES


@router.get("/statuses", response_model=List[str])
async def get_render_statuses():
    """Get list of valid render statuses"""
    return RENDER_STATUSES


@router.get("/{render_id}", response_model=ARVisualizer)
async def get_render(render_id: int):
    """Get a specific render by ID"""
    render = await ar_visualizer_service.get_render(render_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
    return render


@router.post("/", response_model=ARVisualizer, status_code=201)
async def create_render(payload: ARVisualizerCreate):
    """Create a new AR visualizer render"""
    try:
        return await ar_visualizer_service.create_render(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/render", response_model=ARVisualizer, status_code=201)
async def create_render_job(payload: RenderRequest):
    """Create a new render job (simplified endpoint)"""
    try:
        render_data = ARVisualizerCreate(
            homeowner_id=payload.homeowner_id,
            job_id=payload.job_id,
            render_type=payload.render_type,
            before_image_url=payload.before_image_url,
            panel_selection=payload.panel_selection,
            render_settings=payload.render_settings,
            ar_session_id=payload.ar_session_id,
            render_status="pending",
        )
        return await ar_visualizer_service.create_render(render_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{render_id}", response_model=ARVisualizer)
async def update_render(render_id: int, payload: ARVisualizerUpdate):
    """Update an existing render"""
    try:
        render = await ar_visualizer_service.update_render(render_id, payload)
        if not render:
            raise HTTPException(status_code=404, detail="Render not found")
        return render
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{render_id}", status_code=204)
async def delete_render(render_id: int):
    """Delete a render"""
    ok = await ar_visualizer_service.delete_render(render_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Render not found")
    return None


@router.post("/{render_id}/status", response_model=ARVisualizer)
async def update_render_status(render_id: int, payload: RenderStatusUpdate):
    """Update render status"""
    try:
        render = await ar_visualizer_service.update_render_status(
            render_id,
            payload.render_status,
            payload.after_image_url,
            payload.thumbnail_url
        )
        if not render:
            raise HTTPException(status_code=404, detail="Render not found")
        return render
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/homeowner/{homeowner_id}/renders", response_model=List[ARVisualizer])
async def get_homeowner_renders(homeowner_id: int, limit: int = Query(20, ge=1, le=100)):
    """Get all renders for a specific homeowner"""
    return await ar_visualizer_service.get_homeowner_renders(homeowner_id, limit)


@router.get("/job/{job_id}/renders", response_model=List[ARVisualizer])
async def get_job_renders(job_id: int):
    """Get all renders for a specific job"""
    return await ar_visualizer_service.get_job_renders(job_id)
