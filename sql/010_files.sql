-- ===========================================================
-- 010_FILES.SQL
-- Canonical File Storage, Uploads, Documents
-- Multi-source: Visualizer, Jobs, Quotes, Installers, AR Fox
-- Depends on:
--   000_common.sql
--   005_tenants_users.sql
--   001_leads_table.sql
--   004_jobs_table.sql
--   006_installers.sql
--   007_homeowners.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE file_status AS ENUM (
  'pending',          -- Upload initiated
  'uploading',        -- In progress
  'processing',       -- Post-upload processing (thumbnails, virus scan)
  'ready',            -- Available for use
  'failed',           -- Upload/processing failed
  'quarantined',      -- Failed virus scan
  'archived',         -- Archived but accessible
  'deleted'           -- Marked for deletion
);

CREATE TYPE file_category AS ENUM (
  'photo',            -- General photos
  'document',         -- PDFs, docs, contracts
  'video',            -- Video files
  'render',           -- AR/AI generated renders
  'before_photo',     -- Before transformation photo
  'after_photo',      -- After transformation photo
  'progress_photo',   -- Job progress documentation
  'completion_photo', -- Final job photos
  'visualizer',       -- Visualizer session images
  'floor_plan',       -- Kitchen/room floor plans
  'contract',         -- Signed contracts
  'invoice',          -- Invoice PDFs
  'receipt',          -- Payment receipts
  'permit',           -- Building permits
  'certification',    -- Installer certifications
  'insurance',        -- Insurance documents
  'w9',               -- Tax documents
  'id_verification',  -- ID documents
  'avatar',           -- Profile pictures
  'logo',             -- Company logos
  'ar_model',         -- AR 3D models
  'ar_texture',       -- AR textures/materials
  'other'
);

CREATE TYPE file_visibility AS ENUM (
  'private',          -- Only tenant users
  'internal',         -- Tenant + installers
  'customer',         -- Visible to customer
  'public'            -- Publicly accessible
);

CREATE TYPE storage_provider AS ENUM (
  'supabase',         -- Supabase Storage
  's3',               -- AWS S3
  'gcs',              -- Google Cloud Storage
  'azure',            -- Azure Blob Storage
  'local'             -- Local filesystem (dev only)
);

-- ============================================
-- FILES TABLE (Canonical file registry)
-- ============================================

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Human-readable ID
  file_number TEXT UNIQUE,
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- File identity
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL, -- UUID-based or hashed name
  
  -- Storage
  storage_provider storage_provider NOT NULL DEFAULT 'supabase',
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- Full path within bucket
  storage_url TEXT, -- Direct URL if public
  cdn_url TEXT, -- CDN URL if available
  
  -- File properties
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- Bytes
  file_hash TEXT, -- SHA-256 hash for deduplication/integrity
  
  -- Classification
  category file_category NOT NULL DEFAULT 'other',
  visibility file_visibility NOT NULL DEFAULT 'private',
  status file_status NOT NULL DEFAULT 'pending',
  
  -- Image properties (if applicable)
  width INT,
  height INT,
  
  -- Thumbnails
  has_thumbnail BOOLEAN NOT NULL DEFAULT false,
  thumbnail_url TEXT,
  thumbnail_storage_path TEXT,
  
  -- Video properties (if applicable)
  duration_seconds INT,
  
  -- Processing
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  -- Virus scan
  virus_scanned BOOLEAN NOT NULL DEFAULT false,
  virus_scan_result TEXT, -- 'clean', 'infected', 'error'
  virus_scanned_at TIMESTAMPTZ,
  
  -- Versioning
  version INT NOT NULL DEFAULT 1,
  parent_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  is_current_version BOOLEAN NOT NULL DEFAULT true,
  
  -- Expiration
  expires_at TIMESTAMPTZ, -- For temporary files
  
  -- Description
  title TEXT,
  description TEXT,
  alt_text TEXT, -- Accessibility
  
  -- Tags for search/filtering
  tags TEXT[] DEFAULT '{}',
  
  -- AI/AR metadata
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT, -- Model used for generation
  ai_prompt TEXT, -- Prompt used
  ar_metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(ar_metadata) = 'object'),
  -- Expected: { "scene_id": "", "camera_angle": "", "lighting": "", "materials": [] }
  
  -- EXIF/metadata extracted from file
  extracted_metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(extracted_metadata) = 'object'),
  -- Expected: { "exif": {}, "gps": {}, "camera": "", "taken_at": "" }
  
  -- Audit log
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  
  -- Audit
  created_by UUID,
  uploaded_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- FILE_ASSOCIATIONS TABLE (Links files to entities)
