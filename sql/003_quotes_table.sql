-- ===========================================================
-- 003_QUOTES_TABLE.SQL (UPGRADED)
-- Depends on:
--   000_common.sql  (enums + functions)
--   001_leads_table.sql
--   002_call_events_table.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE quote_status AS ENUM (
  'draft',
  'pending_review',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'revised',
  'cancelled'
);

CREATE TYPE line_item_type AS ENUM (
  'cabinet_door',
  'drawer_front',
  'hardware',
  'countertop',
  'labor',
  'material',
  'addon',
  'discount',
  'fee',
  'other'
);

CREATE TYPE measurement_unit AS ENUM (
  'each',
  'sqft',
  'linear_ft',
  'hour',
  'flat'
);

-- ============================================
-- QUOTES TABLE
-- ============================================

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number TEXT UNIQUE,
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  tenant_id UUID NOT NULL,

  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  homeowner_id UUID,

  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address JSONB DEFAULT '{}' CHECK (jsonb_typeof(customer_address) = 'object'),

  status quote_status NOT NULL DEFAULT 'draft',
  title TEXT,
  description TEXT,

  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  cost_of_goods NUMERIC(12,2) DEFAULT 0,
  estimated_labor_cost NUMERIC(12,2) DEFAULT 0,

  margin NUMERIC(12,2) GENERATED ALWAYS AS (total - cost_of_goods - estimated_labor_cost) STORED,
  margin_percent NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total > 0 THEN ((total - cost_of_goods - estimated_labor_cost) / total * 100) ELSE 0 END
  ) STORED,

  valid_until DATE,
  payment_terms TEXT,
  terms_and_conditions TEXT,

  ar_session_id UUID,
  ar_preview_url TEXT,

  project_details JSONB DEFAULT '{}' CHECK (jsonb_typeof(project_details) = 'object'),

  assigned_to UUID,
  sales_notes TEXT,

  sent_at TIMESTAMPTZ,
  sent_via TEXT,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  customer_signature_url TEXT,
  signed_at TIMESTAMPTZ,

  version INT NOT NULL DEFAULT 1,
  parent_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- QUOTE LINE ITEMS TABLE
-- ============================================

CREATE TABLE quote_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,

  type line_item_type NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,

  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit measurement_unit NOT NULL DEFAULT 'each',
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

  unit_cost NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,

  sort_order INT NOT NULL DEFAULT 0,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  is_included BOOLEAN NOT NULL DEFAULT true,

  product_id UUID,

  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_quotes_tenant_id ON quotes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_lead_id ON quotes(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_homeowner_id ON quotes(tenant_id, homeowner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_status ON quotes(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_assigned_to ON quotes(tenant_id, assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_created_at ON quotes(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_valid_until ON quotes(tenant_id, valid_until) WHERE deleted_at IS NULL AND status = 'sent';
CREATE INDEX idx_quotes_public_token ON quotes(public_token) WHERE deleted_at IS NULL;

CREATE INDEX idx_quotes_customer_address_gin ON quotes USING GIN (customer_address jsonb_path_ops);
CREATE INDEX idx_quotes_project_details_gin ON quotes USING GIN (project_details jsonb_path_ops);
CREATE INDEX idx_quotes_metadata_gin ON quotes USING GIN (metadata jsonb_path_ops);

CREATE INDEX idx_quotes_fts ON quotes USING GIN (
  to_tsvector('english',
    COALESCE(quote_number, '') || ' ' ||
    COALESCE(customer_name, '') || ' ' ||
    COALESCE(customer_email, '') || ' ' ||
    COALESCE(title, '') || ' ' ||
    COALESCE(description, '')
  )
) WHERE deleted_at IS NULL;

CREATE INDEX idx_quote_line_items_quote_id ON quote_line_items(quote_id);
CREATE INDEX idx_quote_line_items_tenant_id ON quote_line_items(tenant_id);
CREATE INDEX idx_quote_line_items_type ON quote_line_items(tenant_id, type);
CREATE INDEX idx_quote_line_items_sort ON quote_line_items(quote_id, sort_order);
CREATE INDEX idx_quote_line_items_metadata_gin ON quote_line_items USING GIN (metadata jsonb_path_ops);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := next_tenant_sequence(NEW.tenant_id, 'quote', 'VUL');
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_number_trigger
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION generate_quote_number();

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER quote_line_items_updated_at
  BEFORE UPDATE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION recalculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_cost NUMERIC(12,2);
BEGIN
  SELECT 
    COALESCE(SUM(total_price), 0),
    COALESCE(SUM(total_cost), 0)
  INTO v_subtotal, v_cost
  FROM quote_line_items
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    AND is_included = true;

  UPDATE quotes
  SET 
    subtotal = v_subtotal,
    cost_of_goods = v_cost,
    tax_amount = v_subtotal * tax_rate,
    total = v_subtotal - discount_amount + (v_subtotal * tax_rate),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_line_items_recalc
  AFTER INSERT OR UPDATE OR DELETE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quote_totals();

CREATE OR REPLACE FUNCTION track_quote_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'sent' THEN NEW.sent_at := COALESCE(NEW.sent_at, NOW());
      WHEN 'viewed' THEN NEW.viewed_at := COALESCE(NEW.viewed_at, NOW());
      WHEN 'accepted' THEN NEW.accepted_at := COALESCE(NEW.accepted_at, NOW());
      WHEN 'rejected' THEN NEW.rejected_at := COALESCE(NEW.rejected_at, NOW());
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_status_change
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION track_quote_status_change();

-- ============================================
-- RLS
-- ============================================

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;

CREATE POLICY quotes_select ON quotes
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND deleted_at IS NULL
  );

-- UPGRADED: tenant isolation for leads + homeowners
CREATE POLICY quotes_insert ON quotes
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND (
      lead_id IS NULL OR
      EXISTS (
        SELECT 1 FROM leads 
        WHERE id = lead_id 
          AND leads.tenant_id = quotes.tenant_id
      )
    )
  );

CREATE POLICY quotes_update ON quotes
  FOR UPDATE
  USING (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND deleted_at IS NULL
  )
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  );

CREATE POLICY quotes_delete ON quotes FOR DELETE USING (false);

-- RLS FOR LINE ITEMS
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_line_items_select ON quote_line_items
  FOR SELECT
  USING (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  );

-- UPGRADED: tenant strictness + ensure quote belongs to tenant
CREATE POLICY quote_line_items_insert ON quote_line_items
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (
      SELECT 1 FROM quotes 
      WHERE id = quote_id 
        AND quotes.tenant_id = quote_line_items.tenant_id
    )
  );

CREATE POLICY quote_line_items_update ON quote_line_items
  FOR UPDATE
  USING (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  )
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  );

