-- ===========================================================
-- 007_HOMEOWNERS.SQL (UPGRADED)
-- Homeowner Profiles + Property Management
-- Full RLS, AR Fox Integration, Merge Support
-- Depends on:
--   000_common.sql
--   005_tenants_users.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE homeowner_status AS ENUM (
  'prospect',
  'quoted',
  'customer',
  'repeat',
  'inactive',
  'do_not_contact'
);

CREATE TYPE property_type AS ENUM (
  'single_family',
  'townhouse',
  'condo',
  'apartment',
  'mobile_home',
  'multi_family',
  'commercial',
  'other'
);

CREATE TYPE communication_preference AS ENUM (
  'email',
  'phone',
  'sms',
  'any',
  'none'
);

CREATE TYPE contact_time_preference AS ENUM (
  'morning',
  'afternoon',
  'evening',
  'anytime',
  'weekends_only'
);

-- ============================================
-- HOMEOWNERS TABLE
-- ============================================

CREATE TABLE homeowners (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Human-readable ID
  homeowner_number TEXT UNIQUE,
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Link to user account (for portal access)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Identity
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (
    TRIM(first_name || ' ' || last_name)
  ) STORED,
  
  -- Contact
  email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  phone_secondary TEXT,
  
  -- Communication preferences
  communication_preference communication_preference NOT NULL DEFAULT 'any',
  contact_time_preference contact_time_preference NOT NULL DEFAULT 'anytime',
  language_preference TEXT DEFAULT 'en',
  opted_out_email BOOLEAN NOT NULL DEFAULT false,
  opted_out_sms BOOLEAN NOT NULL DEFAULT false,
  opted_out_phone BOOLEAN NOT NULL DEFAULT false,
  
  -- Primary address (service address)
  address JSONB DEFAULT '{}' CHECK (jsonb_typeof(address) = 'object'),
  
  -- Property details
  property_type property_type DEFAULT 'single_family',
  property_details JSONB DEFAULT '{}' CHECK (jsonb_typeof(property_details) = 'object'),
  
  -- Kitchen details (cabinet refacing specific)
  kitchen_details JSONB DEFAULT '{}' CHECK (jsonb_typeof(kitchen_details) = 'object'),
  
  -- AR Fox Visualizer Data
  ar_visualizer_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(ar_visualizer_data) = 'object'),
  -- Expected: { 
  --   "room_scan_id": "", 
  --   "model_url": "", 
  --   "before_images": [], 
  --   "after_images": [], 
  --   "render_urls": [],
  --   "settings": {},
  --   "last_visualizer_session_id": null
  -- }
  
  -- Status
  status homeowner_status NOT NULL DEFAULT 'prospect',
  
  -- Lifecycle tracking
  first_contact_at TIMESTAMPTZ,
  first_contact_source TEXT,
  first_quote_at TIMESTAMPTZ,
  first_job_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  last_job_at TIMESTAMPTZ,
  
  -- Value metrics
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_jobs INT NOT NULL DEFAULT 0,
  average_job_value NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN total_jobs > 0 THEN total_spent / total_jobs ELSE 0 END
  ) STORED,
  lifetime_value_score INT DEFAULT 0,
  
  -- Referral tracking
  referred_by_homeowner_id UUID REFERENCES homeowners(id) ON DELETE SET NULL,
  referral_code TEXT UNIQUE,
  referrals_count INT NOT NULL DEFAULT 0,
  referral_credits NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Portal access
  portal_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  portal_last_access_at TIMESTAMPTZ,
  
  -- Marketing
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  marketing_source TEXT,
  marketing_campaign TEXT,
  marketing_tags TEXT[] DEFAULT '{}',
  
  -- Notes
  internal_notes TEXT,
  
  -- Additional contacts
  additional_contacts JSONB DEFAULT '[]' CHECK (jsonb_typeof(additional_contacts) = 'array'),
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  tags TEXT[] DEFAULT '{}',
  
  -- Audit log
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  
  -- Audit
  created_by UUID,
  updated_by UUID,
  
  -- Constraints
  UNIQUE(tenant_id, email)
) WITH (fillfactor = 90);

