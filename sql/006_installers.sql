-- ===========================================================
-- 006_INSTALLERS.SQL
-- Installer Network + Availability Management
-- Depends on:
--   000_common.sql
--   005_tenants_users.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE installer_status AS ENUM (
  'pending',        -- Applied, awaiting approval
  'onboarding',     -- Approved, completing setup
  'active',         -- Ready to accept jobs
  'inactive',       -- Temporarily unavailable
  'suspended',      -- Issue, under review
  'terminated'      -- No longer with network
);

CREATE TYPE installer_skill AS ENUM (
  'cabinet_refacing',
  'cabinet_painting',
  'door_installation',
  'drawer_installation',
  'hardware_installation',
  'countertop_installation',
  'soft_close_retrofit',
  'crown_molding',
  'light_rail_molding',
  'filler_panels',
  'end_panels',
  'island_work',
  'demolition',
  'disposal',
  'touch_up',
  'custom_modification'
);

CREATE TYPE installer_tier AS ENUM (
  'apprentice',     -- New, limited jobs
  'standard',       -- Proven, normal jobs
  'senior',         -- Experienced, complex jobs
  'lead',           -- Can manage crews
  'master'          -- Top tier, any job
);

CREATE TYPE availability_type AS ENUM (
  'available',
  'busy',
  'time_off',
  'sick',
  'blocked'
);

CREATE TYPE payout_method AS ENUM (
  'direct_deposit',
  'check',
  'venmo',
  'zelle',
  'paypal',
  'cash_app',
  'wire'
);

-- ============================================
-- INSTALLERS TABLE
-- ============================================

