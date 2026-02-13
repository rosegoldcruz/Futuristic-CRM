from typing import List, Optional
from pydantic import BaseModel


class HomeownerContact(BaseModel):
    full_name: str
    email: str
    phone: str
    street: str
    city: str
    state: str
    postal_code: str


class KitchenMeasurements(BaseModel):
    linear_feet_cabinets: float
    ceiling_height_inches: int
    layout_type: str
    has_island: bool
    appliance_notes: Optional[str] = None


class IntakeContext(BaseModel):
    existing_finish: Optional[str] = None
    desired_finish: Optional[str] = None
    doors_drawers_plan: Optional[str] = None
    timeline_weeks: Optional[int] = None
    budget_low: Optional[float] = None
    budget_high: Optional[float] = None
    notes: Optional[str] = None


class ScopeLineItem(BaseModel):
    code: str
    label: str
    qty: float
    unit: str
    unit_price: float
    total_price: float
    notes: Optional[str] = None


class AIScopeResult(BaseModel):
    scope_summary: str
    line_items: List[ScopeLineItem]
    suggested_contract_low: float
    suggested_contract_high: float
    estimated_duration_weeks: int
    risk_flags: List[str]


class IntakeFile(BaseModel):
    filename: str
    url: str


class HomeownerIntakeResponse(BaseModel):
    homeowner: HomeownerContact
    measurements: KitchenMeasurements
    context: IntakeContext
    files: List[IntakeFile]
    ai_scope: AIScopeResult
