-- Create products table for supplier materials catalog
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'other',
    sku_prefix VARCHAR(50),
    base_price DECIMAL(10, 2),
    base_cost DECIMAL(10, 2),
    unit VARCHAR(50) DEFAULT 'each',
    status VARCHAR(50) DEFAULT 'active',
    -- JSONB arrays for available options
    available_styles JSONB DEFAULT '[]'::jsonb,
    available_colors JSONB DEFAULT '[]'::jsonb,
    available_finishes JSONB DEFAULT '[]'::jsonb,
    -- JSONB array of variant objects
    variants JSONB DEFAULT '[]'::jsonb,
    -- Additional metadata
    specifications JSONB DEFAULT '{}'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);

-- GIN indexes for JSONB array containment queries
CREATE INDEX IF NOT EXISTS idx_products_styles ON products USING GIN (available_styles);
CREATE INDEX IF NOT EXISTS idx_products_colors ON products USING GIN (available_colors);
CREATE INDEX IF NOT EXISTS idx_products_finishes ON products USING GIN (available_finishes);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "products_tenant_isolation" ON products
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::integer);

-- Insert some sample products
INSERT INTO products (tenant_id, supplier_id, name, description, category, sku_prefix, base_price, unit, status, available_styles, available_colors, available_finishes)
VALUES 
    (1, 1, 'Shaker Cabinet Door', 'Classic shaker style cabinet door', 'doors', 'SHK-DOOR', 89.99, 'each', 'active', 
     '["shaker", "raised_panel", "flat_panel"]'::jsonb, 
     '["white", "gray", "espresso", "natural_oak", "cherry"]'::jsonb,
     '["matte", "satin", "gloss"]'::jsonb),
    (1, 1, 'Drawer Front Panel', 'Matching drawer front panel', 'panels', 'DRW-PNL', 49.99, 'each', 'active',
     '["shaker", "raised_panel", "flat_panel"]'::jsonb,
     '["white", "gray", "espresso", "natural_oak", "cherry"]'::jsonb,
     '["matte", "satin", "gloss"]'::jsonb),
    (1, 1, 'Cabinet Hardware - Pulls', 'Modern cabinet pull handles', 'hardware', 'HW-PULL', 12.99, 'each', 'active',
     '["bar", "cup", "ring"]'::jsonb,
     '["brushed_nickel", "matte_black", "chrome", "brass"]'::jsonb,
     '[]'::jsonb),
    (1, 1, 'Cabinet Hardware - Knobs', 'Classic cabinet knobs', 'hardware', 'HW-KNOB', 8.99, 'each', 'active',
     '["round", "square", "mushroom"]'::jsonb,
     '["brushed_nickel", "matte_black", "chrome", "brass"]'::jsonb,
     '[]'::jsonb),
    (1, 1, 'End Panel', 'Cabinet end panel for exposed sides', 'panels', 'END-PNL', 129.99, 'each', 'active',
     '["shaker", "flat"]'::jsonb,
     '["white", "gray", "espresso", "natural_oak", "cherry"]'::jsonb,
     '["matte", "satin"]'::jsonb),
    (1, 1, 'Crown Molding', 'Decorative crown molding for cabinet tops', 'accessories', 'CRN-MLD', 24.99, 'linear_foot', 'active',
     '["traditional", "modern", "simple"]'::jsonb,
     '["white", "gray", "espresso", "natural_oak"]'::jsonb,
     '["matte", "satin"]'::jsonb);
