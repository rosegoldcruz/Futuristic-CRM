-- ===========================================================
-- 019_METRICS.SQL
-- Analytics, Dashboards, Reports, Data Exports
-- Depends on: 000_common.sql, 005_tenants_users.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE metric_type AS ENUM (
  'count',
  'sum',
  'average',
  'percentage',
  'ratio',
  'currency',
  'duration',
  'rate'
);

CREATE TYPE metric_period AS ENUM (
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'all_time'
);

CREATE TYPE widget_type AS ENUM (
  'number',
  'chart_line',
  'chart_bar',
  'chart_pie',
  'chart_donut',
  'chart_area',
  'table',
  'list',
  'map',
  'funnel',
  'gauge',
  'heatmap',
  'custom'
);

CREATE TYPE report_status AS ENUM (
  'draft',
  'scheduled',
  'generating',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE export_format AS ENUM (
  'csv',
  'xlsx',
  'pdf',
  'json'
);

CREATE TYPE export_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'expired'
);

-- ============================================
-- METRIC_DEFINITIONS TABLE
-- ============================================

CREATE TABLE metric_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_key TEXT UNIQUE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = system metrics
  
  -- Metric identity
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'leads', 'quotes', 'jobs', 'revenue', 'marketing', 'operations'
  
  -- Type
  metric_type metric_type NOT NULL,
  
  -- Calculation
  source_table TEXT NOT NULL,
  source_column TEXT,
  aggregation TEXT, -- 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'
  filter_conditions JSONB DEFAULT '{}' CHECK (jsonb_typeof(filter_conditions) = 'object'),
  
  -- SQL (for complex metrics)
  custom_sql TEXT,
  
  -- Display
  format_string TEXT, -- e.g., '$#,##0.00', '0.0%'
  unit TEXT, -- 'dollars', 'percent', 'days', 'count'
  decimal_places INT DEFAULT 0,
  
  -- Comparison
  comparison_period metric_period,
  show_trend BOOLEAN DEFAULT true,
  
  -- Goals
  goal_value NUMERIC,
  goal_direction TEXT, -- 'higher', 'lower'
  warning_threshold NUMERIC,
  critical_threshold NUMERIC,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  
  -- Caching
  cache_duration_minutes INT DEFAULT 60,
  last_calculated_at TIMESTAMPTZ,
  last_value NUMERIC,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
) WITH (fillfactor = 90);

-- ============================================
-- METRIC_SNAPSHOTS TABLE
-- ============================================

CREATE TABLE metric_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Metric reference
  metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  
  -- Period
  period metric_period NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Value
  value NUMERIC NOT NULL,
  previous_value NUMERIC,
  change_value NUMERIC,
  change_percentage NUMERIC,
  
  -- Breakdown (optional)
  breakdown JSONB DEFAULT '{}' CHECK (jsonb_typeof(breakdown) = 'object'),
  -- { by_source: {...}, by_status: {...}, etc. }
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, metric_id, period, period_start)
) WITH (fillfactor = 90);

-- ============================================
-- DASHBOARDS TABLE
-- ============================================

CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Dashboard identity
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT,
  
  -- Layout
  layout JSONB DEFAULT '[]' CHECK (jsonb_typeof(layout) = 'array'),
  -- Array of { widget_id, x, y, width, height }
  
  -- Settings
  default_period metric_period DEFAULT 'monthly',
  auto_refresh_seconds INT,
  
  -- Sharing
  is_public BOOLEAN DEFAULT false,
  shared_with_roles TEXT[] DEFAULT '{}',
  shared_with_users UUID[] DEFAULT '{}',
  
  -- Status
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  created_by UUID,
  updated_by UUID,
  
  UNIQUE(tenant_id, slug)
) WITH (fillfactor = 90);

-- ============================================
-- DASHBOARD_WIDGETS TABLE
-- ============================================

CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Dashboard reference
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  
  -- Widget identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Type
  widget_type widget_type NOT NULL,
  
  -- Data source
  metric_ids UUID[] DEFAULT '{}', -- For metric-based widgets
  custom_query TEXT, -- For custom SQL widgets
  data_source JSONB DEFAULT '{}' CHECK (jsonb_typeof(data_source) = 'object'),
  
  -- Configuration
  config JSONB DEFAULT '{}' CHECK (jsonb_typeof(config) = 'object'),
  -- { chart_type, colors, show_legend, etc. }
  
  -- Filters
  filters JSONB DEFAULT '{}' CHECK (jsonb_typeof(filters) = 'object'),
  
  -- Display
  title TEXT,
  subtitle TEXT,
  icon TEXT,
  color TEXT,
  
  -- Size
  min_width INT DEFAULT 1,
  min_height INT DEFAULT 1,
  default_width INT DEFAULT 2,
  default_height INT DEFAULT 2,
  
  -- Interactivity
  drill_down_config JSONB DEFAULT '{}' CHECK (jsonb_typeof(drill_down_config) = 'object'),
  click_action TEXT, -- 'drill_down', 'navigate', 'filter', 'none'
  
  -- Refresh
  refresh_interval_seconds INT,
  
  -- Status
  is_visible BOOLEAN DEFAULT true,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- REPORTS TABLE
-- ============================================

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Report identity
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  
  -- Type
  report_type TEXT NOT NULL, -- 'leads', 'sales', 'operations', 'financial', 'custom'
  
  -- Configuration
  config JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(config) = 'object'),
  -- { columns, filters, grouping, sorting, etc. }
  
  -- Data source
  source_tables TEXT[],
  custom_sql TEXT,
  
  -- Filters
  default_filters JSONB DEFAULT '{}' CHECK (jsonb_typeof(default_filters) = 'object'),
  available_filters JSONB DEFAULT '[]' CHECK (jsonb_typeof(available_filters) = 'array'),
  
  -- Schedule
  is_scheduled BOOLEAN DEFAULT false,
  schedule_cron TEXT,
  schedule_timezone TEXT DEFAULT 'America/Phoenix',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  
  -- Recipients
  email_recipients TEXT[] DEFAULT '{}',
  
  -- Export settings
  default_format export_format DEFAULT 'pdf',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- REPORT_RUNS TABLE
-- ============================================

CREATE TABLE report_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Report reference
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  
  -- Run configuration
  filters_applied JSONB DEFAULT '{}' CHECK (jsonb_typeof(filters_applied) = 'object'),
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  
  -- Status
  status report_status NOT NULL DEFAULT 'generating',
  
  -- Output
  output_format export_format NOT NULL,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  file_url TEXT,
  file_size_bytes INT,
  
  -- Stats
  row_count INT,
  generation_time_ms INT,
  
  -- Error handling
  error_message TEXT,
  
  -- Triggered by
  triggered_by TEXT, -- 'user', 'schedule', 'api'
  triggered_by_id UUID,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- DATA_EXPORTS TABLE
-- ============================================

CREATE TABLE data_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  export_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Export identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- What to export
  entity_type TEXT NOT NULL, -- 'leads', 'quotes', 'jobs', 'homeowners', 'payments', etc.
  
  -- Filters
  filters JSONB DEFAULT '{}' CHECK (jsonb_typeof(filters) = 'object'),
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  
  -- Columns
  columns TEXT[] DEFAULT '{}', -- Empty = all columns
  column_mapping JSONB DEFAULT '{}' CHECK (jsonb_typeof(column_mapping) = 'object'),
  -- { db_column: display_name }
  
  -- Format
  format export_format NOT NULL DEFAULT 'csv',
  
  -- Options
  include_headers BOOLEAN DEFAULT true,
  include_deleted BOOLEAN DEFAULT false,
  
  -- Status
  status export_status NOT NULL DEFAULT 'pending',
  
  -- Output
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  file_url TEXT,
  file_size_bytes INT,
  row_count INT,
  
  -- Processing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_time_ms INT,
  
  -- Error handling
  error_message TEXT,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  download_count INT DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES
-- ============================================

