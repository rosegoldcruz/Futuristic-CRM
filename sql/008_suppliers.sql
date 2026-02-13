-- ===========================================================
-- 008_SUPPLIERS.SQL
-- Supplier Management + Qwikkit Integration
-- Product Catalog, Orders, Shipments, Pricing
-- Depends on:
--   000_common.sql (assumed)
--   005_tenants_users.sql
--   004_jobs_table.sql
--   003_quotes_table.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE supplier_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'inactive'
);

CREATE TYPE supplier_type AS ENUM (
  'manufacturer',
  'distributor',
  'wholesaler',
  'drop_shipper'
);

CREATE TYPE product_category AS ENUM (
  -- Doors & Fronts
  'cabinet_door',
  'drawer_front',
  'false_drawer_front',
  'hamper_front',
  'lazy_susan_door',
  'decorative_panel',
  'quarter_panel',
  
  -- Molding
  'crown_molding',
  'crown_shaker_molding',
  'inside_corner_molding',
  'outside_corner_molding',
  'scribe_molding',
  'shoe_molding',
  'batten_molding',
  'toe_kick',
  
  -- Hardware
  'pull',
  'knob',
  'hinge',
  'hinge_plate',
  'locator',
  'soft_close',
  
  -- Finishing
  'paint',
  'caulk',
  'touch_up_marker',
  'peel_stick_film',
  
  -- Accessories
  'screw',
  'bumper',
  'tape',
  'dowel',
  'bracket',
  'sample',
  'kit',
  'brochure',
  'tool'
);

CREATE TYPE door_style AS ENUM (
  'shaker',
  'slab',
  'slide',
  'fusion_shaker',
  'fusion_slab',
  'steps_shaker',
  'steps_slab'
);

CREATE TYPE door_color AS ENUM (
  -- Standard colors
  'graphite',
  'storm',
  'mist',
  'espresso_walnut',
  'sable_oak',
  'nimbus_oak',
  'flour',
  'slate',
  'latte_walnut',
  'urban_teak',
  'platinum_teak',
  'mocha_teak',
  'snow_gloss',
  'wheat_oak',
  'paint_ready'
);

CREATE TYPE hardware_finish AS ENUM (
  'satin_nickel',
  'chrome',
  'matte_black',
  'rose_gold',
  'dark_bronze'
);

CREATE TYPE hardware_style AS ENUM (
  'bar',
  'artisan',
  'cottage',
  'arch',
  'loft',
  'square',
  'tapered_arch',
  'round',
  't_knob'
);

CREATE TYPE order_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'submitted',
  'confirmed',
  'in_production',
  'ready_to_ship',
  'shipped',
  'in_transit',
  'delivered',
  'completed',
  'cancelled',
  'on_hold',
  'back_ordered'
);

CREATE TYPE shipment_status AS ENUM (
  'pending',
  'label_created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'returned'
);

CREATE TYPE shipment_carrier AS ENUM (
  'fedex',
  'ups',
  'usps',
  'freight',
  'local_delivery',
  'will_call',
  'other'
);

-- ============================================
-- SUPPLIERS TABLE
-- ============================================

