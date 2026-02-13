-- ===========================================================
-- 017_AR_VISUALIZER.SQL
-- Visualizer Sessions, Renders, Styles + AR Fox Engine
-- Depends on: 000_common.sql, 005_tenants_users.sql, 007_homeowners.sql, 010_files.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE render_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'expired'
);

CREATE TYPE render_quality AS ENUM (
  'preview',
  'standard',
  'high',
  'ultra'
);

CREATE TYPE style_category AS ENUM (
  'door_style',
  'color',
  'hardware',
  'countertop',
  'backsplash',
  'flooring',
  'lighting',
  'appliance'
);

CREATE TYPE ar_model_type AS ENUM (
  'cabinet',
  'door',
  'drawer',
  'hardware',
  'countertop',
  'appliance',
  'fox_mascot',
  'room',
  'custom'
);

CREATE TYPE ar_scene_status AS ENUM (
  'initializing',
  'scanning',
  'ready',
  'active',
  'paused',
  'ended'
);

-- ============================================
-- VISUALIZER_SESSIONS TABLE
-- ============================================

CREATE TABLE visualizer_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- User context
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE SET NULL,
  
  -- Session info
  session_token TEXT UNIQUE,
  
  -- Source
  source TEXT, -- 'website', 'portal', 'mobile_app', 'embed'
  referrer_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  -- Device info
  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen_width INT,
  screen_height INT,
  
  -- Location
  ip_address INET,
  city TEXT,
  state TEXT,
  country TEXT,
  
  -- Session stats
  render_count INT DEFAULT 0,
  photo_count INT DEFAULT 0,
  style_changes INT DEFAULT 0,
  
  -- Duration
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- Conversion
  converted_to_lead BOOLEAN DEFAULT false,
  lead_id UUID,
  converted_to_quote BOOLEAN DEFAULT false,
  quote_id UUID,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- VISUALIZER_RENDERS TABLE
-- ============================================

CREATE TABLE visualizer_renders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  render_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Session reference
  session_id UUID NOT NULL REFERENCES visualizer_sessions(id) ON DELETE CASCADE,
  
  -- Input image
  input_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  input_url TEXT,
  input_width INT,
  input_height INT,
  
  -- Output image
  output_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  output_url TEXT,
  output_width INT,
  output_height INT,
  thumbnail_url TEXT,
  
  -- Render settings
  quality render_quality NOT NULL DEFAULT 'standard',
  
  -- Style selections
  door_style TEXT,
  door_color TEXT,
  hardware_style TEXT,
  hardware_finish TEXT,
  countertop_style TEXT,
  backsplash_style TEXT,
  
  -- Full style config
  style_config JSONB DEFAULT '{}' CHECK (jsonb_typeof(style_config) = 'object'),
  
  -- AI prompts
  positive_prompt TEXT,
  negative_prompt TEXT,
  
  -- AI model info
  model_provider TEXT, -- 'replicate', 'openai', 'stability'
  model_name TEXT,
  model_version TEXT,
  
  -- Processing
  status render_status NOT NULL DEFAULT 'pending',
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Timing
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_time_ms INT,
  
  -- Cost tracking
  credits_used INT DEFAULT 1,
  cost_cents INT,
  
  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INT DEFAULT 0,
  
  -- User feedback
  user_rating INT CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,
  is_favorite BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
) WITH (fillfactor = 90);

-- ============================================
-- VISUALIZER_STYLES TABLE
-- ============================================

CREATE TABLE visualizer_styles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = system styles
  
  -- Style identity
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Category
  category style_category NOT NULL,
  
  -- Visual
  preview_image_url TEXT,
  swatch_color TEXT, -- Hex color for color swatches
  
  -- AI prompts
  prompt_keywords TEXT[],
  positive_prompt_addition TEXT,
  negative_prompt_addition TEXT,
  
  -- Pricing
  is_premium BOOLEAN DEFAULT false,
  credits_required INT DEFAULT 1,
  
  -- Availability
  is_active BOOLEAN NOT NULL DEFAULT true,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  
  -- Ordering
  sort_order INT DEFAULT 0,
  
  -- Stats
  usage_count INT DEFAULT 0,
  average_rating NUMERIC(3, 2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
) WITH (fillfactor = 90);

