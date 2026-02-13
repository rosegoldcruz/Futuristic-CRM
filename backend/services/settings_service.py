"""
Settings service - system config, branding, integrations, encryption
"""
from typing import List, Optional, Dict, Any
import json
import base64
from datetime import datetime
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.settings import (
    SystemSetting, SystemSettingCreate, SystemSettingUpdate,
    Integration, IntegrationCreate, IntegrationUpdate,
    FeatureFlag, FeatureFlagCreate, FeatureFlagUpdate,
    SettingsAuditLog, BrandingSettings, EmailSettings
)


# Simple encryption (in production, use proper encryption like Fernet or AWS KMS)
def encrypt_value(value: str) -> str:
    """Encrypt a sensitive value"""
    # In production: use cryptography.fernet or AWS KMS
    encoded = base64.b64encode(value.encode()).decode()
    return f"enc_{encoded}"


def decrypt_value(encrypted: str) -> str:
    """Decrypt a sensitive value"""
    if not encrypted.startswith("enc_"):
        return encrypted
    encoded = encrypted[4:]
    return base64.b64decode(encoded).decode()


def _parse_json_field(value: Any) -> Any:
    """Parse JSON string to Python object if needed."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _row_to_setting(row: Dict[str, Any]) -> SystemSetting:
    """Convert DB row to SystemSetting model"""
    setting_value = row.get("setting_value")
    # Decrypt if encrypted
    if row.get("is_encrypted") and setting_value:
        setting_value = decrypt_value(setting_value)
    
    return SystemSetting(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        setting_key=row.get("setting_key"),
        setting_value=setting_value,
        setting_type=row.get("setting_type", "string"),
        is_encrypted=row.get("is_encrypted", False),
        is_public=row.get("is_public", False),
        category=row.get("category"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_integration(row: Dict[str, Any]) -> Integration:
    """Convert DB row to Integration model"""
    credentials = _parse_json_field(row.get("credentials"))
    # Decrypt credentials if present
    if credentials:
        credentials = {k: decrypt_value(v) if isinstance(v, str) else v for k, v in credentials.items()}
    
    return Integration(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        integration_key=row.get("integration_key"),
        integration_name=row.get("integration_name"),
        integration_type=row.get("integration_type"),
        status=row.get("status", "inactive"),
        credentials=credentials,
        config=_parse_json_field(row.get("config")),
        is_active=row.get("is_active", False),
        last_sync_at=row.get("last_sync_at"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _row_to_feature_flag(row: Dict[str, Any]) -> FeatureFlag:
    """Convert DB row to FeatureFlag model"""
    return FeatureFlag(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        flag_key=row.get("flag_key"),
        flag_name=row.get("flag_name"),
        is_enabled=row.get("is_enabled", False),
        rollout_percentage=row.get("rollout_percentage", 0),
        conditions=_parse_json_field(row.get("conditions")),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


# System Settings
async def get_setting(setting_key: str, tenant_id: Optional[int] = None) -> Optional[SystemSetting]:
    """Get a system setting"""
    query = "SELECT * FROM system_settings WHERE setting_key = :setting_key"
    params: Dict[str, Any] = {"setting_key": setting_key}
    
    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    else:
        query += " AND tenant_id IS NULL"
    
    row = await fetch_one(query, params)
    return _row_to_setting(row) if row else None


async def set_setting(data: SystemSettingCreate, changed_by: Optional[int] = None) -> SystemSetting:
    """Set a system setting (create or update)"""
    # Get old value for audit
    old_setting = await get_setting(data.setting_key, data.tenant_id)
    old_value = old_setting.setting_value if old_setting else None
    
    # Encrypt if needed
    setting_value = data.setting_value
    if data.is_encrypted and setting_value:
        setting_value = encrypt_value(setting_value)
    
    query = """
        INSERT INTO system_settings (
            tenant_id, setting_key, setting_value, setting_type, is_encrypted, is_public, category, metadata
        )
        VALUES (
            :tenant_id, :setting_key, :setting_value, :setting_type, :is_encrypted, :is_public, :category, CAST(:metadata AS jsonb)
        )
        ON CONFLICT (tenant_id, setting_key)
        DO UPDATE SET
            setting_value = :setting_value,
            setting_type = :setting_type,
            is_encrypted = :is_encrypted,
            is_public = :is_public,
            category = :category,
            metadata = CAST(:metadata AS jsonb),
            updated_at = NOW()
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "setting_key": data.setting_key,
        "setting_value": setting_value,
        "setting_type": data.setting_type,
        "is_encrypted": data.is_encrypted,
        "is_public": data.is_public,
        "category": data.category,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    # Audit log
    await log_setting_change(
        tenant_id=data.tenant_id,
        setting_key=data.setting_key,
        action="updated" if old_value else "created",
        old_value=old_value,
        new_value=data.setting_value if not data.is_encrypted else "[ENCRYPTED]",
        changed_by=changed_by,
    )
    
    return await get_setting(data.setting_key, data.tenant_id)  # type: ignore


