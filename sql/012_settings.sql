-- ===========================================================
-- 012_SETTINGS.SQL
-- Per-tenant Configuration, Feature Flags, Integrations
-- System-wide settings, Branding, Notification Preferences
-- Depends on:
--   000_common.sql
--   005_tenants_users.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE setting_type AS ENUM (
  'string',
  'number',
  'boolean',
  'json',
  'encrypted',
  'url',
  'email',
  'color',
  'file'
);

CREATE TYPE setting_category AS ENUM (
  'general',
  'branding',
  'notifications',
  'integrations',
  'payments',
  'scheduling',
  'quotes',
  'jobs',
  'leads',
  'installers',
  'automation',
  'security',
  'compliance',
  'ar_fox',
  'visualizer',
  'advanced'
);

CREATE TYPE integration_status AS ENUM (
  'disconnected',
  'pending',
  'connected',
  'error',
  'expired',
  'revoked'
);

CREATE TYPE integration_type AS ENUM (
  -- Payment
  'stripe',
  'square',
  'paypal',
  
  -- Communication
  'twilio',
  'sendgrid',
  'mailgun',
  'slack',
  
  -- Calendar
  'google_calendar',
  'outlook_calendar',
  
  -- CRM/Marketing
  'hubspot',
  'salesforce',
  'mailchimp',
  'meta_ads',
  'google_ads',
  'tiktok_ads',
  
  -- Call Center
  'vicidial',
  'ringcentral',
  'dialpad',
  
  -- Storage
  'aws_s3',
  'google_cloud_storage',
  'dropbox',
  
  -- Supplier
  'qwikkit',
  
  -- AI/ML
  'openai',
  'replicate',
  'anthropic',
  
  -- Other
  'zapier',
  'webhook',
  'custom'
);

CREATE TYPE feature_flag_status AS ENUM (
  'enabled',
  'disabled',
  'beta',
  'deprecated'
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'sms',
  'push',
  'in_app',
  'slack',
  'webhook'
);

-- ============================================
-- SYSTEM_SETTINGS TABLE (Global platform config)
-- ============================================

CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Setting identity
  key TEXT NOT NULL UNIQUE,
  
  -- Value
  value TEXT,
  value_type setting_type NOT NULL DEFAULT 'string',
  
  -- Validation
  default_value TEXT,
  allowed_values TEXT[], -- For enums
  min_value NUMERIC,
  max_value NUMERIC,
  regex_pattern TEXT,
  
  -- Metadata
  category setting_category NOT NULL DEFAULT 'general',
  label TEXT NOT NULL,
  description TEXT,
  help_url TEXT,
  
  -- Access control
  is_public BOOLEAN NOT NULL DEFAULT false, -- Visible to all tenants
  requires_restart BOOLEAN NOT NULL DEFAULT false,
  is_sensitive BOOLEAN NOT NULL DEFAULT false, -- Mask in logs
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit
  last_modified_by UUID,
  last_modified_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TENANT_SETTINGS TABLE (Per-tenant config)
-- ============================================

CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Setting identity
  key TEXT NOT NULL,
  
  -- Value
  value TEXT,
  value_type setting_type NOT NULL DEFAULT 'string',
  
  -- Inheritance
  inherit_from_system BOOLEAN NOT NULL DEFAULT true, -- Use system default if not set
  
  -- Metadata
  category setting_category NOT NULL DEFAULT 'general',
  label TEXT,
  description TEXT,
  
  -- Audit
  last_modified_by UUID,
  last_modified_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique per tenant
  UNIQUE(tenant_id, key)
) WITH (fillfactor = 90);

-- ============================================
-- USER_SETTINGS TABLE (Per-user preferences)
-- ============================================

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Setting identity
  key TEXT NOT NULL,
  
  -- Value
  value TEXT,
  value_type setting_type NOT NULL DEFAULT 'string',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique per user
  UNIQUE(user_id, key)
) WITH (fillfactor = 90);

-- ============================================
-- FEATURE_FLAGS TABLE (Feature toggles)
-- ============================================

CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Flag identity
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Status
  status feature_flag_status NOT NULL DEFAULT 'disabled',
  
  -- Rollout
  rollout_percentage INT DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  
  -- Targeting
  allowed_tenant_ids UUID[] DEFAULT '{}', -- Empty = all tenants
  allowed_user_ids UUID[] DEFAULT '{}', -- Empty = all users
  allowed_roles TEXT[] DEFAULT '{}', -- Empty = all roles
  allowed_plans TEXT[] DEFAULT '{}', -- Empty = all plans
  
  -- Scheduling
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  
  -- Metadata
  category setting_category DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  
  -- Dependencies
  depends_on TEXT[], -- Other flag keys that must be enabled
  
  -- Audit
  last_modified_by UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TENANT_FEATURE_OVERRIDES TABLE
-- ============================================

CREATE TABLE tenant_feature_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  
  -- Override
  status feature_flag_status NOT NULL,
  
  -- Scheduling
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  
  -- Notes
  reason TEXT,
  
  -- Audit
  created_by UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, feature_flag_id)
) WITH (fillfactor = 90);