-- ============================================
-- VISUALIZER_ROOM_SCANS TABLE
-- ============================================

CREATE TABLE visualizer_room_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Session reference
  session_id UUID REFERENCES visualizer_sessions(id) ON DELETE SET NULL,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE SET NULL,
  
  -- Scan info
  name TEXT,
  room_type TEXT, -- 'kitchen', 'bathroom', 'laundry'
  
  -- Scan data
  scan_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(scan_data) = 'object'),
  -- Contains: dimensions, surfaces, detected_cabinets, etc.
  
  -- 3D model
  model_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  model_url TEXT,
  model_format TEXT, -- 'glb', 'gltf', 'usdz'
  
  -- Preview
  preview_image_url TEXT,
  
  -- Measurements
  width_inches NUMERIC(10, 2),
  depth_inches NUMERIC(10, 2),
  height_inches NUMERIC(10, 2),
  
  -- Detected elements
  cabinet_count INT,
  drawer_count INT,
  door_count INT,
  
  -- Quality
  scan_quality TEXT, -- 'low', 'medium', 'high'
  confidence_score NUMERIC(5, 2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
) WITH (fillfactor = 90);

-- ============================================
-- AR_MODELS TABLE
-- ============================================

CREATE TABLE ar_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_number TEXT UNIQUE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = system models
  
  -- Model identity
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Type
  model_type ar_model_type NOT NULL,
  
  -- Files
  glb_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  glb_url TEXT,
  usdz_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  usdz_url TEXT,
  
  -- Preview
  preview_image_url TEXT,
  thumbnail_url TEXT,
  
  -- Dimensions (in meters)
  width NUMERIC(10, 4),
  height NUMERIC(10, 4),
  depth NUMERIC(10, 4),
  
  -- Customization
  customizable_materials JSONB DEFAULT '[]' CHECK (jsonb_typeof(customizable_materials) = 'array'),
  -- Array of { name, type, default_value, options }
  
  -- AR settings
  ar_scale NUMERIC(10, 4) DEFAULT 1.0,
  ar_anchor_type TEXT DEFAULT 'horizontal', -- 'horizontal', 'vertical', 'any'
  
  -- Animation
  has_animation BOOLEAN DEFAULT false,
  animation_names TEXT[],
  
  -- LOD (Level of Detail)
  lod_levels JSONB DEFAULT '[]' CHECK (jsonb_typeof(lod_levels) = 'array'),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Stats
  view_count INT DEFAULT 0,
  ar_placement_count INT DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
) WITH (fillfactor = 90);

-- ============================================
-- AR_SCENES TABLE
-- ============================================

CREATE TABLE ar_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Session reference
  session_id UUID REFERENCES visualizer_sessions(id) ON DELETE SET NULL,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE SET NULL,
  
  -- Scene info
  name TEXT,
  
  -- Status
  status ar_scene_status NOT NULL DEFAULT 'initializing',
  
  -- Scene data
  scene_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(scene_data) = 'object'),
  -- Contains: camera_position, placed_models, lighting, etc.
  
  -- Placed models
  placed_models JSONB DEFAULT '[]' CHECK (jsonb_typeof(placed_models) = 'array'),
  -- Array of { model_id, position, rotation, scale, materials }
  
  -- Environment
  lighting_preset TEXT,
  environment_map TEXT,
  
  -- Capture
  screenshot_urls TEXT[],
  video_url TEXT,
  
  -- Device info
  device_type TEXT,
  ar_framework TEXT, -- 'arkit', 'arcore', 'webxr'
  
  -- Duration
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- AR_ANALYTICS TABLE
-- ============================================