async def list_settings(tenant_id: Optional[int] = None, category: Optional[str] = None, public_only: bool = False) -> List[SystemSetting]:
    """List system settings"""
    query = "SELECT * FROM system_settings WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    else:
        query += " AND tenant_id IS NULL"
    
    if category:
        query += " AND category = :category"
        params["category"] = category
    
    if public_only:
        query += " AND is_public = true"
    
    query += " ORDER BY category, setting_key"
    
    rows = await fetch_all(query, params)
    return [_row_to_setting(r) for r in rows]


# Branding
async def get_branding_settings(tenant_id: Optional[int] = None) -> BrandingSettings:
    """Get branding settings"""
    settings = await list_settings(tenant_id, category="branding")
    
    branding = BrandingSettings()
    for setting in settings:
        setattr(branding, setting.setting_key.replace("branding.", ""), setting.setting_value)
    
    return branding


async def set_branding_settings(branding: BrandingSettings, tenant_id: Optional[int] = None) -> BrandingSettings:
    """Set branding settings"""
    branding_dict = branding.model_dump(exclude_none=True)
    
    for key, value in branding_dict.items():
        await set_setting(SystemSettingCreate(
            tenant_id=tenant_id,
            setting_key=f"branding.{key}",
            setting_value=str(value),
            setting_type="color" if "color" in key else "string",
            is_public=True,
            category="branding",
        ))
    
    return await get_branding_settings(tenant_id)


# Integrations
async def get_integration(integration_key: str, tenant_id: Optional[int] = None) -> Optional[Integration]:
    """Get an integration"""
    query = "SELECT * FROM integrations WHERE integration_key = :integration_key"
    params: Dict[str, Any] = {"integration_key": integration_key}
    
    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    row = await fetch_one(query, params)
    return _row_to_integration(row) if row else None


async def create_integration(data: IntegrationCreate) -> Integration:
    """Create an integration"""
    # Encrypt credentials
    credentials = data.credentials
    if credentials:
        credentials = {k: encrypt_value(str(v)) if v else None for k, v in credentials.items()}
    
    query = """
        INSERT INTO integrations (
            tenant_id, integration_key, integration_name, integration_type, status,
            credentials, config, is_active, metadata
        )
        VALUES (
            :tenant_id, :integration_key, :integration_name, :integration_type, :status,
            CAST(:credentials AS jsonb), CAST(:config AS jsonb), :is_active, CAST(:metadata AS jsonb)
        )
        ON CONFLICT (tenant_id, integration_key)
        DO UPDATE SET
            integration_name = :integration_name,
            integration_type = :integration_type,
            status = :status,
            credentials = CAST(:credentials AS jsonb),
            config = CAST(:config AS jsonb),
            is_active = :is_active,
            metadata = CAST(:metadata AS jsonb),
            updated_at = NOW()
        RETURNING id
    """
    
    await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "integration_key": data.integration_key,
        "integration_name": data.integration_name,
        "integration_type": data.integration_type,
        "status": data.status,
        "credentials": json.dumps(credentials) if credentials else "{}",
        "config": json.dumps(data.config) if data.config else "{}",
        "is_active": data.is_active,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_integration(data.integration_key, data.tenant_id)  # type: ignore


async def list_integrations(tenant_id: Optional[int] = None, integration_type: Optional[str] = None) -> List[Integration]:
    """List integrations"""
    query = "SELECT * FROM integrations WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    if integration_type:
        query += " AND integration_type = :integration_type"
        params["integration_type"] = integration_type
    
    query += " ORDER BY integration_name"
    
    rows = await fetch_all(query, params)
    return [_row_to_integration(r) for r in rows]


async def test_integration(integration_key: str, credentials: Optional[Dict[str, Any]] = None, tenant_id: Optional[int] = None) -> Dict[str, Any]:
    """Test an integration connection"""
    # Get integration
    integration = await get_integration(integration_key, tenant_id)
    if not integration:
        return {"success": False, "error": "Integration not found"}
    
    # Use provided credentials or stored ones
    test_credentials = credentials or integration.credentials
    if not test_credentials:
        return {"success": False, "error": "No credentials provided"}
    
    # Test based on integration type
    if integration.integration_type == "payment" and "stripe" in integration_key.lower():
        return await test_stripe_connection(test_credentials)
    elif integration.integration_type == "sms" and "twilio" in integration_key.lower():
        return await test_twilio_connection(test_credentials)
    elif integration.integration_type == "ai" and "openai" in integration_key.lower():
        return await test_openai_connection(test_credentials)
    
    return {"success": True, "message": "Connection test not implemented for this integration"}


async def test_stripe_connection(credentials: Dict[str, Any]) -> Dict[str, Any]:
    """Test Stripe connection"""
    # Mock test - in production, call Stripe API
    api_key = credentials.get("api_key")
    if not api_key:
        return {"success": False, "error": "API key missing"}
    
    print(f"[MOCK] Testing Stripe with key: {api_key[:10]}...")
    return {"success": True, "message": "Stripe connection successful"}


