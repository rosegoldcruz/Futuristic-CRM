-- ===========================================================
-- 011_AUDIT_LOGS.SQL
-- System-wide Action Tracking + Compliance Audit Trail
-- Centralized logging for all platform activity
-- Depends on:
--   000_common.sql
--   005_tenants_users.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE audit_action AS ENUM (
  -- CRUD operations
  'create',
  'read',
  'update',
  'delete',
  'restore',
  
  -- Authentication
  'login',
  'logout',
  'login_failed',
  'password_change',
  'password_reset',
  'mfa_enabled',
  'mfa_disabled',
  'token_refresh',
  'session_expired',
  
  -- Authorization
  'permission_granted',
  'permission_revoked',
  'role_assigned',
  'role_removed',
  'access_denied',
  
  -- Lead/Sales pipeline
  'lead_created',
  'lead_assigned',
  'lead_qualified',
  'lead_converted',
  'lead_lost',
  'quote_sent',
  'quote_accepted',
  'quote_rejected',
  'quote_revised',
  
  -- Jobs
  'job_created',
  'job_scheduled',
  'job_started',
  'job_completed',
  'job_cancelled',
  'job_issue_reported',
  'job_issue_resolved',
  
  -- Installer
  'installer_assigned',
  'installer_unassigned',
  'installer_approved',
  'installer_suspended',
  
  -- Payments
  'payment_initiated',
  'payment_succeeded',
  'payment_failed',
  'payment_refunded',
  'payment_disputed',
  'payout_created',
  'payout_approved',
  'payout_processed',
  
  -- Invoicing
  'invoice_created',
  'invoice_sent',
  'invoice_paid',
  'invoice_voided',
  
  -- Files
  'file_uploaded',
  'file_downloaded',
  'file_shared',
  'file_deleted',
  
  -- Communication
  'email_sent',
  'sms_sent',
  'call_initiated',
  'call_completed',
  
  -- Settings
  'settings_changed',
  'integration_connected',
  'integration_disconnected',
  'webhook_triggered',
  
  -- Tenant/User management
  'tenant_created',
  'tenant_updated',
  'tenant_suspended',
  'tenant_cancelled',
  'user_invited',
  'user_activated',
  'user_deactivated',
  'user_deleted',
  
  -- Supplier/Orders
  'order_created',
  'order_submitted',
  'order_confirmed',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
  
  -- AEON automation
  'automation_triggered',
  'automation_completed',
  'automation_failed',
  'ai_action',
  
  -- System
  'system_event',
  'error',
  'warning',
  'export_requested',
  'import_completed',
  'data_purged',
  
  -- Other
  'other'
);

CREATE TYPE audit_severity AS ENUM (
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'alert',
  'emergency'
);

CREATE TYPE audit_actor_type AS ENUM (
  'user',
  'system',
  'aeon',
  'webhook',
  'api_key',
  'scheduled_job',
  'anonymous'
);

-- ============================================
-- AUDIT_LOGS TABLE (Primary audit trail)
-- ============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant isolation (NULL for system-level events)
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Action details
  action audit_action NOT NULL,
  severity audit_severity NOT NULL DEFAULT 'info',
  
  -- Actor (who performed the action)
  actor_type audit_actor_type NOT NULL DEFAULT 'user',
  actor_id UUID, -- User ID if actor_type = 'user'
  actor_email TEXT,
  actor_name TEXT,
  actor_role TEXT,
  actor_ip TEXT,
  actor_user_agent TEXT,
  
  -- Target entity (what was acted upon)
  entity_type TEXT, -- 'lead', 'job', 'quote', 'homeowner', etc.
  entity_id UUID,
  entity_name TEXT, -- Human-readable identifier (lead name, job number, etc.)
  
  -- Secondary entity (for relationships)
  secondary_entity_type TEXT,
  secondary_entity_id UUID,
  secondary_entity_name TEXT,
  
  -- Action details
  description TEXT NOT NULL,
  
  -- State changes
  previous_state JSONB, -- State before action
  new_state JSONB, -- State after action
  changes JSONB, -- Diff of changes
  
  -- Request context
  request_id UUID, -- Correlation ID for request tracing
  session_id TEXT,
  api_endpoint TEXT,
  http_method TEXT,
  
  -- Additional context
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  tags TEXT[] DEFAULT '{}',
  
  -- Compliance
  is_sensitive BOOLEAN NOT NULL DEFAULT false, -- PII or sensitive data involved
  retention_days INT, -- Override default retention
  
  -- Timestamp (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Partition key for time-based partitioning
  log_date DATE NOT NULL DEFAULT CURRENT_DATE
) PARTITION BY RANGE (log_date);