CREATE POLICY quote_line_items_delete ON quote_line_items
  FOR DELETE
  USING (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  );

-- ============================================
-- PUBLIC QUOTE ACCESS (with SECURITY DEFINER hardening)
-- ============================================

CREATE OR REPLACE FUNCTION get_quote_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  quote_number TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address JSONB,
  status quote_status,
  title TEXT,
  description TEXT,
  subtotal NUMERIC,
  discount_amount NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC,
  valid_until DATE,
  terms_and_conditions TEXT,
  ar_preview_url TEXT,
  project_details JSONB,
  version INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quotes
  SET viewed_at = COALESCE(viewed_at, NOW()),
      status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
  WHERE public_token = p_token
    AND deleted_at IS NULL;

  RETURN QUERY
  SELECT 
    q.id, q.quote_number, q.customer_name, q.customer_email, q.customer_phone,
    q.customer_address, q.status, q.title, q.description,
    q.subtotal, q.discount_amount, q.tax_amount, q.total,
    q.valid_until, q.terms_and_conditions, q.ar_preview_url,
    q.project_details, q.version, q.created_at
  FROM quotes q
  WHERE q.public_token = p_token
    AND q.deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_quote_line_items_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  type line_item_type,
  name TEXT,
  description TEXT,
  quantity NUMERIC,
  unit measurement_unit,
  unit_price NUMERIC,
  total_price NUMERIC,
  is_optional BOOLEAN,
  is_included BOOLEAN,
  sort_order INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    li.id, li.type, li.name, li.description,
    li.quantity, li.unit, li.unit_price, li.total_price,
    li.is_optional, li.is_included, li.sort_order
  FROM quote_line_items li
  INNER JOIN quotes q ON q.id = li.quote_id
  WHERE q.public_token = p_token
    AND q.deleted_at IS NULL
  ORDER BY li.sort_order, li.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION accept_quote(
  p_token TEXT,
  p_signature_url TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id UUID;
BEGIN
  SELECT id INTO v_quote_id
  FROM quotes
  WHERE public_token = p_token
    AND deleted_at IS NULL
    AND status IN ('sent', 'viewed');

  IF v_quote_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE quotes
  SET 
    status = 'accepted',
    customer_signature_url = p_signature_url,
    signed_at = CASE WHEN p_signature_url IS NOT NULL THEN NOW() ELSE NULL END
  WHERE id = v_quote_id;

  RETURN TRUE;
END;
$$;

-- ============================================
-- HELPERS
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_quote(
  p_quote_id UUID,
  p_deleted_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quotes
  SET 
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    updated_by = p_deleted_by
  WHERE id = p_quote_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;