CREATE TABLE suppliers (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant isolation (NULL = platform-level supplier available to all)
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identifiers
  supplier_code TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  
  -- Type & Status
  supplier_type supplier_type NOT NULL DEFAULT 'manufacturer',
  status supplier_status NOT NULL DEFAULT 'pending',
  
  -- Contact
  website TEXT,
  phone TEXT,
  email TEXT,
  support_email TEXT,
  support_phone TEXT,
  
  -- Primary contact
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  
  -- Warehouse/Ship-from address
  warehouse_address_line1 TEXT,
  warehouse_address_line2 TEXT,
  warehouse_city TEXT,
  warehouse_state TEXT,
  warehouse_postal_code TEXT,
  warehouse_country TEXT DEFAULT 'US',
  
  -- Business details
  tax_id TEXT,
  duns_number TEXT,
  
  -- Capabilities
  lead_time_days INT DEFAULT 7, -- Standard production time
  rush_available BOOLEAN DEFAULT false,
  rush_lead_time_days INT,
  rush_fee_percent NUMERIC(5,2),
  minimum_order_amount NUMERIC(10,2) DEFAULT 0,
  free_shipping_threshold NUMERIC(10,2),
  
  -- API Integration
  api_enabled BOOLEAN DEFAULT false,
  api_base_url TEXT,
  api_key_encrypted TEXT, -- Stored encrypted
  api_version TEXT,
  webhook_url TEXT,
  webhook_secret_encrypted TEXT,
  
  -- Catalog sync
  catalog_sync_enabled BOOLEAN DEFAULT false,
  catalog_last_synced_at TIMESTAMPTZ,
  catalog_sync_frequency_hours INT DEFAULT 24,
  
  -- Terms
  payment_terms TEXT, -- 'NET30', 'COD', etc.
  credit_limit NUMERIC(12,2),
  discount_percent NUMERIC(5,2) DEFAULT 0,
  
  -- Notes
  internal_notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  
  -- Constraints
  CONSTRAINT uq_supplier_code UNIQUE (supplier_code),
  CONSTRAINT chk_lead_time CHECK (lead_time_days >= 0),
  CONSTRAINT chk_rush_lead_time CHECK (rush_lead_time_days IS NULL OR rush_lead_time_days >= 0)
) WITH (fillfactor = 90);

-- ============================================
-- SUPPLIER PRODUCTS TABLE
-- Normalized product catalog from suppliers
-- ============================================

CREATE TABLE supplier_products (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Supplier reference
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  -- SKU & Identification
  sku TEXT NOT NULL,
  supplier_sku TEXT, -- Original SKU from supplier
  upc TEXT,
  
  -- Naming
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  
  -- Categorization
  category product_category NOT NULL,
  subcategory TEXT,
  
  -- Door/Panel specific
  door_style door_style,
  door_color door_color,
  
  -- Hardware specific
  hardware_style hardware_style,
  hardware_finish hardware_finish,
  hardware_size TEXT, -- '4-1/2"', '6"', '15/16" Knob', etc.
  hardware_size_mm INT, -- Normalized to mm for sorting
  
  -- Dimensions (for doors/panels/molding)
  width_inches NUMERIC(6,2),
  height_inches NUMERIC(6,2),
  depth_inches NUMERIC(6,2),
  length_inches NUMERIC(6,2), -- For molding
  thickness_inches NUMERIC(4,3),
  
  -- Custom sizing
  is_custom_size BOOLEAN DEFAULT false,
  min_width_inches NUMERIC(6,2),
  max_width_inches NUMERIC(6,2),
  min_height_inches NUMERIC(6,2),
  max_height_inches NUMERIC(6,2),
  size_increment_inches NUMERIC(4,3) DEFAULT 0.0625, -- 1/16"
  
  -- Pricing
  unit_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2), -- Our cost
  msrp NUMERIC(10,2),
  price_per TEXT DEFAULT 'each', -- 'each', 'sqft', 'linear_ft', 'bag', 'box'
  
  -- Volume pricing tiers
  volume_pricing JSONB DEFAULT '[]' CHECK (jsonb_typeof(volume_pricing) = 'array'),
  -- Format: [{"min_qty": 10, "price": 5.99}, {"min_qty": 50, "price": 4.99}]
  
  -- Inventory
  in_stock BOOLEAN DEFAULT true,
  stock_quantity INT,
  reorder_point INT,
  backorder_allowed BOOLEAN DEFAULT true,
  discontinued BOOLEAN DEFAULT false,
  
  -- Lead time override
  lead_time_days INT, -- Override supplier default
  
  -- Packaging
  pack_size INT DEFAULT 1,
  weight_lbs NUMERIC(8,2),
  
  -- Images
  image_url TEXT,
  thumbnail_url TEXT,
  images JSONB DEFAULT '[]' CHECK (jsonb_typeof(images) = 'array'),
  
  -- Compatibility / Related
  compatible_with JSONB DEFAULT '[]' CHECK (jsonb_typeof(compatible_with) = 'array'),
  -- Format: [{"sku": "HINGE-001", "type": "required"}, {"sku": "PULL-BAR-6", "type": "optional"}]
  
  -- Attributes (flexible)
  attributes JSONB DEFAULT '{}' CHECK (jsonb_typeof(attributes) = 'object'),
  -- Examples: {"material": "DuraBuild", "heat_resistant": true, "warranty_years": 5}
  
  -- Search optimization
  search_keywords TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT uq_supplier_product_sku UNIQUE (supplier_id, sku),
  CONSTRAINT chk_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_dimensions CHECK (
    (width_inches IS NULL OR width_inches > 0) AND
    (height_inches IS NULL OR height_inches > 0) AND
    (length_inches IS NULL OR length_inches > 0)
  )
) WITH (fillfactor = 90);