-- ============================================
-- PARTITIONS (Monthly partitions)
-- Create partitions for current and next 12 months
-- ============================================

-- Helper function to create partitions (UPGRADED: SECURITY DEFINER for scheduler compatibility)
CREATE OR REPLACE FUNCTION create_audit_log_partition(
  p_year INT,
  p_month INT
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_partition_name TEXT;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_partition_name := 'audit_logs_' || p_year || '_' || LPAD(p_month::TEXT, 2, '0');
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := v_start_date + INTERVAL '1 month';
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs
     FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    v_start_date,
    v_end_date
  );
  
  -- Create indexes on partition
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, created_at DESC)',
    v_partition_name || '_tenant_idx',
    v_partition_name
  );
  
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (entity_type, entity_id)',
    v_partition_name || '_entity_idx',
    v_partition_name
  );
  
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (actor_id)',
    v_partition_name || '_actor_idx',
    v_partition_name
  );
  
  RETURN v_partition_name;
END;
$$;

-- Create partitions for current year and next year
DO $$
DECLARE
  v_year INT;
  v_month INT;
  v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  v_current_month INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
BEGIN
  -- Create partitions from current month through next 12 months
  FOR i IN 0..13 LOOP
    v_month := ((v_current_month - 1 + i) % 12) + 1;
    v_year := v_current_year + ((v_current_month - 1 + i) / 12);
    PERFORM create_audit_log_partition(v_year, v_month);
  END LOOP;
END;
$$;

-- ============================================
-- AUDIT_LOG_ARCHIVES TABLE (Compressed old logs)
-- ============================================

CREATE TABLE audit_log_archives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Archive details
  archive_name TEXT NOT NULL UNIQUE,
  
  -- Date range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Statistics
  record_count BIGINT NOT NULL,
  compressed_size_bytes BIGINT,
  
  -- Storage
  storage_provider TEXT NOT NULL DEFAULT 'supabase',
  storage_path TEXT NOT NULL,
  storage_url TEXT,
  
  -- Checksum for integrity
  checksum TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'archived', 'deleted'
  
  -- Timestamps
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- When archive can be deleted
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- AUDIT_LOG_RETENTION TABLE (Retention policies)
-- ============================================

CREATE TABLE audit_log_retention (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Scope
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global default
  
  -- Action filter
  action audit_action,
  action_pattern TEXT, -- Regex pattern for multiple actions
  
  -- Retention settings
  retention_days INT NOT NULL DEFAULT 365,
  archive_before_delete BOOLEAN NOT NULL DEFAULT true,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Priority (higher = evaluated first)
  priority INT NOT NULL DEFAULT 0
);

-- ============================================
-- INDEXES: AUDIT_LOGS (Global indexes on parent)
-- ============================================

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(tenant_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_severity ON audit_logs(tenant_id, severity, created_at DESC) WHERE severity IN ('error', 'critical', 'alert', 'emergency');
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_logs_actor_type ON audit_logs(actor_type, created_at DESC);
CREATE INDEX idx_audit_logs_request ON audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_audit_logs_sensitive ON audit_logs(tenant_id, created_at DESC) WHERE is_sensitive = true;
CREATE INDEX idx_audit_logs_tags_gin ON audit_logs USING GIN (tags array_ops);
CREATE INDEX idx_audit_logs_metadata_gin ON audit_logs USING GIN (metadata jsonb_path_ops);

-- Full text search on descriptions
CREATE INDEX idx_audit_logs_fts ON audit_logs USING GIN (
  to_tsvector('english', COALESCE(description, ''))
);

-- ============================================
-- INDEXES: ARCHIVES
-- ============================================

CREATE INDEX idx_audit_log_archives_dates ON audit_log_archives(start_date, end_date);
CREATE INDEX idx_audit_log_archives_status ON audit_log_archives(status);

-- ============================================
-- INDEXES: RETENTION
-- ============================================

CREATE INDEX idx_audit_log_retention_tenant ON audit_log_retention(tenant_id);
CREATE INDEX idx_audit_log_retention_active ON audit_log_retention(is_active, priority DESC) WHERE is_active = true;

-- ============================================
-- ROW LEVEL SECURITY: AUDIT_LOGS
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Note: Don't use FORCE on partitioned tables

CREATE POLICY audit_logs_select ON audit_logs
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
    -- Users can see their own actions
    OR actor_id = (auth.jwt() ->> 'user_id')::UUID
  );