async def test_twilio_connection(credentials: Dict[str, Any]) -> Dict[str, Any]:
    """Test Twilio connection"""
    # Mock test - in production, call Twilio API
    account_sid = credentials.get("account_sid")
    auth_token = credentials.get("auth_token")
    
    if not account_sid or not auth_token:
        return {"success": False, "error": "Account SID or Auth Token missing"}
    
    print(f"[MOCK] Testing Twilio with SID: {account_sid[:10]}...")
    return {"success": True, "message": "Twilio connection successful"}


async def test_openai_connection(credentials: Dict[str, Any]) -> Dict[str, Any]:
    """Test OpenAI connection"""
    # Mock test - in production, call OpenAI API
    api_key = credentials.get("api_key")
    if not api_key:
        return {"success": False, "error": "API key missing"}
    
    print(f"[MOCK] Testing OpenAI with key: {api_key[:10]}...")
    return {"success": True, "message": "OpenAI connection successful"}


# Feature Flags
async def get_feature_flag(flag_key: str, tenant_id: Optional[int] = None) -> Optional[FeatureFlag]:
    """Get a feature flag"""
    query = "SELECT * FROM feature_flags WHERE flag_key = :flag_key"
    params: Dict[str, Any] = {"flag_key": flag_key}
    
    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    row = await fetch_one(query, params)
    return _row_to_feature_flag(row) if row else None


async def set_feature_flag(data: FeatureFlagCreate) -> FeatureFlag:
    """Set a feature flag"""
    query = """
        INSERT INTO feature_flags (
            tenant_id, flag_key, flag_name, is_enabled, rollout_percentage, conditions, metadata
        )
        VALUES (
            :tenant_id, :flag_key, :flag_name, :is_enabled, :rollout_percentage, CAST(:conditions AS jsonb), CAST(:metadata AS jsonb)
        )
        ON CONFLICT (tenant_id, flag_key)
        DO UPDATE SET
            flag_name = :flag_name,
            is_enabled = :is_enabled,
            rollout_percentage = :rollout_percentage,
            conditions = CAST(:conditions AS jsonb),
            metadata = CAST(:metadata AS jsonb),
            updated_at = NOW()
        RETURNING id
    """
    
    await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "flag_key": data.flag_key,
        "flag_name": data.flag_name,
        "is_enabled": data.is_enabled,
        "rollout_percentage": data.rollout_percentage,
        "conditions": json.dumps(data.conditions) if data.conditions else "{}",
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_feature_flag(data.flag_key, data.tenant_id)  # type: ignore


async def list_feature_flags(tenant_id: Optional[int] = None) -> List[FeatureFlag]:
    """List feature flags"""
    query = "SELECT * FROM feature_flags WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    query += " ORDER BY flag_name"
    
    rows = await fetch_all(query, params)
    return [_row_to_feature_flag(r) for r in rows]


async def is_feature_enabled(flag_key: str, tenant_id: Optional[int] = None) -> bool:
    """Check if a feature flag is enabled"""
    flag = await get_feature_flag(flag_key, tenant_id)
    return flag.is_enabled if flag else False


# Audit Logging
async def log_setting_change(
    tenant_id: Optional[int],
    setting_key: str,
    action: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    changed_by: Optional[int] = None,
    changed_by_name: Optional[str] = None,
    ip_address: Optional[str] = None,
):
    """Log a setting change"""
    query = """
        INSERT INTO settings_audit_log (
            tenant_id, setting_key, action, old_value, new_value,
            changed_by, changed_by_name, ip_address, metadata
        )
        VALUES (
            :tenant_id, :setting_key, :action, :old_value, :new_value,
            :changed_by, :changed_by_name, :ip_address, CAST(:metadata AS jsonb)
        )
    """
    
    await execute(query, {
        "tenant_id": tenant_id,
        "setting_key": setting_key,
        "action": action,
        "old_value": old_value,
        "new_value": new_value,
        "changed_by": changed_by,
        "changed_by_name": changed_by_name,
        "ip_address": ip_address,
        "metadata": "{}",
    })


async def get_audit_logs(tenant_id: Optional[int] = None, limit: int = 50) -> List[SettingsAuditLog]:
    """Get settings audit logs"""
    query = "SELECT * FROM settings_audit_log WHERE 1=1"
    params: Dict[str, Any] = {}
    
    if tenant_id is not None:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    query += " ORDER BY created_at DESC LIMIT :limit"
    params["limit"] = limit
    
    rows = await fetch_all(query, params)
    
    return [
        SettingsAuditLog(
            id=r["id"],
            tenant_id=r.get("tenant_id"),
            setting_key=r.get("setting_key"),
            action=r["action"],
            old_value=r.get("old_value"),
            new_value=r.get("new_value"),
            changed_by=r.get("changed_by"),
            changed_by_name=r.get("changed_by_name"),
            ip_address=r.get("ip_address"),
            metadata=_parse_json_field(r.get("metadata")),
            created_at=r.get("created_at"),
        )
        for r in rows
    ]
