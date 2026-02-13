-- ============================================
-- VULPINE CRM: LEADS TABLE (v2)
-- Full RLS, Soft Delete, Auditing, Tenant Sequences
-- ============================================
-- MIGRATION ORDER: 001
-- Depends on: 000 (enums + extensions)
-- Must run FIRST among entity tables
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE lead_status AS ENUM (
  'new',
  'contacted',
  'qualified',
  'quoted',
  'won',
  'lost'
);

CREATE TYPE lead_source AS ENUM (
  'facebook',
  'instagram',
  'google',
  'tiktok',
  'phone',
  'visualizer',
  'referral',
  'website',
  'other'
);

CREATE TYPE activity_type AS ENUM (
  'call_outbound',
  'call_inbound',
  'call_missed',
  'email_sent',
  'email_received',
  'sms_sent',
  'sms_received',
  'note',
  'status_change',
  'quote_created',
  'quote_sent',
  'quote_accepted',
  'quote_rejected',
  'assignment_change',
  'visualizer_session',
  'system'
);

-- ============================================
-- TENANT SEQUENCES TABLE
-- For human-readable IDs: VUL-L-000001, ABC-L-000001
-- ============================================

CREATE TABLE tenant_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'lead', 'quote', 'job', 'invoice'
  prefix TEXT NOT NULL, -- 'VUL', 'ABC', etc.
  current_value BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, entity_type)
);

-- Index for fast sequence lookups under heavy load
CREATE INDEX idx_tenant_seq_lookup ON tenant_sequences(tenant_id, entity_type);