-- ============================================
-- INTEGRATIONS TABLE (Third-party connections)
-- ============================================

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Integration identity
  type integration_type NOT NULL,
  name TEXT NOT NULL, -- Display name
  
  -- Status
  status integration_status NOT NULL DEFAULT 'disconnected',
  
  -- Credentials (encrypted)
  credentials_encrypted TEXT, -- Encrypted JSON blob
  -- Contains: api_key, api_secret, access_token, refresh_token, etc.
  
  -- OAuth
  oauth_access_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_token_expires_at TIMESTAMPTZ,
  oauth_scopes TEXT[],
  
  -- Connection info
  account_id TEXT, -- External account ID
  account_name TEXT,
  account_email TEXT,
  
  -- Webhook
  webhook_url TEXT,
  webhook_secret_encrypted TEXT,
  webhook_events TEXT[] DEFAULT '{}',
  
  -- Configuration
  config JSONB DEFAULT '{}' CHECK (jsonb_typeof(config) = 'object'),
  -- Integration-specific settings
  
  -- Health
  last_connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  error_count INT DEFAULT 0,
  
  -- Limits
  rate_limit_remaining INT,
  rate_limit_reset_at TIMESTAMPTZ,
  
  -- Audit log
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID,
  updated_by UUID,
  
  -- One integration per type per tenant
  UNIQUE(tenant_id, type)
) WITH (fillfactor = 90);

-- ============================================
-- INTEGRATION_LOGS TABLE (API call tracking)
-- ============================================

CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Request
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_headers JSONB,
  request_body JSONB,
  
  -- Response
  response_status INT,
  response_headers JSONB,
  response_body JSONB,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- Status
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  
  -- Context
  triggered_by TEXT, -- 'user', 'system', 'aeon', 'webhook'
  triggered_by_id UUID,
  entity_type TEXT,
  entity_id UUID,
  
  -- Rate limiting
  rate_limit_remaining INT,
  rate_limit_reset_at TIMESTAMPTZ,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- NOTIFICATION_TEMPLATES TABLE
-- ============================================

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Scope (NULL = system template)
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Template identity
  key TEXT NOT NULL, -- 'lead_new', 'quote_sent', 'job_completed', etc.
  name TEXT NOT NULL,
  description TEXT,
  
  -- Channel
  channel notification_channel NOT NULL,
  
  -- Content
  subject TEXT, -- For email
  body TEXT NOT NULL,
  body_html TEXT, -- For email
  
  -- Variables
  available_variables TEXT[] DEFAULT '{}', -- ['{{customer_name}}', '{{job_number}}', etc.]
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false, -- Cannot be deleted
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique per scope
  UNIQUE(tenant_id, key, channel)
);

-- ============================================
-- NOTIFICATION_PREFERENCES TABLE
-- ============================================

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Scope
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- If both NULL = system default
  -- If tenant_id only = tenant default
  -- If user_id = user preference
  
  -- Notification type
  notification_key TEXT NOT NULL, -- 'lead_new', 'quote_sent', etc.
  
  -- Channels
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  slack_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Timing
  digest_frequency TEXT DEFAULT 'instant', -- 'instant', 'hourly', 'daily', 'weekly'
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone TEXT DEFAULT 'America/Phoenix',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique per scope
  UNIQUE(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID), 
         COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID), 
         notification_key)
) WITH (fillfactor = 90);

-- ============================================
-- BRANDING_SETTINGS TABLE (Whitelabel config)
-- ============================================

CREATE TABLE branding_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Company info
  company_name TEXT,
  company_legal_name TEXT,
  tagline TEXT,
  
  -- Logo
  logo_url TEXT,
  logo_dark_url TEXT, -- For dark mode
  favicon_url TEXT,
  
  -- Colors
  primary_color TEXT DEFAULT '#f97316', -- Vulpine orange
  secondary_color TEXT DEFAULT '#1f2937',
  accent_color TEXT DEFAULT '#10b981',
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#111827',
  error_color TEXT DEFAULT '#ef4444',
  success_color TEXT DEFAULT '#22c55e',
  warning_color TEXT DEFAULT '#f59e0b',
  
  -- Typography
  font_family TEXT DEFAULT 'Inter',
  heading_font_family TEXT,
  
  -- Custom CSS
  custom_css TEXT,
  
  -- Email branding
  email_header_html TEXT,
  email_footer_html TEXT,
  email_from_name TEXT,
  email_from_address TEXT,
  email_reply_to TEXT,
  
  -- Documents
  quote_header_html TEXT,
  quote_footer_html TEXT,
  invoice_header_html TEXT,
  invoice_footer_html TEXT,
  contract_header_html TEXT,
  contract_footer_html TEXT,
  
  -- Social/contact
  website_url TEXT,
  phone TEXT,
  email TEXT,
  address JSONB DEFAULT '{}',
  social_links JSONB DEFAULT '{}', -- { facebook, instagram, twitter, linkedin, youtube }
  
  -- Legal
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,
  
  -- Portal customization
  portal_welcome_message TEXT,
  portal_custom_js TEXT,
  
  -- AR Fox customization
  ar_fox_enabled BOOLEAN NOT NULL DEFAULT true,
  ar_fox_custom_model_url TEXT,
  ar_fox_custom_colors JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- BUSINESS_HOURS TABLE
