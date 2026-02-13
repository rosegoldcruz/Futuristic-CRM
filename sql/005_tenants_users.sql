-- ===========================================================
-- 005_TENANTS_USERS.SQL (UPGRADED)
-- Multi-tenant Foundation + User Management
-- Full RLS, Soft Delete Cascade, Audit Logging, Hardened Policies
-- Depends on: 000_common.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE tenant_status AS ENUM (
  'trial',
  'active',
  'suspended',
  'cancelled',
  'churned'
);

CREATE TYPE tenant_plan AS ENUM (
  'starter',
  'growth',
  'professional',
  'enterprise',
  'custom'
);

CREATE TYPE user_role AS ENUM (
  'superadmin',  -- Platform-level admin (AEON)
  'owner',
  'admin',
  'manager',
  'agent',
  'installer',
  'homeowner',
  'readonly'
);

CREATE TYPE user_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'deactivated'
);

-- ============================================
-- TENANTS TABLE
-- ============================================

CREATE TABLE tenants (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identifiers
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  
  -- Custom domain (for whitelabel)
  custom_domain TEXT UNIQUE,
  subdomain TEXT UNIQUE,
  
  -- Branding
  branding JSONB DEFAULT '{}' CHECK (jsonb_typeof(branding) = 'object'),
  
  -- Business info
  business_name TEXT,
  business_type TEXT,
  tax_id TEXT,
  license_number TEXT,
  
  -- Contact
  email TEXT,
  phone TEXT,
  address JSONB DEFAULT '{}' CHECK (jsonb_typeof(address) = 'object'),
  
  -- Billing
  status tenant_status NOT NULL DEFAULT 'trial',
  plan tenant_plan NOT NULL DEFAULT 'starter',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_ends_at TIMESTAMPTZ,
  
  -- Limits (based on plan)
  limits JSONB DEFAULT '{}' CHECK (jsonb_typeof(limits) = 'object'),
  
  -- Usage tracking
  usage JSONB DEFAULT '{}' CHECK (jsonb_typeof(usage) = 'object'),
  
  -- Sequence prefix for this tenant
  sequence_prefix TEXT NOT NULL DEFAULT 'VUL',
  
  -- Owner
  owner_user_id UUID,
  
  -- Settings
  settings JSONB DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object'),
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Audit log (embedded)
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE users (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Auth provider link
  auth_provider TEXT DEFAULT 'clerk',
  auth_provider_id TEXT,
  
  -- Identity
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  
  -- Profile
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  ) STORED,
  avatar_url TEXT,
  
  -- Role & Permissions
  role user_role NOT NULL DEFAULT 'agent',
  status user_status NOT NULL DEFAULT 'pending',
  permissions JSONB DEFAULT '{}' CHECK (jsonb_typeof(permissions) = 'object'),
  
  -- Profile/preferences
  profile JSONB DEFAULT '{}' CHECK (jsonb_typeof(profile) = 'object'),
  
  -- Work info
  title TEXT,
  department TEXT,
  extension TEXT,
  
  -- Activity tracking
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  login_count INT NOT NULL DEFAULT 0,
  
  -- Invitation tracking
  invited_by UUID,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  invitation_token TEXT,
  invitation_expires_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Audit log (embedded)
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  
  -- Constraints
  UNIQUE(tenant_id, email),
  UNIQUE(auth_provider, auth_provider_id)
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES: TENANTS
-- ============================================

CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_custom_domain ON tenants(custom_domain) WHERE deleted_at IS NULL AND custom_domain IS NOT NULL;
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain) WHERE deleted_at IS NULL AND subdomain IS NOT NULL;
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_plan ON tenants(plan) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_owner ON tenants(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_stripe_customer ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_tenants_created_at ON tenants(created_at DESC) WHERE deleted_at IS NULL;

-- GIN indexes
CREATE INDEX idx_tenants_branding_gin ON tenants USING GIN (branding jsonb_path_ops);
CREATE INDEX idx_tenants_settings_gin ON tenants USING GIN (settings jsonb_path_ops);
CREATE INDEX idx_tenants_limits_gin ON tenants USING GIN (limits jsonb_path_ops);
CREATE INDEX idx_tenants_metadata_gin ON tenants USING GIN (metadata jsonb_path_ops);

-- ============================================
-- INDEXES: USERS
-- ============================================

CREATE INDEX idx_users_tenant_id ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tenant_active ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(LOWER(email)) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;
CREATE INDEX idx_users_role ON users(tenant_id, role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_auth_provider ON users(auth_provider, auth_provider_id) WHERE auth_provider_id IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_last_active ON users(tenant_id, last_active_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_invitation_token ON users(invitation_token) WHERE invitation_token IS NOT NULL AND accepted_at IS NULL;

-- GIN indexes
CREATE INDEX idx_users_permissions_gin ON users USING GIN (permissions jsonb_path_ops);
CREATE INDEX idx_users_profile_gin ON users USING GIN (profile jsonb_path_ops);
CREATE INDEX idx_users_metadata_gin ON users USING GIN (metadata jsonb_path_ops);

-- Full text search
CREATE INDEX idx_users_fts ON users USING GIN (
  to_tsvector('english',
    COALESCE(first_name, '') || ' ' ||
    COALESCE(last_name, '') || ' ' ||
    COALESCE(email, '') || ' ' ||
    COALESCE(phone, '') || ' ' ||
    COALESCE(title, '')
  )
) WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for tenants
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for users
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUDIT LOGGING TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION audit_entity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_diff JSONB;
BEGIN
  -- Calculate diff excluding audit_log itself
  SELECT jsonb_object_agg(key, value)
  INTO v_diff
  FROM jsonb_each(to_jsonb(NEW) - 'audit_log' - 'updated_at')
  WHERE (to_jsonb(NEW)->key) IS DISTINCT FROM (to_jsonb(OLD)->key);
  
  -- Only log if there are actual changes
  IF v_diff IS NOT NULL AND v_diff != '{}' THEN
    NEW.audit_log := COALESCE(OLD.audit_log, '[]'::JSONB) || jsonb_build_array(
      jsonb_build_object(
        'changed_at', NOW(),
        'changed_by', COALESCE(
          NULLIF(auth.jwt() ->> 'user_id', ''),
          NEW.deleted_by::TEXT
        ),
        'diff', v_diff
      )
    );
    
    -- Keep only last 50 audit entries to prevent bloat
    IF jsonb_array_length(NEW.audit_log) > 50 THEN
      NEW.audit_log := (
        SELECT jsonb_agg(elem)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(NEW.audit_log) elem
          ORDER BY elem->>'changed_at' DESC
          LIMIT 50
        ) sub
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_audit
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION audit_entity();

CREATE TRIGGER users_audit
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_entity();

-- ============================================
-- TENANT SOFT-DELETE CASCADE
-- ============================================

CREATE OR REPLACE FUNCTION cascade_soft_delete_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Soft-delete all users when tenant is soft-deleted
  UPDATE users
  SET 
    deleted_at = NOW(),
    deleted_by = NEW.deleted_by,
    status = 'deactivated'
  WHERE tenant_id = NEW.id
    AND deleted_at IS NULL;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_soft_delete_cascade
  AFTER UPDATE ON tenants
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION cascade_soft_delete_tenant();

-- ============================================
-- USER-TENANT RELATIONSHIP TRIGGERS
-- ============================================

-- Auto-set owner when first user joins tenant
CREATE OR REPLACE FUNCTION set_tenant_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IN ('owner', 'admin') THEN
    UPDATE tenants
    SET owner_user_id = NEW.id
    WHERE id = NEW.tenant_id
      AND owner_user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_tenant_owner
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_owner();

-- Update tenant usage when users change
CREATE OR REPLACE FUNCTION update_tenant_user_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_count INT;
BEGIN
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  SELECT COUNT(*) INTO v_count
  FROM users
  WHERE tenant_id = v_tenant_id
    AND deleted_at IS NULL
    AND status = 'active';
  
  UPDATE tenants
  SET usage = jsonb_set(COALESCE(usage, '{}'), '{users_count}', to_jsonb(v_count))
  WHERE id = v_tenant_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER users_update_tenant_count
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_user_count();

-- ============================================
-- ROW LEVEL SECURITY: TENANTS
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

-- Tenants can only see their own tenant (superadmins see all)
CREATE POLICY tenants_select ON tenants
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  );

-- Only via SECURITY DEFINER create_tenant()
CREATE POLICY tenants_insert ON tenants
  FOR INSERT
  WITH CHECK (false);

-- Owners/admins can update their tenant
CREATE POLICY tenants_update ON tenants
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY tenants_delete ON tenants
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: USERS
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Users can see all users in their tenant (superadmins see all)
CREATE POLICY users_select ON users
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

-- Hardened: Admins can insert users in their tenant, but NOT owners
CREATE POLICY users_insert ON users
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND role != 'owner'
    AND role != 'superadmin'
  );

-- Users can update themselves, admins can update anyone in tenant
CREATE POLICY users_update ON users
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR (
        tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
        AND (
          id = (auth.jwt() ->> 'user_id')::UUID
          OR (auth.jwt() ->> 'role') IN ('owner', 'admin')
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

CREATE POLICY users_delete ON users
  FOR DELETE
  USING (false);

-- ============================================
-- TENANT MANAGEMENT FUNCTIONS
-- ============================================

-- Create new tenant with owner
CREATE OR REPLACE FUNCTION create_tenant(
  p_name TEXT,
  p_slug TEXT,
  p_owner_email TEXT,
  p_owner_first_name TEXT DEFAULT NULL,
  p_owner_last_name TEXT DEFAULT NULL,
  p_plan tenant_plan DEFAULT 'trial',
  p_sequence_prefix TEXT DEFAULT 'VUL'
)
RETURNS TABLE (
  tenant_id UUID,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  -- Validate slug uniqueness
  IF EXISTS (SELECT 1 FROM tenants WHERE slug = p_slug AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Slug already exists: %', p_slug;
  END IF;
  
  -- Validate slug format (alphanumeric + hyphens only)
  IF p_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND LENGTH(p_slug) > 2 THEN
    RAISE EXCEPTION 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.';
  END IF;
  
  -- Create tenant
  INSERT INTO tenants (
    name,
    slug,
    plan,
    status,
    sequence_prefix,
    trial_ends_at,
    limits,
    usage
  ) VALUES (
    p_name,
    p_slug,
    p_plan,
    CASE WHEN p_plan = 'trial' THEN 'trial'::tenant_status ELSE 'active'::tenant_status END,
    p_sequence_prefix,
    CASE WHEN p_plan = 'trial' THEN NOW() + INTERVAL '14 days' ELSE NULL END,
    CASE p_plan
      WHEN 'starter' THEN '{"max_users": 3, "max_leads_per_month": 50, "max_jobs_per_month": 25, "max_storage_gb": 5}'::JSONB
      WHEN 'growth' THEN '{"max_users": 10, "max_leads_per_month": 250, "max_jobs_per_month": 100, "max_storage_gb": 25}'::JSONB
      WHEN 'professional' THEN '{"max_users": 25, "max_leads_per_month": 1000, "max_jobs_per_month": 500, "max_storage_gb": 100}'::JSONB
      WHEN 'enterprise' THEN '{"max_users": -1, "max_leads_per_month": -1, "max_jobs_per_month": -1, "max_storage_gb": -1}'::JSONB
      ELSE '{"max_users": 3, "max_leads_per_month": 50, "max_jobs_per_month": 25, "max_storage_gb": 5}'::JSONB
    END,
    '{"users_count": 0, "leads_this_month": 0, "jobs_this_month": 0, "storage_used_bytes": 0}'::JSONB
  ) RETURNING id INTO v_tenant_id;
  
  -- Create owner user (bypasses RLS policy restriction on 'owner' role)
  INSERT INTO users (
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    status
  ) VALUES (
    v_tenant_id,
    p_owner_email,
    p_owner_first_name,
    p_owner_last_name,
    'owner',
    'active'
  ) RETURNING id INTO v_user_id;
  
  -- Set owner on tenant
  UPDATE tenants SET owner_user_id = v_user_id WHERE id = v_tenant_id;
  
  -- Initialize sequences
  INSERT INTO tenant_sequences (tenant_id, entity_type, prefix, current_value)
  VALUES 
    (v_tenant_id, 'lead', p_sequence_prefix, 0),
    (v_tenant_id, 'quote', p_sequence_prefix, 0),
    (v_tenant_id, 'job', p_sequence_prefix, 0),
    (v_tenant_id, 'call', p_sequence_prefix, 0),
    (v_tenant_id, 'payment', p_sequence_prefix, 0),
    (v_tenant_id, 'file', p_sequence_prefix, 0);
  
  RETURN QUERY SELECT v_tenant_id, v_user_id;
END;
$$;

-- Invite user to tenant (hardened)
CREATE OR REPLACE FUNCTION invite_user(
  p_email TEXT,
  p_role user_role,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_invited_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_token TEXT;
BEGIN
  -- Guard: Tenant context required
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context missing';
  END IF;
  
  -- Guard: Cannot invite owner or superadmin
  IF p_role IN ('owner', 'superadmin') THEN
    RAISE EXCEPTION 'Cannot invite % via invite_user', p_role;
  END IF;
  
  -- Guard: Check tenant user limit
  IF NOT check_tenant_limit(v_tenant_id, 'max_users') THEN
    RAISE EXCEPTION 'Tenant user limit reached';
  END IF;
  
  -- Guard: Check if email already exists in tenant
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE tenant_id = v_tenant_id 
      AND LOWER(email) = LOWER(p_email) 
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User with this email already exists in tenant';
  END IF;
  
  -- Generate invitation token
  v_token := encode(gen_random_bytes(32), 'hex');
  
  -- Create user in pending state
  INSERT INTO users (
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    status,
    invited_by,
    invited_at,
    invitation_token,
    invitation_expires_at
  ) VALUES (
    v_tenant_id,
    p_email,
    p_first_name,
    p_last_name,
    p_role,
    'pending',
    COALESCE(p_invited_by, (auth.jwt() ->> 'user_id')::UUID),
    NOW(),
    v_token,
    NOW() + INTERVAL '7 days'
  ) RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$;

-- Accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(
  p_token TEXT,
  p_auth_provider_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  UPDATE users
  SET 
    status = 'active',
    accepted_at = NOW(),
    invitation_token = NULL,
    invitation_expires_at = NULL,
    auth_provider_id = p_auth_provider_id,
    email_verified = true
  WHERE invitation_token = p_token
    AND invitation_expires_at > NOW()
    AND deleted_at IS NULL
    AND status = 'pending'
  RETURNING id INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  RETURN v_user_id;
END;
$$;

-- Get tenant by domain (for routing)
CREATE OR REPLACE FUNCTION get_tenant_by_domain(
  p_domain TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  branding JSONB,
  status tenant_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id, t.name, t.slug, t.branding, t.status
  FROM tenants t
  WHERE (
    t.custom_domain = p_domain 
    OR t.subdomain = SPLIT_PART(p_domain, '.', 1)
    OR t.slug = SPLIT_PART(p_domain, '.', 1)
  )
    AND t.deleted_at IS NULL
    AND t.status IN ('trial', 'active');
END;
$$;

-- Get user by auth provider ID (for auth callback)
CREATE OR REPLACE FUNCTION get_user_by_auth_id(
  p_auth_provider TEXT,
  p_auth_provider_id TEXT
)
RETURNS TABLE (
  user_id UUID,
  tenant_id UUID,
  email TEXT,
  role user_role,
  status user_status,
  full_name TEXT,
  tenant_slug TEXT,
  tenant_status tenant_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.tenant_id,
    u.email,
    u.role,
    u.status,
    u.full_name,
    t.slug AS tenant_slug,
    t.status AS tenant_status
  FROM users u
  INNER JOIN tenants t ON t.id = u.tenant_id
  WHERE u.auth_provider = p_auth_provider
    AND u.auth_provider_id = p_auth_provider_id
    AND u.deleted_at IS NULL
    AND t.deleted_at IS NULL;
END;
$$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Record login
CREATE OR REPLACE FUNCTION record_user_login(
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET 
    last_login_at = NOW(),
    last_active_at = NOW(),
    login_count = login_count + 1
  WHERE id = p_user_id
    AND deleted_at IS NULL;
END;
$$;

-- Soft delete user
CREATE OR REPLACE FUNCTION soft_delete_user(
  p_user_id UUID,
  p_deleted_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  -- Check if trying to delete an owner
  SELECT role INTO v_role FROM users WHERE id = p_user_id AND deleted_at IS NULL;
  
  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot delete tenant owner. Transfer ownership first.';
  END IF;
  
  UPDATE users
  SET 
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    status = 'deactivated'
  WHERE id = p_user_id
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_resource TEXT,
  p_action TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_permissions JSONB;
  v_resource_perms JSONB;
BEGIN
  SELECT role, permissions INTO v_role, v_permissions
  FROM users
  WHERE id = p_user_id AND deleted_at IS NULL;
  
  -- Superadmins, owners and admins have all permissions
  IF v_role IN ('superadmin', 'owner', 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Readonly users can only read
  IF v_role = 'readonly' AND p_action != 'read' THEN
    RETURN FALSE;
  END IF;
  
  -- Check specific permission
  v_resource_perms := v_permissions -> p_resource;
  IF v_resource_perms IS NOT NULL THEN
    RETURN v_resource_perms ? p_action;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Check tenant limits
CREATE OR REPLACE FUNCTION check_tenant_limit(
  p_tenant_id UUID,
  p_limit_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_current INT;
  v_usage_key TEXT;
BEGIN
  -- Map limit key to usage key
  v_usage_key := CASE p_limit_key
    WHEN 'max_users' THEN 'users_count'
    WHEN 'max_leads_per_month' THEN 'leads_this_month'
    WHEN 'max_jobs_per_month' THEN 'jobs_this_month'
    ELSE REPLACE(p_limit_key, 'max_', '') || '_count'
  END;
  
  SELECT 
    (limits ->> p_limit_key)::INT,
    COALESCE((usage ->> v_usage_key)::INT, 0)
  INTO v_limit, v_current
  FROM tenants
  WHERE id = p_tenant_id AND deleted_at IS NULL;
  
  -- -1 means unlimited
  IF v_limit IS NULL OR v_limit = -1 THEN
    RETURN TRUE;
  END IF;
  
  RETURN v_current < v_limit;
END;
$$;

-- Transfer tenant ownership
CREATE OR REPLACE FUNCTION transfer_tenant_ownership(
  p_new_owner_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_old_owner_id UUID;
  v_caller_role user_role;
BEGIN
  -- Get caller info
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::UUID;
  v_caller_role := (auth.jwt() ->> 'role')::user_role;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context missing';
  END IF;
  
  -- Only current owner or superadmin can transfer
  IF v_caller_role NOT IN ('owner', 'superadmin') THEN
    RAISE EXCEPTION 'Only owner or superadmin can transfer ownership';
  END IF;
  
  -- Verify new owner is in same tenant
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_new_owner_user_id 
      AND tenant_id = v_tenant_id 
      AND deleted_at IS NULL
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'New owner must be an active user in the same tenant';
  END IF;
  
  -- Get current owner
  SELECT owner_user_id INTO v_old_owner_id
  FROM tenants WHERE id = v_tenant_id;
  
  -- Update roles
  UPDATE users SET role = 'admin' WHERE id = v_old_owner_id;
  UPDATE users SET role = 'owner' WHERE id = p_new_owner_user_id;
  
  -- Update tenant
  UPDATE tenants SET owner_user_id = p_new_owner_user_id WHERE id = v_tenant_id;
  
  RETURN TRUE;
END;
$$;

-- Soft delete tenant (cascades to users)
CREATE OR REPLACE FUNCTION soft_delete_tenant(
  p_tenant_id UUID,
  p_deleted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tenants
  SET 
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    status = 'cancelled'
  WHERE id = p_tenant_id
    AND deleted_at IS NULL;
  
  -- Cascade trigger handles users
  
  RETURN FOUND;
END;
$$;