-- Function to get next sequence number for a tenant
CREATE OR REPLACE FUNCTION next_tenant_sequence(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_prefix TEXT DEFAULT 'VUL'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_val BIGINT;
  v_prefix TEXT;
BEGIN
  -- Insert or update sequence, return new value
  INSERT INTO tenant_sequences (tenant_id, entity_type, prefix, current_value)
  VALUES (p_tenant_id, p_entity_type, p_prefix, 1)
  ON CONFLICT (tenant_id, entity_type)
  DO UPDATE SET 
    current_value = tenant_sequences.current_value + 1,
    updated_at = NOW()
  RETURNING current_value, prefix INTO v_next_val, v_prefix;
  
  -- Format: VUL-L-000001
  RETURN v_prefix || '-' || UPPER(LEFT(p_entity_type, 1)) || '-' || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;

-- ============================================
-- LEADS TABLE
-- ============================================

CREATE TABLE leads (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Human-readable ID (set by trigger)
  lead_number TEXT UNIQUE,
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Contact info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Address (JSONB with GIN index)
  address JSONB DEFAULT '{}' CHECK (jsonb_typeof(address) = 'object'),
  -- Expected: { "street": "", "city": "", "state": "", "zip": "", "lat": null, "lng": null }
  
  -- Lead tracking
  source lead_source NOT NULL DEFAULT 'other',
  status lead_status NOT NULL DEFAULT 'new',
  assigned_to UUID,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  raw_data JSONB DEFAULT '{}',
  
  -- Visualizer link
  visualizer_session_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  qualified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  
  -- Audit fields
  created_by UUID,
  updated_by UUID
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookups
CREATE INDEX idx_leads_tenant_id ON leads(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_status ON leads(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_source ON leads(tenant_id, source) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_assigned_to ON leads(tenant_id, assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_created_at ON leads(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

-- Contact lookups
CREATE INDEX idx_leads_phone ON leads(phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;
CREATE INDEX idx_leads_email ON leads(LOWER(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;

-- GIN indexes for JSONB
CREATE INDEX idx_leads_address_gin ON leads USING GIN (address jsonb_path_ops);
CREATE INDEX idx_leads_raw_data_gin ON leads USING GIN (raw_data jsonb_path_ops);
CREATE INDEX idx_leads_tags_gin ON leads USING GIN (tags array_ops);

-- Full text search
CREATE INDEX idx_leads_fts ON leads USING GIN (
  to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(phone, '') || ' ' ||
    COALESCE(notes, '')
  )
) WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-generate lead_number and set created_by
CREATE OR REPLACE FUNCTION generate_lead_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-generate lead_number
  IF NEW.lead_number IS NULL THEN
    NEW.lead_number := next_tenant_sequence(NEW.tenant_id, 'lead', 'VUL');
  END IF;
  
  -- Auto-set created_by from JWT if not provided
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_number_trigger
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION generate_lead_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-set timestamp on status change
CREATE OR REPLACE FUNCTION track_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'contacted' THEN NEW.contacted_at := COALESCE(NEW.contacted_at, NOW());
      WHEN 'qualified' THEN NEW.qualified_at := COALESCE(NEW.qualified_at, NOW());
      WHEN 'won' THEN NEW.converted_at := COALESCE(NEW.converted_at, NOW());
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_status_change
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION track_lead_status_change();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner too
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

-- Policy: Select only own tenant's leads (non-deleted)
CREATE POLICY leads_select ON leads
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND deleted_at IS NULL
  );

-- Policy: Insert only to own tenant
CREATE POLICY leads_insert ON leads
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- Policy: Update only own tenant's leads
CREATE POLICY leads_update ON leads
  FOR UPDATE
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- Policy: Soft delete only (no hard delete via RLS)
CREATE POLICY leads_delete ON leads
  FOR DELETE
  USING (false); -- Prevent hard deletes, use soft delete instead

-- ============================================
-- LEAD ACTIVITIES (AUDIT LOG)
-- ============================================

CREATE TABLE lead_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  
  -- Activity details
  type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Change tracking (for status changes, etc.)
  previous_value JSONB,
  new_value JSONB,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Who performed it
  performed_by UUID,
  performed_by_name TEXT, -- Denormalized for audit trail
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign key with cascade
  CONSTRAINT fk_lead_activities_lead
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_tenant_id ON lead_activities(tenant_id);
CREATE INDEX idx_lead_activities_type ON lead_activities(tenant_id, type);
CREATE INDEX idx_lead_activities_created_at ON lead_activities(lead_id, created_at DESC);
CREATE INDEX idx_lead_activities_metadata_gin ON lead_activities USING GIN (metadata jsonb_path_ops);

-- RLS for activities
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities FORCE ROW LEVEL SECURITY;

CREATE POLICY lead_activities_select ON lead_activities
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY lead_activities_insert ON lead_activities
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- No update/delete on audit log
CREATE POLICY lead_activities_update ON lead_activities
  FOR UPDATE
  USING (false);

CREATE POLICY lead_activities_delete ON lead_activities
  FOR DELETE
  USING (false);

-- ============================================
-- AUTO-LOG STATUS CHANGES
-- ============================================

CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_activities (
      lead_id,
      tenant_id,
      type,
      title,
      previous_value,
      new_value,
      performed_by
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      'status_change',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_log_status_change
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_status_change();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Soft delete function
CREATE OR REPLACE FUNCTION soft_delete_lead(
  p_lead_id UUID,
  p_deleted_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE leads
  SET 
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    updated_by = p_deleted_by
  WHERE id = p_lead_id
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Restore soft-deleted lead
CREATE OR REPLACE FUNCTION restore_lead(
  p_lead_id UUID,
  p_restored_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE leads
  SET 
    deleted_at = NULL,
    deleted_by = NULL,
    updated_by = p_restored_by,
    updated_at = NOW()
  WHERE id = p_lead_id
    AND deleted_at IS NOT NULL;
  
  RETURN FOUND;
END;
$$;

-- Search leads function
CREATE OR REPLACE FUNCTION search_leads(
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
) RETURNS SETOF leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM leads
  WHERE 
    deleted_at IS NULL
    AND (
      to_tsvector('english', 
        COALESCE(name, '') || ' ' || 
        COALESCE(email, '') || ' ' || 
        COALESCE(phone, '') || ' ' ||
        COALESCE(notes, '')
      ) @@ plainto_tsquery('english', p_query)
      OR name ILIKE '%' || p_query || '%'
      OR email ILIKE '%' || p_query || '%'
      OR phone ILIKE '%' || p_query || '%'
    )
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