-- ============================================

CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Day of week (0 = Sunday, 6 = Saturday)
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  
  -- Hours
  is_open BOOLEAN NOT NULL DEFAULT true,
  open_time TIME,
  close_time TIME,
  
  -- Breaks
  break_start TIME,
  break_end TIME,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, day_of_week)
) WITH (fillfactor = 90);

-- ============================================
-- HOLIDAYS TABLE
-- ============================================

CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Scope (NULL = system/US federal holidays)
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Holiday details
  name TEXT NOT NULL,
  date DATE NOT NULL,
  
  -- Full day or partial
  is_full_day BOOLEAN NOT NULL DEFAULT true,
  open_time TIME,
  close_time TIME,
  
  -- Recurring
  is_recurring BOOLEAN NOT NULL DEFAULT false, -- Same date every year
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, date)
);

-- ============================================
-- INDEXES: SYSTEM_SETTINGS
-- ============================================

CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_active ON system_settings(is_active) WHERE is_active = true;

-- ============================================
-- INDEXES: TENANT_SETTINGS
-- ============================================

CREATE INDEX idx_tenant_settings_tenant ON tenant_settings(tenant_id);
CREATE INDEX idx_tenant_settings_key ON tenant_settings(tenant_id, key);
CREATE INDEX idx_tenant_settings_category ON tenant_settings(tenant_id, category);

-- ============================================
-- INDEXES: USER_SETTINGS
-- ============================================

CREATE INDEX idx_user_settings_user ON user_settings(user_id);
CREATE INDEX idx_user_settings_tenant ON user_settings(tenant_id);
CREATE INDEX idx_user_settings_key ON user_settings(user_id, key);

-- ============================================
-- INDEXES: FEATURE_FLAGS
-- ============================================

CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_status ON feature_flags(status);
CREATE INDEX idx_feature_flags_category ON feature_flags(category);
CREATE INDEX idx_feature_flags_tenants_gin ON feature_flags USING GIN (allowed_tenant_ids array_ops);
CREATE INDEX idx_feature_flags_roles_gin ON feature_flags USING GIN (allowed_roles array_ops);
CREATE INDEX idx_feature_flags_tags_gin ON feature_flags USING GIN (tags array_ops);

-- ============================================
-- INDEXES: TENANT_FEATURE_OVERRIDES
-- ============================================

CREATE INDEX idx_tenant_feature_overrides_tenant ON tenant_feature_overrides(tenant_id);
CREATE INDEX idx_tenant_feature_overrides_flag ON tenant_feature_overrides(feature_flag_id);

-- ============================================
-- INDEXES: INTEGRATIONS
-- ============================================

