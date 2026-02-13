"""
Products router for supplier materials catalog
"""
from typing import List, Optional, Dict

from fastapi import APIRouter, HTTPException, Query

from models.products import Product, ProductCreate, ProductUpdate, PRODUCT_CATEGORIES, PRODUCT_STATUSES
from services import products_service

router = APIRouter(tags=["products"])


@router.get("/", response_model=List[Product])
async def list_products(
    supplier_id: Optional[int] = Query(None, description="Filter by supplier"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    style: Optional[str] = Query(None, description="Filter by available style"),
    color: Optional[str] = Query(None, description="Filter by available color"),
    search: Optional[str] = Query(None, description="Search by name, description, or SKU"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List all products in the materials catalog."""
    return await products_service.list_products(
        supplier_id=supplier_id,
        category=category,
        status=status,
        style=style,
        color=color,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/categories", response_model=List[str])
async def get_categories():
    """Get list of product categories."""
    return PRODUCT_CATEGORIES


@router.get("/statuses", response_model=List[str])
async def get_statuses():
    """Get list of product statuses."""
    return PRODUCT_STATUSES


@router.get("/options", response_model=Dict[str, List[str]])
async def get_available_options():
    """Get all available styles, colors, and finishes."""
    return await products_service.get_available_options()


@router.get("/{product_id}", response_model=Product)
async def get_product(product_id: int):
    """Get a single product by ID."""
    product = await products_service.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=Product, status_code=201)
async def create_product(payload: ProductCreate):
    """Create a new product."""
    return await products_service.create_product(payload)


@router.put("/{product_id}", response_model=Product)
async def update_product(product_id: int, payload: ProductUpdate):
    """Update an existing product."""
    product = await products_service.update_product(product_id, payload)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: int):
    """Soft-delete a product."""
    ok = await products_service.delete_product(product_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Product not found")
    return None
