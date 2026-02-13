-- Enable Row Level Security (RLS) on all tables
-- This script sets up basic RLS policies for multi-tenant isolation

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowners ENABLE ROW LEVEL SECURITY;
ALTER TABLE installers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES FOR SERVICE ROLE (BACKEND)
-- The service role bypasses RLS, so backend can access all data
-- ============================================

-- For now, allow all operations for authenticated users via service role
-- In production, you'd use JWT claims to enforce tenant isolation

-- TENANTS: Allow all for service role
CREATE POLICY "Service role full access to tenants" ON tenants
    FOR ALL USING (true) WITH CHECK (true);

-- USERS: Allow all for service role
CREATE POLICY "Service role full access to users" ON users
    FOR ALL USING (true) WITH CHECK (true);

-- LEADS: Allow all for service role
CREATE POLICY "Service role full access to leads" ON leads
    FOR ALL USING (true) WITH CHECK (true);

-- HOMEOWNERS: Allow all for service role
CREATE POLICY "Service role full access to homeowners" ON homeowners
    FOR ALL USING (true) WITH CHECK (true);

-- INSTALLERS: Allow all for service role
CREATE POLICY "Service role full access to installers" ON installers
    FOR ALL USING (true) WITH CHECK (true);

-- SUPPLIERS: Allow all for service role
CREATE POLICY "Service role full access to suppliers" ON suppliers
    FOR ALL USING (true) WITH CHECK (true);

-- QUOTES: Allow all for service role
CREATE POLICY "Service role full access to quotes" ON quotes
    FOR ALL USING (true) WITH CHECK (true);

-- JOBS: Allow all for service role
CREATE POLICY "Service role full access to jobs" ON jobs
    FOR ALL USING (true) WITH CHECK (true);

-- FILES: Allow all for service role
CREATE POLICY "Service role full access to files" ON files
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- NOTE: For production multi-tenant isolation
-- ============================================
-- You would create policies like:
--
-- CREATE POLICY "Tenant isolation for leads" ON leads
--     FOR ALL
--     USING (tenant_id = current_setting('app.current_tenant_id')::int)
--     WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::int);
--
-- And set the tenant ID in your backend before queries:
-- SET app.current_tenant_id = '1';
