from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from config.db import execute_returning
from services.ai_scope_service import generate_scope

router = APIRouter(prefix="/intake", tags=["intake"])


class HomeownerIntakeRequest(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: str
    address_street: str
    address_city: str
    address_state: str
    address_zip: str
    project_description: str
    cabinet_count: Optional[int] = None
    drawer_count: Optional[int] = None
    preferred_style: Optional[str] = None
    budget_range: Optional[str] = None


class IntakeResponse(BaseModel):
    homeowner_id: int
    job_id: int
    scope: Dict[str, Any]
    message: str


@router.post("/homeowner", response_model=IntakeResponse)
async def intake_homeowner(data: HomeownerIntakeRequest):
    """
    Full intake flow:
    1. Create homeowner record
    2. Generate AI scope from project description
    3. Create job with scope attached
    """
    try:
        # 1. Create homeowner
        homeowner_query = """
            INSERT INTO homeowners (
                first_name, last_name, email, phone,
                address_street, address_city, address_state, address_zip
            )
            VALUES (:first_name, :last_name, :email, :phone,
                :address_street, :address_city, :address_state, :address_zip)
            RETURNING id
        """
        homeowner_row = await execute_returning(homeowner_query, {
            "first_name": data.first_name,
            "last_name": data.last_name,
            "email": data.email,
            "phone": data.phone,
            "address_street": data.address_street,
            "address_city": data.address_city,
            "address_state": data.address_state,
            "address_zip": data.address_zip,
        })
        
        if not homeowner_row:
            raise HTTPException(status_code=500, detail="Failed to create homeowner")
        
        homeowner_id = homeowner_row["id"]
        
        # 2. Generate AI scope
        scope_input = {
            "project_description": data.project_description,
            "cabinet_count": data.cabinet_count,
            "drawer_count": data.drawer_count,
            "preferred_style": data.preferred_style,
            "budget_range": data.budget_range,
        }
        
        try:
            scope = await generate_scope(scope_input)
        except Exception:
            # Fallback scope if AI fails
            scope = {
                "description": data.project_description,
                "estimated_cabinets": data.cabinet_count or 10,
                "estimated_drawers": data.drawer_count or 5,
                "style": data.preferred_style or "shaker",
                "materials": [],
                "estimated_total": 0,
            }
        
        # 3. Create job with scope
        import json
        job_query = """
            INSERT INTO jobs (
                homeowner_id, customer_name, status, project_details
            )
            VALUES (:homeowner_id, :customer_name, 'pending', CAST(:project_details AS jsonb))
            RETURNING id
        """
        job_row = await execute_returning(job_query, {
            "homeowner_id": homeowner_id,
            "customer_name": f"{data.first_name} {data.last_name}",
            "project_details": json.dumps(scope),
        })
        
        if not job_row:
            raise HTTPException(status_code=500, detail="Failed to create job")
        
        job_id = job_row["id"]
        
        return IntakeResponse(
            homeowner_id=homeowner_id,
            job_id=job_id,
            scope=scope,
            message="Intake completed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intake failed: {str(e)}")
