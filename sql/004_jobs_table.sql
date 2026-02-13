-- ===========================================================
-- 004_JOBS_TABLE.SQL
-- Jobs/Orders + Job Events
-- Depends on:
--   000_common.sql (enums + functions)
--   001_leads_table.sql
--   002_call_events_table.sql
--   003_quotes_table.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE job_status AS ENUM (
  'pending',           -- Quote accepted, awaiting order
  'ordered',           -- Materials ordered from supplier
  'in_production',     -- Supplier manufacturing
  'shipped',           -- Materials shipped
  'delivered',         -- Materials at job site
  'scheduled',         -- Install date set
  'in_progress',       -- Installation underway
  'completed',         -- Job done
  'on_hold',           -- Paused (customer request, issue, etc.)
  'cancelled',         -- Job cancelled
  'issue'              -- Problem requiring attention
);

CREATE TYPE job_event_type AS ENUM (
  'status_change',
  'note',
  'photo_upload',
  'document_upload',
  'payment_received',
  'payment_refunded',
  'installer_assigned',
  'installer_changed',
  'scheduled',
  'rescheduled',
  'material_ordered',
  'material_shipped',
  'material_delivered',
  'issue_reported',
  'issue_resolved',
  'customer_contact',
  'internal_note',
  'system'
);

CREATE TYPE job_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- ============================================
-- JOBS TABLE
-- ============================================

CREATE TABLE jobs (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Human-readable ID
  job_number TEXT UNIQUE,
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Relationships
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  homeowner_id UUID, -- Will reference homeowners table when created
  installer_id UUID, -- Will reference installers table when created
  supplier_id UUID,  -- Will reference suppliers table when created
  
  -- Customer info (denormalized snapshot from quote)
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address JSONB DEFAULT '{}' CHECK (jsonb_typeof(customer_address) = 'object'),
  
  -- Job details
  status job_status NOT NULL DEFAULT 'pending',
  priority job_priority NOT NULL DEFAULT 'normal',
  title TEXT,
  description TEXT,
  
  -- Scheduling
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  estimated_duration_hours NUMERIC(4,1),
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  
  -- Pricing (copied from quote at creation)
  quoted_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_total NUMERIC(12,2), -- May differ from quoted if changes
  cost_of_goods NUMERIC(12,2) DEFAULT 0,
  labor_cost NUMERIC(12,2) DEFAULT 0,
  margin NUMERIC(12,2) GENERATED ALWAYS AS (
    COALESCE(final_total, quoted_total) - cost_of_goods - labor_cost
  ) STORED,
  
  -- Payment tracking
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(12,2) GENERATED ALWAYS AS (
    COALESCE(final_total, quoted_total) - amount_paid
  ) STORED,
  payment_status TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN amount_paid >= COALESCE(final_total, quoted_total) THEN 'paid'
      WHEN amount_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END
  ) STORED,
  
  -- Supplier/Qwikkit integration
  supplier_order_id TEXT,
  supplier_order_status TEXT,
  supplier_tracking_number TEXT,
  supplier_ship_date DATE,
  supplier_delivery_date DATE,
  supplier_order_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(supplier_order_data) = 'object'),
  
  -- Installer info (denormalized for quick access)
  installer_name TEXT,
  installer_phone TEXT,
  installer_payout NUMERIC(12,2),
  installer_payout_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid'
  
  -- Project details (from quote)
  project_details JSONB DEFAULT '{}' CHECK (jsonb_typeof(project_details) = 'object'),
  
  -- AR Fox
  ar_session_id UUID,
  
  -- Issue tracking
  has_issue BOOLEAN NOT NULL DEFAULT false,
  issue_description TEXT,
  issue_reported_at TIMESTAMPTZ,
  issue_resolved_at TIMESTAMPTZ,
  
  -- Completion
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  customer_rating INT CHECK (customer_rating >= 1 AND customer_rating <= 5),
  customer_feedback TEXT,
  
  -- Public access token (for homeowner portal)
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  
  -- Notes
  internal_notes TEXT,
  customer_notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  tags TEXT[] DEFAULT '{}',
  
  -- Audit log (AEON upgrade: full change history)
  audit_log JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  
  -- Audit
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- JOB EVENTS TABLE (Timeline/Audit)
-- ============================================

