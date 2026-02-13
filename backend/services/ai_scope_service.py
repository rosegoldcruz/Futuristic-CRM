import json
import os
from typing import List, Dict, Any, Optional

import httpx
from fastapi import HTTPException

from models.intake import (
    HomeownerContact,
    KitchenMeasurements,
    IntakeContext,
    AIScopeResult,
    ScopeLineItem,
)


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


async def generate_scope(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simple scope generation from intake data.
    Falls back to basic calculation if AI is not available.
    """
    if not OPENAI_API_KEY:
        # Fallback: basic scope without AI
        cabinet_count = input_data.get("cabinet_count") or 10
        drawer_count = input_data.get("drawer_count") or 5
        
        return {
            "description": input_data.get("project_description", "Cabinet refacing project"),
            "estimated_cabinets": cabinet_count,
            "estimated_drawers": drawer_count,
            "style": input_data.get("preferred_style") or "shaker",
            "materials": [
                {"item": "Cabinet doors", "qty": cabinet_count, "unit_price": 150},
                {"item": "Drawer fronts", "qty": drawer_count, "unit_price": 75},
                {"item": "Hardware", "qty": cabinet_count + drawer_count, "unit_price": 15},
            ],
            "estimated_total": (cabinet_count * 150) + (drawer_count * 75) + ((cabinet_count + drawer_count) * 15),
            "estimated_labor_hours": cabinet_count * 2,
        }
    
    # AI-powered scope generation
    try:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        
        body = {
            "model": OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": "You are a cabinet refacing estimator. Generate a JSON scope."},
                {"role": "user", "content": f"Generate scope for: {json.dumps(input_data)}"}
            ],
            "temperature": 0.2,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{OPENAI_API_BASE}/chat/completions", headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception:
        # Fallback on any error
        return await generate_scope({**input_data, "OPENAI_API_KEY": None})


async def generate_scope_from_intake(
    homeowner: HomeownerContact,
    measurements: KitchenMeasurements,
    context: IntakeContext,
    image_refs: List[str],
) -> AIScopeResult:
    """
    Calls OpenAI to generate a structured scope of work + pricing band from
    homeowner intake data + basic image references.
    """

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    system_prompt = (
        "You are an expert cabinet refacing estimator working for Vulpine, "
        "an AEON-powered contracting OS. You generate detailed but concise "
        "scopes of work and pricing bands for kitchen cabinet refacing jobs. "
        "Only do cabinet refacing (doors, drawer fronts, panels, crown, light "
        "rails, toe kicks, hardware) – no full gut remodels."
    )

    user_payload = {
        "homeowner": homeowner.dict(),
        "measurements": measurements.dict(),
        "context": context.dict(),
        "image_refs": image_refs,
    }

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                "Based on this intake JSON, produce a cabinet-refacing scope. "
                "Return ONLY JSON with this shape:\n\n"
                "{\n"
                '  "scope_summary": str,\n'
                '  "line_items": [\n'
                "    {\n"
                '      "code": str,\n'
                '      "label": str,\n'
                '      "qty": float,\n'
                '      "unit": str,\n'
                '      "unit_price": float,\n'
                '      "total_price": float,\n'
                '      "notes": str | null\n'
                "    }\n"
                "  ],\n"
                '  "suggested_contract_low": float,\n'
                '  "suggested_contract_high": float,\n'
                '  "estimated_duration_weeks": int,\n'
                '  "risk_flags": [str]\n'
                "}\n\n"
                "Here is the intake JSON:\n"
                f"{json.dumps(user_payload, indent=2)}"
            ),
        },
    ]

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    body = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=60.0, base_url=OPENAI_API_BASE) as client:
        try:
            resp = await client.post("/chat/completions", headers=headers, json=body)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"AI provider error: {e}") from e

    data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=502, detail="Invalid AI response format") from e

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI JSON: {e}") from e

    # Validate + normalize via Pydantic
    line_items = [
        ScopeLineItem(
            code=item.get("code", "LINE"),
            label=item.get("label", ""),
            qty=float(item.get("qty", 0)),
            unit=item.get("unit", "ea"),
            unit_price=float(item.get("unit_price", 0)),
            total_price=float(item.get("total_price", 0)),
            notes=item.get("notes"),
        )
        for item in parsed.get("line_items", [])
    ]

    result = AIScopeResult(
        scope_summary=parsed.get("scope_summary", ""),
        line_items=line_items,
        suggested_contract_low=float(parsed.get("suggested_contract_low", 0)),
        suggested_contract_high=float(parsed.get("suggested_contract_high", 0)),
        estimated_duration_weeks=int(parsed.get("estimated_duration_weeks", 0)),
        risk_flags=list(parsed.get("risk_flags", [])),
    )

    return result