CREATE TABLE installers (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Human-readable ID
  installer_number TEXT UNIQUE,
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Link to user account (optional - installer may not have login)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Identity
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (
    TRIM(first_name || ' ' || last_name)
  ) STORED,
  email TEXT,
  phone TEXT NOT NULL,
  phone_secondary TEXT,
  
  -- Address
  address JSONB DEFAULT '{}' CHECK (jsonb_typeof(address) = 'object'),
  -- Expected: { "street": "", "city": "", "state": "", "zip": "", "lat": null, "lng": null }
  
  -- Service area
  service_area_zips TEXT[] DEFAULT '{}',
  service_radius_miles INT DEFAULT 25,
  service_area_geo JSONB DEFAULT '{}' CHECK (jsonb_typeof(service_area_geo) = 'object'),
  -- Expected: { "center": { "lat": 0, "lng": 0 }, "polygon": [] }
  
  -- Status & Tier
  status installer_status NOT NULL DEFAULT 'pending',
  tier installer_tier NOT NULL DEFAULT 'apprentice',
  
  -- Skills
  skills installer_skill[] DEFAULT '{}',
  certifications JSONB DEFAULT '[]' CHECK (jsonb_typeof(certifications) = 'array'),
  -- Expected: [{ "name": "", "issuer": "", "issued_at": "", "expires_at": "", "document_url": "" }]
  
  -- Capacity
  max_jobs_per_day INT DEFAULT 1,
  max_jobs_per_week INT DEFAULT 5,
  preferred_job_size TEXT, -- 'small', 'medium', 'large', 'any'
  
  -- Pay rates
  base_hourly_rate NUMERIC(8,2),
  base_job_rate NUMERIC(8,2),
  pay_structure JSONB DEFAULT '{}' CHECK (jsonb_typeof(pay_structure) = 'object'),
  -- Expected: { 
  --   "cabinet_door": 15.00, 
  --   "drawer_front": 12.00, 
  --   "countertop_sqft": 25.00,
  --   "minimum_job": 150.00,
  --   "travel_per_mile": 0.65
  -- }
  
  -- Payout info
  payout_method payout_method DEFAULT 'direct_deposit',
  payout_details JSONB DEFAULT '{}' CHECK (jsonb_typeof(payout_details) = 'object'),
  -- Expected: { "account_number": "", "routing_number": "", "account_type": "", "venmo_handle": "" }
  -- Note: Sensitive - encrypt in app layer
  tax_id TEXT, -- SSN or EIN (encrypted in app layer)
  tax_form_type TEXT DEFAULT 'W9', -- 'W9', '1099'
  
  -- Insurance & Compliance
  has_insurance BOOLEAN NOT NULL DEFAULT false,
  insurance_info JSONB DEFAULT '{}' CHECK (jsonb_typeof(insurance_info) = 'object'),
  -- Expected: { "provider": "", "policy_number": "", "coverage_amount": 0, "expires_at": "", "document_url": "" }
  has_workers_comp BOOLEAN NOT NULL DEFAULT false,
  workers_comp_info JSONB DEFAULT '{}' CHECK (jsonb_typeof(workers_comp_info) = 'object'),
  background_check_status TEXT, -- 'pending', 'passed', 'failed', 'expired'
  background_check_date DATE,
  
  -- Vehicle
  has_vehicle BOOLEAN NOT NULL DEFAULT true,
  vehicle_info JSONB DEFAULT '{}' CHECK (jsonb_typeof(vehicle_info) = 'object'),
  -- Expected: { "make": "", "model": "", "year": 0, "color": "", "plate": "" }
  
  -- Equipment
  has_tools BOOLEAN NOT NULL DEFAULT true,
  tools_list TEXT[],
  equipment_notes TEXT,
  
  -- Performance
  jobs_completed INT NOT NULL DEFAULT 0,
  jobs_cancelled INT NOT NULL DEFAULT 0,
  rating_average NUMERIC(3,2) DEFAULT 0 CHECK (rating_average >= 0 AND rating_average <= 5),
  rating_count INT NOT NULL DEFAULT 0,
  on_time_percentage NUMERIC(5,2) DEFAULT 100,
  callback_rate NUMERIC(5,2) DEFAULT 0, -- % of jobs requiring return visit
  
  -- Financials
  total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_jobs_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Emergency contact
  emergency_contact JSONB DEFAULT '{}' CHECK (jsonb_typeof(emergency_contact) = 'object'),
  -- Expected: { "name": "", "phone": "", "relationship": "" }
  
  -- Notes
  internal_notes TEXT,
  
  -- Onboarding tracking
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_checklist JSONB DEFAULT '{}' CHECK (jsonb_typeof(onboarding_checklist) = 'object'),
  -- Expected: { "profile_complete": false, "documents_uploaded": false, "training_complete": false, "test_job_complete": false }
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  tags TEXT[] DEFAULT '{}',
  
  -- Audit log
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  last_job_at TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  
  -- Audit
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- INSTALLER AVAILABILITY TABLE
-- ============================================

CREATE TABLE installer_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  installer_id UUID NOT NULL REFERENCES installers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Date/Time
  date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  
  -- Type
  type availability_type NOT NULL DEFAULT 'available',
  
  -- If busy, link to job
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(installer_id, date, start_time),
  CHECK (end_time > start_time)
);

-- ============================================
-- INSTALLER DOCUMENTS TABLE
-- ============================================

CREATE TABLE installer_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  installer_id UUID NOT NULL REFERENCES installers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Document info
  type TEXT NOT NULL, -- 'w9', 'insurance', 'workers_comp', 'id', 'certification', 'background_check', 'other'
  name TEXT NOT NULL,
  description TEXT,
  
  -- File
  file_url TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Expiration
  expires_at DATE,
  expiration_notified BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INSTALLER RATINGS TABLE
-- ============================================

CREATE TABLE installer_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  installer_id UUID NOT NULL REFERENCES installers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  homeowner_id UUID, -- Will reference homeowners table
  
  -- Rating
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Breakdown (optional)
  quality_rating INT CHECK (quality_rating >= 1 AND quality_rating <= 5),
  timeliness_rating INT CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  professionalism_rating INT CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  communication_rating INT CHECK (communication_rating >= 1 AND communication_rating <= 5),
  
  -- Feedback
  review_text TEXT,
  internal_notes TEXT, -- Admin-only notes
  
  -- Visibility
  is_public BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES: INSTALLERS