CREATE TABLE job_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Event details
  type job_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Change tracking
  previous_value JSONB,
  new_value JSONB,
  
  -- Attachments
  attachments JSONB DEFAULT '[]' CHECK (jsonb_typeof(attachments) = 'array'),
  -- Expected: [{ "type": "photo|document", "url": "", "name": "", "size": 0 }]
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Who performed it
  performed_by UUID,
  performed_by_name TEXT,
  performed_by_role TEXT, -- 'admin', 'agent', 'installer', 'customer', 'system'
  
  -- Visibility
  is_internal BOOLEAN NOT NULL DEFAULT false, -- Hide from customer portal if true
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- JOB LINE ITEMS (for tracking what was installed)
-- ============================================

CREATE TABLE job_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  quote_line_item_id UUID REFERENCES quote_line_items(id) ON DELETE SET NULL,
  
  -- Item details
  type line_item_type NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  
  -- Quantities
  quantity_ordered NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity_delivered NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity_installed NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Pricing
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'ordered', 'delivered', 'installed', 'issue'
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Jobs indexes
CREATE INDEX idx_jobs_tenant_id ON jobs(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_quote_id ON jobs(quote_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_lead_id ON jobs(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_homeowner_id ON jobs(tenant_id, homeowner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_installer_id ON jobs(tenant_id, installer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_status ON jobs(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_priority ON jobs(tenant_id, priority) WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_jobs_scheduled_date ON jobs(tenant_id, scheduled_date) WHERE deleted_at IS NULL AND scheduled_date IS NOT NULL;
CREATE INDEX idx_jobs_created_at ON jobs(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_public_token ON jobs(public_token) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_supplier_order ON jobs(supplier_order_id) WHERE supplier_order_id IS NOT NULL;
CREATE INDEX idx_jobs_has_issue ON jobs(tenant_id, has_issue) WHERE deleted_at IS NULL AND has_issue = true;
CREATE INDEX idx_jobs_payment_status ON jobs(tenant_id, (
  CASE 
    WHEN amount_paid >= COALESCE(final_total, quoted_total) THEN 'paid'
    WHEN amount_paid > 0 THEN 'partial'
    ELSE 'unpaid'
  END
)) WHERE deleted_at IS NULL;

-- GIN indexes
CREATE INDEX idx_jobs_customer_address_gin ON jobs USING GIN (customer_address jsonb_path_ops);
CREATE INDEX idx_jobs_project_details_gin ON jobs USING GIN (project_details jsonb_path_ops);
CREATE INDEX idx_jobs_supplier_order_data_gin ON jobs USING GIN (supplier_order_data jsonb_path_ops);
CREATE INDEX idx_jobs_metadata_gin ON jobs USING GIN (metadata jsonb_path_ops);
CREATE INDEX idx_jobs_tags_gin ON jobs USING GIN (tags array_ops);

-- Full text search
CREATE INDEX idx_jobs_fts ON jobs USING GIN (
  to_tsvector('english',
    COALESCE(job_number, '') || ' ' ||
    COALESCE(customer_name, '') || ' ' ||
    COALESCE(customer_email, '') || ' ' ||
    COALESCE(customer_phone, '') || ' ' ||
    COALESCE(title, '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE(installer_name, '')
  )
) WHERE deleted_at IS NULL;

-- Job events indexes
CREATE INDEX idx_job_events_job_id ON job_events(job_id);
CREATE INDEX idx_job_events_tenant_id ON job_events(tenant_id);
CREATE INDEX idx_job_events_type ON job_events(tenant_id, type);
CREATE INDEX idx_job_events_created_at ON job_events(job_id, created_at DESC);
CREATE INDEX idx_job_events_public ON job_events(job_id, created_at DESC) WHERE is_internal = false;
CREATE INDEX idx_job_events_metadata_gin ON job_events USING GIN (metadata jsonb_path_ops);
CREATE INDEX idx_job_events_attachments_gin ON job_events USING GIN (attachments jsonb_path_ops);

-- Job line items indexes
CREATE INDEX idx_job_line_items_job_id ON job_line_items(job_id);
CREATE INDEX idx_job_line_items_tenant_id ON job_line_items(tenant_id);
CREATE INDEX idx_job_line_items_status ON job_line_items(job_id, status);
CREATE INDEX idx_job_line_items_metadata_gin ON job_line_items USING GIN (metadata jsonb_path_ops);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-generate job_number and set created_by
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL THEN
    NEW.job_number := next_tenant_sequence(NEW.tenant_id, 'job', 'VUL');
  END IF;
  
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_number_trigger
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION generate_job_number();

-- Auto-update updated_at
CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER job_line_items_updated_at
  BEFORE UPDATE ON job_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- AEON Upgrade: Full audit logging on jobs
CREATE OR REPLACE FUNCTION audit_jobs()
RETURNS TRIGGER AS $$
DECLARE
  v_diff JSONB;
  v_key TEXT;
BEGIN
  -- Build diff of changed fields
  v_diff := '{}'::jsonb;
  
  FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW))
  LOOP
    IF to_jsonb(NEW) -> v_key IS DISTINCT FROM to_jsonb(OLD) -> v_key THEN
      -- Skip audit_log itself and updated_at to avoid recursion
      IF v_key NOT IN ('audit_log', 'updated_at') THEN
        v_diff := v_diff || jsonb_build_object(
          v_key, jsonb_build_object(
            'old', to_jsonb(OLD) -> v_key,
            'new', to_jsonb(NEW) -> v_key
          )
        );
      END IF;
    END IF;
  END LOOP;
  
  -- Only log if there are actual changes
  IF v_diff != '{}'::jsonb THEN
    NEW.audit_log := COALESCE(OLD.audit_log, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'changed_at', NOW(),
        'changed_by', COALESCE(NEW.updated_by::TEXT, auth.jwt() ->> 'user_id'),
        'diff', v_diff
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_audit
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION audit_jobs();

-- Track job status changes
CREATE OR REPLACE FUNCTION track_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Set completed_at when job completes
    IF NEW.status = 'completed' THEN
      NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    END IF;
    
    -- Set issue flags
    IF NEW.status = 'issue' AND OLD.status != 'issue' THEN
      NEW.has_issue := true;
      NEW.issue_reported_at := COALESCE(NEW.issue_reported_at, NOW());
    ELSIF OLD.status = 'issue' AND NEW.status != 'issue' THEN
      NEW.issue_resolved_at := NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_status_change
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION track_job_status_change();

-- Auto-log job status changes to events
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO job_events (
      job_id,
      tenant_id,
      type,
      title,
      previous_value,
      new_value,
      performed_by,
      performed_by_name,
      is_internal
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      'status_change',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NEW.updated_by,
      NULL,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_log_status_change
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_status_change();

-- Auto-log installer assignment changes
CREATE OR REPLACE FUNCTION log_job_installer_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.installer_id IS DISTINCT FROM NEW.installer_id THEN
    INSERT INTO job_events (
      job_id,
      tenant_id,
      type,
      title,
      previous_value,
      new_value,
      performed_by,
      is_internal
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      CASE WHEN OLD.installer_id IS NULL THEN 'installer_assigned' ELSE 'installer_changed' END,
      CASE 
        WHEN OLD.installer_id IS NULL THEN 'Installer assigned: ' || COALESCE(NEW.installer_name, 'Unknown')
        ELSE 'Installer changed to: ' || COALESCE(NEW.installer_name, 'Unknown')
      END,
      jsonb_build_object('installer_id', OLD.installer_id, 'installer_name', OLD.installer_name),
      jsonb_build_object('installer_id', NEW.installer_id, 'installer_name', NEW.installer_name),
      NEW.updated_by,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_log_installer_change
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_installer_change();

-- Auto-log scheduling changes
CREATE OR REPLACE FUNCTION log_job_schedule_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date THEN
    INSERT INTO job_events (
      job_id,
      tenant_id,
      type,
      title,
      previous_value,
      new_value,
      performed_by,
      is_internal
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      CASE WHEN OLD.scheduled_date IS NULL THEN 'scheduled' ELSE 'rescheduled' END,
      CASE 
        WHEN OLD.scheduled_date IS NULL THEN 'Installation scheduled for ' || NEW.scheduled_date
        ELSE 'Rescheduled from ' || OLD.scheduled_date || ' to ' || NEW.scheduled_date
      END,
      jsonb_build_object('scheduled_date', OLD.scheduled_date, 'scheduled_time_start', OLD.scheduled_time_start),
      jsonb_build_object('scheduled_date', NEW.scheduled_date, 'scheduled_time_start', NEW.scheduled_time_start),
      NEW.updated_by,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_log_schedule_change
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_schedule_change();

-- Log to lead activity when job status changes
CREATE OR REPLACE FUNCTION log_job_to_lead_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_activities (
      lead_id,
      tenant_id,
      type,
      title,
      metadata,
      performed_by
    ) VALUES (
      NEW.lead_id,
      NEW.tenant_id,
      'system',
      'Job ' || NEW.job_number || ' status: ' || NEW.status,
      jsonb_build_object(
        'job_id', NEW.id,
        'job_number', NEW.job_number,
        'status', NEW.status,
        'scheduled_date', NEW.scheduled_date
      ),
      NEW.updated_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_log_to_lead
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_to_lead_activity();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY jobs_select ON jobs
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND deleted_at IS NULL
  );

-- UPGRADED: Cross-tenant isolation for quote_id and lead_id
CREATE POLICY jobs_insert ON jobs
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND (
      quote_id IS NULL OR
      EXISTS (
        SELECT 1 FROM quotes
        WHERE id = quote_id
          AND quotes.tenant_id = jobs.tenant_id
      )
    )
    AND (
      lead_id IS NULL OR
      EXISTS (
        SELECT 1 FROM leads
        WHERE id = lead_id
          AND leads.tenant_id = jobs.tenant_id
      )
    )
  );

CREATE POLICY jobs_update ON jobs
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

CREATE POLICY jobs_delete ON jobs
  FOR DELETE
  USING (false);

-- Job events RLS
ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_events FORCE ROW LEVEL SECURITY;

-- UPGRADED: Soft-delete protection - hide events for deleted jobs
CREATE POLICY job_events_select ON job_events
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND NOT EXISTS (
      SELECT 1 FROM jobs j 
      WHERE j.id = job_events.job_id 
        AND j.deleted_at IS NOT NULL
    )
  );

-- UPGRADED: Ensure job belongs to same tenant
CREATE POLICY job_events_insert ON job_events
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE id = job_id
        AND jobs.tenant_id = job_events.tenant_id
    )
  );

-- No update/delete on job events (audit log)
CREATE POLICY job_events_update ON job_events
  FOR UPDATE
  USING (false);

CREATE POLICY job_events_delete ON job_events
  FOR DELETE
  USING (false);

-- Job line items RLS
ALTER TABLE job_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_line_items FORCE ROW LEVEL SECURITY;

-- UPGRADED: Soft-delete protection - hide line items for deleted jobs
CREATE POLICY job_line_items_select ON job_line_items
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND NOT EXISTS (
      SELECT 1 FROM jobs j 
      WHERE j.id = job_line_items.job_id 
        AND j.deleted_at IS NOT NULL
    )
  );

-- UPGRADED: Ensure job belongs to same tenant
CREATE POLICY job_line_items_insert ON job_line_items
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE id = job_id
        AND jobs.tenant_id = job_line_items.tenant_id
    )
  );

CREATE POLICY job_line_items_update ON job_line_items
  FOR UPDATE
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY job_line_items_delete ON job_line_items
  FOR DELETE
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- ============================================
-- PUBLIC JOB ACCESS (Homeowner Portal)
-- ============================================

CREATE OR REPLACE FUNCTION get_job_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  job_number TEXT,
  customer_name TEXT,
  status job_status,
  priority job_priority,
  title TEXT,
  description TEXT,
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  installer_name TEXT,
  quoted_total NUMERIC,
  amount_paid NUMERIC,
  amount_due NUMERIC,
  project_details JSONB,
  customer_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.job_number, j.customer_name, j.status, j.priority,
    j.title, j.description, j.scheduled_date, j.scheduled_time_start,
    j.scheduled_time_end, j.installer_name, j.quoted_total,
    j.amount_paid, j.amount_due, j.project_details, j.customer_notes,
    j.created_at, j.updated_at
  FROM jobs j
  WHERE j.public_token = p_token
    AND j.deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_job_events_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  type job_event_type,
  title TEXT,
  description TEXT,
  attachments JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id, e.type, e.title, e.description, e.attachments, e.created_at
  FROM job_events e
  INNER JOIN jobs j ON j.id = e.job_id
  WHERE j.public_token = p_token
    AND j.deleted_at IS NULL
    AND e.is_internal = false
  ORDER BY e.created_at DESC;
END;
$$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Create job from accepted quote
CREATE OR REPLACE FUNCTION create_job_from_quote(
  p_quote_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
  v_quote RECORD;
  v_current_tenant UUID;
BEGIN
  -- Get current tenant
  v_current_tenant := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  -- Get quote details
  SELECT * INTO v_quote
  FROM quotes
  WHERE id = p_quote_id
    AND deleted_at IS NULL
    AND status = 'accepted';
  
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found or not accepted';
  END IF;
  
  -- UPGRADED: Tenant guard - prevent cross-tenant job creation
  IF v_quote.tenant_id != v_current_tenant THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;
  
  -- Create job
  INSERT INTO jobs (
    tenant_id,
    quote_id,
    lead_id,
    homeowner_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    title,
    description,
    quoted_total,
    cost_of_goods,
    project_details,
    ar_session_id,
    created_by
  ) VALUES (
    v_quote.tenant_id,
    v_quote.id,
    v_quote.lead_id,
    v_quote.homeowner_id,
    v_quote.customer_name,
    v_quote.customer_email,
    v_quote.customer_phone,
    v_quote.customer_address,
    v_quote.title,
    v_quote.description,
    v_quote.total,
    v_quote.cost_of_goods,
    v_quote.project_details,
    v_quote.ar_session_id,
    COALESCE(p_created_by, v_quote.created_by)
  ) RETURNING id INTO v_job_id;
  
  -- Copy line items
  INSERT INTO job_line_items (
    job_id,
    tenant_id,
    quote_line_item_id,
    type,
    name,
    description,
    sku,
    quantity_ordered,
    unit_price,
    unit_cost,
    metadata
  )
  SELECT
    v_job_id,
    tenant_id,
    id,
    type,
    name,
    description,
    sku,
    quantity,
    unit_price,
    unit_cost,
    metadata
  FROM quote_line_items
  WHERE quote_id = p_quote_id
    AND is_included = true;
  
  -- Update lead status
  IF v_quote.lead_id IS NOT NULL THEN
    UPDATE leads
    SET status = 'won', updated_by = p_created_by
    WHERE id = v_quote.lead_id;
  END IF;
  
  RETURN v_job_id;
END;
$$;

-- Soft delete job
CREATE OR REPLACE FUNCTION soft_delete_job(
  p_job_id UUID,
  p_deleted_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE jobs
  SET 
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    updated_by = p_deleted_by
  WHERE id = p_job_id
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Add job event (helper for API)
CREATE OR REPLACE FUNCTION add_job_event(
  p_job_id UUID,
  p_type job_event_type,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_attachments JSONB DEFAULT '[]',
  p_metadata JSONB DEFAULT '{}',
  p_is_internal BOOLEAN DEFAULT false,
  p_performed_by UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get tenant from job
  SELECT tenant_id INTO v_tenant_id
  FROM jobs
  WHERE id = p_job_id AND deleted_at IS NULL;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  INSERT INTO job_events (
    job_id,
    tenant_id,
    type,
    title,
    description,
    attachments,
    metadata,
    is_internal,
    performed_by
  ) VALUES (
    p_job_id,
    v_tenant_id,
    p_type,
    p_title,
    p_description,
    p_attachments,
    p_metadata,
    p_is_internal,
    p_performed_by
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Get job dashboard stats
CREATE OR REPLACE FUNCTION get_job_stats(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_jobs BIGINT,
  pending_jobs BIGINT,
  scheduled_jobs BIGINT,
  in_progress_jobs BIGINT,
  completed_jobs BIGINT,
  jobs_with_issues BIGINT,
  total_revenue NUMERIC,
  total_margin NUMERIC,
  avg_job_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_jobs,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending_jobs,
    COUNT(*) FILTER (WHERE status = 'scheduled')::BIGINT AS scheduled_jobs,
    COUNT(*) FILTER (WHERE status = 'in_progress')::BIGINT AS in_progress_jobs,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS completed_jobs,
    COUNT(*) FILTER (WHERE has_issue = true)::BIGINT AS jobs_with_issues,
    COALESCE(SUM(COALESCE(final_total, quoted_total)) FILTER (WHERE status = 'completed'), 0)::NUMERIC AS total_revenue,
    COALESCE(SUM(margin) FILTER (WHERE status = 'completed'), 0)::NUMERIC AS total_margin,
    COALESCE(AVG(COALESCE(final_total, quoted_total)) FILTER (WHERE status = 'completed'), 0)::NUMERIC AS avg_job_value
  FROM jobs
  WHERE deleted_at IS NULL
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
END;
$$;