-- ============================================
-- SUPPLIER ORDERS TABLE
-- Orders placed with suppliers
-- ============================================

CREATE TABLE supplier_orders (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Human-readable order number
  order_number TEXT UNIQUE,
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Supplier
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  
  -- Link to our entities
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  
  -- Supplier's reference
  supplier_order_id TEXT, -- PO number from supplier
  supplier_confirmation TEXT,
  
  -- Status
  status order_status NOT NULL DEFAULT 'draft',
  
  -- Customer info (for drop ship)
  ship_to_name TEXT,
  ship_to_company TEXT,
  ship_to_address_line1 TEXT,
  ship_to_address_line2 TEXT,
  ship_to_city TEXT,
  ship_to_state TEXT,
  ship_to_postal_code TEXT,
  ship_to_country TEXT DEFAULT 'US',
  ship_to_phone TEXT,
  ship_to_email TEXT,
  
  -- Shipping preferences
  shipping_method TEXT,
  shipping_instructions TEXT,
  signature_required BOOLEAN DEFAULT false,
  
  -- Project details (for supplier reference)
  project_name TEXT,
  project_notes TEXT,
  
  -- Dual color option
  is_dual_color BOOLEAN DEFAULT false,
  upper_color door_color,
  lower_color door_color,
  
  -- Dates
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  production_started_at TIMESTAMPTZ,
  estimated_ship_date DATE,
  actual_ship_date DATE,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Rush order
  is_rush BOOLEAN DEFAULT false,
  rush_reason TEXT,
  
  -- Financials
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  rush_fee NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Payment
  payment_terms TEXT,
  payment_due_date DATE,
  payment_status TEXT DEFAULT 'unpaid', -- unpaid, partial, paid
  amount_paid NUMERIC(12,2) DEFAULT 0,
  
  -- Internal
  internal_notes TEXT,
  supplier_notes TEXT, -- Notes to supplier
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- SUPPLIER ORDER ITEMS TABLE
-- Line items for supplier orders
-- ============================================

CREATE TABLE supplier_order_items (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Order reference
  order_id UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  
  -- Product reference
  product_id UUID REFERENCES supplier_products(id) ON DELETE SET NULL,
  
  -- Line number for ordering
  line_number INT NOT NULL,
  
  -- Product details (denormalized for history)
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Category
  category product_category NOT NULL,
  
  -- Door/Panel specifics
  door_style door_style,
  door_color door_color,
  
  -- Hardware specifics
  hardware_style hardware_style,
  hardware_finish hardware_finish,
  hardware_size TEXT,
  
  -- Custom dimensions
  width_inches NUMERIC(6,2),
  height_inches NUMERIC(6,2),
  length_inches NUMERIC(6,2),
  
  -- Hinge placement
  hinge_side TEXT, -- 'left', 'right', 'none'
  hinge_count INT,
  
  -- Quantity & Pricing
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, in_production, shipped, received, issue
  
  -- Issue tracking
  has_issue BOOLEAN DEFAULT false,
  issue_description TEXT,
  issue_resolution TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_order_line UNIQUE (order_id, line_number),
  CONSTRAINT chk_quantity CHECK (quantity > 0),
  CONSTRAINT chk_unit_price CHECK (unit_price >= 0)
) WITH (fillfactor = 90);

-- ============================================
-- SUPPLIER SHIPMENTS TABLE
-- Shipment tracking for orders
-- ============================================

CREATE TABLE supplier_shipments (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Order reference
  order_id UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  
  -- Shipment identifiers
  shipment_number TEXT,
  
  -- Carrier & Tracking
  carrier shipment_carrier NOT NULL DEFAULT 'fedex',
  carrier_name TEXT, -- For 'other' carrier
  tracking_number TEXT,
  tracking_url TEXT,
  
  -- Status
  status shipment_status NOT NULL DEFAULT 'pending',
  
  -- Dates
  shipped_at TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Package details
  package_count INT DEFAULT 1,
  total_weight_lbs NUMERIC(8,2),
  
  -- Delivery confirmation
  delivery_signature TEXT,
  delivery_photo_url TEXT,
  
  -- Issues
  has_exception BOOLEAN DEFAULT false,
  exception_reason TEXT,
  exception_resolved_at TIMESTAMPTZ,
  
  -- Tracking history (from carrier webhooks)
  tracking_history JSONB DEFAULT '[]' CHECK (jsonb_typeof(tracking_history) = 'array'),
  -- Format: [{"timestamp": "...", "status": "...", "location": "...", "description": "..."}]
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- SUPPLIER SHIPMENT ITEMS TABLE
-- Which items are in which shipment
-- ============================================

CREATE TABLE supplier_shipment_items (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- References
  shipment_id UUID NOT NULL REFERENCES supplier_shipments(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES supplier_order_items(id) ON DELETE CASCADE,
  
  -- Quantity in this shipment (for partial shipments)
  quantity INT NOT NULL,
  
  -- Receipt tracking
  received_at TIMESTAMPTZ,
  received_by UUID,
  received_quantity INT,
  
  -- Condition on receipt
  condition_ok BOOLEAN DEFAULT true,
  damage_notes TEXT,
  damage_photo_urls JSONB DEFAULT '[]' CHECK (jsonb_typeof(damage_photo_urls) = 'array'),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_shipment_item UNIQUE (shipment_id, order_item_id),
  CONSTRAINT chk_ship_quantity CHECK (quantity > 0)
);

-- ============================================
-- SUPPLIER PRICE LISTS TABLE
-- Contract/negotiated pricing by tenant
-- ============================================

CREATE TABLE supplier_price_lists (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant + Supplier
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  -- Price list details
  name TEXT NOT NULL,
  description TEXT,
  
  -- Validity
  effective_date DATE NOT NULL,
  expiration_date DATE,
  
  -- Discounts
  base_discount_percent NUMERIC(5,2) DEFAULT 0,
  
  -- Category-specific discounts
  category_discounts JSONB DEFAULT '{}' CHECK (jsonb_typeof(category_discounts) = 'object'),
  -- Format: {"cabinet_door": 15, "hardware": 10}
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_tenant_supplier_pricelist UNIQUE (tenant_id, supplier_id, name)
);

-- ============================================
-- SUPPLIER PRICE OVERRIDES TABLE
-- Individual product price overrides
-- ============================================

CREATE TABLE supplier_price_overrides (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Price list reference
  price_list_id UUID NOT NULL REFERENCES supplier_price_lists(id) ON DELETE CASCADE,
  
  -- Product reference
  product_id UUID NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  
  -- Override pricing
  override_price NUMERIC(10,2),
  override_cost NUMERIC(10,2),
  discount_percent NUMERIC(5,2),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_pricelist_product UNIQUE (price_list_id, product_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Suppliers
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_status ON suppliers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_code ON suppliers(supplier_code) WHERE deleted_at IS NULL;

-- Supplier Products
CREATE INDEX idx_supplier_products_supplier ON supplier_products(supplier_id) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_supplier_products_category ON supplier_products(category) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_supplier_products_sku ON supplier_products(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_products_door_style ON supplier_products(door_style) WHERE deleted_at IS NULL AND door_style IS NOT NULL;
CREATE INDEX idx_supplier_products_door_color ON supplier_products(door_color) WHERE deleted_at IS NULL AND door_color IS NOT NULL;
CREATE INDEX idx_supplier_products_hardware ON supplier_products(hardware_style, hardware_finish) WHERE deleted_at IS NULL AND hardware_style IS NOT NULL;
CREATE INDEX idx_supplier_products_search ON supplier_products USING GIN(search_keywords) WHERE deleted_at IS NULL;

-- Supplier Orders
CREATE INDEX idx_supplier_orders_tenant ON supplier_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_orders_supplier ON supplier_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_orders_status ON supplier_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_orders_job ON supplier_orders(job_id) WHERE deleted_at IS NULL AND job_id IS NOT NULL;
CREATE INDEX idx_supplier_orders_quote ON supplier_orders(quote_id) WHERE deleted_at IS NULL AND quote_id IS NOT NULL;
CREATE INDEX idx_supplier_orders_submitted ON supplier_orders(submitted_at DESC) WHERE deleted_at IS NULL AND submitted_at IS NOT NULL;
CREATE INDEX idx_supplier_orders_number ON supplier_orders(order_number) WHERE deleted_at IS NULL;

-- Order Items
CREATE INDEX idx_supplier_order_items_order ON supplier_order_items(order_id);
CREATE INDEX idx_supplier_order_items_product ON supplier_order_items(product_id) WHERE product_id IS NOT NULL;

-- Shipments
CREATE INDEX idx_supplier_shipments_order ON supplier_shipments(order_id);
CREATE INDEX idx_supplier_shipments_tracking ON supplier_shipments(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_supplier_shipments_status ON supplier_shipments(status);

-- Price Lists
CREATE INDEX idx_supplier_price_lists_tenant ON supplier_price_lists(tenant_id, supplier_id) WHERE is_active = true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_overrides ENABLE ROW LEVEL SECURITY;

-- Suppliers: Platform-level (NULL tenant) visible to all, tenant-specific only to that tenant
CREATE POLICY suppliers_tenant_isolation ON suppliers
  FOR ALL
  USING (
    deleted_at IS NULL
    AND (
      tenant_id IS NULL -- Platform-level supplier
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  )
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- Supplier Products: Visible based on supplier access
CREATE POLICY supplier_products_access ON supplier_products
  FOR ALL
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_products.supplier_id
        AND s.deleted_at IS NULL
        AND (
          s.tenant_id IS NULL
          OR s.tenant_id = COALESCE(
            (auth.jwt() ->> 'tenant_id')::UUID,
            NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
          )
        )
    )
  );

-- Supplier Orders: Tenant isolation
CREATE POLICY supplier_orders_tenant_isolation ON supplier_orders
  FOR ALL
  USING (
    deleted_at IS NULL
    AND tenant_id = COALESCE(
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

-- Order Items: Through order access
CREATE POLICY supplier_order_items_access ON supplier_order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_orders o
      WHERE o.id = supplier_order_items.order_id
        AND o.deleted_at IS NULL
        AND o.tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
    )
  );

-- Shipments: Through order access
CREATE POLICY supplier_shipments_access ON supplier_shipments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_orders o
      WHERE o.id = supplier_shipments.order_id
        AND o.deleted_at IS NULL
        AND o.tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
    )
  );

-- Shipment Items: Through shipment access
CREATE POLICY supplier_shipment_items_access ON supplier_shipment_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_shipments sh
      JOIN supplier_orders o ON o.id = sh.order_id
      WHERE sh.id = supplier_shipment_items.shipment_id
        AND o.deleted_at IS NULL
        AND o.tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
    )
  );

-- Price Lists: Tenant isolation
CREATE POLICY supplier_price_lists_tenant_isolation ON supplier_price_lists
  FOR ALL
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- Price Overrides: Through price list
CREATE POLICY supplier_price_overrides_access ON supplier_price_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_price_lists pl
      WHERE pl.id = supplier_price_overrides.price_list_id
        AND pl.tenant_id = COALESCE(
          (auth.jwt() ->> 'tenant_id')::UUID,
          NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        )
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_supplier_products_updated_at
  BEFORE UPDATE ON supplier_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_supplier_orders_updated_at
  BEFORE UPDATE ON supplier_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_supplier_order_items_updated_at
  BEFORE UPDATE ON supplier_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_supplier_shipments_updated_at
  BEFORE UPDATE ON supplier_shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_supplier_price_lists_updated_at
  BEFORE UPDATE ON supplier_price_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_supplier_price_overrides_updated_at
  BEFORE UPDATE ON supplier_price_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ORDER NUMBER GENERATION
-- ============================================

CREATE OR REPLACE FUNCTION generate_supplier_order_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT := 'PO';
  v_year TEXT;
  v_seq INT;
BEGIN
  IF NEW.order_number IS NULL THEN
    v_year := TO_CHAR(NOW(), 'YY');
    
    -- Get next sequence for this tenant
    UPDATE tenant_sequences
    SET current_value = current_value + 1
    WHERE tenant_id = NEW.tenant_id AND entity_type = 'supplier_order'
    RETURNING current_value INTO v_seq;
    
    IF v_seq IS NULL THEN
      INSERT INTO tenant_sequences (tenant_id, entity_type, current_value)
      VALUES (NEW.tenant_id, 'supplier_order', 1)
      ON CONFLICT (tenant_id, entity_type) DO UPDATE
      SET current_value = tenant_sequences.current_value + 1
      RETURNING current_value INTO v_seq;
    END IF;
    
    NEW.order_number := v_prefix || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_supplier_order_number
  BEFORE INSERT ON supplier_orders
  FOR EACH ROW EXECUTE FUNCTION generate_supplier_order_number();

-- ============================================
-- ORDER TOTAL CALCULATION
-- ============================================

CREATE OR REPLACE FUNCTION calculate_supplier_order_totals()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_order_id UUID;
BEGIN
  -- Determine which order to update
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;
  
  -- Calculate subtotal
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM supplier_order_items
  WHERE order_id = v_order_id;
  
  -- Update order totals
  UPDATE supplier_orders
  SET 
    subtotal = v_subtotal,
    total_amount = v_subtotal - discount_amount + shipping_cost + tax_amount + rush_fee,
    updated_at = NOW()
  WHERE id = v_order_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON supplier_order_items
  FOR EACH ROW EXECUTE FUNCTION calculate_supplier_order_totals();

-- ============================================
-- LINE ITEM TOTAL CALCULATION
-- ============================================

CREATE OR REPLACE FUNCTION calculate_line_item_total()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.line_total := NEW.quantity * NEW.unit_price * (1 - COALESCE(NEW.discount_percent, 0) / 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_line_total
  BEFORE INSERT OR UPDATE ON supplier_order_items
  FOR EACH ROW EXECUTE FUNCTION calculate_line_item_total();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get effective price for a product (considering tenant price lists)
CREATE OR REPLACE FUNCTION get_effective_product_price(
  p_product_id UUID,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_base_price NUMERIC(10,2);
  v_override_price NUMERIC(10,2);
  v_discount_percent NUMERIC(5,2);
  v_category product_category;
  v_category_discount NUMERIC(5,2);
BEGIN
  -- Get tenant context
  v_tenant_id := COALESCE(
    p_tenant_id,
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  -- Get base price and category
  SELECT sp.unit_price, sp.category INTO v_base_price, v_category
  FROM supplier_products sp
  WHERE sp.id = p_product_id AND sp.deleted_at IS NULL;
  
  IF v_base_price IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check for price override
  SELECT po.override_price, po.discount_percent INTO v_override_price, v_discount_percent
  FROM supplier_price_overrides po
  JOIN supplier_price_lists pl ON pl.id = po.price_list_id
  WHERE po.product_id = p_product_id
    AND pl.tenant_id = v_tenant_id
    AND pl.is_active = true
    AND pl.effective_date <= CURRENT_DATE
    AND (pl.expiration_date IS NULL OR pl.expiration_date >= CURRENT_DATE)
  LIMIT 1;
  
  -- Return override price if set
  IF v_override_price IS NOT NULL THEN
    RETURN v_override_price;
  END IF;
  
  -- Apply discount if set
  IF v_discount_percent IS NOT NULL AND v_discount_percent > 0 THEN
    RETURN v_base_price * (1 - v_discount_percent / 100);
  END IF;
  
  -- Check for category discount
  SELECT 
    COALESCE(pl.base_discount_percent, 0) + 
    COALESCE((pl.category_discounts ->> v_category::TEXT)::NUMERIC, 0)
  INTO v_category_discount
  FROM supplier_price_lists pl
  JOIN supplier_products sp ON sp.supplier_id = (
    SELECT s.id FROM suppliers s
    JOIN supplier_products sp2 ON sp2.supplier_id = s.id
    WHERE sp2.id = p_product_id
  )
  WHERE pl.tenant_id = v_tenant_id
    AND pl.supplier_id = sp.supplier_id
    AND pl.is_active = true
    AND pl.effective_date <= CURRENT_DATE
    AND (pl.expiration_date IS NULL OR pl.expiration_date >= CURRENT_DATE)
  LIMIT 1;
  
  IF v_category_discount IS NOT NULL AND v_category_discount > 0 THEN
    RETURN v_base_price * (1 - v_category_discount / 100);
  END IF;
  
  -- Return base price
  RETURN v_base_price;
END;
$$ LANGUAGE plpgsql;

-- Search products with filters
CREATE OR REPLACE FUNCTION search_supplier_products(
  p_supplier_id UUID DEFAULT NULL,
  p_category product_category DEFAULT NULL,
  p_door_style door_style DEFAULT NULL,
  p_door_color door_color DEFAULT NULL,
  p_hardware_style hardware_style DEFAULT NULL,
  p_hardware_finish hardware_finish DEFAULT NULL,
  p_search_term TEXT DEFAULT NULL,
  p_in_stock_only BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  supplier_id UUID,
  sku TEXT,
  name TEXT,
  category product_category,
  door_style door_style,
  door_color door_color,
  hardware_style hardware_style,
  hardware_finish hardware_finish,
  unit_price NUMERIC,
  effective_price NUMERIC,
  in_stock BOOLEAN,
  image_url TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.supplier_id,
    sp.sku,
    sp.name,
    sp.category,
    sp.door_style,
    sp.door_color,
    sp.hardware_style,
    sp.hardware_finish,
    sp.unit_price,
    get_effective_product_price(sp.id) AS effective_price,
    sp.in_stock,
    sp.image_url
  FROM supplier_products sp
  JOIN suppliers s ON s.id = sp.supplier_id
  WHERE sp.deleted_at IS NULL
    AND sp.is_active = true
    AND s.deleted_at IS NULL
    AND s.status = 'active'
    AND (p_supplier_id IS NULL OR sp.supplier_id = p_supplier_id)
    AND (p_category IS NULL OR sp.category = p_category)
    AND (p_door_style IS NULL OR sp.door_style = p_door_style)
    AND (p_door_color IS NULL OR sp.door_color = p_door_color)
    AND (p_hardware_style IS NULL OR sp.hardware_style = p_hardware_style)
    AND (p_hardware_finish IS NULL OR sp.hardware_finish = p_hardware_finish)
    AND (NOT p_in_stock_only OR sp.in_stock = true)
    AND (
      p_search_term IS NULL 
      OR sp.name ILIKE '%' || p_search_term || '%'
      OR sp.sku ILIKE '%' || p_search_term || '%'
      OR sp.description ILIKE '%' || p_search_term || '%'
      OR p_search_term = ANY(sp.search_keywords)
    )
    AND (
      s.tenant_id IS NULL
      OR s.tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  ORDER BY sp.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Soft delete for orders
CREATE OR REPLACE FUNCTION soft_delete_supplier_order(
  p_order_id UUID,
  p_deleted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_order_tenant UUID;
BEGIN
  -- Get tenant context
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  -- Verify tenant access
  SELECT tenant_id INTO v_order_tenant
  FROM supplier_orders
  WHERE id = p_order_id AND deleted_at IS NULL;
  
  IF v_order_tenant IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  IF v_tenant_id IS NOT NULL AND v_order_tenant != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized: order not in current tenant';
  END IF;
  
  -- Only allow deleting draft orders
  IF EXISTS (
    SELECT 1 FROM supplier_orders 
    WHERE id = p_order_id AND status NOT IN ('draft', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Cannot delete order that has been submitted';
  END IF;
  
  UPDATE supplier_orders
  SET 
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    updated_by = p_deleted_by
  WHERE id = p_order_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED QWIKKIT AS PLATFORM SUPPLIER
-- ============================================

INSERT INTO suppliers (
  id,
  tenant_id, -- NULL = platform-level
  supplier_code,
  name,
  legal_name,
  supplier_type,
  status,
  website,
  phone,
  email,
  support_email,
  support_phone,
  lead_time_days,
  rush_available,
  rush_lead_time_days,
  payment_terms,
  metadata
) VALUES (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  NULL,
  'QWIKKIT',
  'Qwikkit',
  'Qwikkit Cabinet Makeover Kits',
  'manufacturer',
  'active',
  'https://qwikkit.com',
  '844-4-THE-KIT',
  'customerservice@Qwikkit.com',
  'support@qwikkit.com',
  '844-4-THE-KIT',
  7, -- 5-7 business days
  true,
  3,
  'NET30',
  '{
    "brands": ["Qwikkit", "CinchKit", "RefaceKit", "KitchenMakeover"],
    "warranty_years": 5,
    "features": ["DuraBuild doors", "Heat resistant to 212°F", "100% waterproof", "Warp resistant"]
  }'::JSONB
) ON CONFLICT (supplier_code) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE suppliers IS 'Supplier registry - Qwikkit, other vendors';
COMMENT ON TABLE supplier_products IS 'Product catalog from suppliers - doors, hardware, materials';
COMMENT ON TABLE supplier_orders IS 'Purchase orders placed with suppliers';
COMMENT ON TABLE supplier_order_items IS 'Line items for supplier orders';
COMMENT ON TABLE supplier_shipments IS 'Shipment tracking for supplier orders';
COMMENT ON TABLE supplier_shipment_items IS 'Items included in each shipment';
COMMENT ON TABLE supplier_price_lists IS 'Negotiated pricing by tenant';
COMMENT ON TABLE supplier_price_overrides IS 'Product-specific price overrides';

COMMENT ON COLUMN supplier_products.door_style IS 'Shaker, Slab, Slide, Fusion variants';
COMMENT ON COLUMN supplier_products.door_color IS 'Available: Graphite, Storm, Mist, Espresso Walnut, etc.';
COMMENT ON COLUMN supplier_products.hardware_style IS 'Bar (free), Artisan, Cottage, Arch, Loft, Square';
COMMENT ON COLUMN supplier_products.volume_pricing IS 'Tiered pricing: [{"min_qty": 10, "price": 5.99}]';