CREATE TABLE ar_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Context
  session_id UUID REFERENCES visualizer_sessions(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES ar_scenes(id) ON DELETE SET NULL,
  
  -- Event
  event_type TEXT NOT NULL, -- 'ar_start', 'model_placed', 'screenshot', 'share', etc.
  event_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(event_data) = 'object'),
  
  -- Model reference
  model_id UUID REFERENCES ar_models(id) ON DELETE SET NULL,
  
  -- Device info
  device_type TEXT,
  ar_supported BOOLEAN,
  ar_framework TEXT,
  
  -- Timing
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_time_seconds INT,
  
  -- Location
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES
-- ============================================

-- visualizer_sessions
CREATE INDEX idx_visualizer_sessions_tenant ON visualizer_sessions(tenant_id);
CREATE INDEX idx_visualizer_sessions_token ON visualizer_sessions(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX idx_visualizer_sessions_user ON visualizer_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_visualizer_sessions_homeowner ON visualizer_sessions(homeowner_id) WHERE homeowner_id IS NOT NULL;
CREATE INDEX idx_visualizer_sessions_created ON visualizer_sessions(tenant_id, created_at DESC);
CREATE INDEX idx_visualizer_sessions_converted ON visualizer_sessions(tenant_id, converted_to_lead) WHERE converted_to_lead = true;

-- visualizer_renders
CREATE INDEX idx_visualizer_renders_tenant ON visualizer_renders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_visualizer_renders_session ON visualizer_renders(session_id);
CREATE INDEX idx_visualizer_renders_status ON visualizer_renders(tenant_id, status);
CREATE INDEX idx_visualizer_renders_created ON visualizer_renders(tenant_id, created_at DESC);
CREATE INDEX idx_visualizer_renders_favorites ON visualizer_renders(session_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_visualizer_renders_style ON visualizer_renders(door_style, door_color);

-- visualizer_styles
CREATE INDEX idx_visualizer_styles_tenant ON visualizer_styles(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_visualizer_styles_category ON visualizer_styles(category) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_visualizer_styles_active ON visualizer_styles(is_active, sort_order) WHERE deleted_at IS NULL;

-- visualizer_room_scans
CREATE INDEX idx_visualizer_room_scans_tenant ON visualizer_room_scans(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_visualizer_room_scans_session ON visualizer_room_scans(session_id);
CREATE INDEX idx_visualizer_room_scans_homeowner ON visualizer_room_scans(homeowner_id) WHERE homeowner_id IS NOT NULL;

-- ar_models
CREATE INDEX idx_ar_models_tenant ON ar_models(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ar_models_type ON ar_models(model_type) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_ar_models_active ON ar_models(is_active) WHERE deleted_at IS NULL;

-- ar_scenes
CREATE INDEX idx_ar_scenes_tenant ON ar_scenes(tenant_id);
CREATE INDEX idx_ar_scenes_session ON ar_scenes(session_id);
CREATE INDEX idx_ar_scenes_homeowner ON ar_scenes(homeowner_id) WHERE homeowner_id IS NOT NULL;
CREATE INDEX idx_ar_scenes_status ON ar_scenes(tenant_id, status);

-- ar_analytics
CREATE INDEX idx_ar_analytics_tenant ON ar_analytics(tenant_id);
CREATE INDEX idx_ar_analytics_session ON ar_analytics(session_id);
CREATE INDEX idx_ar_analytics_scene ON ar_analytics(scene_id);
CREATE INDEX idx_ar_analytics_event ON ar_analytics(tenant_id, event_type);
CREATE INDEX idx_ar_analytics_created ON ar_analytics(tenant_id, created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER visualizer_sessions_updated_at BEFORE UPDATE ON visualizer_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER visualizer_renders_updated_at BEFORE UPDATE ON visualizer_renders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER visualizer_styles_updated_at BEFORE UPDATE ON visualizer_styles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER visualizer_room_scans_updated_at BEFORE UPDATE ON visualizer_room_scans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ar_models_updated_at BEFORE UPDATE ON ar_models FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ar_scenes_updated_at BEFORE UPDATE ON ar_scenes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate session number
CREATE OR REPLACE FUNCTION generate_visualizer_session_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.session_number := 'VIS-' || next_tenant_sequence(NEW.tenant_id, 'visualizer_session');
  NEW.session_token := encode(gen_random_bytes(16), 'hex');
  RETURN NEW;
END;
$$;

CREATE TRIGGER visualizer_sessions_number BEFORE INSERT ON visualizer_sessions FOR EACH ROW EXECUTE FUNCTION generate_visualizer_session_number();

-- Generate render number
CREATE OR REPLACE FUNCTION generate_render_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.render_number := 'RND-' || next_tenant_sequence(NEW.tenant_id, 'visualizer_render');
  RETURN NEW;
END;
$$;

CREATE TRIGGER visualizer_renders_number BEFORE INSERT ON visualizer_renders FOR EACH ROW EXECUTE FUNCTION generate_render_number();

-- Generate scan number
CREATE OR REPLACE FUNCTION generate_scan_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.scan_number := 'SCAN-' || next_tenant_sequence(NEW.tenant_id, 'room_scan');
  RETURN NEW;
END;
$$;

CREATE TRIGGER visualizer_room_scans_number BEFORE INSERT ON visualizer_room_scans FOR EACH ROW EXECUTE FUNCTION generate_scan_number();

-- Generate model number
CREATE OR REPLACE FUNCTION generate_ar_model_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    NEW.model_number := 'MDL-' || next_tenant_sequence(NEW.tenant_id, 'ar_model');
  ELSE
    NEW.model_number := 'SYS-MDL-' || LPAD(nextval('ar_model_system_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS ar_model_system_seq START 1;
CREATE TRIGGER ar_models_number BEFORE INSERT ON ar_models FOR EACH ROW EXECUTE FUNCTION generate_ar_model_number();

-- Generate scene number
CREATE OR REPLACE FUNCTION generate_ar_scene_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.scene_number := 'AR-' || next_tenant_sequence(NEW.tenant_id, 'ar_scene');
  RETURN NEW;
END;
$$;

CREATE TRIGGER ar_scenes_number BEFORE INSERT ON ar_scenes FOR EACH ROW EXECUTE FUNCTION generate_ar_scene_number();

-- Update session stats on render
CREATE OR REPLACE FUNCTION update_session_render_stats()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE visualizer_sessions
  SET 
    render_count = render_count + 1,
    last_activity_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER visualizer_renders_session_stats AFTER INSERT ON visualizer_renders FOR EACH ROW EXECUTE FUNCTION update_session_render_stats();

-- Update style usage count
CREATE OR REPLACE FUNCTION update_style_usage()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.door_style IS NOT NULL THEN
    UPDATE visualizer_styles SET usage_count = usage_count + 1 WHERE name = NEW.door_style;
  END IF;
  IF NEW.door_color IS NOT NULL THEN
    UPDATE visualizer_styles SET usage_count = usage_count + 1 WHERE name = NEW.door_color;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER visualizer_renders_style_usage AFTER INSERT ON visualizer_renders FOR EACH ROW EXECUTE FUNCTION update_style_usage();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- visualizer_sessions
ALTER TABLE visualizer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualizer_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY visualizer_sessions_select ON visualizer_sessions FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY visualizer_sessions_insert ON visualizer_sessions FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY visualizer_sessions_update ON visualizer_sessions FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY visualizer_sessions_delete ON visualizer_sessions FOR DELETE USING (false);

-- visualizer_renders
ALTER TABLE visualizer_renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualizer_renders FORCE ROW LEVEL SECURITY;

CREATE POLICY visualizer_renders_select ON visualizer_renders FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY visualizer_renders_insert ON visualizer_renders FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM visualizer_sessions WHERE id = session_id AND tenant_id = visualizer_renders.tenant_id)
  );

CREATE POLICY visualizer_renders_update ON visualizer_renders FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY visualizer_renders_delete ON visualizer_renders FOR DELETE USING (false);

-- visualizer_styles
ALTER TABLE visualizer_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualizer_styles FORCE ROW LEVEL SECURITY;

CREATE POLICY visualizer_styles_select ON visualizer_styles FOR SELECT
  USING (deleted_at IS NULL AND (tenant_id IS NULL OR (auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY visualizer_styles_insert ON visualizer_styles FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND (tenant_id IS NULL OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY visualizer_styles_update ON visualizer_styles FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR (tenant_id IS NOT NULL AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))));

CREATE POLICY visualizer_styles_delete ON visualizer_styles FOR DELETE USING (false);

-- visualizer_room_scans
ALTER TABLE visualizer_room_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualizer_room_scans FORCE ROW LEVEL SECURITY;

CREATE POLICY visualizer_room_scans_select ON visualizer_room_scans FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY visualizer_room_scans_insert ON visualizer_room_scans FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY visualizer_room_scans_update ON visualizer_room_scans FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY visualizer_room_scans_delete ON visualizer_room_scans FOR DELETE USING (false);

-- ar_models
ALTER TABLE ar_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_models FORCE ROW LEVEL SECURITY;

CREATE POLICY ar_models_select ON ar_models FOR SELECT
  USING (deleted_at IS NULL AND (tenant_id IS NULL OR (auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY ar_models_insert ON ar_models FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin'));

CREATE POLICY ar_models_update ON ar_models FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR (tenant_id IS NOT NULL AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))));

CREATE POLICY ar_models_delete ON ar_models FOR DELETE USING (false);

-- ar_scenes
ALTER TABLE ar_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_scenes FORCE ROW LEVEL SECURITY;

CREATE POLICY ar_scenes_select ON ar_scenes FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ar_scenes_insert ON ar_scenes FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ar_scenes_update ON ar_scenes FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ar_scenes_delete ON ar_scenes FOR DELETE USING (false);

-- ar_analytics
ALTER TABLE ar_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_analytics FORCE ROW LEVEL SECURITY;

CREATE POLICY ar_analytics_select ON ar_analytics FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ar_analytics_insert ON ar_analytics FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ar_analytics_update ON ar_analytics FOR UPDATE USING (false);
CREATE POLICY ar_analytics_delete ON ar_analytics FOR DELETE USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Create visualizer session
CREATE OR REPLACE FUNCTION create_visualizer_session(
  p_source TEXT DEFAULT 'website',
  p_homeowner_id UUID DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_session_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO visualizer_sessions (tenant_id, user_id, homeowner_id, source, device_type, ip_address)
  VALUES (v_tenant_id, (auth.jwt() ->> 'user_id')::UUID, p_homeowner_id, p_source, p_device_type, p_ip_address)
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

-- Queue render
CREATE OR REPLACE FUNCTION queue_visualizer_render(
  p_session_id UUID,
  p_input_url TEXT,
  p_style_config JSONB,
  p_quality render_quality DEFAULT 'standard'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_render_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO visualizer_renders (
    tenant_id, session_id, input_url, style_config, quality,
    door_style, door_color, hardware_style, hardware_finish,
    status, queued_at
  )
  VALUES (
    v_tenant_id, p_session_id, p_input_url, p_style_config, p_quality,
    p_style_config->>'door_style', p_style_config->>'door_color',
    p_style_config->>'hardware_style', p_style_config->>'hardware_finish',
    'pending', NOW()
  )
  RETURNING id INTO v_render_id;
  
  RETURN v_render_id;
END;
$$;

-- Get active styles
CREATE OR REPLACE FUNCTION get_visualizer_styles(p_category style_category DEFAULT NULL)
RETURNS SETOF visualizer_styles
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT * FROM visualizer_styles
  WHERE deleted_at IS NULL
    AND is_active = true
    AND (p_category IS NULL OR category = p_category)
    AND (available_from IS NULL OR available_from <= NOW())
    AND (available_until IS NULL OR available_until > NOW())
  ORDER BY sort_order, display_name;
$$;

-- Convert session to lead
CREATE OR REPLACE FUNCTION convert_session_to_lead(
  p_session_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_lead_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO leads (tenant_id, name, phone, email, source, source_details)
  VALUES (v_tenant_id, p_name, p_phone, p_email, 'visualizer', jsonb_build_object('session_id', p_session_id))
  RETURNING id INTO v_lead_id;
  
  UPDATE visualizer_sessions
  SET converted_to_lead = true, lead_id = v_lead_id
  WHERE id = p_session_id;
  
  RETURN v_lead_id;
END;
$$;

-- ============================================
-- DEFAULT STYLES
-- ============================================

INSERT INTO visualizer_styles (tenant_id, name, display_name, category, swatch_color, sort_order, prompt_keywords) VALUES
  -- Door styles
  (NULL, 'shaker_classic', 'Shaker Classic', 'door_style', NULL, 1, ARRAY['shaker', 'classic', 'traditional']),
  (NULL, 'shaker_slim', 'Shaker Slim', 'door_style', NULL, 2, ARRAY['shaker', 'slim', 'modern']),
  (NULL, 'slab', 'Slab', 'door_style', NULL, 3, ARRAY['slab', 'flat', 'modern', 'minimalist']),
  (NULL, 'raised_panel', 'Raised Panel', 'door_style', NULL, 4, ARRAY['raised panel', 'traditional', 'classic']),
  (NULL, 'beadboard', 'Beadboard', 'door_style', NULL, 5, ARRAY['beadboard', 'cottage', 'farmhouse']),
  
  -- Colors
  (NULL, 'pure_white', 'Pure White', 'color', '#FFFFFF', 1, ARRAY['white', 'pure white', 'bright white']),
  (NULL, 'soft_white', 'Soft White', 'color', '#F5F5F0', 2, ARRAY['soft white', 'off white', 'cream']),
  (NULL, 'dove_gray', 'Dove Gray', 'color', '#6B7280', 3, ARRAY['gray', 'dove gray', 'medium gray']),
  (NULL, 'navy_blue', 'Navy Blue', 'color', '#1E3A5F', 4, ARRAY['navy', 'blue', 'dark blue']),
  (NULL, 'sage_green', 'Sage Green', 'color', '#9CAF88', 5, ARRAY['sage', 'green', 'sage green']),
  (NULL, 'espresso', 'Espresso', 'color', '#3E2723', 6, ARRAY['espresso', 'dark brown', 'brown']),
  (NULL, 'natural_oak', 'Natural Oak', 'color', '#C4A35A', 7, ARRAY['oak', 'natural', 'wood grain']),
  
  -- Hardware finishes
  (NULL, 'brushed_nickel', 'Brushed Nickel', 'hardware', '#C0C0C0', 1, ARRAY['brushed nickel', 'silver', 'satin nickel']),
  (NULL, 'matte_black', 'Matte Black', 'hardware', '#1A1A1A', 2, ARRAY['matte black', 'black', 'flat black']),
  (NULL, 'polished_chrome', 'Polished Chrome', 'hardware', '#E8E8E8', 3, ARRAY['chrome', 'polished chrome', 'shiny']),
  (NULL, 'brass', 'Brass', 'hardware', '#B5A642', 4, ARRAY['brass', 'gold', 'antique brass']),
  (NULL, 'oil_rubbed_bronze', 'Oil Rubbed Bronze', 'hardware', '#3D2B1F', 5, ARRAY['bronze', 'oil rubbed bronze', 'dark bronze'])
ON CONFLICT DO NOTHING;