-- ============================================

CREATE TABLE file_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- File reference
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Polymorphic association
  entity_type TEXT NOT NULL, -- 'lead', 'job', 'quote', 'homeowner', 'installer', 'invoice', 'payout', 'supplier_order'
  entity_id UUID NOT NULL,
  
  -- Association metadata
  association_type TEXT NOT NULL DEFAULT 'attachment', -- 'attachment', 'primary', 'gallery', 'document', 'before', 'after'
  sort_order INT DEFAULT 0,
  
  -- Caption/notes for this association
  caption TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  
  -- Prevent duplicate associations
  UNIQUE(file_id, entity_type, entity_id, association_type)
) WITH (fillfactor = 90);

-- ============================================
-- FILE_ACCESS_TOKENS TABLE (Temporary access)
-- ============================================

CREATE TABLE file_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- File reference
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Token
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Access control
  max_downloads INT, -- NULL = unlimited
  download_count INT NOT NULL DEFAULT 0,
  
  -- Validity
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Restrictions
  ip_whitelist TEXT[], -- Optional IP restrictions
  
  -- Tracking
  last_accessed_at TIMESTAMPTZ,
  last_accessed_ip TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- ============================================
-- FILE_DOWNLOADS TABLE (Download audit trail)
-- ============================================

CREATE TABLE file_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- File reference
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Access method
  access_token_id UUID REFERENCES file_access_tokens(id) ON DELETE SET NULL,
  
  -- Who downloaded
  downloaded_by UUID, -- NULL if via token
  
  -- Request info
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  
  -- Timestamp
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- UPLOAD_SESSIONS TABLE (Resumable uploads)
-- ============================================

CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Session identity
  session_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- File info
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  category file_category NOT NULL DEFAULT 'other',
  
  -- Target entity (pre-association)
  target_entity_type TEXT,
  target_entity_id UUID,
  target_association_type TEXT DEFAULT 'attachment',
  
  -- Upload progress
  bytes_uploaded BIGINT NOT NULL DEFAULT 0,
  chunks_received INT NOT NULL DEFAULT 0,
  total_chunks INT,
  
  -- Storage
  storage_provider storage_provider NOT NULL DEFAULT 'supabase',
  storage_bucket TEXT NOT NULL,
  temp_storage_path TEXT, -- Temporary location during upload
  
  -- Status
  status TEXT NOT NULL DEFAULT 'initiated', -- 'initiated', 'uploading', 'completing', 'completed', 'failed', 'cancelled'
  error_message TEXT,
  
  -- Resulting file
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  
  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES: FILES
-- ============================================

