-- ===========================================================
-- 007a_PATCH_QUOTES_JOBS_HOMEOWNER_VALIDATION.SQL
-- Add homeowner cross-tenant validation to quotes/jobs
-- Run AFTER 007_homeowners.sql
-- Depends on:
--   003_quotes_table.sql
--   004_jobs_table.sql
--   006_installers.sql
--   007_homeowners.sql
-- ===========================================================

-- ============================================
-- PATCH: quotes_insert policy
-- ============================================

DROP POLICY IF EXISTS quotes_insert ON quotes;

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
          AND leads.deleted_at IS NULL
      )
    )
    AND (
      homeowner_id IS NULL OR
      EXISTS (
        SELECT 1 FROM homeowners
        WHERE id = homeowner_id
          AND homeowners.tenant_id = quotes.tenant_id
          AND homeowners.deleted_at IS NULL
      )
    )
  );

-- ============================================
-- PATCH: jobs_insert policy
-- ============================================

DROP POLICY IF EXISTS jobs_insert ON jobs;

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
          AND quotes.deleted_at IS NULL
      )
    )
    AND (
      lead_id IS NULL OR
      EXISTS (
        SELECT 1 FROM leads
        WHERE id = lead_id
          AND leads.tenant_id = jobs.tenant_id
          AND leads.deleted_at IS NULL
      )
    )
    AND (
      homeowner_id IS NULL OR
      EXISTS (
        SELECT 1 FROM homeowners
        WHERE id = homeowner_id
          AND homeowners.tenant_id = jobs.tenant_id
          AND homeowners.deleted_at IS NULL
      )
    )
    AND (
      installer_id IS NULL OR
      EXISTS (
        SELECT 1 FROM installers
        WHERE id = installer_id
          AND installers.tenant_id = jobs.tenant_id
          AND installers.deleted_at IS NULL
      )
    )
  );