CREATE INDEX idx_integrations_tenant ON integrations(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_integrations_type ON integrations(tenant_id, type) WHERE deleted_at IS NULL;
CREATE INDEX idx_integrations_status ON integrations(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_integrations_config_gin ON integrations USING GIN (config jsonb_path_ops);
CREATE INDEX idx_integrations_metadata_gin ON integrations USING GIN (metadata jsonb_path_ops);

-- ============================================
-- INDEXES: INTEGRATION_LOGS
-- ============================================

CREATE INDEX idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX idx_integration_logs_tenant ON integration_logs(tenant_id);
CREATE INDEX idx_integration_logs_created ON integration_logs(integration_id, created_at DESC);
CREATE INDEX idx_integration_logs_success ON integration_logs(integration_id, success);
CREATE INDEX idx_integration_logs_entity ON integration_logs(entity_type, entity_id) WHERE entity_type IS NOT NULL;

-- ============================================
-- INDEXES: NOTIFICATION_TEMPLATES
-- ============================================

CREATE INDEX idx_notification_templates_tenant ON notification_templates(tenant_id);
CREATE INDEX idx_notification_templates_key ON notification_templates(key);
CREATE INDEX idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX idx_notification_templates_active ON notification_templates(tenant_id, is_active) WHERE is_active = true;

-- ============================================
-- INDEXES: NOTIFICATION_PREFERENCES
-- ============================================

CREATE INDEX idx_notification_preferences_tenant ON notification_preferences(tenant_id);
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_key ON notification_preferences(notification_key);

-- ============================================
-- INDEXES: BRANDING
-- ============================================

CREATE INDEX idx_branding_settings_tenant ON branding_settings(tenant_id);

-- ============================================
-- INDEXES: BUSINESS_HOURS
-- ============================================

CREATE INDEX idx_business_hours_tenant ON business_hours(tenant_id);
CREATE INDEX idx_business_hours_day ON business_hours(tenant_id, day_of_week);

-- ============================================
-- INDEXES: HOLIDAYS
-- ============================================

CREATE INDEX idx_holidays_tenant ON holidays(tenant_id);
CREATE INDEX idx_holidays_date ON holidays(date);
CREATE INDEX idx_holidays_tenant_date ON holidays(tenant_id, date);

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tenant_feature_overrides_updated_at
  BEFORE UPDATE ON tenant_feature_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER branding_settings_updated_at
  BEFORE UPDATE ON branding_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER business_hours_updated_at
  BEFORE UPDATE ON business_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Audit logging for integrations
CREATE TRIGGER integrations_audit
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION audit_entity();

-- Track setting changes
CREATE OR REPLACE FUNCTION track_setting_change()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at := NOW();
  NEW.last_modified_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_settings_track_change
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION track_setting_change();

CREATE TRIGGER tenant_settings_track_change
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION track_setting_change();

-- ============================================
-- ROW LEVEL SECURITY: SYSTEM_SETTINGS
-- ============================================

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY system_settings_select ON system_settings
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR is_public = true
  );

CREATE POLICY system_settings_insert ON system_settings
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY system_settings_update ON system_settings
  FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY system_settings_delete ON system_settings
  FOR DELETE
  USING ((auth.jwt() ->> 'role') = 'superadmin');

-- ============================================
-- ROW LEVEL SECURITY: TENANT_SETTINGS
-- ============================================

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_settings_select ON tenant_settings
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY tenant_settings_insert ON tenant_settings
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY tenant_settings_update ON tenant_settings
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY tenant_settings_delete ON tenant_settings
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- ============================================
-- ROW LEVEL SECURITY: USER_SETTINGS
-- ============================================

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY user_settings_select ON user_settings
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (
      (auth.jwt() ->> 'role') IN ('owner', 'admin')
      AND tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY user_settings_insert ON user_settings
  FOR INSERT
  WITH CHECK (
    user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (auth.jwt() ->> 'role') = 'superadmin'
  );

CREATE POLICY user_settings_update ON user_settings
  FOR UPDATE
  USING (
    user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (auth.jwt() ->> 'role') = 'superadmin'
  )
  WITH CHECK (
    user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (auth.jwt() ->> 'role') = 'superadmin'
  );

CREATE POLICY user_settings_delete ON user_settings
  FOR DELETE
  USING (
    user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (auth.jwt() ->> 'role') = 'superadmin'
  );

-- ============================================
-- ROW LEVEL SECURITY: FEATURE_FLAGS
-- ============================================

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags FORCE ROW LEVEL SECURITY;

CREATE POLICY feature_flags_select ON feature_flags
  FOR SELECT
  USING (true); -- Everyone can read flags

CREATE POLICY feature_flags_insert ON feature_flags
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY feature_flags_update ON feature_flags
  FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY feature_flags_delete ON feature_flags
  FOR DELETE
  USING ((auth.jwt() ->> 'role') = 'superadmin');

-- ============================================
-- ROW LEVEL SECURITY: TENANT_FEATURE_OVERRIDES
-- ============================================

ALTER TABLE tenant_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_feature_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_feature_overrides_select ON tenant_feature_overrides
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY tenant_feature_overrides_insert ON tenant_feature_overrides
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY tenant_feature_overrides_update ON tenant_feature_overrides
  FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY tenant_feature_overrides_delete ON tenant_feature_overrides
  FOR DELETE
  USING ((auth.jwt() ->> 'role') = 'superadmin');

-- ============================================
-- ROW LEVEL SECURITY: INTEGRATIONS
-- ============================================

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;

CREATE POLICY integrations_select ON integrations
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY integrations_insert ON integrations
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY integrations_update ON integrations
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR (
        (auth.jwt() ->> 'role') IN ('owner', 'admin')
        AND tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY integrations_delete ON integrations
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: INTEGRATION_LOGS
-- ============================================

ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY integration_logs_select ON integration_logs
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      (auth.jwt() ->> 'role') IN ('owner', 'admin')
      AND tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY integration_logs_insert ON integration_logs
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- Logs are immutable
CREATE POLICY integration_logs_update ON integration_logs
  FOR UPDATE
  USING (false);

CREATE POLICY integration_logs_delete ON integration_logs
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: NOTIFICATION_TEMPLATES
-- ============================================

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY notification_templates_select ON notification_templates
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id IS NULL -- System templates
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY notification_templates_insert ON notification_templates
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND (
      tenant_id IS NULL -- Only superadmin can create system templates
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY notification_templates_update ON notification_templates
  FOR UPDATE
  USING (
    NOT is_system -- System templates cannot be modified
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR (
        (auth.jwt() ->> 'role') IN ('owner', 'admin')
        AND tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY notification_templates_delete ON notification_templates
  FOR DELETE
  USING (
    NOT is_system
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR (
        (auth.jwt() ->> 'role') IN ('owner', 'admin')
        AND tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
      )
    )
  );

-- ============================================
-- ROW LEVEL SECURITY: NOTIFICATION_PREFERENCES
-- ============================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_select ON notification_preferences
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (
      user_id IS NULL
      AND tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY notification_preferences_insert ON notification_preferences
  FOR INSERT
  WITH CHECK (
    user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (
      (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
      AND user_id IS NULL
    )
  );

CREATE POLICY notification_preferences_update ON notification_preferences
  FOR UPDATE
  USING (
    user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      (auth.jwt() ->> 'role') IN ('owner', 'admin')
      AND user_id IS NULL
      AND tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  )
  WITH CHECK (
    user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (auth.jwt() ->> 'role') = 'superadmin'
  );

CREATE POLICY notification_preferences_delete ON notification_preferences
  FOR DELETE
  USING (
    user_id = (auth.jwt() ->> 'user_id')::UUID
    OR (auth.jwt() ->> 'role') = 'superadmin'
  );

-- ============================================
-- ROW LEVEL SECURITY: BRANDING_SETTINGS
-- ============================================

ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY branding_settings_select ON branding_settings
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY branding_settings_insert ON branding_settings
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY branding_settings_update ON branding_settings
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      (auth.jwt() ->> 'role') IN ('owner', 'admin')
      AND tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY branding_settings_delete ON branding_settings
  FOR DELETE
  USING ((auth.jwt() ->> 'role') = 'superadmin');

-- ============================================
-- ROW LEVEL SECURITY: BUSINESS_HOURS & HOLIDAYS
-- ============================================

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours FORCE ROW LEVEL SECURITY;

CREATE POLICY business_hours_select ON business_hours
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY business_hours_insert ON business_hours
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY business_hours_update ON business_hours
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY business_hours_delete ON business_hours
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays FORCE ROW LEVEL SECURITY;

CREATE POLICY holidays_select ON holidays
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id IS NULL -- System holidays
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY holidays_insert ON holidays
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND (
      tenant_id IS NULL
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY holidays_update ON holidays
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND (
      tenant_id IS NULL
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY holidays_delete ON holidays
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND (
      tenant_id IS NULL
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get setting value with inheritance
CREATE OR REPLACE FUNCTION get_setting(
  p_key TEXT,
  p_default TEXT DEFAULT NULL
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_value TEXT;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  -- Check tenant setting first
  IF v_tenant_id IS NOT NULL THEN
    SELECT ts.value INTO v_value
    FROM tenant_settings ts
    WHERE ts.tenant_id = v_tenant_id
      AND ts.key = p_key
      AND (NOT ts.inherit_from_system OR ts.value IS NOT NULL);
    
    IF v_value IS NOT NULL THEN
      RETURN v_value;
    END IF;
  END IF;
  
  -- Fall back to system setting
  SELECT ss.value INTO v_value
  FROM system_settings ss
  WHERE ss.key = p_key
    AND ss.is_active = true;
  
  RETURN COALESCE(v_value, p_default);
END;
$$;

-- Get setting as boolean
CREATE OR REPLACE FUNCTION get_setting_bool(
  p_key TEXT,
  p_default BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_value TEXT;
BEGIN
  v_value := get_setting(p_key);
  
  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;
  
  RETURN LOWER(v_value) IN ('true', '1', 'yes', 'on', 'enabled');
END;
$$;

-- Get setting as number
CREATE OR REPLACE FUNCTION get_setting_number(
  p_key TEXT,
  p_default NUMERIC DEFAULT 0
)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_value TEXT;
BEGIN
  v_value := get_setting(p_key);
  
  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;
  
  RETURN v_value::NUMERIC;
EXCEPTION
  WHEN OTHERS THEN
    RETURN p_default;
END;
$$;

-- Get setting as JSON
CREATE OR REPLACE FUNCTION get_setting_json(
  p_key TEXT,
  p_default JSONB DEFAULT '{}'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_value TEXT;
BEGIN
  v_value := get_setting(p_key);
  
  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;
  
  RETURN v_value::JSONB;
EXCEPTION
  WHEN OTHERS THEN
    RETURN p_default;
END;
$$;

-- Set tenant setting
CREATE OR REPLACE FUNCTION set_tenant_setting(
  p_key TEXT,
  p_value TEXT,
  p_category setting_category DEFAULT 'general',
  p_value_type setting_type DEFAULT 'string'
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context required';
  END IF;
  
  INSERT INTO tenant_settings (tenant_id, key, value, value_type, category, inherit_from_system)
  VALUES (v_tenant_id, p_key, p_value, p_value_type, p_category, p_value IS NULL)
  ON CONFLICT (tenant_id, key)
  DO UPDATE SET
    value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    category = EXCLUDED.category,
    inherit_from_system = EXCLUDED.value IS NULL;
  
  RETURN TRUE;
END;
$$;

-- Check feature flag
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_key TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_user_role TEXT;
  v_tenant_plan TEXT;
  v_flag RECORD;
  v_override RECORD;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  v_user_id := COALESCE(p_user_id, (auth.jwt() ->> 'user_id')::UUID);
  v_user_role := auth.jwt() ->> 'role';
  
  -- Get tenant plan
  SELECT plan INTO v_tenant_plan
  FROM tenants
  WHERE id = v_tenant_id;
  
  -- Get flag
  SELECT * INTO v_flag
  FROM feature_flags
  WHERE key = p_flag_key;
  
  IF v_flag IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check for tenant override
  IF v_tenant_id IS NOT NULL THEN
    SELECT * INTO v_override
    FROM tenant_feature_overrides
    WHERE tenant_id = v_tenant_id
      AND feature_flag_id = v_flag.id;
    
    IF v_override IS NOT NULL THEN
      -- Check override scheduling
      IF v_override.enabled_at IS NOT NULL AND v_override.enabled_at > NOW() THEN
        RETURN FALSE;
      END IF;
      IF v_override.disabled_at IS NOT NULL AND v_override.disabled_at <= NOW() THEN
        RETURN FALSE;
      END IF;
      
      RETURN v_override.status = 'enabled';
    END IF;
  END IF;
  
  -- Check flag status
  IF v_flag.status = 'disabled' THEN
    RETURN FALSE;
  END IF;
  
  -- Check scheduling
  IF v_flag.enabled_at IS NOT NULL AND v_flag.enabled_at > NOW() THEN
    RETURN FALSE;
  END IF;
  IF v_flag.disabled_at IS NOT NULL AND v_flag.disabled_at <= NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Check tenant targeting
  IF array_length(v_flag.allowed_tenant_ids, 1) > 0 
     AND NOT (v_tenant_id = ANY(v_flag.allowed_tenant_ids)) THEN
    RETURN FALSE;
  END IF;
  
  -- Check user targeting
  IF array_length(v_flag.allowed_user_ids, 1) > 0 
     AND NOT (v_user_id = ANY(v_flag.allowed_user_ids)) THEN
    RETURN FALSE;
  END IF;
  
  -- Check role targeting
  IF array_length(v_flag.allowed_roles, 1) > 0 
     AND v_user_role IS NOT NULL
     AND NOT (v_user_role = ANY(v_flag.allowed_roles)) THEN
    RETURN FALSE;
  END IF;
  
  -- Check plan targeting
  IF array_length(v_flag.allowed_plans, 1) > 0 
     AND v_tenant_plan IS NOT NULL
     AND NOT (v_tenant_plan = ANY(v_flag.allowed_plans)) THEN
    RETURN FALSE;
  END IF;
  
  -- Check rollout percentage
  IF v_flag.rollout_percentage < 100 AND v_flag.rollout_percentage > 0 THEN
    -- Use tenant_id or user_id for consistent bucketing
    IF v_tenant_id IS NOT NULL THEN
      RETURN (abs(hashtext(v_tenant_id::TEXT || p_flag_key)) % 100) < v_flag.rollout_percentage;
    ELSIF v_user_id IS NOT NULL THEN
      RETURN (abs(hashtext(v_user_id::TEXT || p_flag_key)) % 100) < v_flag.rollout_percentage;
    END IF;
  END IF;
  
  RETURN v_flag.status IN ('enabled', 'beta');
END;
$$;

-- Get all enabled features for current context
CREATE OR REPLACE FUNCTION get_enabled_features()
RETURNS TEXT[]
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_features TEXT[] := '{}';
  v_flag RECORD;
BEGIN
  FOR v_flag IN SELECT key FROM feature_flags
  LOOP
    IF is_feature_enabled(v_flag.key) THEN
      v_features := array_append(v_features, v_flag.key);
    END IF;
  END LOOP;
  
  RETURN v_features;
END;
$$;

-- Get integration by type
CREATE OR REPLACE FUNCTION get_integration(
  p_type integration_type
)
RETURNS integrations
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_integration integrations;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  SELECT * INTO v_integration
  FROM integrations
  WHERE tenant_id = v_tenant_id
    AND type = p_type
    AND deleted_at IS NULL;
  
  RETURN v_integration;
END;
$$;

-- Check if integration is connected
CREATE OR REPLACE FUNCTION is_integration_connected(
  p_type integration_type
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_integration integrations;
BEGIN
  v_integration := get_integration(p_type);
  
  RETURN v_integration IS NOT NULL AND v_integration.status = 'connected';
END;
$$;

-- Log integration API call
CREATE OR REPLACE FUNCTION log_integration_call(
  p_integration_id UUID,
  p_endpoint TEXT,
  p_method TEXT,
  p_request_body JSONB DEFAULT NULL,
  p_response_status INT DEFAULT NULL,
  p_response_body JSONB DEFAULT NULL,
  p_success BOOLEAN DEFAULT false,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id UUID;
  v_integration RECORD;
BEGIN
  SELECT * INTO v_integration
  FROM integrations
  WHERE id = p_integration_id;
  
  IF v_integration IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO integration_logs (
    integration_id,
    tenant_id,
    endpoint,
    method,
    request_body,
    response_status,
    response_body,
    success,
    error_message,
    duration_ms,
    completed_at
  ) VALUES (
    p_integration_id,
    v_integration.tenant_id,
    p_endpoint,
    p_method,
    p_request_body,
    p_response_status,
    p_response_body,
    p_success,
    p_error_message,
    p_duration_ms,
    NOW()
  ) RETURNING id INTO v_log_id;
  
  -- Update integration status on error
  IF NOT p_success THEN
    UPDATE integrations
    SET 
      error_count = error_count + 1,
      last_error = p_error_message,
      last_error_at = NOW(),
      status = CASE 
        WHEN error_count >= 5 THEN 'error'::integration_status
        ELSE status
      END
    WHERE id = p_integration_id;
  ELSE
    UPDATE integrations
    SET 
      last_connected_at = NOW(),
      error_count = 0
    WHERE id = p_integration_id;
  END IF;
  
  RETURN v_log_id;
END;
$$;

-- Get branding for tenant
CREATE OR REPLACE FUNCTION get_tenant_branding()
RETURNS branding_settings
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_branding branding_settings;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  SELECT * INTO v_branding
  FROM branding_settings
  WHERE tenant_id = v_tenant_id;
  
  RETURN v_branding;
END;
$$;

-- Check if business is open
CREATE OR REPLACE FUNCTION is_business_open(
  p_check_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_day_of_week INT;
  v_time TIME;
  v_hours RECORD;
  v_is_holiday BOOLEAN;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  v_day_of_week := EXTRACT(DOW FROM p_check_time)::INT;
  v_time := p_check_time::TIME;
  
  -- Check for holiday
  SELECT EXISTS (
    SELECT 1 FROM holidays
    WHERE (tenant_id = v_tenant_id OR tenant_id IS NULL)
      AND date = p_check_time::DATE
      AND is_full_day = true
  ) INTO v_is_holiday;
  
  IF v_is_holiday THEN
    RETURN FALSE;
  END IF;
  
  -- Get business hours
  SELECT * INTO v_hours
  FROM business_hours
  WHERE tenant_id = v_tenant_id
    AND day_of_week = v_day_of_week;
  
  IF v_hours IS NULL OR NOT v_hours.is_open THEN
    RETURN FALSE;
  END IF;
  
  -- Check time
  IF v_time < v_hours.open_time OR v_time > v_hours.close_time THEN
    RETURN FALSE;
  END IF;
  
  -- Check break time
  IF v_hours.break_start IS NOT NULL AND v_hours.break_end IS NOT NULL THEN
    IF v_time >= v_hours.break_start AND v_time <= v_hours.break_end THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Get notification preference for user/tenant
CREATE OR REPLACE FUNCTION get_notification_preference(
  p_notification_key TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS notification_preferences
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_pref notification_preferences;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  v_user_id := COALESCE(p_user_id, (auth.jwt() ->> 'user_id')::UUID);
  
  -- Check user preference first
  IF v_user_id IS NOT NULL THEN
    SELECT * INTO v_pref
    FROM notification_preferences
    WHERE user_id = v_user_id
      AND notification_key = p_notification_key;
    
    IF v_pref IS NOT NULL THEN
      RETURN v_pref;
    END IF;
  END IF;
  
  -- Fall back to tenant default
  IF v_tenant_id IS NOT NULL THEN
    SELECT * INTO v_pref
    FROM notification_preferences
    WHERE tenant_id = v_tenant_id
      AND user_id IS NULL
      AND notification_key = p_notification_key;
    
    IF v_pref IS NOT NULL THEN
      RETURN v_pref;
    END IF;
  END IF;
  
  -- Fall back to system default
  SELECT * INTO v_pref
  FROM notification_preferences
  WHERE tenant_id IS NULL
    AND user_id IS NULL
    AND notification_key = p_notification_key;
  
  RETURN v_pref;
END;
$$;

-- Initialize default settings for new tenant
CREATE OR REPLACE FUNCTION initialize_tenant_settings(
  p_tenant_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create branding settings
  INSERT INTO branding_settings (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;
  
  -- Create default business hours (Mon-Fri 8am-6pm, Sat 9am-2pm)
  INSERT INTO business_hours (tenant_id, day_of_week, is_open, open_time, close_time)
  VALUES 
    (p_tenant_id, 0, false, NULL, NULL), -- Sunday
    (p_tenant_id, 1, true, '08:00', '18:00'), -- Monday
    (p_tenant_id, 2, true, '08:00', '18:00'),
    (p_tenant_id, 3, true, '08:00', '18:00'),
    (p_tenant_id, 4, true, '08:00', '18:00'),
    (p_tenant_id, 5, true, '08:00', '18:00'),
    (p_tenant_id, 6, true, '09:00', '14:00') -- Saturday
  ON CONFLICT (tenant_id, day_of_week) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default system settings
INSERT INTO system_settings (key, value, value_type, category, label, description, is_public) VALUES
  -- General
  ('platform.name', 'Vulpine', 'string', 'general', 'Platform Name', 'Name of the platform', true),
  ('platform.support_email', 'support@vulpinehomes.com', 'email', 'general', 'Support Email', 'Email for support inquiries', true),
  ('platform.default_timezone', 'America/Phoenix', 'string', 'general', 'Default Timezone', 'Default timezone for new tenants', true),
  
  -- Leads
  ('leads.auto_assignment', 'true', 'boolean', 'leads', 'Auto Assignment', 'Automatically assign leads to agents', true),
  ('leads.followup_days', '3', 'number', 'leads', 'Follow-up Days', 'Days until lead follow-up reminder', true),
  
  -- Quotes
  ('quotes.validity_days', '30', 'number', 'quotes', 'Quote Validity', 'Default days a quote is valid', true),
  ('quotes.auto_expire', 'true', 'boolean', 'quotes', 'Auto Expire', 'Automatically expire old quotes', true),
  
  -- Jobs
  ('jobs.buffer_hours', '2', 'number', 'jobs', 'Buffer Hours', 'Hours between scheduled jobs', true),
  ('jobs.max_per_day', '3', 'number', 'jobs', 'Max Jobs Per Day', 'Maximum jobs per installer per day', true),
  
  -- Payments
  ('payments.deposit_percent', '50', 'number', 'payments', 'Deposit Percentage', 'Default deposit percentage', true),
  ('payments.late_fee_days', '30', 'number', 'payments', 'Late Fee Days', 'Days until late fee applied', true),
  
  -- Visualizer
  ('visualizer.max_renders', '5', 'number', 'visualizer', 'Max Renders', 'Maximum visualizer renders per session', true),
  ('visualizer.resolution', '1024', 'number', 'visualizer', 'Render Resolution', 'Default render resolution', true),
  
  -- AR Fox
  ('ar_fox.enabled', 'true', 'boolean', 'ar_fox', 'AR Fox Enabled', 'Enable AR Fox features', true),
  
  -- Security
  ('security.session_timeout_minutes', '480', 'number', 'security', 'Session Timeout', 'Minutes until session expires', false),
  ('security.max_login_attempts', '5', 'number', 'security', 'Max Login Attempts', 'Maximum failed login attempts', false),
  ('security.password_min_length', '8', 'number', 'security', 'Password Min Length', 'Minimum password length', false)
ON CONFLICT (key) DO NOTHING;

-- Insert default feature flags
INSERT INTO feature_flags (key, name, description, status, category) VALUES
  ('visualizer_v2', 'Visualizer V2', 'New AI-powered visualizer with enhanced rendering', 'enabled', 'visualizer'),
  ('ar_fox_3d', 'AR Fox 3D Models', 'Full 3D AR experience with custom fox mascot', 'beta', 'ar_fox'),
  ('aeon_auto_schedule', 'AEON Auto-Scheduling', 'AI-powered automatic job scheduling', 'beta', 'automation'),
  ('aeon_lead_scoring', 'AEON Lead Scoring', 'AI-powered lead scoring and prioritization', 'enabled', 'automation'),
  ('aeon_follow_up', 'AEON Follow-up', 'Automated follow-up suggestions', 'enabled', 'automation'),
  ('multi_property', 'Multi-Property Support', 'Support for homeowners with multiple properties', 'enabled', 'general'),
  ('installer_mobile', 'Installer Mobile App', 'Mobile app features for installers', 'enabled', 'installers'),
  ('customer_portal', 'Customer Portal', 'Self-service customer portal', 'enabled', 'general'),
  ('stripe_connect', 'Stripe Connect', 'Split payments via Stripe Connect', 'beta', 'payments'),
  ('qwikkit_integration', 'Qwikkit Integration', 'Direct supplier integration with Qwikkit', 'enabled', 'integrations')
ON CONFLICT (key) DO NOTHING;

-- Insert default notification templates (system-level)
INSERT INTO notification_templates (tenant_id, key, name, channel, subject, body, is_system, available_variables) VALUES
  (NULL, 'lead_new', 'New Lead', 'email', 'New Lead: {{lead_name}}', 'A new lead has been created: {{lead_name}} from {{lead_source}}.', true, ARRAY['{{lead_name}}', '{{lead_source}}', '{{lead_phone}}', '{{lead_email}}']),
  (NULL, 'quote_sent', 'Quote Sent', 'email', 'Your Quote from {{company_name}}', 'Hi {{customer_name}}, your quote #{{quote_number}} is ready. Total: ${{quote_total}}.', true, ARRAY['{{customer_name}}', '{{quote_number}}', '{{quote_total}}', '{{company_name}}']),
  (NULL, 'job_scheduled', 'Job Scheduled', 'email', 'Your Installation is Scheduled', 'Hi {{customer_name}}, your installation is scheduled for {{job_date}}.', true, ARRAY['{{customer_name}}', '{{job_date}}', '{{job_time}}', '{{installer_name}}']),
  (NULL, 'job_completed', 'Job Completed', 'email', 'Installation Complete', 'Hi {{customer_name}}, your installation has been completed!', true, ARRAY['{{customer_name}}', '{{job_number}}']),
  (NULL, 'payment_received', 'Payment Received', 'email', 'Payment Received - Thank You!', 'Hi {{customer_name}}, we received your payment of ${{amount}}.', true, ARRAY['{{customer_name}}', '{{amount}}', '{{payment_number}}'])
ON CONFLICT DO NOTHING;

-- Insert default US federal holidays
INSERT INTO holidays (tenant_id, name, date, is_recurring) VALUES
  (NULL, 'New Year''s Day', '2025-01-01', true),
  (NULL, 'Martin Luther King Jr. Day', '2025-01-20', false),
  (NULL, 'Presidents'' Day', '2025-02-17', false),
  (NULL, 'Memorial Day', '2025-05-26', false),
  (NULL, 'Independence Day', '2025-07-04', true),
  (NULL, 'Labor Day', '2025-09-01', false),
  (NULL, 'Columbus Day', '2025-10-13', false),
  (NULL, 'Veterans Day', '2025-11-11', true),
  (NULL, 'Thanksgiving Day', '2025-11-27', false),
  (NULL, 'Christmas Day', '2025-12-25', true)
ON CONFLICT DO NOTHING;