CREATE INDEX idx_files_tenant ON files(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_status ON files(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_category ON files(tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_visibility ON files(tenant_id, visibility) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_created ON files(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_hash ON files(file_hash) WHERE file_hash IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_files_mime ON files(tenant_id, mime_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_storage_path ON files(storage_provider, storage_bucket, storage_path) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_parent ON files(parent_file_id) WHERE parent_file_id IS NOT NULL;
CREATE INDEX idx_files_current_version ON files(parent_file_id) WHERE is_current_version = true AND deleted_at IS NULL;
CREATE INDEX idx_files_expires ON files(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_files_ai_generated ON files(tenant_id) WHERE ai_generated = true AND deleted_at IS NULL;
CREATE INDEX idx_files_virus_pending ON files(tenant_id) WHERE virus_scanned = false AND status = 'ready';
CREATE INDEX idx_files_tags_gin ON files USING GIN (tags array_ops);
CREATE INDEX idx_files_ar_metadata_gin ON files USING GIN (ar_metadata jsonb_path_ops);
CREATE INDEX idx_files_extracted_metadata_gin ON files USING GIN (extracted_metadata jsonb_path_ops);
CREATE INDEX idx_files_metadata_gin ON files USING GIN (metadata jsonb_path_ops);

-- Full text search on files
CREATE INDEX idx_files_fts ON files USING GIN (
  to_tsvector('english',
    COALESCE(original_filename, '') || ' ' ||
    COALESCE(title, '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE(alt_text, '')
  )
) WHERE deleted_at IS NULL;

-- ============================================
-- INDEXES: FILE_ASSOCIATIONS
-- ============================================

CREATE INDEX idx_file_associations_file ON file_associations(file_id);
CREATE INDEX idx_file_associations_tenant ON file_associations(tenant_id);
CREATE INDEX idx_file_associations_entity ON file_associations(entity_type, entity_id);
CREATE INDEX idx_file_associations_type ON file_associations(entity_type, entity_id, association_type);
CREATE INDEX idx_file_associations_sort ON file_associations(entity_type, entity_id, sort_order);

-- ============================================
-- INDEXES: FILE_ACCESS_TOKENS
-- ============================================

CREATE INDEX idx_file_access_tokens_file ON file_access_tokens(file_id);
CREATE INDEX idx_file_access_tokens_tenant ON file_access_tokens(tenant_id);
CREATE INDEX idx_file_access_tokens_token ON file_access_tokens(token);
-- FIXED: Removed NOW() from predicate (volatile function not allowed in index)
-- Queries should filter with: WHERE expires_at > NOW()
CREATE INDEX idx_file_access_tokens_expires ON file_access_tokens(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- INDEXES: FILE_DOWNLOADS
-- ============================================

CREATE INDEX idx_file_downloads_file ON file_downloads(file_id);
CREATE INDEX idx_file_downloads_tenant ON file_downloads(tenant_id);
CREATE INDEX idx_file_downloads_token ON file_downloads(access_token_id) WHERE access_token_id IS NOT NULL;
CREATE INDEX idx_file_downloads_user ON file_downloads(downloaded_by) WHERE downloaded_by IS NOT NULL;
CREATE INDEX idx_file_downloads_date ON file_downloads(tenant_id, downloaded_at DESC);

-- ============================================
-- INDEXES: UPLOAD_SESSIONS
-- ============================================

CREATE INDEX idx_upload_sessions_tenant ON upload_sessions(tenant_id);
CREATE INDEX idx_upload_sessions_token ON upload_sessions(session_token);
CREATE INDEX idx_upload_sessions_status ON upload_sessions(tenant_id, status);
CREATE INDEX idx_upload_sessions_expires ON upload_sessions(expires_at) WHERE status NOT IN ('completed', 'failed', 'cancelled');
CREATE INDEX idx_upload_sessions_file ON upload_sessions(file_id) WHERE file_id IS NOT NULL;

-- ============================================
-- TRIGGERS (UPGRADED: All with SECURITY DEFINER)
-- ============================================

-- Auto-generate file number
CREATE OR REPLACE FUNCTION generate_file_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.file_number IS NULL THEN
    NEW.file_number := next_tenant_sequence(NEW.tenant_id, 'file', 'VUL');
  END IF;
  
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  
  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := NEW.created_by;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER file_number_trigger
  BEFORE INSERT ON files
  FOR EACH ROW
  EXECUTE FUNCTION generate_file_number();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_file_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_file_updated_at();

CREATE TRIGGER upload_sessions_updated_at
  BEFORE UPDATE ON upload_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Audit logging
CREATE TRIGGER files_audit
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION audit_entity();

-- Mark old versions when new version uploaded
CREATE OR REPLACE FUNCTION mark_old_file_versions()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_file_id IS NOT NULL AND NEW.is_current_version = true THEN
    -- Mark all other versions as not current
    UPDATE files
    SET is_current_version = false
    WHERE parent_file_id = NEW.parent_file_id
      AND id != NEW.id
      AND is_current_version = true;
    
    -- Also mark the parent
    UPDATE files
    SET is_current_version = false
    WHERE id = NEW.parent_file_id
      AND is_current_version = true;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER files_version_trigger
  AFTER INSERT ON files
  FOR EACH ROW
  WHEN (NEW.parent_file_id IS NOT NULL)
  EXECUTE FUNCTION mark_old_file_versions();

-- Auto-associate file after upload session completes
CREATE OR REPLACE FUNCTION auto_associate_upload()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.file_id IS NOT NULL 
     AND NEW.target_entity_type IS NOT NULL AND NEW.target_entity_id IS NOT NULL THEN
    INSERT INTO file_associations (
      file_id,
      tenant_id,
      entity_type,
      entity_id,
      association_type,
      created_by
    ) VALUES (
      NEW.file_id,
      NEW.tenant_id,
      NEW.target_entity_type,
      NEW.target_entity_id,
      COALESCE(NEW.target_association_type, 'attachment'),
      NEW.created_by
    ) ON CONFLICT (file_id, entity_type, entity_id, association_type) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER upload_sessions_auto_associate
  AFTER UPDATE ON upload_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION auto_associate_upload();

-- Increment download count on access token
CREATE OR REPLACE FUNCTION increment_download_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.access_token_id IS NOT NULL THEN
    UPDATE file_access_tokens
    SET 
      download_count = download_count + 1,
      last_accessed_at = NOW(),
      last_accessed_ip = NEW.ip_address
    WHERE id = NEW.access_token_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER file_downloads_increment
  AFTER INSERT ON file_downloads
  FOR EACH ROW
  EXECUTE FUNCTION increment_download_count();

-- ============================================
-- ROW LEVEL SECURITY: FILES
-- ============================================

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE files FORCE ROW LEVEL SECURITY;

CREATE POLICY files_select ON files
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
      -- Public files visible to all
      OR visibility = 'public'
    )
  );

CREATE POLICY files_insert ON files
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY files_update ON files
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::UUID,
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY files_delete ON files
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: FILE_ASSOCIATIONS
-- ============================================

ALTER TABLE file_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_associations FORCE ROW LEVEL SECURITY;

CREATE POLICY file_associations_select ON file_associations
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY file_associations_insert ON file_associations
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM files
      WHERE id = file_id
        AND files.tenant_id = file_associations.tenant_id
        AND files.deleted_at IS NULL
    )
  );

CREATE POLICY file_associations_update ON file_associations
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY file_associations_delete ON file_associations
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin', 'manager')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- ============================================
-- ROW LEVEL SECURITY: FILE_ACCESS_TOKENS
-- ============================================

ALTER TABLE file_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_access_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY file_access_tokens_select ON file_access_tokens
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY file_access_tokens_insert ON file_access_tokens
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND EXISTS (
      SELECT 1 FROM files
      WHERE id = file_id
        AND files.tenant_id = file_access_tokens.tenant_id
        AND files.deleted_at IS NULL
    )
  );

CREATE POLICY file_access_tokens_update ON file_access_tokens
  FOR UPDATE
  USING (false); -- Tokens are immutable

CREATE POLICY file_access_tokens_delete ON file_access_tokens
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- ============================================
-- ROW LEVEL SECURITY: FILE_DOWNLOADS
-- ============================================

ALTER TABLE file_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_downloads FORCE ROW LEVEL SECURITY;

CREATE POLICY file_downloads_select ON file_downloads
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY file_downloads_insert ON file_downloads
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- Downloads are immutable audit records
CREATE POLICY file_downloads_update ON file_downloads
  FOR UPDATE
  USING (false);

CREATE POLICY file_downloads_delete ON file_downloads
  FOR DELETE
  USING (false);

-- ============================================
-- ROW LEVEL SECURITY: UPLOAD_SESSIONS
-- ============================================

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY upload_sessions_select ON upload_sessions
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY upload_sessions_insert ON upload_sessions
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY upload_sessions_update ON upload_sessions
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY upload_sessions_delete ON upload_sessions
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
    AND tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Create upload session
CREATE OR REPLACE FUNCTION create_upload_session(
  p_original_filename TEXT,
  p_mime_type TEXT,
  p_file_size BIGINT,
  p_category file_category DEFAULT 'other',
  p_target_entity_type TEXT DEFAULT NULL,
  p_target_entity_id UUID DEFAULT NULL,
  p_total_chunks INT DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  storage_bucket TEXT,
  temp_storage_path TEXT,
  expires_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id UUID;
  v_session_token TEXT;
  v_tenant_id UUID;
  v_storage_bucket TEXT := 'uploads';
  v_temp_path TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context required';
  END IF;
  
  -- Generate paths
  v_session_id := uuid_generate_v4();
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_temp_path := v_tenant_id || '/temp/' || v_session_id || '/' || p_original_filename;
  v_expires := NOW() + INTERVAL '24 hours';
  
  INSERT INTO upload_sessions (
    id,
    tenant_id,
    session_token,
    original_filename,
    mime_type,
    file_size,
    category,
    target_entity_type,
    target_entity_id,
    total_chunks,
    storage_bucket,
    temp_storage_path,
    expires_at,
    created_by
  ) VALUES (
    v_session_id,
    v_tenant_id,
    v_session_token,
    p_original_filename,
    p_mime_type,
    p_file_size,
    p_category,
    p_target_entity_type,
    p_target_entity_id,
    p_total_chunks,
    v_storage_bucket,
    v_temp_path,
    v_expires,
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID
  );
  
  RETURN QUERY
  SELECT v_session_id, v_session_token, v_storage_bucket, v_temp_path, v_expires;
END;
$$;

-- Complete upload session and create file record
CREATE OR REPLACE FUNCTION complete_upload_session(
  p_session_token TEXT,
  p_stored_filename TEXT,
  p_storage_path TEXT,
  p_storage_url TEXT DEFAULT NULL,
  p_file_hash TEXT DEFAULT NULL,
  p_width INT DEFAULT NULL,
  p_height INT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_file_id UUID;
  v_session RECORD;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

  -- Get session
  SELECT * INTO v_session
  FROM upload_sessions
  WHERE session_token = p_session_token
    AND status IN ('initiated', 'uploading')
    AND expires_at > NOW();
  
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Upload session not found or expired';
  END IF;
  
  -- Tenant enforcement
  IF v_tenant_id IS NOT NULL
     AND (auth.jwt() ->> 'role') != 'superadmin'
     AND v_session.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Create file record
  INSERT INTO files (
    tenant_id,
    original_filename,
    stored_filename,
    storage_provider,
    storage_bucket,
    storage_path,
    storage_url,
    mime_type,
    file_size,
    file_hash,
    category,
    visibility,
    status,
    width,
    height,
    created_by,
    uploaded_by
  ) VALUES (
    v_session.tenant_id,
    v_session.original_filename,
    p_stored_filename,
    v_session.storage_provider,
    v_session.storage_bucket,
    p_storage_path,
    p_storage_url,
    v_session.mime_type,
    v_session.file_size,
    p_file_hash,
    v_session.category,
    'private',
    'ready',
    p_width,
    p_height,
    v_session.created_by,
    v_session.created_by
  ) RETURNING id INTO v_file_id;
  
  -- Update session
  UPDATE upload_sessions
  SET 
    status = 'completed',
    file_id = v_file_id,
    completed_at = NOW()
  WHERE id = v_session.id;
  
  RETURN v_file_id;
END;
$$;

-- Associate file with entity
CREATE OR REPLACE FUNCTION associate_file(
  p_file_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_association_type TEXT DEFAULT 'attachment',
  p_caption TEXT DEFAULT NULL,
  p_sort_order INT DEFAULT 0
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_association_id UUID;
  v_file RECORD;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

  -- Get file
  SELECT * INTO v_file
  FROM files
  WHERE id = p_file_id AND deleted_at IS NULL;
  
  IF v_file IS NULL THEN
    RAISE EXCEPTION 'File not found';
  END IF;
  
  -- Tenant enforcement
  IF v_tenant_id IS NOT NULL
     AND (auth.jwt() ->> 'role') != 'superadmin'
     AND v_file.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Create association
  INSERT INTO file_associations (
    file_id,
    tenant_id,
    entity_type,
    entity_id,
    association_type,
    caption,
    sort_order,
    created_by
  ) VALUES (
    p_file_id,
    v_file.tenant_id,
    p_entity_type,
    p_entity_id,
    p_association_type,
    p_caption,
    p_sort_order,
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID
  )
  ON CONFLICT (file_id, entity_type, entity_id, association_type) 
  DO UPDATE SET
    caption = COALESCE(EXCLUDED.caption, file_associations.caption),
    sort_order = EXCLUDED.sort_order
  RETURNING id INTO v_association_id;
  
  RETURN v_association_id;
END;
$$;

-- Get files for entity
CREATE OR REPLACE FUNCTION get_entity_files(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_association_type TEXT DEFAULT NULL,
  p_category file_category DEFAULT NULL
)
RETURNS TABLE (
  file_id UUID,
  file_number TEXT,
  original_filename TEXT,
  storage_url TEXT,
  cdn_url TEXT,
  thumbnail_url TEXT,
  mime_type TEXT,
  file_size BIGINT,
  category file_category,
  width INT,
  height INT,
  association_type TEXT,
  caption TEXT,
  sort_order INT,
  created_at TIMESTAMPTZ
)
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
  
  RETURN QUERY
  SELECT 
    f.id,
    f.file_number,
    f.original_filename,
    f.storage_url,
    f.cdn_url,
    f.thumbnail_url,
    f.mime_type,
    f.file_size,
    f.category,
    f.width,
    f.height,
    fa.association_type,
    fa.caption,
    fa.sort_order,
    f.created_at
  FROM files f
  JOIN file_associations fa ON fa.file_id = f.id
  WHERE fa.entity_type = p_entity_type
    AND fa.entity_id = p_entity_id
    AND f.deleted_at IS NULL
    AND f.status = 'ready'
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR f.tenant_id = v_tenant_id
      OR f.visibility = 'public'
    )
    AND (p_association_type IS NULL OR fa.association_type = p_association_type)
    AND (p_category IS NULL OR f.category = p_category)
  ORDER BY fa.sort_order, f.created_at;
END;
$$;

-- Create temporary access token
CREATE OR REPLACE FUNCTION create_file_access_token(
  p_file_id UUID,
  p_expires_in_hours INT DEFAULT 24,
  p_max_downloads INT DEFAULT NULL,
  p_ip_whitelist TEXT[] DEFAULT NULL
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_token TEXT;
  v_file RECORD;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

  -- Get file
  SELECT * INTO v_file
  FROM files
  WHERE id = p_file_id AND deleted_at IS NULL;
  
  IF v_file IS NULL THEN
    RAISE EXCEPTION 'File not found';
  END IF;
  
  -- Tenant enforcement
  IF v_tenant_id IS NOT NULL
     AND (auth.jwt() ->> 'role') != 'superadmin'
     AND v_file.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  v_token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO file_access_tokens (
    file_id,
    tenant_id,
    token,
    max_downloads,
    expires_at,
    ip_whitelist,
    created_by
  ) VALUES (
    p_file_id,
    v_file.tenant_id,
    v_token,
    p_max_downloads,
    NOW() + (p_expires_in_hours || ' hours')::INTERVAL,
    p_ip_whitelist,
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID
  );
  
  RETURN v_token;
END;
$$;

-- Get file by access token (public access)
CREATE OR REPLACE FUNCTION get_file_by_token(
  p_token TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  file_id UUID,
  original_filename TEXT,
  storage_url TEXT,
  cdn_url TEXT,
  mime_type TEXT,
  file_size BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Get and validate token
  SELECT * INTO v_token_record
  FROM file_access_tokens
  WHERE token = p_token
    AND expires_at > NOW()
    AND (max_downloads IS NULL OR download_count < max_downloads);
  
  IF v_token_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Check IP whitelist
  IF v_token_record.ip_whitelist IS NOT NULL 
     AND array_length(v_token_record.ip_whitelist, 1) > 0
     AND p_ip_address IS NOT NULL
     AND NOT (p_ip_address = ANY(v_token_record.ip_whitelist)) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    f.id,
    f.original_filename,
    f.storage_url,
    f.cdn_url,
    f.mime_type,
    f.file_size
  FROM files f
  WHERE f.id = v_token_record.file_id
    AND f.deleted_at IS NULL
    AND f.status = 'ready';
END;
$$;

-- Record file download
CREATE OR REPLACE FUNCTION record_file_download(
  p_file_id UUID,
  p_access_token_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_download_id UUID;
  v_file RECORD;
BEGIN
  SELECT * INTO v_file
  FROM files
  WHERE id = p_file_id AND deleted_at IS NULL;
  
  IF v_file IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO file_downloads (
    file_id,
    tenant_id,
    access_token_id,
    downloaded_by,
    ip_address,
    user_agent
  ) VALUES (
    p_file_id,
    v_file.tenant_id,
    p_access_token_id,
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_download_id;
  
  RETURN v_download_id;
END;
$$;

-- Soft delete file
CREATE OR REPLACE FUNCTION soft_delete_file(
  p_file_id UUID
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
  
  UPDATE files
  SET 
    deleted_at = NOW(),
    deleted_by = NULLIF(auth.jwt() ->> 'user_id', '')::UUID,
    status = 'deleted'
  WHERE id = p_file_id
    AND tenant_id = v_tenant_id
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Upload new version of file
CREATE OR REPLACE FUNCTION upload_file_version(
  p_parent_file_id UUID,
  p_stored_filename TEXT,
  p_storage_path TEXT,
  p_storage_url TEXT DEFAULT NULL,
  p_file_size BIGINT DEFAULT NULL,
  p_file_hash TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_file_id UUID;
  v_parent RECORD;
  v_tenant_id UUID;
  v_new_version INT;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );

  -- Get parent file
  SELECT * INTO v_parent
  FROM files
  WHERE id = p_parent_file_id AND deleted_at IS NULL;
  
  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'Parent file not found';
  END IF;
  
  -- Tenant enforcement
  IF v_tenant_id IS NOT NULL
     AND (auth.jwt() ->> 'role') != 'superadmin'
     AND v_parent.tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Get max version
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
  FROM files
  WHERE parent_file_id = p_parent_file_id OR id = p_parent_file_id;
  
  -- Create new version
  INSERT INTO files (
    tenant_id,
    original_filename,
    stored_filename,
    storage_provider,
    storage_bucket,
    storage_path,
    storage_url,
    mime_type,
    file_size,
    file_hash,
    category,
    visibility,
    status,
    version,
    parent_file_id,
    is_current_version,
    title,
    description,
    tags,
    created_by,
    uploaded_by
  ) VALUES (
    v_parent.tenant_id,
    v_parent.original_filename,
    p_stored_filename,
    v_parent.storage_provider,
    v_parent.storage_bucket,
    p_storage_path,
    p_storage_url,
    v_parent.mime_type,
    COALESCE(p_file_size, v_parent.file_size),
    p_file_hash,
    v_parent.category,
    v_parent.visibility,
    'ready',
    v_new_version,
    p_parent_file_id,
    true,
    v_parent.title,
    v_parent.description,
    v_parent.tags,
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID,
    NULLIF(auth.jwt() ->> 'user_id', '')::UUID
  ) RETURNING id INTO v_new_file_id;
  
  RETURN v_new_file_id;
END;
$$;

-- Get file versions
CREATE OR REPLACE FUNCTION get_file_versions(
  p_file_id UUID
)
RETURNS TABLE (
  file_id UUID,
  version INT,
  is_current BOOLEAN,
  storage_url TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ,
  uploaded_by_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_root_file_id UUID;
BEGIN
  v_tenant_id := COALESCE(
    (auth.jwt() ->> 'tenant_id')::UUID,
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
  );
  
  -- Find root file
  SELECT COALESCE(parent_file_id, id) INTO v_root_file_id
  FROM files
  WHERE id = p_file_id AND deleted_at IS NULL;
  
  IF v_root_file_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    f.id,
    f.version,
    f.is_current_version,
    f.storage_url,
    f.file_size,
    f.created_at,
    u.full_name
  FROM files f
  LEFT JOIN users u ON u.id = f.uploaded_by
  WHERE (f.id = v_root_file_id OR f.parent_file_id = v_root_file_id)
    AND f.deleted_at IS NULL
    AND (
      (auth.jwt() ->> 'role') = 'superadmin'
      OR f.tenant_id = v_tenant_id
    )
  ORDER BY f.version DESC;
END;
$$;

-- Search files
CREATE OR REPLACE FUNCTION search_files(
  p_query TEXT DEFAULT NULL,
  p_category file_category DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS SETOF files
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
  
  -- Guard against empty search
  IF p_query IS NULL AND p_category IS NULL AND p_mime_type IS NULL 
     AND p_entity_type IS NULL AND p_entity_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT DISTINCT f.*
  FROM files f
  LEFT JOIN file_associations fa ON fa.file_id = f.id
  WHERE f.tenant_id = v_tenant_id
    AND f.deleted_at IS NULL
    AND f.status = 'ready'
    AND (p_category IS NULL OR f.category = p_category)
    AND (p_mime_type IS NULL OR f.mime_type LIKE p_mime_type || '%')
    AND (p_entity_type IS NULL OR fa.entity_type = p_entity_type)
    AND (p_entity_id IS NULL OR fa.entity_id = p_entity_id)
    AND (
      p_query IS NULL OR
      to_tsvector('english', f.original_filename || ' ' || COALESCE(f.title, '') || ' ' || COALESCE(f.description, ''))
        @@ plainto_tsquery('english', p_query)
      OR f.original_filename ILIKE '%' || p_query || '%'
      OR f.title ILIKE '%' || p_query || '%'
    )
  ORDER BY f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Cleanup expired sessions (for scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_upload_sessions()
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH deleted AS (
    DELETE FROM upload_sessions
    WHERE expires_at < NOW()
      AND status NOT IN ('completed', 'cancelled')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;
  
  RETURN v_count;
END;
$$;

-- Cleanup expired access tokens (for scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_access_tokens()
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH deleted AS (
    DELETE FROM file_access_tokens
    WHERE expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;
  
  RETURN v_count;
END;
$$;

-- Get storage usage for tenant
CREATE OR REPLACE FUNCTION get_tenant_storage_usage()
RETURNS TABLE (
  total_files BIGINT,
  total_size_bytes BIGINT,
  total_size_formatted TEXT,
  by_category JSONB,
  by_status JSONB
)
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
  
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT,
    COALESCE(SUM(file_size), 0)::BIGINT,
    pg_size_pretty(COALESCE(SUM(file_size), 0)),
    (
      SELECT jsonb_object_agg(category, cnt)
      FROM (
        SELECT category, COUNT(*) as cnt
        FROM files
        WHERE tenant_id = v_tenant_id AND deleted_at IS NULL
        GROUP BY category
      ) sub
    ),
    (
      SELECT jsonb_object_agg(status, cnt)
      FROM (
        SELECT status, COUNT(*) as cnt
        FROM files
        WHERE tenant_id = v_tenant_id AND deleted_at IS NULL
        GROUP BY status
      ) sub
    )
  FROM files
  WHERE tenant_id = v_tenant_id
    AND deleted_at IS NULL;
END;
$$;
