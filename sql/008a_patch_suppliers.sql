-- ===========================================================
-- 008a_PATCH_SUPPLIERS.SQL
-- Security + Tenant Isolation Upgrades for 008_suppliers.sql
-- Run AFTER 008_suppliers.sql
-- ===========================================================

-- ============================================
-- 1. CHILD RLS: Hide rows for soft-deleted orders
-- ============================================

-- supplier_order_items_select (UPGRADED)
DROP POLICY IF EXISTS supplier_order_items_select ON supplier_order_items;

CREATE POLICY supplier_order_items_select ON supplier_order_items
  FOR SELECT
  USING (
    (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
    AND EXISTS (
      SELECT 1 FROM supplier_orders so
      WHERE so.id = supplier_order_items.order_id
        AND so.deleted_at IS NULL
    )
  );

-- supplier_order_events_select (UPGRADED)
DROP POLICY IF EXISTS supplier_order_events_select ON supplier_order_events;

CREATE POLICY supplier_order_events_select ON supplier_order_events
  FOR SELECT
  USING (
    (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
    AND EXISTS (
      SELECT 1 FROM supplier_orders so
      WHERE so.id = supplier_order_events.order_id
        AND so.deleted_at IS NULL
    )
  );

-- supplier_order_events_insert (UPGRADED with order validation)
DROP POLICY IF EXISTS supplier_order_events_insert ON supplier_order_events;

CREATE POLICY supplier_order_events_insert ON supplier_order_events
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM supplier_orders so
      WHERE so.id = supplier_order_events.order_id
        AND so.tenant_id = supplier_order_events.tenant_id
        AND so.deleted_at IS NULL
    )
  );

