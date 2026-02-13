-- Core Vulpine OS Database Schema
-- Created: 2025-12-01
-- Description: Creates all core tables for leads, homeowners, jobs, quotes, files, etc.

-- ============================================================================
-- LEADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(32),
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'new',
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_leads_tenant ON leads(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_status ON leads(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_source ON leads(source) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_email ON leads(customer_email) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_created_at ON leads(created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- HOMEOWNERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS homeowners (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(32),
    address_street TEXT,
    address_city VARCHAR(100),
    address_state VARCHAR(50),
    address_zip VARCHAR(20),
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_homeowners_tenant ON homeowners(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_homeowners_email ON homeowners(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_homeowners_name ON homeowners(last_name, first_name) WHERE deleted_at IS NULL;

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    homeowner_id BIGINT REFERENCES homeowners(id),
    quote_id BIGINT,
    job_number VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount NUMERIC(12, 2),
    deposit_amount NUMERIC(12, 2),
    balance_due NUMERIC(12, 2),
    start_date DATE,
    completion_date DATE,
    internal_notes TEXT,
    customer_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_jobs_tenant ON jobs(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_homeowner ON jobs(homeowner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_status ON jobs(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_number ON jobs(job_number) WHERE deleted_at IS NULL;

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotes (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    lead_id BIGINT REFERENCES leads(id),
    homeowner_id BIGINT REFERENCES homeowners(id),
    quote_number VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'draft',
    subtotal NUMERIC(12, 2) DEFAULT 0,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) DEFAULT 0,
    valid_until DATE,
    internal_notes TEXT,
    customer_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_quotes_tenant ON quotes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_lead ON quotes(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_homeowner ON quotes(homeowner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_status ON quotes(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_number ON quotes(quote_number) WHERE deleted_at IS NULL;

-- ============================================================================
-- QUOTE ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_items (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    quote_id BIGINT REFERENCES quotes(id) ON DELETE CASCADE,
    product_id BIGINT,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1,
    unit_price NUMERIC(12, 2) DEFAULT 0,
    total_price NUMERIC(12, 2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_quote_items_quote ON quote_items(quote_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quote_items_product ON quote_items(product_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- FILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS files (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    storage_path TEXT NOT NULL,
    storage_url TEXT,
    entity_type VARCHAR(100),
    entity_id BIGINT,
    uploaded_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_files_tenant ON files(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_entity ON files(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by) WHERE deleted_at IS NULL;

-- ============================================================================
-- INSTALLERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS installers (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    company_name VARCHAR(200),
    contact_name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(32),
    address_street TEXT,
    address_city VARCHAR(100),
    address_state VARCHAR(50),
    address_zip VARCHAR(20),
    license_number VARCHAR(100),
    insurance_info TEXT,
    status VARCHAR(50) DEFAULT 'active',
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_installers_tenant ON installers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_installers_status ON installers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_installers_email ON installers(email) WHERE deleted_at IS NULL;

-- ============================================================================
-- SUPPLIERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    company_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(200),
    email VARCHAR(255),
    phone VARCHAR(32),
    website VARCHAR(255),
    address_street TEXT,
    address_city VARCHAR(100),
    address_state VARCHAR(50),
    address_zip VARCHAR(20),
    account_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_status ON suppliers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_company ON suppliers(company_name) WHERE deleted_at IS NULL;

-- ============================================================================
-- WORK ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_orders (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    job_id BIGINT REFERENCES jobs(id),
    installer_id BIGINT REFERENCES installers(id),
    work_order_number VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_date DATE,
    completed_date DATE,
    description TEXT,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_work_orders_tenant ON work_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_job ON work_orders(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_installer ON work_orders(installer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_status ON work_orders(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- SUPPLIER ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplier_orders (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    supplier_id BIGINT REFERENCES suppliers(id),
    job_id BIGINT REFERENCES jobs(id),
    order_number VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending',
    order_date DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    total_amount NUMERIC(12, 2),
    tracking_info TEXT,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_supplier_orders_tenant ON supplier_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_orders_supplier ON supplier_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_orders_job ON supplier_orders(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_orders_status ON supplier_orders(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    job_id BIGINT REFERENCES jobs(id),
    quote_id BIGINT,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    transaction_id VARCHAR(255),
    payment_date DATE,
    processor_response JSONB,
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_job ON payments(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_status ON payments(payment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_transaction ON payments(transaction_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- DOCUMENTS TABLE (for e-sign, contracts, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    entity_type VARCHAR(100),
    entity_id BIGINT,
    document_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    file_id BIGINT REFERENCES files(id),
    docusign_envelope_id VARCHAR(255),
    signed_at TIMESTAMP WITH TIME ZONE,
    signed_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_type ON documents(document_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_status ON documents(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT,
    user_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    notification_type VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    link_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_tenant ON notifications(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_user ON notifications(user_id) WHERE deleted_at IS NULL AND is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- Success message
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Core Vulpine OS tables created successfully';
END $$;