-- ============================================

CREATE INDEX idx_installers_tenant_id ON installers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_installers_user_id ON installers(user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX idx_installers_status ON installers(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_installers_tier ON installers(tenant_id, tier) WHERE deleted_at IS NULL;
CREATE INDEX idx_installers_active ON installers(tenant_id) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_installers_email ON installers(LOWER(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX idx_installers_phone ON installers(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_installers_rating ON installers(tenant_id, rating_average DESC) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_installers_created_at ON installers(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

-- GIN indexes
CREATE INDEX idx_installers_service_zips_gin ON installers USING GIN (service_area_zips array_ops);
CREATE INDEX idx_installers_skills_gin ON installers USING GIN (skills array_ops);
CREATE INDEX idx_installers_tags_gin ON installers USING GIN (tags array_ops);
CREATE INDEX idx_installers_address_gin ON installers USING GIN (address jsonb_path_ops);
CREATE INDEX idx_installers_metadata_gin ON installers USING GIN (metadata jsonb_path_ops);
CREATE INDEX idx_installers_pay_structure_gin ON installers USING GIN (pay_structure jsonb_path_ops);

-- Full text search
CREATE INDEX idx_installers_fts ON installers USING GIN (
  to_tsvector('english',
    COALESCE(first_name, '') || ' ' ||
    COALESCE(last_name, '') || ' ' ||
    COALESCE(email, '') || ' ' ||
    COALESCE(phone, '') || ' ' ||
    COALESCE(internal_notes, '')
  )
) WHERE deleted_at IS NULL;

-- ============================================
-- INDEXES: AVAILABILITY
-- ============================================

CREATE INDEX idx_installer_availability_installer ON installer_availability(installer_id);
CREATE INDEX idx_installer_availability_tenant ON installer_availability(tenant_id);
CREATE INDEX idx_installer_availability_date ON installer_availability(installer_id, date);
CREATE INDEX idx_installer_availability_lookup ON installer_availability(tenant_id, date, type) WHERE type = 'available';
CREATE INDEX idx_installer_availability_job ON installer_availability(job_id) WHERE job_id IS NOT NULL;

-- ============================================
-- INDEXES: DOCUMENTS
-- ============================================

CREATE INDEX idx_installer_docs_installer ON installer_documents(installer_id);
CREATE INDEX idx_installer_docs_tenant ON installer_documents(tenant_id);
CREATE INDEX idx_installer_docs_type ON installer_documents(installer_id, type);
CREATE INDEX idx_installer_docs_status ON installer_documents(installer_id, status);
CREATE INDEX idx_installer_docs_expiring ON installer_documents(expires_at) WHERE expires_at IS NOT NULL AND status = 'approved';

-- ============================================
-- INDEXES: RATINGS
-- ============================================

CREATE INDEX idx_installer_ratings_installer ON installer_ratings(installer_id);
CREATE INDEX idx_installer_ratings_tenant ON installer_ratings(tenant_id);
CREATE INDEX idx_installer_ratings_job ON installer_ratings(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_installer_ratings_public ON installer_ratings(installer_id, created_at DESC) WHERE is_public = true;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-generate installer_number
CREATE OR REPLACE FUNCTION generate_installer_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.installer_number IS NULL THEN
    NEW.installer_number := next_tenant_sequence(NEW.tenant_id, 'installer', 'VUL');
  END IF;
  
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER installer_number_trigger
  BEFORE INSERT ON installers
  FOR EACH ROW
  EXECUTE FUNCTION generate_installer_number();

-- Auto-update updated_at
CREATE TRIGGER installers_updated_at
  BEFORE UPDATE ON installers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER installer_availability_updated_at
  BEFORE UPDATE ON installer_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER installer_documents_updated_at
  BEFORE UPDATE ON installer_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Audit logging (reuses audit_entity from 005)
CREATE TRIGGER installers_audit
  BEFORE UPDATE ON installers
  FOR EACH ROW
  EXECUTE FUNCTION audit_entity();

-- Track status changes
CREATE OR REPLACE FUNCTION track_installer_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'active' AND OLD.status != 'active' THEN
      NEW.activated_at := COALESCE(NEW.activated_at, NOW());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER installers_status_change
  BEFORE UPDATE ON installers
  FOR EACH ROW
  EXECUTE FUNCTION track_installer_status_change();

-- Update installer stats when rating added
CREATE OR REPLACE FUNCTION update_installer_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_avg NUMERIC(3,2);
  v_count INT;
  v_installer_id UUID;
BEGIN
  v_installer_id := COALESCE(NEW.installer_id, OLD.installer_id);
  
  SELECT 
    AVG(rating)::NUMERIC(3,2),
    COUNT(*)
  INTO v_avg, v_count
  FROM installer_ratings
  WHERE installer_id = v_installer_id;
  
  UPDATE installers
  SET 
    rating_average = COALESCE(v_avg, 0),
    rating_count = COALESCE(v_count, 0)
  WHERE id = v_installer_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER installer_ratings_update_stats
  AFTER INSERT OR UPDATE OR DELETE ON installer_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_installer_rating_stats();

-- ============================================
-- ROW LEVEL SECURITY: INSTALLERS
-- ============================================

ALTER TABLE installers ENABLE ROW LEVEL SECURITY;
ALTER TABLE installers FORCE ROW LEVEL SECURITY;

CREATE POLICY installers_select ON installers
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
      -- Installers can see themselves
      OR user_id = (auth.jwt() ->> 'user_id')::UUID
    )
  );

CREATE POLICY installers_insert ON installers
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY installers_update ON installers
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
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

CREATE POLICY installers_delete ON installers
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: AVAILABILITY
-- ============================================

ALTER TABLE installer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE installer_availability FORCE ROW LEVEL SECURITY;

-- UPGRADED: Hide availability for soft-deleted installers
CREATE POLICY installer_availability_select ON installer_availability
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
      SELECT 1 FROM installers i
      WHERE i.id = installer_availability.installer_id
        AND i.deleted_at IS NOT NULL
    )
  );

-- UPGRADED: Validate installer belongs to same tenant
CREATE POLICY installer_availability_insert ON installer_availability
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM installers
      WHERE id = installer_id
        AND installers.tenant_id = installer_availability.tenant_id
        AND installers.deleted_at IS NULL
    )
  );

CREATE POLICY installer_availability_update ON installer_availability
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

CREATE POLICY installer_availability_delete ON installer_availability
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- ============================================
-- ROW LEVEL SECURITY: DOCUMENTS
-- ============================================

ALTER TABLE installer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE installer_documents FORCE ROW LEVEL SECURITY;

-- UPGRADED: Hide documents for soft-deleted installers
CREATE POLICY installer_documents_select ON installer_documents
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
      SELECT 1 FROM installers i
      WHERE i.id = installer_documents.installer_id
        AND i.deleted_at IS NOT NULL
    )
  );

