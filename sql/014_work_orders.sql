-- ===========================================================
-- 014_WORK_ORDERS.SQL
-- Installer Workflow: Work Orders, Tasks, Materials, Time, Photos, Signatures
-- Depends on: 000_common.sql, 004_jobs_table.sql, 005_tenants_users.sql, 006_installers.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE work_order_status AS ENUM (
  'draft',
  'pending',
  'assigned',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
  'requires_revisit'
);

CREATE TYPE work_order_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'blocked'
);

CREATE TYPE time_entry_type AS ENUM (
  'work',
  'travel',
  'break',
  'waiting',
  'setup',
  'cleanup'
);

CREATE TYPE photo_type AS ENUM (
  'before',
  'during',
  'after',
  'issue',
  'material',
  'signature',
  'other'
);

CREATE TYPE signature_type AS ENUM (
  'work_start',
  'work_complete',
  'customer_approval',
  'change_order',
  'material_delivery'
);

-- ============================================
-- WORK_ORDERS TABLE
-- ============================================

CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Relationships
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  installer_id UUID REFERENCES installers(id) ON DELETE SET NULL,
  secondary_installer_id UUID REFERENCES installers(id) ON DELETE SET NULL,
  
  -- Work order details
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  
  -- Status
  status work_order_status NOT NULL DEFAULT 'draft',
  priority work_order_priority NOT NULL DEFAULT 'normal',
  
  -- Scheduling
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  estimated_duration_minutes INT,
  
  -- Actual timing
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  actual_duration_minutes INT,
  
  -- Location (can override job address)
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  access_instructions TEXT,
  gate_code TEXT,
  
  -- Customer contact
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_notes TEXT,
  
  -- Completion
  completion_notes TEXT,
  customer_rating INT CHECK (customer_rating >= 1 AND customer_rating <= 5),
  customer_feedback TEXT,
  
  -- Issues
  has_issues BOOLEAN DEFAULT false,
  issue_description TEXT,
  requires_follow_up BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  
  -- Financials
  labor_cost NUMERIC(12, 2) DEFAULT 0,
  material_cost NUMERIC(12, 2) DEFAULT 0,
  additional_charges NUMERIC(12, 2) DEFAULT 0,
  total_cost NUMERIC(12, 2) GENERATED ALWAYS AS (labor_cost + material_cost + additional_charges) STORED,
  
  -- Audit
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- WORK_ORDER_TASKS TABLE
-- ============================================