-- ============================================
-- HOMEOWNER PROPERTIES TABLE
-- ============================================

CREATE TABLE homeowner_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  homeowner_id UUID NOT NULL REFERENCES homeowners(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Property name/label
  name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  
  -- Address
  address JSONB DEFAULT '{}' CHECK (jsonb_typeof(address) = 'object'),
  
  -- Property details
  property_type property_type DEFAULT 'single_family',
  property_details JSONB DEFAULT '{}' CHECK (jsonb_typeof(property_details) = 'object'),
  kitchen_details JSONB DEFAULT '{}' CHECK (jsonb_typeof(kitchen_details) = 'object'),
  
  -- AR visualizer for this property
  ar_visualizer_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(ar_visualizer_data) = 'object'),
  
  -- Access info
  access_notes TEXT,
  gate_code TEXT,
  lockbox_code TEXT,
  
  -- Contact for this property
  contact_name TEXT,
  contact_phone TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Audit log
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Audit
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- HOMEOWNER COMMUNICATIONS LOG
-- ============================================

CREATE TABLE homeowner_communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  homeowner_id UUID NOT NULL REFERENCES homeowners(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Communication details
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  type TEXT NOT NULL,
  
  -- Content
  subject TEXT,
  body TEXT,
  template_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'sent',
  
  -- Tracking
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  
  -- External IDs
  external_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Who sent it
  sent_by UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES: HOMEOWNERS
-- ============================================

CREATE INDEX idx_homeowners_tenant_id ON homeowners(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_homeowners_user_id ON homeowners(user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX idx_homeowners_status ON homeowners(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_homeowners_email ON homeowners(tenant_id, LOWER(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX idx_homeowners_phone ON homeowners(phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;
CREATE INDEX idx_homeowners_portal_token ON homeowners(portal_token) WHERE deleted_at IS NULL;
CREATE INDEX idx_homeowners_referral_code ON homeowners(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_homeowners_created_at ON homeowners(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_homeowners_last_contact ON homeowners(tenant_id, last_contact_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_homeowners_total_spent ON homeowners(tenant_id, total_spent DESC) WHERE deleted_at IS NULL AND status = 'customer';
CREATE INDEX idx_homeowners_lifetime_value ON homeowners(tenant_id, lifetime_value_score DESC) WHERE deleted_at IS NULL;

-- GIN indexes
CREATE INDEX idx_homeowners_address_gin ON homeowners USING GIN (address jsonb_path_ops);
CREATE INDEX idx_homeowners_property_details_gin ON homeowners USING GIN (property_details jsonb_path_ops);
CREATE INDEX idx_homeowners_kitchen_details_gin ON homeowners USING GIN (kitchen_details jsonb_path_ops);
CREATE INDEX idx_homeowners_ar_data_gin ON homeowners USING GIN (ar_visualizer_data jsonb_path_ops);
CREATE INDEX idx_homeowners_tags_gin ON homeowners USING GIN (tags array_ops);
CREATE INDEX idx_homeowners_marketing_tags_gin ON homeowners USING GIN (marketing_tags array_ops);
CREATE INDEX idx_homeowners_metadata_gin ON homeowners USING GIN (metadata jsonb_path_ops);

-- ZIP code lookup
CREATE INDEX idx_homeowners_zip ON homeowners(tenant_id, (address->>'zip')) WHERE deleted_at IS NULL AND address->>'zip' IS NOT NULL;

-- Full text search
CREATE INDEX idx_homeowners_fts ON homeowners USING GIN (
  to_tsvector('english',
    COALESCE(first_name, '') || ' ' ||
    COALESCE(last_name, '') || ' ' ||
    COALESCE(email, '') || ' ' ||
    COALESCE(phone, '') || ' ' ||
    COALESCE(address->>'street', '') || ' ' ||
    COALESCE(address->>'city', '') || ' ' ||
    COALESCE(internal_notes, '')
  )
) WHERE deleted_at IS NULL;

-- ============================================
-- INDEXES: PROPERTIES
-- ============================================

CREATE INDEX idx_homeowner_properties_homeowner ON homeowner_properties(homeowner_id);
CREATE INDEX idx_homeowner_properties_tenant ON homeowner_properties(tenant_id);
CREATE INDEX idx_homeowner_properties_primary ON homeowner_properties(homeowner_id) WHERE is_primary = true;
CREATE INDEX idx_homeowner_properties_address_gin ON homeowner_properties USING GIN (address jsonb_path_ops);
CREATE INDEX idx_homeowner_properties_ar_data_gin ON homeowner_properties USING GIN (ar_visualizer_data jsonb_path_ops);

-- ============================================
-- INDEXES: COMMUNICATIONS
-- ============================================

CREATE INDEX idx_homeowner_comms_homeowner ON homeowner_communications(homeowner_id);
CREATE INDEX idx_homeowner_comms_tenant ON homeowner_communications(tenant_id);
CREATE INDEX idx_homeowner_comms_lead ON homeowner_communications(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_homeowner_comms_job ON homeowner_communications(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_homeowner_comms_channel ON homeowner_communications(tenant_id, channel);
CREATE INDEX idx_homeowner_comms_type ON homeowner_communications(tenant_id, type);
CREATE INDEX idx_homeowner_comms_created ON homeowner_communications(homeowner_id, created_at DESC);
CREATE INDEX idx_homeowner_comms_external ON homeowner_communications(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_homeowner_comms_metadata_gin ON homeowner_communications USING GIN (metadata jsonb_path_ops);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-generate homeowner_number
CREATE OR REPLACE FUNCTION generate_homeowner_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.homeowner_number IS NULL THEN
    NEW.homeowner_number := next_tenant_sequence(NEW.tenant_id, 'homeowner', 'VUL');
  END IF;
  
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  
  -- Generate referral code if not set
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(LEFT(NEW.first_name, 2) || LEFT(NEW.last_name, 2)) || '-' || 
                         UPPER(encode(gen_random_bytes(3), 'hex'));
  END IF;
  
  -- Set first contact
  IF NEW.first_contact_at IS NULL THEN
    NEW.first_contact_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER homeowner_number_trigger
  BEFORE INSERT ON homeowners
  FOR EACH ROW
  EXECUTE FUNCTION generate_homeowner_number();

-- Auto-update updated_at with updated_by
CREATE OR REPLACE FUNCTION update_homeowner_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER homeowners_updated_at
  BEFORE UPDATE ON homeowners
  FOR EACH ROW
  EXECUTE FUNCTION update_homeowner_updated_at();

-- Properties updated_at with updated_by
CREATE OR REPLACE FUNCTION update_homeowner_property_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER homeowner_properties_updated_at
  BEFORE UPDATE ON homeowner_properties
  FOR EACH ROW
  EXECUTE FUNCTION update_homeowner_property_updated_at();

-- Audit logging (reuses audit_entity from 005)
CREATE TRIGGER homeowners_audit
  BEFORE UPDATE ON homeowners
  FOR EACH ROW
  EXECUTE FUNCTION audit_entity();

CREATE TRIGGER homeowner_properties_audit
  BEFORE UPDATE ON homeowner_properties
  FOR EACH ROW
  EXECUTE FUNCTION audit_entity();

-- Track status changes
CREATE OR REPLACE FUNCTION track_homeowner_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'customer' AND OLD.status != 'customer' THEN
      NEW.first_job_at := COALESCE(NEW.first_job_at, NOW());
    END IF;
    IF NEW.status = 'quoted' AND OLD.status = 'prospect' THEN
      NEW.first_quote_at := COALESCE(NEW.first_quote_at, NOW());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER homeowners_status_change
  BEFORE UPDATE ON homeowners
  FOR EACH ROW
  EXECUTE FUNCTION track_homeowner_status_change();

-- Ensure only one primary property per homeowner
CREATE OR REPLACE FUNCTION ensure_single_primary_property()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE homeowner_properties
    SET is_primary = false
    WHERE homeowner_id = NEW.homeowner_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER homeowner_properties_primary
  BEFORE INSERT OR UPDATE ON homeowner_properties
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_property();

-- Update referral counts
CREATE OR REPLACE FUNCTION update_referral_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referred_by_homeowner_id IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.referred_by_homeowner_id IS DISTINCT FROM NEW.referred_by_homeowner_id) THEN
    UPDATE homeowners
    SET referrals_count = referrals_count + 1
    WHERE id = NEW.referred_by_homeowner_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER homeowners_update_referrals
  AFTER INSERT OR UPDATE ON homeowners
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_counts();

-- ============================================
-- ROW LEVEL SECURITY: HOMEOWNERS
-- ============================================

ALTER TABLE homeowners ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowners FORCE ROW LEVEL SECURITY;

CREATE POLICY homeowners_select ON homeowners
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
      OR user_id = (auth.jwt() ->> 'user_id')::UUID
    )
  );

CREATE POLICY homeowners_insert ON homeowners
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY homeowners_update ON homeowners
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
      OR user_id = (auth.jwt() ->> 'user_id')::UUID
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY homeowners_delete ON homeowners
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: PROPERTIES
-- ============================================

ALTER TABLE homeowner_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowner_properties FORCE ROW LEVEL SECURITY;

-- UPGRADED: Hide properties for soft-deleted homeowners
CREATE POLICY homeowner_properties_select ON homeowner_properties
  FOR SELECT
  USING (
    (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM homeowners h
      WHERE h.id = homeowner_properties.homeowner_id
        AND h.deleted_at IS NOT NULL
    )
  );

-- UPGRADED: Validate homeowner belongs to same tenant
CREATE POLICY homeowner_properties_insert ON homeowner_properties
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM homeowners
      WHERE id = homeowner_id
        AND homeowners.tenant_id = homeowner_properties.tenant_id
        AND homeowners.deleted_at IS NULL
    )
  );

CREATE POLICY homeowner_properties_update ON homeowner_properties
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY homeowner_properties_delete ON homeowner_properties
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- ============================================
-- ROW LEVEL SECURITY: COMMUNICATIONS
-- ============================================

ALTER TABLE homeowner_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowner_communications FORCE ROW LEVEL SECURITY;

-- UPGRADED: Hide communications for soft-deleted homeowners
CREATE POLICY homeowner_comms_select ON homeowner_communications
  FOR SELECT
  USING (
    (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM homeowners h
      WHERE h.id = homeowner_communications.homeowner_id
        AND h.deleted_at IS NOT NULL
    )
  );

-- UPGRADED: Validate homeowner belongs to same tenant
CREATE POLICY homeowner_comms_insert ON homeowner_communications
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM homeowners
      WHERE id = homeowner_id
        AND homeowners.tenant_id = homeowner_communications.tenant_id
        AND homeowners.deleted_at IS NULL
    )
  );

-- Communications are immutable (audit trail)
CREATE POLICY homeowner_comms_update ON homeowner_communications
  FOR UPDATE
  USING (false);

CREATE POLICY homeowner_comms_delete ON homeowner_communications
  FOR DELETE
  USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get or create homeowner from lead data
CREATE OR REPLACE FUNCTION get_or_create_homeowner(
  p_tenant_id UUID,
  p_email TEXT,
  p_phone TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_address JSONB DEFAULT '{}',
  p_source TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_homeowner_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Explicit tenant assignment
  v_tenant_id := p_tenant_id;
  
  -- Try to find by email first
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_homeowner_id
    FROM homeowners
    WHERE tenant_id = v_tenant_id
      AND LOWER(email) = LOWER(p_email)
      AND deleted_at IS NULL;
  END IF;
  
  -- Try phone if email not found
  IF v_homeowner_id IS NULL AND p_phone IS NOT NULL THEN
    SELECT id INTO v_homeowner_id
    FROM homeowners
    WHERE tenant_id = v_tenant_id
      AND phone = p_phone
      AND deleted_at IS NULL;
  END IF;
  
  -- Create if not found
  IF v_homeowner_id IS NULL THEN
    INSERT INTO homeowners (
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      address,
      first_contact_source,
      first_contact_at
    ) VALUES (
      v_tenant_id,
      p_first_name,
      p_last_name,
      p_email,
      p_phone,
      p_address,
      p_source,
      NOW()
    ) RETURNING id INTO v_homeowner_id;
  ELSE
    -- Update last contact and ensure first_contact_at is set
    UPDATE homeowners
    SET 
      last_contact_at = NOW(),
      first_contact_at = COALESCE(first_contact_at, NOW())
    WHERE id = v_homeowner_id;
  END IF;
  
  RETURN v_homeowner_id;
END;
$$;

-- Link lead to homeowner
CREATE OR REPLACE FUNCTION link_lead_to_homeowner(
  p_lead_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_homeowner_id UUID;
  v_name_parts TEXT[];
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Get lead data
  SELECT * INTO v_lead
  FROM leads
  WHERE id = p_lead_id AND deleted_at IS NULL;
  
  IF v_lead IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  
  -- Parse name
  v_name_parts := string_to_array(TRIM(v_lead.name), ' ');
  v_first_name := COALESCE(v_name_parts[1], v_lead.name);
  v_last_name := COALESCE(
    array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' '),
    ''
  );
  
  -- Get or create homeowner
  v_homeowner_id := get_or_create_homeowner(
    v_lead.tenant_id,
    v_lead.email,
    v_lead.phone,
    v_first_name,
    v_last_name,
    v_lead.address,
    v_lead.source::TEXT
  );
  
  RETURN v_homeowner_id;
END;
$$;

-- Update homeowner stats when job completes
CREATE OR REPLACE FUNCTION update_homeowner_job_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_homeowner_id UUID;
  v_current_jobs INT;
BEGIN
  v_homeowner_id := NEW.homeowner_id;
  
  IF v_homeowner_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get current job count for status determination
    SELECT total_jobs INTO v_current_jobs
    FROM homeowners
    WHERE id = v_homeowner_id;
    
    UPDATE homeowners
    SET 
      total_jobs = total_jobs + 1,
      total_spent = total_spent + COALESCE(NEW.final_total, NEW.quoted_total, 0),
      last_job_at = NOW(),
      status = CASE 
        WHEN v_current_jobs >= 1 THEN 'repeat'::homeowner_status
        ELSE 'customer'::homeowner_status
      END
    WHERE id = v_homeowner_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_update_homeowner_stats
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_homeowner_job_stats();

-- Get homeowner by portal token (for public access)
CREATE OR REPLACE FUNCTION get_homeowner_by_portal_token(
  p_token TEXT
)
RETURNS TABLE (
  id UUID,
  homeowner_number TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  address JSONB,
  status homeowner_status,
  ar_visualizer_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update last portal access
  UPDATE homeowners
  SET portal_last_access_at = NOW()
  WHERE portal_token = p_token
    AND deleted_at IS NULL;
  
  RETURN QUERY
  SELECT 
    h.id, h.homeowner_number, h.full_name, h.email, h.phone, 
    h.address, h.status, h.ar_visualizer_data
  FROM homeowners h
  WHERE h.portal_token = p_token
    AND h.deleted_at IS NULL;
END;
$$;

-- Get homeowner's jobs (for portal)
CREATE OR REPLACE FUNCTION get_homeowner_jobs_by_token(
  p_token TEXT
)
RETURNS TABLE (
  job_id UUID,
  job_number TEXT,
  status job_status,
  title TEXT,
  scheduled_date DATE,
  installer_name TEXT,
  quoted_total NUMERIC,
  amount_paid NUMERIC,
  amount_due NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_homeowner_id UUID;
BEGIN
  SELECT id INTO v_homeowner_id
  FROM homeowners
  WHERE portal_token = p_token AND deleted_at IS NULL;
  
  IF v_homeowner_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    j.id, j.job_number, j.status, j.title, j.scheduled_date,
    j.installer_name, j.quoted_total, j.amount_paid, j.amount_due, j.created_at
  FROM jobs j
  WHERE j.homeowner_id = v_homeowner_id
    AND j.deleted_at IS NULL
  ORDER BY j.created_at DESC;
END;
$$;

-- Get homeowner's quotes (for portal)
CREATE OR REPLACE FUNCTION get_homeowner_quotes_by_token(
  p_token TEXT
)
RETURNS TABLE (
  quote_id UUID,
  quote_number TEXT,
  status quote_status,
  title TEXT,
  total NUMERIC,
  valid_until DATE,
  public_token TEXT,
  ar_preview_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_homeowner_id UUID;
BEGIN
  SELECT id INTO v_homeowner_id
  FROM homeowners
  WHERE portal_token = p_token AND deleted_at IS NULL;
  
  IF v_homeowner_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    q.id, q.quote_number, q.status, q.title, q.total, 
    q.valid_until, q.public_token, q.ar_preview_url, q.created_at
  FROM quotes q
  WHERE q.homeowner_id = v_homeowner_id
    AND q.deleted_at IS NULL
  ORDER BY q.created_at DESC;
END;
$$;

-- Log communication (with proper tenant propagation)
CREATE OR REPLACE FUNCTION log_homeowner_communication(
  p_homeowner_id UUID,
  p_channel TEXT,
  p_direction TEXT,
  p_type TEXT,
  p_subject TEXT DEFAULT NULL,
  p_body TEXT DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get tenant from homeowner (explicit assignment)
  SELECT tenant_id INTO v_tenant_id
  FROM homeowners
  WHERE id = p_homeowner_id AND deleted_at IS NULL;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Homeowner not found';
  END IF;
  
  INSERT INTO homeowner_communications (
    homeowner_id,
    tenant_id,
    lead_id,
    job_id,
    channel,
    direction,
    type,
    subject,
    body,
    external_id,
    metadata,
    sent_at,
    sent_by
  ) VALUES (
    p_homeowner_id,
    v_tenant_id,
    p_lead_id,
    p_job_id,
    p_channel,
    p_direction,
    p_type,
    p_subject,
    p_body,
    p_external_id,
    p_metadata,
    NOW(),
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID
  ) RETURNING id INTO v_id;
  
  -- Update last contact
  UPDATE homeowners
  SET last_contact_at = NOW()
  WHERE id = p_homeowner_id;
  
  RETURN v_id;
END;
$$;

-- Soft delete homeowner (with tenant enforcement)
CREATE OR REPLACE FUNCTION soft_delete_homeowner(
  p_homeowner_id UUID,
  p_deleted_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  UPDATE homeowners
  SET 
    deleted_at = NOW(),
    deleted_by = COALESCE(p_deleted_by, NULLIF(auth.jwt() ->> 'user_id', '')::UUID),
    status = 'inactive'
  WHERE id = p_homeowner_id
    AND tenant_id = v_tenant_id
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Merge duplicate homeowners (for AI dedupe)
-- FIXED: Clear visualizer linkage BEFORE reassignment
CREATE OR REPLACE FUNCTION merge_homeowners(
  p_source_id UUID,
  p_target_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_source_tenant UUID;
  v_target_tenant UUID;
BEGIN
  -- Get tenant context
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  -- Verify both homeowners are in the same tenant
  SELECT tenant_id INTO v_source_tenant
  FROM homeowners
  WHERE id = p_source_id AND deleted_at IS NULL;
  
  SELECT tenant_id INTO v_target_tenant
  FROM homeowners
  WHERE id = p_target_id AND deleted_at IS NULL;
  
  IF v_source_tenant IS NULL OR v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Homeowner not found';
  END IF;
  
  IF v_source_tenant != v_target_tenant THEN
    RAISE EXCEPTION 'Cannot merge homeowners from different tenants';
  END IF;
  
  IF v_tenant_id IS NOT NULL AND v_source_tenant != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized: homeowners not in current tenant';
  END IF;
  
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot merge homeowner with itself';
  END IF;
  
  -- FIXED: Clear visualizer linkage BEFORE moving records
  UPDATE leads
  SET visualizer_session_id = NULL
  WHERE id IN (
    SELECT lead_id FROM quotes WHERE homeowner_id = p_source_id
    UNION
    SELECT lead_id FROM jobs WHERE homeowner_id = p_source_id
  );
  
  -- Move all related records to target
  UPDATE quotes 
  SET homeowner_id = p_target_id 
  WHERE homeowner_id = p_source_id;
  
  UPDATE jobs 
  SET homeowner_id = p_target_id 
  WHERE homeowner_id = p_source_id;
  
  UPDATE homeowner_properties 
  SET homeowner_id = p_target_id 
  WHERE homeowner_id = p_source_id;
  
  UPDATE homeowner_communications 
  SET homeowner_id = p_target_id 
  WHERE homeowner_id = p_source_id;
  
  -- Update referral links
  UPDATE homeowners
  SET referred_by_homeowner_id = p_target_id
  WHERE referred_by_homeowner_id = p_source_id;
  
  -- Merge stats into target
  UPDATE homeowners t
  SET 
    total_spent = t.total_spent + s.total_spent,
    total_jobs = t.total_jobs + s.total_jobs,
    referrals_count = t.referrals_count + s.referrals_count,
    referral_credits = t.referral_credits + s.referral_credits,
    first_contact_at = LEAST(t.first_contact_at, s.first_contact_at),
    first_quote_at = LEAST(t.first_quote_at, s.first_quote_at),
    first_job_at = LEAST(t.first_job_at, s.first_job_at),
    last_contact_at = GREATEST(t.last_contact_at, s.last_contact_at),
    last_job_at = GREATEST(t.last_job_at, s.last_job_at),
    internal_notes = COALESCE(t.internal_notes, '') || 
      CASE WHEN s.internal_notes IS NOT NULL 
        THEN E'\n\n[Merged from ' || s.homeowner_number || ']:\n' || s.internal_notes 
        ELSE '' 
      END,
    tags = ARRAY(SELECT DISTINCT unnest(t.tags || s.tags)),
    marketing_tags = ARRAY(SELECT DISTINCT unnest(t.marketing_tags || s.marketing_tags)),
    ar_visualizer_data = CASE 
      WHEN t.ar_visualizer_data = '{}'::JSONB THEN s.ar_visualizer_data
      ELSE t.ar_visualizer_data
    END
  FROM homeowners s
  WHERE t.id = p_target_id AND s.id = p_source_id;
  
  -- Soft delete source
  PERFORM soft_delete_homeowner(p_source_id, NULLIF(auth.jwt() ->> 'user_id', '')::UUID);
  
  -- Recalculate lifetime value
  PERFORM calculate_lifetime_value_score(p_target_id);
  
  RETURN TRUE;
END;
$$;

-- Calculate lifetime value score
CREATE OR REPLACE FUNCTION calculate_lifetime_value_score(
  p_homeowner_id UUID
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INT := 0;
  v_homeowner RECORD;
BEGIN
  SELECT * INTO v_homeowner
  FROM homeowners
  WHERE id = p_homeowner_id AND deleted_at IS NULL;
  
  IF v_homeowner IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Base score from total spent (up to 40 points)
  v_score := v_score + LEAST(40, (v_homeowner.total_spent / 200)::INT);
  
  -- Jobs count (up to 20 points)
  v_score := v_score + LEAST(20, v_homeowner.total_jobs * 5);
  
  -- Referrals (up to 20 points)
  v_score := v_score + LEAST(20, v_homeowner.referrals_count * 10);
  
  -- Recency (last contact within 6 months)
  IF v_homeowner.last_contact_at > NOW() - INTERVAL '6 months' THEN
    v_score := v_score + 10;
  END IF;
  
  -- Marketing engagement
  IF v_homeowner.marketing_consent THEN
    v_score := v_score + 5;
  END IF;
  
  -- Email verified
  IF v_homeowner.email_verified THEN
    v_score := v_score + 5;
  END IF;
  
  -- Update score
  UPDATE homeowners
  SET lifetime_value_score = LEAST(100, v_score)
  WHERE id = p_homeowner_id;
  
  RETURN LEAST(100, v_score);
END;
$$;

-- Search homeowners
CREATE OR REPLACE FUNCTION search_homeowners(
  p_query TEXT,
  p_status homeowner_status DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS SETOF homeowners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  RETURN QUERY
  SELECT *
  FROM homeowners
  WHERE tenant_id = v_tenant_id
    AND deleted_at IS NULL
    AND (p_status IS NULL OR status = p_status)
    AND (
      to_tsvector('english',
        COALESCE(first_name, '') || ' ' ||
        COALESCE(last_name, '') || ' ' ||
        COALESCE(email, '') || ' ' ||
        COALESCE(phone, '') || ' ' ||
        COALESCE(address->>'city', '')
      ) @@ plainto_tsquery('english', p_query)
      OR first_name ILIKE '%' || p_query || '%'
      OR last_name ILIKE '%' || p_query || '%'
      OR email ILIKE '%' || p_query || '%'
      OR phone ILIKE '%' || p_query || '%'
      OR homeowner_number ILIKE '%' || p_query || '%'
    )
  ORDER BY 
    lifetime_value_score DESC,
    last_contact_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Find potential duplicates (for AI/AEON)
-- FIXED: Early return on empty params
CREATE OR REPLACE FUNCTION find_potential_duplicate_homeowners(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  homeowner_id UUID,
  homeowner_number TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  match_type TEXT,
  match_score INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  -- Short-circuit if no search criteria provided
  IF p_email IS NULL AND p_phone IS NULL AND p_first_name IS NULL AND p_last_name IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    h.id,
    h.homeowner_number,
    h.full_name,
    h.email,
    h.phone,
    CASE 
      WHEN p_email IS NOT NULL AND LOWER(h.email) = LOWER(p_email) THEN 'email_exact'
      WHEN p_phone IS NOT NULL AND h.phone = p_phone THEN 'phone_exact'
      WHEN p_first_name IS NOT NULL AND p_last_name IS NOT NULL 
           AND LOWER(h.first_name) = LOWER(p_first_name) 
           AND LOWER(h.last_name) = LOWER(p_last_name) THEN 'name_exact'
      WHEN p_phone IS NOT NULL AND RIGHT(h.phone, 10) = RIGHT(p_phone, 10) THEN 'phone_partial'
      ELSE 'fuzzy'
    END AS match_type,
    CASE 
      WHEN p_email IS NOT NULL AND LOWER(h.email) = LOWER(p_email) THEN 100
      WHEN p_phone IS NOT NULL AND h.phone = p_phone THEN 95
      WHEN p_first_name IS NOT NULL AND p_last_name IS NOT NULL 
           AND LOWER(h.first_name) = LOWER(p_first_name) 
           AND LOWER(h.last_name) = LOWER(p_last_name) THEN 80
      WHEN p_phone IS NOT NULL AND RIGHT(h.phone, 10) = RIGHT(p_phone, 10) THEN 70
      ELSE 50
    END AS match_score
  FROM homeowners h
  WHERE h.tenant_id = v_tenant_id
    AND h.deleted_at IS NULL
    AND (
      (p_email IS NOT NULL AND LOWER(h.email) = LOWER(p_email))
      OR (p_phone IS NOT NULL AND (h.phone = p_phone OR RIGHT(h.phone, 10) = RIGHT(p_phone, 10)))
      OR (p_first_name IS NOT NULL AND p_last_name IS NOT NULL 
          AND LOWER(h.first_name) = LOWER(p_first_name) 
          AND LOWER(h.last_name) = LOWER(p_last_name))
    )
  ORDER BY match_score DESC;
END;
$$;
