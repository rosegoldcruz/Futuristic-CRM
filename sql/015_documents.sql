-- ===========================================================
-- 015_DOCUMENTS.SQL
-- Document Generation, Templates, E-Signatures
-- Depends on: 000_common.sql, 005_tenants_users.sql, 010_files.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE document_type AS ENUM (
  'quote',
  'invoice',
  'contract',
  'work_order',
  'change_order',
  'warranty',
  'receipt',
  'proposal',
  'agreement',
  'certificate',
  'report',
  'custom'
);

CREATE TYPE document_status AS ENUM (
  'draft',
  'pending_review',
  'pending_signature',
  'partially_signed',
  'signed',
  'approved',
  'rejected',
  'expired',
  'voided',
  'archived'
);

CREATE TYPE signature_status AS ENUM (
  'pending',
  'viewed',
  'signed',
  'declined',
  'expired'
);

CREATE TYPE recipient_role AS ENUM (
  'signer',
  'approver',
  'cc',
  'viewer'
);

-- ============================================
-- DOCUMENT_TEMPLATES TABLE
-- ============================================

CREATE TABLE document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Template identity
  name TEXT NOT NULL,
  description TEXT,
  document_type document_type NOT NULL,
  
  -- Content
  content_html TEXT NOT NULL,
  content_css TEXT,
  
  -- Variables available in template
  available_variables JSONB DEFAULT '[]' CHECK (jsonb_typeof(available_variables) = 'array'),
  -- Array of { name, type, description, default_value }
  
  -- Header/Footer
  header_html TEXT,
  footer_html TEXT,
  
  -- Page settings
  page_size TEXT DEFAULT 'letter', -- letter, legal, a4
  page_orientation TEXT DEFAULT 'portrait', -- portrait, landscape
  margin_top NUMERIC(5,2) DEFAULT 1,
  margin_bottom NUMERIC(5,2) DEFAULT 1,
  margin_left NUMERIC(5,2) DEFAULT 1,
  margin_right NUMERIC(5,2) DEFAULT 1,
  
  -- Signature settings
  requires_signature BOOLEAN DEFAULT false,
  signature_positions JSONB DEFAULT '[]' CHECK (jsonb_typeof(signature_positions) = 'array'),
  -- Array of { page, x, y, width, height, role, required }
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Versioning
  version INT DEFAULT 1,
  
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
-- DOCUMENTS TABLE
-- ============================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Template reference
  template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  
  -- Document identity
  name TEXT NOT NULL,
  description TEXT,
  document_type document_type NOT NULL,
  
  -- Status
  status document_status NOT NULL DEFAULT 'draft',
  
  -- Related entity
  entity_type TEXT, -- 'quote', 'job', 'homeowner', etc.
  entity_id UUID,
  
  -- Content
  content_html TEXT,
  rendered_html TEXT, -- With variables replaced
  
  -- Variables used
  variables JSONB DEFAULT '{}' CHECK (jsonb_typeof(variables) = 'object'),
  
  -- Generated files
  pdf_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  pdf_url TEXT,
  
  -- Signature tracking
  requires_signature BOOLEAN DEFAULT false,
  signature_count_required INT DEFAULT 0,
  signature_count_completed INT DEFAULT 0,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Sent tracking
  sent_at TIMESTAMPTZ,
  sent_to TEXT[], -- Email addresses
  sent_by UUID,
  
  -- Completion
  completed_at TIMESTAMPTZ,
  
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
-- DOCUMENT_VERSIONS TABLE
-- ============================================

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent document
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Version info
  version_number INT NOT NULL,
  
  -- Content snapshot
  content_html TEXT NOT NULL,
  rendered_html TEXT,
  variables JSONB DEFAULT '{}' CHECK (jsonb_typeof(variables) = 'object'),
  
  -- PDF snapshot
  pdf_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  
  -- Change info
  change_summary TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  
  UNIQUE(document_id, version_number)
) WITH (fillfactor = 90);

-- ============================================
-- DOCUMENT_RECIPIENTS TABLE
-- ============================================

CREATE TABLE document_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent document
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Recipient info
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  
  -- Role
  role recipient_role NOT NULL DEFAULT 'signer',
  
  -- Ordering (for sequential signing)
  signing_order INT DEFAULT 1,
  
  -- Status
  status signature_status NOT NULL DEFAULT 'pending',
  
  -- Access
  access_token TEXT UNIQUE,
  access_token_expires_at TIMESTAMPTZ,
  
  -- Tracking
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  
  -- Reminder tracking
  last_reminder_at TIMESTAMPTZ,
  reminder_count INT DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- DOCUMENT_SIGNATURES TABLE
-- ============================================