-- UPGRADED: Validate installer belongs to same tenant
CREATE POLICY installer_documents_insert ON installer_documents
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM installers
      WHERE id = installer_id
        AND installers.tenant_id = installer_documents.tenant_id
        AND installers.deleted_at IS NULL
    )
  );

CREATE POLICY installer_documents_update ON installer_documents
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

CREATE POLICY installer_documents_delete ON installer_documents
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- ============================================
-- ROW LEVEL SECURITY: RATINGS
-- ============================================

ALTER TABLE installer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE installer_ratings FORCE ROW LEVEL SECURITY;

-- UPGRADED: Hide ratings for soft-deleted installers
CREATE POLICY installer_ratings_select ON installer_ratings
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
      SELECT 1 FROM installers i
      WHERE i.id = installer_ratings.installer_id
        AND i.deleted_at IS NOT NULL
    )
  );

-- UPGRADED: Validate installer belongs to same tenant
CREATE POLICY installer_ratings_insert ON installer_ratings
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM installers
      WHERE id = installer_id
        AND installers.tenant_id = installer_ratings.tenant_id
        AND installers.deleted_at IS NULL
    )
  );

-- Ratings cannot be updated or deleted (audit trail)
CREATE POLICY installer_ratings_update ON installer_ratings
  FOR UPDATE
  USING (false);