-- ============================================
-- 2. HARDENING: soft_delete_supplier_order
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_supplier_order(
  p_order_id UUID
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
  
  UPDATE supplier_orders
  SET 
    deleted_at = NOW(),
    deleted_by = NULLIF(auth.jwt() ->> 'user_id', '')::UUID,
    status = 'cancelled'
  WHERE id = p_order_id
    AND tenant_id = v_tenant_id
    AND deleted_at IS NULL
    AND status IN ('draft', 'pending_approval');
  
  RETURN FOUND;
END;
$$;

-- ============================================
-- 3. TENANT GUARDS: Cross-tenant leak prevention
-- ============================================

-- 3.1 create_supplier_order_from_job (UPGRADED)
CREATE OR REPLACE FUNCTION create_supplier_order_from_job(
  p_job_id UUID,
  p_supplier_id UUID,
  p_auto_generated BOOLEAN DEFAULT false
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id UUID;
  v_tenant_id UUID;
  v_job RECORD;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

  -- Get job
  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id
    AND deleted_at IS NULL;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Tenant enforcement (unless superadmin / system context)
  IF v_tenant_id IS NOT NULL
     AND (auth.jwt() ->> 'role') != 'superadmin'
     AND v_job.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized to create order for this job';
  END IF;

  -- Use job's tenant for the order
  v_tenant_id := v_job.tenant_id;

  -- Verify supplier is enabled for tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_suppliers
    WHERE tenant_id = v_tenant_id
      AND supplier_id = p_supplier_id
      AND enabled = true
  ) THEN
    RAISE EXCEPTION 'Supplier not enabled for this tenant';
  END IF;

  -- Create order
  INSERT INTO supplier_orders (
    tenant_id,
    supplier_id,
    job_id,
    status,
    ship_to_address,
    auto_generated,
    created_by
  ) VALUES (
    v_tenant_id,
    p_supplier_id,
    p_job_id,
    'draft',
    v_job.service_address,
    p_auto_generated,
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID
  ) RETURNING id INTO v_order_id;

  -- Log event
  INSERT INTO supplier_order_events (
    order_id,
    tenant_id,
    event_type,
    description,
    performed_by,
    performed_by_system
  ) VALUES (
    v_order_id,
    v_tenant_id,
    'created',
    CASE WHEN p_auto_generated 
      THEN 'Order auto-generated from job ' || v_job.job_number
      ELSE 'Order created from job ' || v_job.job_number
    END,
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID,
    p_auto_generated
  );

  RETURN v_order_id;
END;
$$;

-- 3.2 add_supplier_order_item (UPGRADED)
CREATE OR REPLACE FUNCTION add_supplier_order_item(
  p_order_id UUID,
  p_product_id UUID,
  p_quantity INT,
  p_custom_width NUMERIC DEFAULT NULL,
  p_custom_height NUMERIC DEFAULT NULL,
  p_custom_notes TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id UUID;
  v_order RECORD;
  v_product RECORD;
  v_tenant_cost NUMERIC;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

  -- Get order
  SELECT * INTO v_order
  FROM supplier_orders
  WHERE id = p_order_id
    AND deleted_at IS NULL;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Tenant enforcement
  IF v_tenant_id IS NOT NULL
     AND (auth.jwt() ->> 'role') != 'superadmin'
     AND v_order.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized to modify this order';
  END IF;

  IF v_order.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Cannot modify order in status: %', v_order.status;
  END IF;

  -- Get product
  SELECT * INTO v_product
  FROM supplier_products
  WHERE id = p_product_id
    AND deleted_at IS NULL;

  IF v_product IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Get tenant pricing
  SELECT 
    COALESCE(tpp.unit_cost, v_product.unit_price * (1 - ts.discount_percent / 100))
  INTO v_tenant_cost
  FROM tenant_suppliers ts
  LEFT JOIN tenant_product_pricing tpp
    ON tpp.product_id = p_product_id
   AND tpp.tenant_id = v_order.tenant_id
  WHERE ts.tenant_id = v_order.tenant_id
    AND ts.supplier_id = v_product.supplier_id;

  -- Insert item
  INSERT INTO supplier_order_items (
    order_id,
    product_id,
    tenant_id,
    sku,
    name,
    description,
    category,
    specifications,
    custom_width,
    custom_height,
    custom_notes,
    quantity,
    unit_cost,
    unit
  ) VALUES (
    p_order_id,
    p_product_id,
    v_order.tenant_id,
    v_product.sku,
    v_product.name,
    v_product.description,
    v_product.category,
    v_product.specifications,
    p_custom_width,
    p_custom_height,
    p_custom_notes,
    p_quantity,
    v_tenant_cost,
    v_product.unit
  ) RETURNING id INTO v_item_id;

  RETURN v_item_id;
END;
$$;

-- 3.3 submit_supplier_order (UPGRADED)
CREATE OR REPLACE FUNCTION submit_supplier_order(
  p_order_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_tenant_supplier RECORD;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

  -- Get order
  SELECT * INTO v_order
  FROM supplier_orders
  WHERE id = p_order_id
    AND deleted_at IS NULL;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Tenant enforcement
  IF v_tenant_id IS NOT NULL
     AND (auth.jwt() ->> 'role') != 'superadmin'
     AND v_order.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized to submit this order';
  END IF;

  IF v_order.status NOT IN ('draft', 'approved') THEN
    RAISE EXCEPTION 'Order cannot be submitted in status: %', v_order.status;
  END IF;

  -- Check if items exist
  IF NOT EXISTS (SELECT 1 FROM supplier_order_items WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Order has no items';
  END IF;

  -- Get tenant supplier config
  SELECT * INTO v_tenant_supplier
  FROM tenant_suppliers
  WHERE tenant_id = v_order.tenant_id
    AND supplier_id = v_order.supplier_id;

  -- Check if approval required
  IF v_order.status = 'draft' 
     AND v_tenant_supplier.auto_order_approval_required 
     AND v_order.total > COALESCE(v_tenant_supplier.auto_order_max_amount, 0) THEN
    UPDATE supplier_orders
    SET status = 'pending_approval'
    WHERE id = p_order_id;
    
    RETURN FALSE; -- Needs approval
  END IF;

  -- Submit order
  UPDATE supplier_orders
  SET 
    status = 'submitted',
    submitted_at = NOW()
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

-- 3.4 approve_supplier_order (UPGRADED)
CREATE OR REPLACE FUNCTION approve_supplier_order(
  p_order_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

  SELECT * INTO v_order
  FROM supplier_orders
  WHERE id = p_order_id
    AND deleted_at IS NULL;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Tenant enforcement
  IF v_tenant_id IS NOT NULL
     AND (auth.jwt() ->> 'role') != 'superadmin'
     AND v_order.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized to approve this order';
  END IF;

  IF v_order.status != 'pending_approval' THEN
    RAISE EXCEPTION 'Order is not pending approval';
  END IF;

  UPDATE supplier_orders
  SET 
    status = 'approved',
    approved_by = NULLIF(auth.jwt() ->> 'user_id', '')::UUID,
    approved_at = NOW()
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

-- ============================================
-- 4. AEON HELPER: Tenant-scoped by default
-- ============================================

CREATE OR REPLACE FUNCTION find_jobs_needing_supplier_orders(
  p_threshold_days INT DEFAULT 7
)
RETURNS TABLE (
  job_id UUID,
  job_number TEXT,
  tenant_id UUID,
  scheduled_date DATE,
  days_until_job INT,
  has_pending_order BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  v_role := auth.jwt() ->> 'role';

  RETURN QUERY
  SELECT 
    j.id,
    j.job_number,
    j.tenant_id,
    j.scheduled_date,
    (j.scheduled_date - CURRENT_DATE)::INT AS days_until_job,
    EXISTS (
      SELECT 1 FROM supplier_orders so
      WHERE so.job_id = j.id
        AND so.status NOT IN ('cancelled', 'completed')
        AND so.deleted_at IS NULL
    ) AS has_pending_order
  FROM jobs j
  JOIN tenant_suppliers ts
    ON ts.tenant_id = j.tenant_id
   AND ts.auto_order_enabled = true
  WHERE j.deleted_at IS NULL
    AND j.status IN ('pending', 'ordered', 'scheduled')
    AND j.scheduled_date IS NOT NULL
    AND j.scheduled_date - CURRENT_DATE <= p_threshold_days
    AND j.scheduled_date >= CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM supplier_orders so
      WHERE so.job_id = j.id
        AND so.status NOT IN ('cancelled', 'completed')
        AND so.deleted_at IS NULL
    )
    AND (
      v_tenant_id IS NULL
      OR v_role = 'superadmin'
      OR j.tenant_id = v_tenant_id
    )
  ORDER BY j.scheduled_date;
END;
$$;

-- ============================================
-- 5. PERFORMANCE GUARD: search_supplier_products
-- ============================================

CREATE OR REPLACE FUNCTION search_supplier_products(
  p_query TEXT,
  p_supplier_id UUID DEFAULT NULL,
  p_category product_category DEFAULT NULL,
  p_door_style TEXT DEFAULT NULL,
  p_door_color TEXT DEFAULT NULL,
  p_in_stock_only BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS SETOF supplier_products
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Guard: prevent full table scan on empty params
  IF p_query IS NULL
     AND p_supplier_id IS NULL
     AND p_category IS NULL
     AND p_door_style IS NULL
     AND p_door_color IS NULL
     AND p_in_stock_only = false THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM supplier_products
  WHERE deleted_at IS NULL
    AND status = 'active'
    AND (p_supplier_id IS NULL OR supplier_id = p_supplier_id)
    AND (p_category IS NULL OR category = p_category)
    AND (p_door_style IS NULL OR door_style ILIKE '%' || p_door_style || '%')
    AND (p_door_color IS NULL OR door_color ILIKE '%' || p_door_color || '%')
    AND (NOT p_in_stock_only OR in_stock = true)
    AND (
      p_query IS NULL OR
      to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' ||
                              COALESCE(door_style, '') || ' ' ||
                              COALESCE(door_color, ''))
        @@ plainto_tsquery('english', p_query)
      OR sku ILIKE '%' || p_query || '%'
      OR name ILIKE '%' || p_query || '%'
    )
  ORDER BY name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
