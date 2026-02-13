from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.suppliers import Supplier, SupplierCreate, SupplierUpdate
from models.products import Product
from services import suppliers_service
from services import products_service

router = APIRouter(tags=["suppliers"])


@router.get("/", response_model=List[Supplier])
async def list_suppliers(
    search: Optional[str] = Query(None, description="Search by name, contact, or city"),
    supplier_type: Optional[str] = Query(None, description="Filter by supplier type"),
    state: Optional[str] = Query(None, description="Filter by state"),
    active_only: bool = Query(True, description="Only show active suppliers"),
):
    return await suppliers_service.list_suppliers(
        search=search,
        supplier_type=supplier_type,
        state=state,
        active_only=active_only,
    )


@router.get("/{supplier_id}", response_model=Supplier)
async def get_supplier(supplier_id: int):
    supplier = await suppliers_service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.post("/", response_model=Supplier, status_code=201)
async def create_supplier(payload: SupplierCreate):
    return await suppliers_service.create_supplier(payload)


@router.put("/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: int, payload: SupplierUpdate):
    supplier = await suppliers_service.update_supplier(supplier_id, payload)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(supplier_id: int):
    ok = await suppliers_service.delete_supplier(supplier_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return None


@router.get("/{supplier_id}/products", response_model=List[Product])
async def get_supplier_products(supplier_id: int):
    """Get all products from a specific supplier."""
    supplier = await suppliers_service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return await products_service.get_products_by_supplier(supplier_id)
