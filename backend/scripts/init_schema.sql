-- Vulpine OS Core Schema for Supabase
-- This creates the essential tables needed for the MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'nurture');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM (
        'pending', 'ordered', 'in_production', 'shipped', 'delivered',
        'scheduled', 'in_progress', 'completed', 'on_hold', 'cancelled', 'issue'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE installer_status AS ENUM ('pending', 'onboarding', 'active', 'inactive', 'suspended', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE installer_tier AS ENUM ('apprentice', 'standard', 'senior', 'lead', 'master');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE quote_status AS ENUM ('draft', 'pending_review', 'sent', 'accepted', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TENANTS
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    status TEXT DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- USERS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user',
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- LEADS
-- ============================================

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    source TEXT,
    status TEXT DEFAULT 'new',
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- HOMEOWNERS
-- ============================================

CREATE TABLE IF NOT EXISTS homeowners (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address_street TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip TEXT,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- INSTALLERS
-- ============================================

CREATE TABLE IF NOT EXISTS installers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    phone_secondary TEXT,
    company_name TEXT,
    status TEXT DEFAULT 'pending',
    tier TEXT DEFAULT 'apprentice',
    skills TEXT[],
    service_area_zips TEXT[],
    service_radius_miles INTEGER DEFAULT 25,
    max_jobs_per_day INTEGER DEFAULT 1,
    max_jobs_per_week INTEGER DEFAULT 5,
    base_hourly_rate NUMERIC(8,2),
    base_job_rate NUMERIC(8,2),
    has_insurance BOOLEAN DEFAULT false,
    has_vehicle BOOLEAN DEFAULT true,
    has_tools BOOLEAN DEFAULT true,
    jobs_completed INTEGER DEFAULT 0,
    jobs_cancelled INTEGER DEFAULT 0,
    rating_average NUMERIC(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    total_earnings NUMERIC(12,2) DEFAULT 0,
    pending_payout NUMERIC(12,2) DEFAULT 0,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- SUPPLIERS
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    supplier_type TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    is_active BOOLEAN DEFAULT true,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- QUOTES
-- ============================================

CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    homeowner_id INTEGER REFERENCES homeowners(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft',
    total_price NUMERIC(12,2) DEFAULT 0,
    valid_until DATE,
    internal_notes TEXT,
    line_items JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- JOBS
-- ============================================

CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    homeowner_id INTEGER REFERENCES homeowners(id) ON DELETE SET NULL,
    installer_id INTEGER REFERENCES installers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    scheduled_date DATE,
    scheduled_time_start TIME,
    scheduled_time_end TIME,
    installer_name TEXT,
    project_details JSONB DEFAULT '{}',
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- FILES
-- ============================================

CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_filename TEXT,
    file_type TEXT,
    file_size INTEGER,
    mime_type TEXT,
    storage_path TEXT,
    entity_type TEXT,
    entity_id INTEGER,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_homeowners_tenant ON homeowners(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installers_tenant ON installers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installers_status ON installers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_installer ON jobs(installer_id);
CREATE INDEX IF NOT EXISTS idx_files_entity ON files(entity_type, entity_id);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert demo tenant if not exists
INSERT INTO tenants (name, slug, status)
SELECT 'Vulpine Demo', 'vulpine-demo', 'active'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'vulpine-demo');

-- Get tenant ID for subsequent inserts
DO $$
DECLARE
    v_tenant_id INTEGER;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'vulpine-demo';
    
    -- Insert admin user if not exists
    INSERT INTO users (tenant_id, email, role, first_name, last_name, status)
    SELECT v_tenant_id, 'admin@vulpine.local', 'admin', 'Admin', 'User', 'active'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@vulpine.local');
    
    -- Insert demo installer if not exists
    INSERT INTO installers (tenant_id, first_name, last_name, phone, email, status, tier, service_area_zips)
    SELECT v_tenant_id, 'Demo', 'Installer', '555-0100', 'installer@vulpine.local', 'active', 'standard', ARRAY['85001', '85002', '85003']
    WHERE NOT EXISTS (SELECT 1 FROM installers WHERE email = 'installer@vulpine.local');
    
    -- Insert demo homeowner if not exists
    INSERT INTO homeowners (tenant_id, first_name, last_name, phone, email, address_street, address_city, address_state, address_zip)
    SELECT v_tenant_id, 'Jane', 'Doe', '555-0200', 'jane@example.com', '123 Main St', 'Phoenix', 'AZ', '85001'
    WHERE NOT EXISTS (SELECT 1 FROM homeowners WHERE email = 'jane@example.com');
    
    -- Insert demo lead if not exists
    INSERT INTO leads (tenant_id, customer_name, customer_email, customer_phone, source, status)
    SELECT v_tenant_id, 'John Smith', 'john@example.com', '555-0300', 'website', 'new'
    WHERE NOT EXISTS (SELECT 1 FROM leads WHERE customer_email = 'john@example.com');
    
    -- Insert demo supplier if not exists
    INSERT INTO suppliers (tenant_id, name, contact_name, email, phone, supplier_type, city, state, is_active)
    SELECT v_tenant_id, 'Cabinet Supply Co', 'Bob Wilson', 'bob@cabinetsupply.com', '555-0400', 'materials', 'Phoenix', 'AZ', true
    WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE email = 'bob@cabinetsupply.com');
    
    -- Insert demo job if not exists
    INSERT INTO jobs (tenant_id, homeowner_id, customer_name, status, project_details)
    SELECT v_tenant_id, 
           (SELECT id FROM homeowners WHERE email = 'jane@example.com' LIMIT 1),
           'Jane Doe', 
           'pending', 
           '{"description": "Kitchen cabinet refacing", "cabinets": 12, "drawers": 6}'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE customer_name = 'Jane Doe' AND tenant_id = v_tenant_id);
END $$;
