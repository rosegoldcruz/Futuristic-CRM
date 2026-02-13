from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.homeowners import Homeowner, HomeownerCreate, HomeownerUpdate
from services import homeowners_service

router = APIRouter(tags=["homeowners"])


@router.get("/", response_model=List[Homeowner])
async def list_homeowners(
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await homeowners_service.list_homeowners(
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/{homeowner_id}", response_model=Homeowner)
async def get_homeowner(homeowner_id: int):
    homeowner = await homeowners_service.get_homeowner(homeowner_id)
    if not homeowner:
        raise HTTPException(status_code=404, detail="Homeowner not found")
    return homeowner


@router.post("/", response_model=Homeowner, status_code=201)
async def create_homeowner(payload: HomeownerCreate):
    return await homeowners_service.create_homeowner(payload)


@router.put("/{homeowner_id}", response_model=Homeowner)
async def update_homeowner(homeowner_id: int, payload: HomeownerUpdate):
    homeowner = await homeowners_service.update_homeowner(homeowner_id, payload)
    if not homeowner:
        raise HTTPException(status_code=404, detail="Homeowner not found")
    return homeowner


@router.delete("/{homeowner_id}", status_code=204)
async def delete_homeowner(homeowner_id: int):
    ok = await homeowners_service.delete_homeowner(homeowner_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Homeowner not found")
    return None