CREATE POLICY installer_ratings_delete ON installer_ratings
  FOR DELETE
  USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Find available installers for a job
CREATE OR REPLACE FUNCTION find_available_installers(
  p_date DATE,
  p_zip TEXT,
  p_skills installer_skill[] DEFAULT '{}',
  p_min_rating NUMERIC DEFAULT 0,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  installer_id UUID,
  installer_number TEXT,
  full_name TEXT,
  phone TEXT,
  rating_average NUMERIC,
  tier installer_tier,
  distance_miles NUMERIC
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
  
  RETURN QUERY
  SELECT 
    i.id AS installer_id,
    i.installer_number,
    i.full_name,
    i.phone,
    i.rating_average,
    i.tier,
    NULL::NUMERIC AS distance_miles -- TODO: Calculate from geo
  FROM installers i
  WHERE i.tenant_id = v_tenant_id
    AND i.deleted_at IS NULL
    AND i.status = 'active'
    AND i.rating_average >= p_min_rating
    AND (p_zip = ANY(i.service_area_zips) OR cardinality(i.service_area_zips) = 0)
    AND (cardinality(p_skills) = 0 OR i.skills @> p_skills)
    AND NOT EXISTS (
      SELECT 1 FROM installer_availability a
      WHERE a.installer_id = i.id
        AND a.date = p_date
        AND a.type IN ('busy', 'time_off', 'sick', 'blocked')
    )
  ORDER BY 
    i.tier DESC,
    i.rating_average DESC,
    i.jobs_completed DESC
  LIMIT p_limit;
END;
$$;

-- Set installer availability
CREATE OR REPLACE FUNCTION set_installer_availability(
  p_installer_id UUID,
  p_date DATE,
  p_type availability_type,
  p_start_time TIME DEFAULT '08:00',
  p_end_time TIME DEFAULT '17:00',
  p_job_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
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
  -- Get tenant from installer
  SELECT tenant_id INTO v_tenant_id
  FROM installers
  WHERE id = p_installer_id AND deleted_at IS NULL;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Installer not found';
  END IF;
  
  -- Upsert availability
  INSERT INTO installer_availability (
    installer_id,
    tenant_id,
    date,
    start_time,
    end_time,
    type,
    job_id,
    notes
  ) VALUES (
    p_installer_id,
    v_tenant_id,
    p_date,
    p_start_time,
    p_end_time,
    p_type,
    p_job_id,
    p_notes
  )
  ON CONFLICT (installer_id, date, start_time)
  DO UPDATE SET
    type = EXCLUDED.type,
    end_time = EXCLUDED.end_time,
    job_id = EXCLUDED.job_id,
    notes = EXCLUDED.notes,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Block installer availability when assigned to job
CREATE OR REPLACE FUNCTION block_installer_for_job()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When job gets scheduled and assigned, block installer
  IF NEW.installer_id IS NOT NULL 
     AND NEW.scheduled_date IS NOT NULL 
     AND (OLD.installer_id IS DISTINCT FROM NEW.installer_id 
          OR OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date) THEN
    
    PERFORM set_installer_availability(
      NEW.installer_id,
      NEW.scheduled_date,
      'busy'::availability_type,
      COALESCE(NEW.scheduled_time_start, '08:00'::TIME),
      COALESCE(NEW.scheduled_time_end, '17:00'::TIME),
      NEW.id,
      'Job ' || NEW.job_number
    );
    
    -- Update installer last_job_at
    UPDATE installers
    SET last_job_at = NOW()
    WHERE id = NEW.installer_id;
  END IF;
  
  -- Clear old availability if installer or date changed
  IF OLD.installer_id IS NOT NULL 
     AND (OLD.installer_id IS DISTINCT FROM NEW.installer_id 
          OR OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date) THEN
    DELETE FROM installer_availability
    WHERE job_id = NEW.id
      AND installer_id = OLD.installer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_block_installer
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION block_installer_for_job();

-- Update installer job stats when job completes
CREATE OR REPLACE FUNCTION update_installer_job_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.installer_id IS NOT NULL THEN
    UPDATE installers
    SET 
      jobs_completed = jobs_completed + 1,
      total_jobs_value = total_jobs_value + COALESCE(NEW.final_total, NEW.quoted_total, 0),
      last_job_at = NOW()
    WHERE id = NEW.installer_id;
  END IF;
  
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.installer_id IS NOT NULL THEN
    UPDATE installers
    SET jobs_cancelled = jobs_cancelled + 1
    WHERE id = NEW.installer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_update_installer_stats
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_installer_job_stats();

-- Soft delete installer
CREATE OR REPLACE FUNCTION soft_delete_installer(
  p_installer_id UUID,
  p_deleted_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE installers
  SET 
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    status = 'terminated'
  WHERE id = p_installer_id
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Add installer rating (with job validation)
CREATE OR REPLACE FUNCTION add_installer_rating(
  p_installer_id UUID,
  p_rating INT,
  p_job_id UUID DEFAULT NULL,
  p_review_text TEXT DEFAULT NULL,
  p_quality_rating INT DEFAULT NULL,
  p_timeliness_rating INT DEFAULT NULL,
  p_professionalism_rating INT DEFAULT NULL,
  p_communication_rating INT DEFAULT NULL
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
  -- Get tenant from installer
  SELECT tenant_id INTO v_tenant_id
  FROM installers
  WHERE id = p_installer_id AND deleted_at IS NULL;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Installer not found';
  END IF;
  
  -- If job_id provided, validate it
  IF p_job_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM jobs
      WHERE id = p_job_id
        AND installer_id = p_installer_id
        AND status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Job not found or not completed by this installer';
    END IF;
    
    -- Check if already rated
    IF EXISTS (
      SELECT 1 FROM installer_ratings
      WHERE job_id = p_job_id
    ) THEN
      RAISE EXCEPTION 'This job has already been rated';
    END IF;
  END IF;
  
  INSERT INTO installer_ratings (
    installer_id,
    tenant_id,
    job_id,
    rating,
    quality_rating,
    timeliness_rating,
    professionalism_rating,
    communication_rating,
    review_text
  ) VALUES (
    p_installer_id,
    v_tenant_id,
    p_job_id,
    p_rating,
    p_quality_rating,
    p_timeliness_rating,
    p_professionalism_rating,
    p_communication_rating,
    p_review_text
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Get installer dashboard stats
CREATE OR REPLACE FUNCTION get_installer_stats(
  p_installer_id UUID
)
RETURNS TABLE (
  jobs_completed INT,
  jobs_cancelled INT,
  jobs_pending BIGINT,
  rating_average NUMERIC,
  rating_count INT,
  total_earnings NUMERIC,
  pending_payout NUMERIC,
  this_month_jobs BIGINT,
  this_month_earnings NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.jobs_completed,
    i.jobs_cancelled,
    (SELECT COUNT(*) FROM jobs j WHERE j.installer_id = i.id AND j.status IN ('scheduled', 'in_progress'))::BIGINT AS jobs_pending,
    i.rating_average,
    i.rating_count,
    i.total_earnings,
    i.pending_payout,
    (SELECT COUNT(*) FROM jobs j WHERE j.installer_id = i.id AND j.status = 'completed' AND j.completed_at >= DATE_TRUNC('month', NOW()))::BIGINT AS this_month_jobs,
    (SELECT COALESCE(SUM(COALESCE(j.final_total, j.quoted_total)), 0) FROM jobs j WHERE j.installer_id = i.id AND j.status = 'completed' AND j.completed_at >= DATE_TRUNC('month', NOW()))::NUMERIC AS this_month_earnings
  FROM installers i
  WHERE i.id = p_installer_id
    AND i.deleted_at IS NULL;
END;
$$;