CREATE TABLE work_order_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  
  -- Ordering
  sort_order INT NOT NULL DEFAULT 0,
  
  -- Status
  status task_status NOT NULL DEFAULT 'pending',
  
  -- Timing
  estimated_minutes INT,
  actual_minutes INT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Assignment
  assigned_to UUID REFERENCES installers(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES installers(id) ON DELETE SET NULL,
  
  -- Completion
  completion_notes TEXT,
  
  -- Dependencies
  depends_on_task_id UUID REFERENCES work_order_tasks(id) ON DELETE SET NULL,
  
  -- Checklist items
  checklist JSONB DEFAULT '[]' CHECK (jsonb_typeof(checklist) = 'array'),
  -- Array of { item, completed, completed_at, completed_by }
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- WORK_ORDER_MATERIALS TABLE
-- ============================================

CREATE TABLE work_order_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Material details
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  
  -- Quantities
  quantity_planned NUMERIC(10, 2) NOT NULL DEFAULT 1,
  quantity_used NUMERIC(10, 2) DEFAULT 0,
  unit TEXT DEFAULT 'each',
  
  -- Pricing
  unit_cost NUMERIC(12, 2) DEFAULT 0,
  total_cost NUMERIC(12, 2) GENERATED ALWAYS AS (quantity_used * unit_cost) STORED,
  
  -- Source
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  from_inventory BOOLEAN DEFAULT false,
  
  -- Status
  is_received BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ,
  received_by UUID,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- WORK_ORDER_TIME_ENTRIES TABLE
-- ============================================

CREATE TABLE work_order_time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Who
  installer_id UUID NOT NULL REFERENCES installers(id) ON DELETE CASCADE,
  
  -- Type
  entry_type time_entry_type NOT NULL DEFAULT 'work',
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INT,
  
  -- Location (for travel tracking)
  start_latitude NUMERIC(10, 7),
  start_longitude NUMERIC(10, 7),
  end_latitude NUMERIC(10, 7),
  end_longitude NUMERIC(10, 7),
  distance_miles NUMERIC(8, 2),
  
  -- Billing
  is_billable BOOLEAN DEFAULT true,
  hourly_rate NUMERIC(10, 2),
  total_amount NUMERIC(12, 2),
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- WORK_ORDER_PHOTOS TABLE
-- ============================================

CREATE TABLE work_order_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  task_id UUID REFERENCES work_order_tasks(id) ON DELETE SET NULL,
  
  -- Photo details
  photo_type photo_type NOT NULL DEFAULT 'other',
  
  -- File reference
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  file_url TEXT,
  thumbnail_url TEXT,
  
  -- Metadata
  caption TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  taken_by UUID REFERENCES installers(id) ON DELETE SET NULL,
  
  -- Location
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  
  -- AI analysis
  ai_tags TEXT[] DEFAULT '{}',
  ai_description TEXT,
  
  -- Ordering
  sort_order INT DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- WORK_ORDER_SIGNATURES TABLE
-- ============================================

CREATE TABLE work_order_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Signature details
  signature_type signature_type NOT NULL,
  
  -- Signer info
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_phone TEXT,
  signer_role TEXT, -- 'customer', 'installer', 'supervisor'
  
  -- Signature data
  signature_data TEXT NOT NULL, -- Base64 encoded signature image
  signature_hash TEXT, -- For verification
  
  -- File reference (if stored as file)
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  
  -- Location
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  ip_address INET,
  
  -- Device info
  device_info JSONB DEFAULT '{}' CHECK (jsonb_typeof(device_info) = 'object'),
  
  -- Legal
  agreement_text TEXT,
  agreed_to_terms BOOLEAN DEFAULT true,
  
  -- Timestamps
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES
-- ============================================

-- work_orders
CREATE INDEX idx_work_orders_tenant ON work_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_job ON work_orders(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_installer ON work_orders(installer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_status ON work_orders(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_scheduled ON work_orders(tenant_id, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_created ON work_orders(tenant_id, created_at DESC);

-- work_order_tasks
CREATE INDEX idx_work_order_tasks_work_order ON work_order_tasks(work_order_id);
CREATE INDEX idx_work_order_tasks_status ON work_order_tasks(work_order_id, status);
CREATE INDEX idx_work_order_tasks_assigned ON work_order_tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- work_order_materials
CREATE INDEX idx_work_order_materials_work_order ON work_order_materials(work_order_id);
CREATE INDEX idx_work_order_materials_supplier ON work_order_materials(supplier_id) WHERE supplier_id IS NOT NULL;

-- work_order_time_entries
CREATE INDEX idx_work_order_time_entries_work_order ON work_order_time_entries(work_order_id);
CREATE INDEX idx_work_order_time_entries_installer ON work_order_time_entries(installer_id);
CREATE INDEX idx_work_order_time_entries_date ON work_order_time_entries(tenant_id, start_time);

-- work_order_photos
CREATE INDEX idx_work_order_photos_work_order ON work_order_photos(work_order_id);
CREATE INDEX idx_work_order_photos_type ON work_order_photos(work_order_id, photo_type);
CREATE INDEX idx_work_order_photos_tags ON work_order_photos USING GIN (ai_tags array_ops);

-- work_order_signatures
CREATE INDEX idx_work_order_signatures_work_order ON work_order_signatures(work_order_id);
CREATE INDEX idx_work_order_signatures_type ON work_order_signatures(work_order_id, signature_type);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER work_order_tasks_updated_at BEFORE UPDATE ON work_order_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER work_order_materials_updated_at BEFORE UPDATE ON work_order_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER work_order_time_entries_updated_at BEFORE UPDATE ON work_order_time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate work order number
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.work_order_number := 'WO-' || next_tenant_sequence(NEW.tenant_id, 'work_order');
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_orders_number BEFORE INSERT ON work_orders FOR EACH ROW EXECUTE FUNCTION generate_work_order_number();

-- Calculate time entry duration
CREATE OR REPLACE FUNCTION calculate_time_entry_duration()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    IF NEW.hourly_rate IS NOT NULL THEN
      NEW.total_amount := (NEW.duration_minutes / 60.0) * NEW.hourly_rate;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_time_entries_duration BEFORE INSERT OR UPDATE ON work_order_time_entries FOR EACH ROW EXECUTE FUNCTION calculate_time_entry_duration();

-- Update work order costs when materials change
CREATE OR REPLACE FUNCTION update_work_order_material_cost()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE work_orders
  SET material_cost = (
    SELECT COALESCE(SUM(quantity_used * unit_cost), 0)
    FROM work_order_materials
    WHERE work_order_id = COALESCE(NEW.work_order_id, OLD.work_order_id)
  )
  WHERE id = COALESCE(NEW.work_order_id, OLD.work_order_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_materials_cost AFTER INSERT OR UPDATE OR DELETE ON work_order_materials FOR EACH ROW EXECUTE FUNCTION update_work_order_material_cost();

-- Update work order labor cost when time entries change
CREATE OR REPLACE FUNCTION update_work_order_labor_cost()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE work_orders
  SET labor_cost = (
    SELECT COALESCE(SUM(total_amount), 0)
    FROM work_order_time_entries
    WHERE work_order_id = COALESCE(NEW.work_order_id, OLD.work_order_id)
      AND is_billable = true
  ),
  actual_duration_minutes = (
    SELECT COALESCE(SUM(duration_minutes), 0)
    FROM work_order_time_entries
    WHERE work_order_id = COALESCE(NEW.work_order_id, OLD.work_order_id)
      AND entry_type = 'work'
  )
  WHERE id = COALESCE(NEW.work_order_id, OLD.work_order_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_time_entries_cost AFTER INSERT OR UPDATE OR DELETE ON work_order_time_entries FOR EACH ROW EXECUTE FUNCTION update_work_order_labor_cost();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- work_orders
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY work_orders_select ON work_orders FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY work_orders_insert ON work_orders FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND tenant_id = work_orders.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY work_orders_update ON work_orders FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY work_orders_delete ON work_orders FOR DELETE USING (false);

-- work_order_tasks
ALTER TABLE work_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY work_order_tasks_select ON work_order_tasks FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_tasks_insert ON work_order_tasks FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND tenant_id = work_order_tasks.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY work_order_tasks_update ON work_order_tasks FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_tasks_delete ON work_order_tasks FOR DELETE USING (false);

-- work_order_materials
ALTER TABLE work_order_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_materials FORCE ROW LEVEL SECURITY;

CREATE POLICY work_order_materials_select ON work_order_materials FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_materials_insert ON work_order_materials FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND tenant_id = work_order_materials.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY work_order_materials_update ON work_order_materials FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_materials_delete ON work_order_materials FOR DELETE USING (false);

-- work_order_time_entries
ALTER TABLE work_order_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_time_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY work_order_time_entries_select ON work_order_time_entries FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_time_entries_insert ON work_order_time_entries FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND tenant_id = work_order_time_entries.tenant_id AND deleted_at IS NULL)
    AND EXISTS (SELECT 1 FROM installers WHERE id = installer_id AND tenant_id = work_order_time_entries.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY work_order_time_entries_update ON work_order_time_entries FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_time_entries_delete ON work_order_time_entries FOR DELETE USING (false);

-- work_order_photos
ALTER TABLE work_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_photos FORCE ROW LEVEL SECURITY;

CREATE POLICY work_order_photos_select ON work_order_photos FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_photos_insert ON work_order_photos FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND tenant_id = work_order_photos.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY work_order_photos_update ON work_order_photos FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_photos_delete ON work_order_photos FOR DELETE USING (false);

-- work_order_signatures
ALTER TABLE work_order_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_signatures FORCE ROW LEVEL SECURITY;

CREATE POLICY work_order_signatures_select ON work_order_signatures FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY work_order_signatures_insert ON work_order_signatures FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND tenant_id = work_order_signatures.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY work_order_signatures_update ON work_order_signatures FOR UPDATE USING (false);
CREATE POLICY work_order_signatures_delete ON work_order_signatures FOR DELETE USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Create work order from job
CREATE OR REPLACE FUNCTION create_work_order_from_job(
  p_job_id UUID,
  p_installer_id UUID DEFAULT NULL,
  p_scheduled_date DATE DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_job RECORD;
  v_work_order_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND tenant_id = v_tenant_id AND deleted_at IS NULL;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  INSERT INTO work_orders (
    tenant_id, job_id, installer_id, title, description,
    scheduled_date, address_line1, address_line2, city, state, zip,
    customer_name, customer_phone, customer_email, created_by
  )
  SELECT
    v_tenant_id, p_job_id, p_installer_id, 
    'Installation for ' || v_job.job_number,
    v_job.notes,
    COALESCE(p_scheduled_date, v_job.scheduled_date),
    v_job.address_line1, v_job.address_line2, v_job.city, v_job.state, v_job.zip,
    h.first_name || ' ' || h.last_name,
    h.phone,
    h.email,
    (auth.jwt() ->> 'user_id')::UUID
  FROM homeowners h
  WHERE h.id = v_job.homeowner_id
  RETURNING id INTO v_work_order_id;
  
  RETURN v_work_order_id;
END;
$$;

-- Clock in/out for installer
CREATE OR REPLACE FUNCTION clock_in_work_order(
  p_work_order_id UUID,
  p_entry_type time_entry_type DEFAULT 'work',
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_installer_id UUID;
  v_entry_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  SELECT id INTO v_installer_id FROM installers WHERE user_id = (auth.jwt() ->> 'user_id')::UUID AND tenant_id = v_tenant_id AND deleted_at IS NULL;
  IF v_installer_id IS NULL THEN
    RAISE EXCEPTION 'Installer not found';
  END IF;
  
  INSERT INTO work_order_time_entries (tenant_id, work_order_id, installer_id, entry_type, start_time, start_latitude, start_longitude)
  VALUES (v_tenant_id, p_work_order_id, v_installer_id, p_entry_type, NOW(), p_latitude, p_longitude)
  RETURNING id INTO v_entry_id;
  
  IF p_entry_type = 'work' THEN
    UPDATE work_orders SET status = 'in_progress', actual_start_at = COALESCE(actual_start_at, NOW()) WHERE id = p_work_order_id;
  END IF;
  
  RETURN v_entry_id;
END;
$$;

-- Clock out
CREATE OR REPLACE FUNCTION clock_out_work_order(
  p_entry_id UUID,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE work_order_time_entries
  SET end_time = NOW(), end_latitude = p_latitude, end_longitude = p_longitude, notes = p_notes
  WHERE id = p_entry_id;
  RETURN TRUE;
END;
$$;

-- Complete work order
CREATE OR REPLACE FUNCTION complete_work_order(
  p_work_order_id UUID,
  p_completion_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  UPDATE work_orders
  SET status = 'completed', actual_end_at = NOW(), completion_notes = p_completion_notes, updated_by = (auth.jwt() ->> 'user_id')::UUID
  WHERE id = p_work_order_id AND tenant_id = v_tenant_id AND deleted_at IS NULL;
  
  UPDATE work_order_time_entries
  SET end_time = NOW()
  WHERE work_order_id = p_work_order_id AND end_time IS NULL;
  
  RETURN TRUE;
END;
$$;