-- Only system can insert audit logs
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT
  WITH CHECK (true); -- Handled by functions

-- Audit logs are immutable
CREATE POLICY audit_logs_update ON audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY audit_logs_delete ON audit_logs
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: ARCHIVES
-- ============================================

ALTER TABLE audit_log_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_archives FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_log_archives_select ON audit_log_archives
  FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY audit_log_archives_insert ON audit_log_archives
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY audit_log_archives_update ON audit_log_archives
  FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin');

CREATE POLICY audit_log_archives_delete ON audit_log_archives
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: RETENTION
-- ============================================

ALTER TABLE audit_log_retention ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_retention FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_log_retention_select ON audit_log_retention
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      (auth.jwt() ->> 'role') IN ('owner', 'admin')
      AND (
        tenant_id IS NULL
        OR tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
      )
    )
  );

CREATE POLICY audit_log_retention_insert ON audit_log_retention
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner')
    AND (
      tenant_id IS NULL
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY audit_log_retention_update ON audit_log_retention
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner')
    AND (
      tenant_id IS NULL
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

CREATE POLICY audit_log_retention_delete ON audit_log_retention
  FOR DELETE
  USING ((auth.jwt() ->> 'role') = 'superadmin');

-- ============================================
-- CORE LOGGING FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION log_audit(
  p_action audit_action,
  p_description TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_previous_state JSONB DEFAULT NULL,
  p_new_state JSONB DEFAULT NULL,
  p_severity audit_severity DEFAULT 'info',
  p_metadata JSONB DEFAULT '{}',
  p_tags TEXT[] DEFAULT '{}',
  p_is_sensitive BOOLEAN DEFAULT false,
  p_secondary_entity_type TEXT DEFAULT NULL,
  p_secondary_entity_id UUID DEFAULT NULL,
  p_secondary_entity_name TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id UUID;
  v_tenant_id UUID;
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_name TEXT;
  v_actor_role TEXT;
  v_actor_type audit_actor_type;
  v_changes JSONB;
  v_request_id UUID;
BEGIN
  -- Get context from JWT or settings
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  v_actor_id := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  v_actor_email := auth.jwt() ->> 'email';
  v_actor_name := auth.jwt() ->> 'name';
  v_actor_role := auth.jwt() ->> 'role';
  v_request_id := NULLIF(current_setting('app.request_id', true), '')::UUID;
  
  -- Determine actor type
  IF auth.jwt() ->> 'actor_type' IS NOT NULL THEN
    v_actor_type := (auth.jwt() ->> 'actor_type')::audit_actor_type;
  ELSIF v_actor_id IS NOT NULL THEN
    v_actor_type := 'user';
  ELSIF current_setting('app.actor_type', true) IS NOT NULL THEN
    v_actor_type := current_setting('app.actor_type', true)::audit_actor_type;
  ELSE
    v_actor_type := 'system';
  END IF;
  
  -- Calculate changes if both states provided
  IF p_previous_state IS NOT NULL AND p_new_state IS NOT NULL THEN
    SELECT jsonb_object_agg(key, value)
    INTO v_changes
    FROM (
      SELECT key, jsonb_build_object('old', p_previous_state->key, 'new', value) as value
      FROM jsonb_each(p_new_state)
      WHERE p_previous_state->key IS DISTINCT FROM p_new_state->key
    ) diff;
  END IF;
  
  INSERT INTO audit_logs (
    tenant_id,
    action,
    severity,
    actor_type,
    actor_id,
    actor_email,
    actor_name,
    actor_role,
    actor_ip,
    actor_user_agent,
    entity_type,
    entity_id,
    entity_name,
    secondary_entity_type,
    secondary_entity_id,
    secondary_entity_name,
    description,
    previous_state,
    new_state,
    changes,
    request_id,
    session_id,
    api_endpoint,
    http_method,
    metadata,
    tags,
    is_sensitive,
    log_date
  ) VALUES (
    v_tenant_id,
    p_action,
    p_severity,
    v_actor_type,
    v_actor_id,
    v_actor_email,
    v_actor_name,
    v_actor_role,
    current_setting('app.client_ip', true),
    current_setting('app.user_agent', true),
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_secondary_entity_type,
    p_secondary_entity_id,
    p_secondary_entity_name,
    p_description,
    p_previous_state,
    p_new_state,
    v_changes,
    v_request_id,
    current_setting('app.session_id', true),
    current_setting('app.api_endpoint', true),
    current_setting('app.http_method', true),
    p_metadata,
    p_tags,
    p_is_sensitive,
    CURRENT_DATE
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================
-- SPECIALIZED LOGGING FUNCTIONS
-- ============================================

-- Log entity creation
CREATE OR REPLACE FUNCTION log_entity_created(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_name TEXT,
  p_new_state JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN log_audit(
    'create',
    p_entity_type || ' created: ' || COALESCE(p_entity_name, p_entity_id::TEXT),
    p_entity_type,
    p_entity_id,
    p_entity_name,
    NULL,
    p_new_state,
    'info',
    p_metadata
  );
END;
$$;

-- Log entity update
CREATE OR REPLACE FUNCTION log_entity_updated(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_name TEXT,
  p_previous_state JSONB,
  p_new_state JSONB,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN log_audit(
    'update',
    p_entity_type || ' updated: ' || COALESCE(p_entity_name, p_entity_id::TEXT),
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_previous_state,
    p_new_state,
    'info',
    p_metadata
  );
END;
$$;

-- Log entity deletion
CREATE OR REPLACE FUNCTION log_entity_deleted(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_name TEXT,
  p_previous_state JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN log_audit(
    'delete',
    p_entity_type || ' deleted: ' || COALESCE(p_entity_name, p_entity_id::TEXT),
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_previous_state,
    NULL,
    'notice',
    p_metadata
  );
END;
$$;

-- Log authentication event
CREATE OR REPLACE FUNCTION log_auth_event(
  p_action audit_action,
  p_user_id UUID DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_failure_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_description TEXT;
  v_severity audit_severity;
BEGIN
  v_description := CASE p_action
    WHEN 'login' THEN 'User logged in'
    WHEN 'logout' THEN 'User logged out'
    WHEN 'login_failed' THEN 'Login failed: ' || COALESCE(p_failure_reason, 'Unknown reason')
    WHEN 'password_change' THEN 'Password changed'
    WHEN 'password_reset' THEN 'Password reset requested'
    WHEN 'mfa_enabled' THEN 'MFA enabled'
    WHEN 'mfa_disabled' THEN 'MFA disabled'
    ELSE p_action::TEXT
  END;
  
  v_severity := CASE 
    WHEN NOT p_success THEN 'warning'
    WHEN p_action = 'login_failed' THEN 'warning'
    ELSE 'info'
  END;
  
  RETURN log_audit(
    p_action,
    v_description,
    'user',
    p_user_id,
    p_user_email,
    NULL,
    NULL,
    v_severity,
    p_metadata || jsonb_build_object('success', p_success),
    ARRAY['auth']::TEXT[],
    true -- Auth events are sensitive
  );
END;
$$;

-- Log payment event
CREATE OR REPLACE FUNCTION log_payment_event(
  p_action audit_action,
  p_payment_id UUID,
  p_payment_number TEXT,
  p_amount NUMERIC,
  p_homeowner_id UUID DEFAULT NULL,
  p_homeowner_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_description TEXT;
BEGIN
  v_description := CASE p_action
    WHEN 'payment_initiated' THEN 'Payment initiated: $' || p_amount
    WHEN 'payment_succeeded' THEN 'Payment succeeded: $' || p_amount
    WHEN 'payment_failed' THEN 'Payment failed: $' || p_amount
    WHEN 'payment_refunded' THEN 'Payment refunded: $' || p_amount
    WHEN 'payment_disputed' THEN 'Payment disputed: $' || p_amount
    ELSE p_action::TEXT || ': $' || p_amount
  END;
  
  RETURN log_audit(
    p_action,
    v_description,
    'payment',
    p_payment_id,
    p_payment_number,
    NULL,
    NULL,
    CASE WHEN p_action IN ('payment_failed', 'payment_disputed') THEN 'warning' ELSE 'info' END,
    p_metadata || jsonb_build_object('amount', p_amount),
    ARRAY['payment', 'financial']::TEXT[],
    true, -- Financial events are sensitive
    'homeowner',
    p_homeowner_id,
    p_homeowner_name
  );
END;
$$;

-- Log AEON automation event
CREATE OR REPLACE FUNCTION log_aeon_event(
  p_action_name TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_action audit_action;
  v_description TEXT;
  v_severity audit_severity;
BEGIN
  IF p_success THEN
    v_action := 'automation_completed';
    v_description := 'AEON automation completed: ' || p_action_name;
    v_severity := 'info';
  ELSE
    v_action := 'automation_failed';
    v_description := 'AEON automation failed: ' || p_action_name || 
                     COALESCE(' - ' || p_error_message, '');
    v_severity := 'error';
  END IF;
  
  -- Set actor type for this request
  PERFORM set_config('app.actor_type', 'aeon', true);
  
  RETURN log_audit(
    v_action,
    v_description,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    NULL,
    NULL,
    v_severity,
    p_metadata || jsonb_build_object(
      'automation_name', p_action_name,
      'success', p_success,
      'error', p_error_message
    ),
    ARRAY['aeon', 'automation']::TEXT[]
  );
END;
$$;

-- Log error
CREATE OR REPLACE FUNCTION log_error(
  p_error_message TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_stack_trace TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN log_audit(
    'error',
    p_error_message,
    p_entity_type,
    p_entity_id,
    NULL,
    NULL,
    NULL,
    'error',
    p_metadata || jsonb_build_object(
      'error_code', p_error_code,
      'stack_trace', p_stack_trace
    ),
    ARRAY['error']::TEXT[]
  );
END;
$$;

-- ============================================
-- QUERY FUNCTIONS
-- ============================================

-- Get audit logs for entity
CREATE OR REPLACE FUNCTION get_entity_audit_logs(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action audit_action,
  severity audit_severity,
  actor_name TEXT,
  actor_email TEXT,
  description TEXT,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
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
  
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.severity,
    al.actor_name,
    al.actor_email,
    al.description,
    al.changes,
    al.metadata,
    al.created_at
  FROM audit_logs al
  WHERE al.entity_type = p_entity_type
    AND al.entity_id = p_entity_id
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR al.tenant_id = v_tenant_id
    )
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Get user activity
CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  action audit_action,
  entity_type TEXT,
  entity_name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
)
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
  
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.entity_type,
    al.entity_name,
    al.description,
    al.created_at
  FROM audit_logs al
  WHERE al.actor_id = p_user_id
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR al.tenant_id = v_tenant_id
      OR al.actor_id = (auth.jwt() ->> 'user_id')::UUID
    )
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at < p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Search audit logs
CREATE OR REPLACE FUNCTION search_audit_logs(
  p_query TEXT DEFAULT NULL,
  p_actions audit_action[] DEFAULT NULL,
  p_severities audit_severity[] DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action audit_action,
  severity audit_severity,
  actor_type audit_actor_type,
  actor_name TEXT,
  entity_type TEXT,
  entity_name TEXT,
  description TEXT,
  changes JSONB,
  tags TEXT[],
  created_at TIMESTAMPTZ
)
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
  
  -- Require at least one filter
  IF p_query IS NULL AND p_actions IS NULL AND p_severities IS NULL 
     AND p_entity_type IS NULL AND p_actor_id IS NULL 
     AND p_start_date IS NULL AND p_end_date IS NULL AND p_tags IS NULL THEN
    RAISE EXCEPTION 'At least one filter required';
  END IF;
  
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.severity,
    al.actor_type,
    al.actor_name,
    al.entity_type,
    al.entity_name,
    al.description,
    al.changes,
    al.tags,
    al.created_at
  FROM audit_logs al
  WHERE (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR al.tenant_id = v_tenant_id
    )
    AND (p_actions IS NULL OR al.action = ANY(p_actions))
    AND (p_severities IS NULL OR al.severity = ANY(p_severities))
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_actor_id IS NULL OR al.actor_id = p_actor_id)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at < p_end_date)
    AND (p_tags IS NULL OR al.tags && p_tags)
    AND (
      p_query IS NULL OR
      to_tsvector('english', al.description) @@ plainto_tsquery('english', p_query)
      OR al.description ILIKE '%' || p_query || '%'
    )
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Get audit summary (for dashboard)
CREATE OR REPLACE FUNCTION get_audit_summary(
  p_start_date DATE DEFAULT CURRENT_DATE - 30,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_events BIGINT,
  by_action JSONB,
  by_severity JSONB,
  by_entity_type JSONB,
  by_actor_type JSONB,
  errors_count BIGINT,
  warnings_count BIGINT
)
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
  
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT,
    (
      SELECT jsonb_object_agg(action, cnt)
      FROM (
        SELECT action::TEXT, COUNT(*) as cnt
        FROM audit_logs
        WHERE tenant_id = v_tenant_id
          AND log_date BETWEEN p_start_date AND p_end_date
        GROUP BY action
        ORDER BY cnt DESC
        LIMIT 10
      ) sub
    ),
    (
      SELECT jsonb_object_agg(severity, cnt)
      FROM (
        SELECT severity::TEXT, COUNT(*) as cnt
        FROM audit_logs
        WHERE tenant_id = v_tenant_id
          AND log_date BETWEEN p_start_date AND p_end_date
        GROUP BY severity
      ) sub
    ),
    (
      SELECT jsonb_object_agg(entity_type, cnt)
      FROM (
        SELECT entity_type, COUNT(*) as cnt
        FROM audit_logs
        WHERE tenant_id = v_tenant_id
          AND log_date BETWEEN p_start_date AND p_end_date
          AND entity_type IS NOT NULL
        GROUP BY entity_type
        ORDER BY cnt DESC
        LIMIT 10
      ) sub
    ),
    (
      SELECT jsonb_object_agg(actor_type, cnt)
      FROM (
        SELECT actor_type::TEXT, COUNT(*) as cnt
        FROM audit_logs
        WHERE tenant_id = v_tenant_id
          AND log_date BETWEEN p_start_date AND p_end_date
        GROUP BY actor_type
      ) sub
    ),
    COUNT(*) FILTER (WHERE severity IN ('error', 'critical', 'alert', 'emergency'))::BIGINT,
    COUNT(*) FILTER (WHERE severity = 'warning')::BIGINT
  FROM audit_logs
  WHERE tenant_id = v_tenant_id
    AND log_date BETWEEN p_start_date AND p_end_date;
END;
$$;

-- ============================================
-- MAINTENANCE FUNCTIONS
-- ============================================

-- Create next month's partition (for scheduled job)
CREATE OR REPLACE FUNCTION ensure_audit_log_partitions()
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT := 0;
  v_year INT;
  v_month INT;
  v_future_date DATE;
BEGIN
  -- Ensure partitions exist for next 3 months
  FOR i IN 1..3 LOOP
    v_future_date := CURRENT_DATE + (i || ' months')::INTERVAL;
    v_year := EXTRACT(YEAR FROM v_future_date)::INT;
    v_month := EXTRACT(MONTH FROM v_future_date)::INT;
    
    PERFORM create_audit_log_partition(v_year, v_month);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Get retention policy for action (UPGRADED: SECURITY DEFINER for scheduler compatibility)
CREATE OR REPLACE FUNCTION get_retention_days(
  p_tenant_id UUID,
  p_action audit_action
)
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_retention_days INT;
BEGIN
  -- Check tenant-specific policy first, then global
  SELECT retention_days INTO v_retention_days
  FROM audit_log_retention
  WHERE is_active = true
    AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
    AND (action = p_action OR action IS NULL)
  ORDER BY 
    CASE WHEN tenant_id IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN action IS NOT NULL THEN 0 ELSE 1 END,
    priority DESC
  LIMIT 1;
  
  -- Default: 365 days
  RETURN COALESCE(v_retention_days, 365);
END;
$$;

-- Archive old audit logs (for scheduled job)
CREATE OR REPLACE FUNCTION archive_old_audit_logs(
  p_older_than_days INT DEFAULT 365,
  p_batch_size INT DEFAULT 10000
)
RETURNS TABLE (
  archived_count BIGINT,
  archive_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date DATE;
  v_archive_name TEXT;
  v_count BIGINT;
BEGIN
  v_cutoff_date := CURRENT_DATE - p_older_than_days;
  v_archive_name := 'audit_archive_' || to_char(v_cutoff_date, 'YYYY_MM');
  
  -- Count records to archive
  SELECT COUNT(*) INTO v_count
  FROM audit_logs
  WHERE log_date < v_cutoff_date;
  
  IF v_count = 0 THEN
    RETURN QUERY SELECT 0::BIGINT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- In production, this would:
  -- 1. Export to cloud storage
  -- 2. Create archive record
  -- 3. Delete from main table
  
  -- For now, just return count
  RETURN QUERY SELECT v_count, v_archive_name;
END;
$$;

-- Cleanup old partitions (for scheduled job)
CREATE OR REPLACE FUNCTION cleanup_old_audit_partitions(
  p_older_than_months INT DEFAULT 24
)
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_partition RECORD;
  v_count INT := 0;
  v_cutoff_date DATE;
BEGIN
  v_cutoff_date := CURRENT_DATE - (p_older_than_months || ' months')::INTERVAL;
  
  -- Find old partitions
  FOR v_partition IN
    SELECT inhrelid::regclass::TEXT as partition_name
    FROM pg_inherits
    WHERE inhparent = 'audit_logs'::regclass
  LOOP
    -- Check if partition is before cutoff
    -- Partition names are like: audit_logs_2024_01
    IF v_partition.partition_name ~ 'audit_logs_\d{4}_\d{2}' THEN
      DECLARE
        v_partition_date DATE;
      BEGIN
        v_partition_date := to_date(
          substring(v_partition.partition_name from 'audit_logs_(\d{4}_\d{2})'),
          'YYYY_MM'
        );
        
        IF v_partition_date < v_cutoff_date THEN
          -- Drop partition
          EXECUTE 'DROP TABLE IF EXISTS ' || v_partition.partition_name;
          v_count := v_count + 1;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Skip invalid partition names
          NULL;
      END;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Export audit logs to JSON (for compliance)
CREATE OR REPLACE FUNCTION export_audit_logs_json(
  p_start_date DATE,
  p_end_date DATE,
  p_entity_type TEXT DEFAULT NULL,
  p_include_sensitive BOOLEAN DEFAULT false
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  -- Only admins can export
  IF (auth.jwt() ->> 'role') NOT IN ('superadmin', 'owner', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  SELECT jsonb_build_object(
    'exported_at', NOW(),
    'tenant_id', v_tenant_id,
    'date_range', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'record_count', COUNT(*),
    'records', jsonb_agg(
      jsonb_build_object(
        'id', id,
        'action', action,
        'severity', severity,
        'actor_type', actor_type,
        'actor_id', actor_id,
        'actor_email', CASE WHEN p_include_sensitive THEN actor_email ELSE '***' END,
        'entity_type', entity_type,
        'entity_id', entity_id,
        'description', description,
        'changes', changes,
        'created_at', created_at
      ) ORDER BY created_at DESC
    )
  ) INTO v_result
  FROM audit_logs
  WHERE tenant_id = v_tenant_id
    AND log_date BETWEEN p_start_date AND p_end_date
    AND (p_entity_type IS NULL OR entity_type = p_entity_type)
    AND (p_include_sensitive OR NOT is_sensitive);
  
  -- Log the export
  PERFORM log_audit(
    'export_requested',
    'Audit logs exported',
    NULL, NULL, NULL,
    NULL, NULL,
    'notice',
    jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'entity_type', p_entity_type,
      'include_sensitive', p_include_sensitive
    )
  );
  
  RETURN v_result;
END;
$$;

-- Insert default retention policies
INSERT INTO audit_log_retention (tenant_id, action, retention_days, priority) VALUES
  (NULL, NULL, 365, 0), -- Default: 1 year
  (NULL, 'login', 90, 10), -- Auth logs: 90 days
  (NULL, 'logout', 90, 10),
  (NULL, 'login_failed', 180, 10), -- Failed logins: 6 months
  (NULL, 'error', 180, 10), -- Errors: 6 months
  (NULL, 'payment_succeeded', 2555, 20), -- Financial: 7 years
  (NULL, 'payment_failed', 2555, 20),
  (NULL, 'payment_refunded', 2555, 20),
  (NULL, 'payout_processed', 2555, 20)
ON CONFLICT DO NOTHING;
