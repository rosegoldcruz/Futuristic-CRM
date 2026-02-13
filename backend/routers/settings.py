from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request

from models.settings import (
    SystemSetting, SystemSettingCreate,
    Integration, IntegrationCreate,
    FeatureFlag, FeatureFlagCreate,
    SettingsAuditLog, BrandingSettings,
    TestIntegrationRequest, BulkSettingsUpdate,
    SETTING_CATEGORIES, INTEGRATION_TYPES
)
from services import settings_service

router = APIRouter(tags=["settings"])


# System Settings
@router.get("/", response_model=List[SystemSetting])
async def list_settings(
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
    category: Optional[str] = Query(None, description="Setting category"),
    public_only: bool = Query(False, description="Public settings only"),
):
    """List system settings"""
    return await settings_service.list_settings(tenant_id, category, public_only)


@router.get("/{setting_key}", response_model=SystemSetting)
async def get_setting(
    setting_key: str,
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
):
    """Get a system setting"""
    setting = await settings_service.get_setting(setting_key, tenant_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.post("/", response_model=SystemSetting, status_code=201)
async def set_setting(payload: SystemSettingCreate):
    """Set a system setting"""
    return await settings_service.set_setting(payload)


@router.post("/bulk")
async def bulk_update_settings(payload: BulkSettingsUpdate):
    """Bulk update multiple settings"""
    results = []
    for key, value in payload.settings.items():
        setting = await settings_service.set_setting(SystemSettingCreate(
            setting_key=key,
            setting_value=value,
            category=payload.category,
        ))
        results.append(setting)
    
    return {"updated": len(results), "settings": results}


# Branding
@router.get("/branding/current", response_model=BrandingSettings)
async def get_branding(
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
):
    """Get current branding settings"""
    return await settings_service.get_branding_settings(tenant_id)


@router.post("/branding", response_model=BrandingSettings)
async def set_branding(
    payload: BrandingSettings,
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
):
    """Set branding settings"""
    return await settings_service.set_branding_settings(payload, tenant_id)


# Integrations
@router.get("/integrations", response_model=List[Integration])
async def list_integrations(
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
    integration_type: Optional[str] = Query(None, description="Integration type"),
):
    """List integrations"""
    return await settings_service.list_integrations(tenant_id, integration_type)


@router.get("/integrations/{integration_key}", response_model=Integration)
async def get_integration(
    integration_key: str,
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
):
    """Get an integration"""
    integration = await settings_service.get_integration(integration_key, tenant_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.post("/integrations", response_model=Integration, status_code=201)
async def create_integration(payload: IntegrationCreate):
    """Create or update an integration"""
    return await settings_service.create_integration(payload)


@router.post("/integrations/test")
async def test_integration(payload: TestIntegrationRequest):
    """Test an integration connection"""
    result = await settings_service.test_integration(
        payload.integration_key,
        payload.credentials
    )
    return result


# Feature Flags
@router.get("/feature-flags", response_model=List[FeatureFlag])
async def list_feature_flags(
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
):
    """List feature flags"""
    return await settings_service.list_feature_flags(tenant_id)


@router.get("/feature-flags/{flag_key}", response_model=FeatureFlag)
async def get_feature_flag(
    flag_key: str,
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
):
    """Get a feature flag"""
    flag = await settings_service.get_feature_flag(flag_key, tenant_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag


@router.post("/feature-flags", response_model=FeatureFlag, status_code=201)
async def set_feature_flag(payload: FeatureFlagCreate):
    """Set a feature flag"""
    return await settings_service.set_feature_flag(payload)


@router.get("/feature-flags/{flag_key}/enabled")
async def check_feature_enabled(
    flag_key: str,
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
):
    """Check if a feature flag is enabled"""
    enabled = await settings_service.is_feature_enabled(flag_key, tenant_id)
    return {"flag_key": flag_key, "is_enabled": enabled}


# Audit Logs
@router.get("/audit-logs", response_model=List[SettingsAuditLog])
async def get_audit_logs(
    tenant_id: Optional[int] = Query(None, description="Tenant ID"),
    limit: int = Query(50, ge=1, le=200),
):
    """Get settings audit logs"""
    return await settings_service.get_audit_logs(tenant_id, limit)


# Meta endpoints
@router.get("/meta/categories", response_model=List[str])
async def get_categories():
    """Get list of setting categories"""
    return SETTING_CATEGORIES


@router.get("/meta/integration-types", response_model=List[str])
async def get_integration_types():
    """Get list of integration types"""
    return INTEGRATION_TYPES