CREATE TABLE document_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent document
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES document_recipients(id) ON DELETE CASCADE,
  
  -- Signature position
  page_number INT NOT NULL DEFAULT 1,
  position_x NUMERIC(10, 2),
  position_y NUMERIC(10, 2),
  width NUMERIC(10, 2),
  height NUMERIC(10, 2),
  
  -- Signature data
  signature_type TEXT NOT NULL DEFAULT 'drawn', -- drawn, typed, uploaded
  signature_data TEXT NOT NULL, -- Base64 for drawn, text for typed, file_id for uploaded
  signature_hash TEXT,
  
  -- File reference
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  
  -- Signer info at time of signing
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_ip INET,
  
  -- Device/browser info
  user_agent TEXT,
  device_info JSONB DEFAULT '{}' CHECK (jsonb_typeof(device_info) = 'object'),
  
  -- Location
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  
  -- Legal
  consent_text TEXT,
  consented_at TIMESTAMPTZ,
  
  -- Timestamps
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES
-- ============================================

-- document_templates
CREATE INDEX idx_document_templates_tenant ON document_templates(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_templates_type ON document_templates(tenant_id, document_type) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_document_templates_default ON document_templates(tenant_id, document_type, is_default) WHERE deleted_at IS NULL AND is_default = true;

-- documents
CREATE INDEX idx_documents_tenant ON documents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_status ON documents(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_type ON documents(tenant_id, document_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_created ON documents(tenant_id, created_at DESC);
CREATE INDEX idx_documents_expires ON documents(expires_at) WHERE expires_at IS NOT NULL AND status = 'pending_signature';

-- document_versions
CREATE INDEX idx_document_versions_document ON document_versions(document_id);

-- document_recipients
CREATE INDEX idx_document_recipients_document ON document_recipients(document_id);
CREATE INDEX idx_document_recipients_email ON document_recipients(email);
CREATE INDEX idx_document_recipients_token ON document_recipients(access_token) WHERE access_token IS NOT NULL;
CREATE INDEX idx_document_recipients_status ON document_recipients(document_id, status);

-- document_signatures
CREATE INDEX idx_document_signatures_document ON document_signatures(document_id);
CREATE INDEX idx_document_signatures_recipient ON document_signatures(recipient_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER document_templates_updated_at BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER document_recipients_updated_at BEFORE UPDATE ON document_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate template number
CREATE OR REPLACE FUNCTION generate_template_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.template_number := 'TPL-' || next_tenant_sequence(NEW.tenant_id, 'document_template');
  RETURN NEW;
END;
$$;

CREATE TRIGGER document_templates_number BEFORE INSERT ON document_templates FOR EACH ROW EXECUTE FUNCTION generate_template_number();

-- Generate document number
CREATE OR REPLACE FUNCTION generate_document_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.document_number := 'DOC-' || next_tenant_sequence(NEW.tenant_id, 'document');
  RETURN NEW;
END;
$$;

CREATE TRIGGER documents_number BEFORE INSERT ON documents FOR EACH ROW EXECUTE FUNCTION generate_document_number();

-- Generate access token for recipients
CREATE OR REPLACE FUNCTION generate_recipient_access_token()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.access_token IS NULL THEN
    NEW.access_token := encode(gen_random_bytes(32), 'hex');
    NEW.access_token_expires_at := NOW() + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER document_recipients_token BEFORE INSERT ON document_recipients FOR EACH ROW EXECUTE FUNCTION generate_recipient_access_token();

-- Update document signature count
CREATE OR REPLACE FUNCTION update_document_signature_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_required INT;
  v_completed INT;
  v_doc_id UUID;
BEGIN
  v_doc_id := COALESCE(NEW.document_id, OLD.document_id);
  
  SELECT COUNT(*) INTO v_required FROM document_recipients WHERE document_id = v_doc_id AND role = 'signer';
  SELECT COUNT(*) INTO v_completed FROM document_recipients WHERE document_id = v_doc_id AND role = 'signer' AND status = 'signed';
  
  UPDATE documents
  SET 
    signature_count_required = v_required,
    signature_count_completed = v_completed,
    status = CASE
      WHEN v_completed = 0 THEN 'pending_signature'
      WHEN v_completed < v_required THEN 'partially_signed'
      WHEN v_completed >= v_required THEN 'signed'
      ELSE status
    END,
    completed_at = CASE WHEN v_completed >= v_required THEN NOW() ELSE completed_at END
  WHERE id = v_doc_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER document_recipients_count AFTER INSERT OR UPDATE OF status OR DELETE ON document_recipients FOR EACH ROW EXECUTE FUNCTION update_document_signature_count();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- document_templates
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY document_templates_select ON document_templates FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY document_templates_insert ON document_templates FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY document_templates_update ON document_templates FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR ((auth.jwt() ->> 'role') IN ('owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))));

CREATE POLICY document_templates_delete ON document_templates FOR DELETE USING (false);

-- documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE POLICY documents_select ON documents FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY documents_insert ON documents FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY documents_update ON documents FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY documents_delete ON documents FOR DELETE USING (false);

-- document_versions
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY document_versions_select ON document_versions FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY document_versions_insert ON document_versions FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY document_versions_update ON document_versions FOR UPDATE USING (false);
CREATE POLICY document_versions_delete ON document_versions FOR DELETE USING (false);

-- document_recipients
ALTER TABLE document_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_recipients FORCE ROW LEVEL SECURITY;

CREATE POLICY document_recipients_select ON document_recipients FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY document_recipients_insert ON document_recipients FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM documents WHERE id = document_id AND tenant_id = document_recipients.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY document_recipients_update ON document_recipients FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY document_recipients_delete ON document_recipients FOR DELETE USING (false);

-- document_signatures
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures FORCE ROW LEVEL SECURITY;

CREATE POLICY document_signatures_select ON document_signatures FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY document_signatures_insert ON document_signatures FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM documents WHERE id = document_id AND tenant_id = document_signatures.tenant_id AND deleted_at IS NULL)
    AND EXISTS (SELECT 1 FROM document_recipients WHERE id = recipient_id AND tenant_id = document_signatures.tenant_id)
  );

CREATE POLICY document_signatures_update ON document_signatures FOR UPDATE USING (false);
CREATE POLICY document_signatures_delete ON document_signatures FOR DELETE USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Create document from template
CREATE OR REPLACE FUNCTION create_document_from_template(
  p_template_id UUID,
  p_variables JSONB DEFAULT '{}',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_template RECORD;
  v_document_id UUID;
  v_rendered_html TEXT;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  SELECT * INTO v_template FROM document_templates WHERE id = p_template_id AND tenant_id = v_tenant_id AND deleted_at IS NULL;
  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  
  v_rendered_html := v_template.content_html;
  
  INSERT INTO documents (
    tenant_id, template_id, name, document_type, content_html, rendered_html,
    variables, entity_type, entity_id, requires_signature, created_by
  )
  VALUES (
    v_tenant_id, p_template_id, v_template.name, v_template.document_type,
    v_template.content_html, v_rendered_html, p_variables,
    p_entity_type, p_entity_id, v_template.requires_signature,
    (auth.jwt() ->> 'user_id')::UUID
  )
  RETURNING id INTO v_document_id;
  
  RETURN v_document_id;
END;
$$;

-- Send document for signature
CREATE OR REPLACE FUNCTION send_document_for_signature(
  p_document_id UUID,
  p_recipients JSONB -- Array of { email, name, role, signing_order }
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_recipient JSONB;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  FOR v_recipient IN SELECT * FROM jsonb_array_elements(p_recipients)
  LOOP
    INSERT INTO document_recipients (tenant_id, document_id, email, name, role, signing_order)
    VALUES (
      v_tenant_id,
      p_document_id,
      v_recipient->>'email',
      v_recipient->>'name',
      COALESCE((v_recipient->>'role')::recipient_role, 'signer'),
      COALESCE((v_recipient->>'signing_order')::INT, 1)
    );
  END LOOP;
  
  UPDATE documents
  SET status = 'pending_signature', sent_at = NOW(), sent_by = (auth.jwt() ->> 'user_id')::UUID
  WHERE id = p_document_id AND tenant_id = v_tenant_id;
  
  RETURN TRUE;
END;
$$;

-- Sign document
CREATE OR REPLACE FUNCTION sign_document(
  p_recipient_id UUID,
  p_signature_data TEXT,
  p_signature_type TEXT DEFAULT 'drawn',
  p_signer_ip INET DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_recipient RECORD;
  v_signature_id UUID;
BEGIN
  SELECT * INTO v_recipient FROM document_recipients WHERE id = p_recipient_id;
  IF v_recipient IS NULL THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;
  
  INSERT INTO document_signatures (
    tenant_id, document_id, recipient_id, signature_type, signature_data,
    signature_hash, signer_name, signer_email, signer_ip, latitude, longitude
  )
  VALUES (
    v_recipient.tenant_id, v_recipient.document_id, p_recipient_id,
    p_signature_type, p_signature_data, encode(sha256(p_signature_data::bytea), 'hex'),
    v_recipient.name, v_recipient.email, p_signer_ip, p_latitude, p_longitude
  )
  RETURNING id INTO v_signature_id;
  
  UPDATE document_recipients SET status = 'signed', signed_at = NOW() WHERE id = p_recipient_id;
  
  RETURN v_signature_id;
END;
$$;

-- Get document by access token
CREATE OR REPLACE FUNCTION get_document_by_token(p_token TEXT)
RETURNS TABLE (
  document_id UUID,
  recipient_id UUID,
  document_name TEXT,
  document_status document_status,
  recipient_status signature_status,
  pdf_url TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    d.id, dr.id, d.name, d.status, dr.status, d.pdf_url
  FROM document_recipients dr
  JOIN documents d ON d.id = dr.document_id
  WHERE dr.access_token = p_token
    AND dr.access_token_expires_at > NOW()
    AND d.deleted_at IS NULL;
$$;