-- metric_definitions
CREATE INDEX idx_metric_definitions_tenant ON metric_definitions(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_metric_definitions_key ON metric_definitions(metric_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_metric_definitions_category ON metric_definitions(category) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_metric_definitions_system ON metric_definitions(is_system) WHERE deleted_at IS NULL AND is_system = true;

-- metric_snapshots
CREATE INDEX idx_metric_snapshots_tenant ON metric_snapshots(tenant_id);
CREATE INDEX idx_metric_snapshots_metric ON metric_snapshots(metric_id);
CREATE INDEX idx_metric_snapshots_period ON metric_snapshots(tenant_id, metric_id, period, period_start DESC);
CREATE INDEX idx_metric_snapshots_date ON metric_snapshots(tenant_id, period_start DESC);

-- dashboards
CREATE INDEX idx_dashboards_tenant ON dashboards(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dashboards_slug ON dashboards(tenant_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_dashboards_default ON dashboards(tenant_id, is_default) WHERE deleted_at IS NULL AND is_default = true;
CREATE INDEX idx_dashboards_created_by ON dashboards(created_by) WHERE deleted_at IS NULL;

-- dashboard_widgets
CREATE INDEX idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX idx_dashboard_widgets_type ON dashboard_widgets(widget_type);
CREATE INDEX idx_dashboard_widgets_metrics ON dashboard_widgets USING GIN (metric_ids array_ops);

-- reports
CREATE INDEX idx_reports_tenant ON reports(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reports_type ON reports(tenant_id, report_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_reports_scheduled ON reports(next_run_at) WHERE is_scheduled = true AND is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_reports_created_by ON reports(created_by) WHERE deleted_at IS NULL;

-- report_runs
CREATE INDEX idx_report_runs_tenant ON report_runs(tenant_id);
CREATE INDEX idx_report_runs_report ON report_runs(report_id);
CREATE INDEX idx_report_runs_status ON report_runs(tenant_id, status);
CREATE INDEX idx_report_runs_created ON report_runs(tenant_id, created_at DESC);

-- data_exports
CREATE INDEX idx_data_exports_tenant ON data_exports(tenant_id);
CREATE INDEX idx_data_exports_status ON data_exports(tenant_id, status);
CREATE INDEX idx_data_exports_entity ON data_exports(tenant_id, entity_type);
CREATE INDEX idx_data_exports_created ON data_exports(tenant_id, created_at DESC);
CREATE INDEX idx_data_exports_created_by ON data_exports(created_by);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER metric_definitions_updated_at BEFORE UPDATE ON metric_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER dashboards_updated_at BEFORE UPDATE ON dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER data_exports_updated_at BEFORE UPDATE ON data_exports FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate dashboard number
CREATE OR REPLACE FUNCTION generate_dashboard_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.dashboard_number := 'DASH-' || next_tenant_sequence(NEW.tenant_id, 'dashboard');
  IF NEW.slug IS NULL THEN
    NEW.slug := LOWER(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dashboards_number BEFORE INSERT ON dashboards FOR EACH ROW EXECUTE FUNCTION generate_dashboard_number();

-- Generate report number
CREATE OR REPLACE FUNCTION generate_report_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.report_number := 'RPT-' || next_tenant_sequence(NEW.tenant_id, 'report');
  RETURN NEW;
END;
$$;

CREATE TRIGGER reports_number BEFORE INSERT ON reports FOR EACH ROW EXECUTE FUNCTION generate_report_number();

-- Generate report run number
CREATE OR REPLACE FUNCTION generate_report_run_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.run_number := 'RUN-' || next_tenant_sequence(NEW.tenant_id, 'report_run');
  RETURN NEW;
END;
$$;

CREATE TRIGGER report_runs_number BEFORE INSERT ON report_runs FOR EACH ROW EXECUTE FUNCTION generate_report_run_number();

-- Generate export number
CREATE OR REPLACE FUNCTION generate_export_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.export_number := 'EXP-' || next_tenant_sequence(NEW.tenant_id, 'data_export');
  NEW.expires_at := NOW() + INTERVAL '7 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER data_exports_number BEFORE INSERT ON data_exports FOR EACH ROW EXECUTE FUNCTION generate_export_number();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- metric_definitions
ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_definitions FORCE ROW LEVEL SECURITY;

CREATE POLICY metric_definitions_select ON metric_definitions FOR SELECT
  USING (deleted_at IS NULL AND (tenant_id IS NULL OR (auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY metric_definitions_insert ON metric_definitions FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND (tenant_id IS NULL OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY metric_definitions_update ON metric_definitions FOR UPDATE
  USING (deleted_at IS NULL AND NOT is_system AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY metric_definitions_delete ON metric_definitions FOR DELETE USING (false);

-- metric_snapshots
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY metric_snapshots_select ON metric_snapshots FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY metric_snapshots_insert ON metric_snapshots FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY metric_snapshots_update ON metric_snapshots FOR UPDATE USING (false);
CREATE POLICY metric_snapshots_delete ON metric_snapshots FOR DELETE USING (false);

-- dashboards
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards FORCE ROW LEVEL SECURITY;

CREATE POLICY dashboards_select ON dashboards FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY dashboards_insert ON dashboards FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY dashboards_update ON dashboards FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY dashboards_delete ON dashboards FOR DELETE USING (false);

-- dashboard_widgets
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets FORCE ROW LEVEL SECURITY;

CREATE POLICY dashboard_widgets_select ON dashboard_widgets FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY dashboard_widgets_insert ON dashboard_widgets FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM dashboards WHERE id = dashboard_id AND tenant_id = dashboard_widgets.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY dashboard_widgets_update ON dashboard_widgets FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY dashboard_widgets_delete ON dashboard_widgets FOR DELETE USING (false);

-- reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports FORCE ROW LEVEL SECURITY;

CREATE POLICY reports_select ON reports FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY reports_insert ON reports FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin', 'manager') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY reports_update ON reports FOR UPDATE
  USING (deleted_at IS NULL AND NOT is_system AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY reports_delete ON reports FOR DELETE USING (false);

-- report_runs
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY report_runs_select ON report_runs FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY report_runs_insert ON report_runs FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM reports WHERE id = report_id AND tenant_id = report_runs.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY report_runs_update ON report_runs FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY report_runs_delete ON report_runs FOR DELETE USING (false);

-- data_exports
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_exports FORCE ROW LEVEL SECURITY;

CREATE POLICY data_exports_select ON data_exports FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY data_exports_insert ON data_exports FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin', 'manager') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY data_exports_update ON data_exports FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY data_exports_delete ON data_exports FOR DELETE USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate metric value
CREATE OR REPLACE FUNCTION calculate_metric(
  p_metric_key TEXT,
  p_date_start TIMESTAMPTZ DEFAULT NULL,
  p_date_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_metric RECORD;
  v_result NUMERIC;
  v_sql TEXT;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  SELECT * INTO v_metric FROM metric_definitions WHERE metric_key = p_metric_key AND deleted_at IS NULL;
  IF v_metric IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF v_metric.custom_sql IS NOT NULL THEN
    v_sql := v_metric.custom_sql;
  ELSE
    v_sql := format('SELECT %s(%s) FROM %I WHERE tenant_id = $1',
      v_metric.aggregation,
      COALESCE(v_metric.source_column, '*'),
      v_metric.source_table
    );
    
    IF p_date_start IS NOT NULL THEN
      v_sql := v_sql || ' AND created_at >= $2';
    END IF;
    IF p_date_end IS NOT NULL THEN
      v_sql := v_sql || ' AND created_at <= $3';
    END IF;
  END IF;
  
  EXECUTE v_sql INTO v_result USING v_tenant_id, p_date_start, p_date_end;
  
  UPDATE metric_definitions SET last_calculated_at = NOW(), last_value = v_result WHERE id = v_metric.id;
  
  RETURN v_result;
END;
$$;

-- Snapshot metric
CREATE OR REPLACE FUNCTION snapshot_metric(
  p_metric_key TEXT,
  p_period metric_period,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_metric RECORD;
  v_value NUMERIC;
  v_previous_value NUMERIC;
  v_snapshot_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  SELECT * INTO v_metric FROM metric_definitions WHERE metric_key = p_metric_key AND deleted_at IS NULL;
  IF v_metric IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_value := calculate_metric(p_metric_key, p_period_start, p_period_end);
  
  SELECT value INTO v_previous_value
  FROM metric_snapshots
  WHERE tenant_id = v_tenant_id AND metric_id = v_metric.id AND period = p_period
  ORDER BY period_start DESC
  LIMIT 1;
  
  INSERT INTO metric_snapshots (
    tenant_id, metric_id, metric_key, period, period_start, period_end,
    value, previous_value, change_value, change_percentage
  )
  VALUES (
    v_tenant_id, v_metric.id, p_metric_key, p_period, p_period_start, p_period_end,
    v_value, v_previous_value,
    v_value - COALESCE(v_previous_value, 0),
    CASE WHEN v_previous_value > 0 THEN ((v_value - v_previous_value) / v_previous_value * 100) ELSE NULL END
  )
  ON CONFLICT (tenant_id, metric_id, period, period_start)
  DO UPDATE SET value = EXCLUDED.value, previous_value = EXCLUDED.previous_value,
    change_value = EXCLUDED.change_value, change_percentage = EXCLUDED.change_percentage,
    calculated_at = NOW()
  RETURNING id INTO v_snapshot_id;
  
  RETURN v_snapshot_id;
END;
$$;

-- Create data export
CREATE OR REPLACE FUNCTION create_data_export(
  p_entity_type TEXT,
  p_format export_format DEFAULT 'csv',
  p_filters JSONB DEFAULT '{}',
  p_columns TEXT[] DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_export_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO data_exports (tenant_id, name, entity_type, format, filters, columns, created_by)
  VALUES (
    v_tenant_id,
    'Export ' || p_entity_type || ' ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI'),
    p_entity_type, p_format, p_filters, p_columns,
    (auth.jwt() ->> 'user_id')::UUID
  )
  RETURNING id INTO v_export_id;
  
  RETURN v_export_id;
END;
$$;

-- Get dashboard with widgets
CREATE OR REPLACE FUNCTION get_dashboard_with_widgets(p_dashboard_id UUID)
RETURNS TABLE (
  dashboard JSONB,
  widgets JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    to_jsonb(d.*) AS dashboard,
    COALESCE(jsonb_agg(to_jsonb(w.*) ORDER BY w.created_at), '[]'::JSONB) AS widgets
  FROM dashboards d
  LEFT JOIN dashboard_widgets w ON w.dashboard_id = d.id
  WHERE d.id = p_dashboard_id AND d.deleted_at IS NULL
  GROUP BY d.id;
$$;

-- ============================================
-- DEFAULT METRIC DEFINITIONS
-- ============================================

INSERT INTO metric_definitions (metric_key, tenant_id, name, description, category, metric_type, source_table, aggregation, is_system) VALUES
  ('leads_total', NULL, 'Total Leads', 'Total number of leads', 'leads', 'count', 'leads', 'COUNT', true),
  ('leads_new_today', NULL, 'New Leads Today', 'Leads created today', 'leads', 'count', 'leads', 'COUNT', true),
  ('leads_conversion_rate', NULL, 'Lead Conversion Rate', 'Percentage of leads converted to quotes', 'leads', 'percentage', 'leads', 'AVG', true),
  ('quotes_total', NULL, 'Total Quotes', 'Total number of quotes', 'quotes', 'count', 'quotes', 'COUNT', true),
  ('quotes_value', NULL, 'Total Quote Value', 'Sum of all quote amounts', 'quotes', 'currency', 'quotes', 'SUM', true),
  ('quotes_accepted_rate', NULL, 'Quote Acceptance Rate', 'Percentage of quotes accepted', 'quotes', 'percentage', 'quotes', 'AVG', true),
  ('jobs_total', NULL, 'Total Jobs', 'Total number of jobs', 'jobs', 'count', 'jobs', 'COUNT', true),
  ('jobs_in_progress', NULL, 'Jobs In Progress', 'Currently active jobs', 'jobs', 'count', 'jobs', 'COUNT', true),
  ('jobs_completed_month', NULL, 'Jobs Completed This Month', 'Jobs completed in current month', 'jobs', 'count', 'jobs', 'COUNT', true),
  ('revenue_total', NULL, 'Total Revenue', 'Total revenue from payments', 'revenue', 'currency', 'payments', 'SUM', true),
  ('revenue_month', NULL, 'Monthly Revenue', 'Revenue for current month', 'revenue', 'currency', 'payments', 'SUM', true),
  ('avg_job_value', NULL, 'Average Job Value', 'Average value per job', 'revenue', 'currency', 'jobs', 'AVG', true)
ON CONFLICT (metric_key) DO NOTHING;
