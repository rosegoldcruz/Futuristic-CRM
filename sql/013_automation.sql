-- ===========================================================
-- 013_AUTOMATION.SQL
-- AEON Rule Engine, AI Agents, Scheduled Tasks, Event System
-- Depends on: 000_common.sql, 005_tenants_users.sql, 012_settings.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE automation_trigger_type AS ENUM (
  'event',
  'schedule',
  'webhook',
  'manual',
  'condition',
  'ai_decision'
);

CREATE TYPE automation_action_type AS ENUM (
  'send_email',
  'send_sms',
  'create_task',
  'update_record',
  'create_record',
  'assign_user',
  'change_status',
  'add_tag',
  'remove_tag',
  'webhook',
  'delay',
  'condition',
  'ai_generate',
  'ai_classify',
  'notify_slack',
  'create_quote',
  'schedule_job',
  'run_script'
);

CREATE TYPE automation_status AS ENUM (
  'draft',
  'active',
  'paused',
  'archived',
  'error'
);

CREATE TYPE execution_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'retrying'
);

CREATE TYPE ai_agent_type AS ENUM (
  'lead_qualifier',
  'follow_up',
  'scheduler',
  'quote_generator',
  'support',
  'data_enrichment',
  'sentiment_analyzer',
  'custom'
);

CREATE TYPE schedule_frequency AS ENUM (
  'once',
  'minutely',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'cron'
);

-- ============================================
-- AUTOMATION_RULES TABLE
-- ============================================

CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Trigger configuration
  trigger_type automation_trigger_type NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(trigger_config) = 'object'),
  -- For event: { entity_type, event_name, filters }
  -- For schedule: { cron, timezone }
  -- For webhook: { path, method, secret }
  
  -- Conditions (when to run)
  conditions JSONB DEFAULT '[]' CHECK (jsonb_typeof(conditions) = 'array'),
  -- Array of { field, operator, value, logic }
  
  -- Actions (what to do)
  actions JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(actions) = 'array'),
  -- Array of { type, config, order, on_error }
  
  -- Execution settings
  status automation_status NOT NULL DEFAULT 'draft',
  priority INT NOT NULL DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  max_executions_per_hour INT DEFAULT 1000,
  retry_count INT DEFAULT 3,
  retry_delay_seconds INT DEFAULT 60,
  timeout_seconds INT DEFAULT 300,
  
  -- Targeting
  applies_to_entities TEXT[] DEFAULT '{}',
  excluded_entity_ids UUID[] DEFAULT '{}',
  
  -- Scheduling
  active_from TIMESTAMPTZ,
  active_until TIMESTAMPTZ,
  run_on_days INT[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun, 6=Sat
  run_start_time TIME,
  run_end_time TIME,
  timezone TEXT DEFAULT 'America/Phoenix',
  
  -- Stats
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  
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
-- AUTOMATION_RULE_VERSIONS TABLE
-- ============================================

CREATE TABLE automation_rule_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Parent rule
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  
  -- Snapshot of rule at this version
  rule_snapshot JSONB NOT NULL CHECK (jsonb_typeof(rule_snapshot) = 'object'),
  
  -- Change info
  change_summary TEXT,
  changed_fields TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  
  UNIQUE(rule_id, version_number)
) WITH (fillfactor = 90);

-- ============================================
-- AUTOMATION_EXECUTIONS TABLE
-- ============================================

CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule reference
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  rule_version INT,
  
  -- Trigger context
  trigger_type automation_trigger_type NOT NULL,
  trigger_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(trigger_data) = 'object'),
  
  -- Entity context
  entity_type TEXT,
  entity_id UUID,
  
  -- Execution status
  status execution_status NOT NULL DEFAULT 'pending',
  
  -- Progress
  current_action_index INT DEFAULT 0,
  total_actions INT DEFAULT 0,
  
  -- Results
  action_results JSONB DEFAULT '[]' CHECK (jsonb_typeof(action_results) = 'array'),
  -- Array of { action_index, status, result, error, duration_ms }
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- Retry info
  attempt_number INT DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  error_stack TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- AUTOMATION_QUEUE TABLE
-- ============================================

CREATE TABLE automation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- What to execute
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES automation_executions(id) ON DELETE SET NULL,
  
  -- Priority and scheduling
  priority INT NOT NULL DEFAULT 50,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Payload
  payload JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload) = 'object'),
  
  -- Processing
  status execution_status NOT NULL DEFAULT 'pending',
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  
  -- Attempts
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
) WITH (fillfactor = 90);

-- ============================================
-- AUTOMATION_ENTITY_TRACKING TABLE
-- ============================================

CREATE TABLE automation_entity_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Entity being tracked
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Rule tracking
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  
  -- State
  last_triggered_at TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  
  -- Cooldown
  cooldown_until TIMESTAMPTZ,
  
  -- Custom state for stateful automations
  state JSONB DEFAULT '{}' CHECK (jsonb_typeof(state) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, entity_type, entity_id, rule_id)
) WITH (fillfactor = 90);

-- ============================================
-- AI_AGENTS TABLE
-- ============================================

CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Agent identity
  name TEXT NOT NULL,
  description TEXT,
  type ai_agent_type NOT NULL,
  
  -- Model configuration
  model_provider TEXT NOT NULL DEFAULT 'openai', -- openai, anthropic, replicate
  model_name TEXT NOT NULL DEFAULT 'gpt-4o',
  
  -- Prompts
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT,
  
  -- Parameters
  temperature NUMERIC(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INT DEFAULT 1000,
  
  -- Tools/Functions
  available_tools JSONB DEFAULT '[]' CHECK (jsonb_typeof(available_tools) = 'array'),
  
  -- Rate limiting
  max_runs_per_hour INT DEFAULT 100,
  max_tokens_per_day INT DEFAULT 100000,
  
  -- Stats
  total_runs INT DEFAULT 0,
  total_tokens_used INT DEFAULT 0,
  average_latency_ms INT,
  success_rate NUMERIC(5,2),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
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
-- AI_AGENT_RUNS TABLE
-- ============================================

CREATE TABLE ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Agent reference
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  
  -- Context
  entity_type TEXT,
  entity_id UUID,
  triggered_by TEXT, -- 'automation', 'user', 'api'
  triggered_by_id UUID,
  
  -- Input
  input_data JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(input_data) = 'object'),
  resolved_prompt TEXT,
  
  -- Output
  output_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(output_data) = 'object'),
  raw_response TEXT,
  
  -- Status
  status execution_status NOT NULL DEFAULT 'pending',
  
  -- Metrics
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  latency_ms INT,
  cost_cents INT,
  
  -- Error handling
  error_message TEXT,
  error_code TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- SCHEDULED_TASKS TABLE
-- ============================================

CREATE TABLE scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Task identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Schedule
  frequency schedule_frequency NOT NULL,
  cron_expression TEXT, -- For cron frequency
  interval_value INT, -- For minutely/hourly
  timezone TEXT DEFAULT 'America/Phoenix',
  
  -- What to run
  task_type TEXT NOT NULL, -- 'automation_rule', 'report', 'cleanup', 'sync', 'custom'
  task_config JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(task_config) = 'object'),
  
  -- Execution
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status execution_status,
  last_run_duration_ms INT,
  last_error TEXT,
  
  -- Stats
  run_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
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
-- EVENT_SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE event_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Event to subscribe to
  event_name TEXT NOT NULL, -- 'lead.created', 'quote.sent', etc.
  entity_type TEXT, -- Optional filter by entity type
  
  -- Subscriber
  subscriber_type TEXT NOT NULL, -- 'automation_rule', 'webhook', 'ai_agent'
  subscriber_id UUID NOT NULL,
  
  -- Filters
  filters JSONB DEFAULT '{}' CHECK (jsonb_typeof(filters) = 'object'),
  
  -- Priority
  priority INT DEFAULT 50,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, event_name, subscriber_type, subscriber_id)
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES
-- ============================================

-- automation_rules
CREATE INDEX idx_automation_rules_tenant ON automation_rules(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_automation_rules_status ON automation_rules(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_automation_rules_trigger ON automation_rules(tenant_id, trigger_type) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_automation_rules_trigger_config ON automation_rules USING GIN (trigger_config jsonb_path_ops);
CREATE INDEX idx_automation_rules_entities ON automation_rules USING GIN (applies_to_entities array_ops);

-- automation_rule_versions
CREATE INDEX idx_automation_rule_versions_rule ON automation_rule_versions(rule_id);

-- automation_executions
CREATE INDEX idx_automation_executions_tenant ON automation_executions(tenant_id);
CREATE INDEX idx_automation_executions_rule ON automation_executions(rule_id);
CREATE INDEX idx_automation_executions_status ON automation_executions(tenant_id, status);
CREATE INDEX idx_automation_executions_entity ON automation_executions(entity_type, entity_id);
CREATE INDEX idx_automation_executions_created ON automation_executions(tenant_id, created_at DESC);

-- automation_queue
CREATE INDEX idx_automation_queue_pending ON automation_queue(scheduled_for, priority DESC) WHERE status = 'pending';
CREATE INDEX idx_automation_queue_tenant ON automation_queue(tenant_id);
CREATE INDEX idx_automation_queue_locked ON automation_queue(locked_by, locked_at) WHERE status = 'running';

-- automation_entity_tracking
CREATE INDEX idx_automation_entity_tracking_entity ON automation_entity_tracking(tenant_id, entity_type, entity_id);
CREATE INDEX idx_automation_entity_tracking_rule ON automation_entity_tracking(rule_id);
CREATE INDEX idx_automation_entity_tracking_cooldown ON automation_entity_tracking(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- ai_agents
CREATE INDEX idx_ai_agents_tenant ON ai_agents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ai_agents_type ON ai_agents(tenant_id, type) WHERE deleted_at IS NULL AND is_active = true;

-- ai_agent_runs
CREATE INDEX idx_ai_agent_runs_tenant ON ai_agent_runs(tenant_id);
CREATE INDEX idx_ai_agent_runs_agent ON ai_agent_runs(agent_id);
CREATE INDEX idx_ai_agent_runs_entity ON ai_agent_runs(entity_type, entity_id);
CREATE INDEX idx_ai_agent_runs_created ON ai_agent_runs(tenant_id, created_at DESC);
CREATE INDEX idx_ai_agent_runs_status ON ai_agent_runs(tenant_id, status);

-- scheduled_tasks
CREATE INDEX idx_scheduled_tasks_tenant ON scheduled_tasks(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_scheduled_tasks_type ON scheduled_tasks(tenant_id, task_type) WHERE deleted_at IS NULL;

-- event_subscriptions
CREATE INDEX idx_event_subscriptions_event ON event_subscriptions(tenant_id, event_name) WHERE is_active = true;
CREATE INDEX idx_event_subscriptions_subscriber ON event_subscriptions(subscriber_type, subscriber_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER automation_rule_versions_updated_at BEFORE UPDATE ON automation_rule_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER automation_executions_updated_at BEFORE UPDATE ON automation_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER automation_entity_tracking_updated_at BEFORE UPDATE ON automation_entity_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER scheduled_tasks_updated_at BEFORE UPDATE ON scheduled_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER event_subscriptions_updated_at BEFORE UPDATE ON event_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate entity numbers
CREATE OR REPLACE FUNCTION generate_automation_rule_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.rule_number := 'RULE-' || next_tenant_sequence(NEW.tenant_id, 'automation_rule');
  RETURN NEW;
END;
$$;

CREATE TRIGGER automation_rules_number BEFORE INSERT ON automation_rules FOR EACH ROW EXECUTE FUNCTION generate_automation_rule_number();

CREATE OR REPLACE FUNCTION generate_execution_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.execution_number := 'EXEC-' || next_tenant_sequence(NEW.tenant_id, 'automation_execution');
  RETURN NEW;
END;
$$;

CREATE TRIGGER automation_executions_number BEFORE INSERT ON automation_executions FOR EACH ROW EXECUTE FUNCTION generate_execution_number();

CREATE OR REPLACE FUNCTION generate_agent_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.agent_number := 'AGENT-' || next_tenant_sequence(NEW.tenant_id, 'ai_agent');
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_agents_number BEFORE INSERT ON ai_agents FOR EACH ROW EXECUTE FUNCTION generate_agent_number();

CREATE OR REPLACE FUNCTION generate_agent_run_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.run_number := 'RUN-' || next_tenant_sequence(NEW.tenant_id, 'ai_agent_run');
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_agent_runs_number BEFORE INSERT ON ai_agent_runs FOR EACH ROW EXECUTE FUNCTION generate_agent_run_number();

CREATE OR REPLACE FUNCTION generate_task_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.task_number := 'TASK-' || next_tenant_sequence(NEW.tenant_id, 'scheduled_task');
  RETURN NEW;
END;
$$;

CREATE TRIGGER scheduled_tasks_number BEFORE INSERT ON scheduled_tasks FOR EACH ROW EXECUTE FUNCTION generate_task_number();

-- Version tracking for rules
CREATE OR REPLACE FUNCTION track_automation_rule_version()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_version INT;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
  FROM automation_rule_versions
  WHERE rule_id = NEW.id;
  
  INSERT INTO automation_rule_versions (tenant_id, rule_id, version_number, rule_snapshot, created_by)
  VALUES (
    NEW.tenant_id,
    NEW.id,
    v_version,
    jsonb_build_object(
      'name', NEW.name,
      'trigger_type', NEW.trigger_type,
      'trigger_config', NEW.trigger_config,
      'conditions', NEW.conditions,
      'actions', NEW.actions,
      'status', NEW.status
    ),
    NEW.updated_by
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER automation_rules_version AFTER UPDATE ON automation_rules FOR EACH ROW
  WHEN (OLD.trigger_config IS DISTINCT FROM NEW.trigger_config OR OLD.conditions IS DISTINCT FROM NEW.conditions OR OLD.actions IS DISTINCT FROM NEW.actions)
  EXECUTE FUNCTION track_automation_rule_version();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- automation_rules
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY automation_rules_select ON automation_rules FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY automation_rules_insert ON automation_rules FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_rules_update ON automation_rules FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR ((auth.jwt() ->> 'role') IN ('owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))));

CREATE POLICY automation_rules_delete ON automation_rules FOR DELETE USING (false);

-- automation_rule_versions
ALTER TABLE automation_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rule_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY automation_rule_versions_select ON automation_rule_versions FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_rule_versions_insert ON automation_rule_versions FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_rule_versions_update ON automation_rule_versions FOR UPDATE USING (false);
CREATE POLICY automation_rule_versions_delete ON automation_rule_versions FOR DELETE USING (false);

-- automation_executions
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions FORCE ROW LEVEL SECURITY;

CREATE POLICY automation_executions_select ON automation_executions FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_executions_insert ON automation_executions FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_executions_update ON automation_executions FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_executions_delete ON automation_executions FOR DELETE USING (false);

-- automation_queue
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_queue FORCE ROW LEVEL SECURITY;

CREATE POLICY automation_queue_select ON automation_queue FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_queue_insert ON automation_queue FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_queue_update ON automation_queue FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_queue_delete ON automation_queue FOR DELETE USING (false);

-- automation_entity_tracking
ALTER TABLE automation_entity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_entity_tracking FORCE ROW LEVEL SECURITY;

CREATE POLICY automation_entity_tracking_select ON automation_entity_tracking FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_entity_tracking_insert ON automation_entity_tracking FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_entity_tracking_update ON automation_entity_tracking FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY automation_entity_tracking_delete ON automation_entity_tracking FOR DELETE USING (false);

-- ai_agents
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_agents_select ON ai_agents FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY ai_agents_insert ON ai_agents FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ai_agents_update ON ai_agents FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR ((auth.jwt() ->> 'role') IN ('owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))));

CREATE POLICY ai_agents_delete ON ai_agents FOR DELETE USING (false);

-- ai_agent_runs
ALTER TABLE ai_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_agent_runs_select ON ai_agent_runs FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ai_agent_runs_insert ON ai_agent_runs FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM ai_agents WHERE id = agent_id AND tenant_id = ai_agent_runs.tenant_id AND deleted_at IS NULL));

CREATE POLICY ai_agent_runs_update ON ai_agent_runs FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ai_agent_runs_delete ON ai_agent_runs FOR DELETE USING (false);

-- scheduled_tasks
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY scheduled_tasks_select ON scheduled_tasks FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY scheduled_tasks_insert ON scheduled_tasks FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY scheduled_tasks_update ON scheduled_tasks FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR ((auth.jwt() ->> 'role') IN ('owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))));

CREATE POLICY scheduled_tasks_delete ON scheduled_tasks FOR DELETE USING (false);

-- event_subscriptions
ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY event_subscriptions_select ON event_subscriptions FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY event_subscriptions_insert ON event_subscriptions FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY event_subscriptions_update ON event_subscriptions FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR ((auth.jwt() ->> 'role') IN ('owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY event_subscriptions_delete ON event_subscriptions FOR DELETE USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Queue an automation for execution
CREATE OR REPLACE FUNCTION queue_automation(
  p_rule_id UUID,
  p_payload JSONB DEFAULT '{}',
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  p_priority INT DEFAULT 50
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_queue_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO automation_queue (tenant_id, rule_id, payload, scheduled_for, priority)
  VALUES (v_tenant_id, p_rule_id, p_payload, p_scheduled_for, p_priority)
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$;

-- Get active rules for an event
CREATE OR REPLACE FUNCTION get_rules_for_event(
  p_event_name TEXT,
  p_entity_type TEXT DEFAULT NULL
)
RETURNS SETOF automation_rules
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  RETURN QUERY
  SELECT ar.*
  FROM automation_rules ar
  WHERE ar.tenant_id = v_tenant_id
    AND ar.deleted_at IS NULL
    AND ar.status = 'active'
    AND ar.trigger_type = 'event'
    AND ar.trigger_config->>'event_name' = p_event_name
    AND (p_entity_type IS NULL OR ar.trigger_config->>'entity_type' = p_entity_type OR ar.trigger_config->>'entity_type' IS NULL)
    AND (ar.active_from IS NULL OR ar.active_from <= NOW())
    AND (ar.active_until IS NULL OR ar.active_until > NOW())
  ORDER BY ar.priority DESC;
END;
$$;

-- Run AI agent
CREATE OR REPLACE FUNCTION run_ai_agent(
  p_agent_id UUID,
  p_input_data JSONB,
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
  v_run_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO ai_agent_runs (tenant_id, agent_id, input_data, entity_type, entity_id, triggered_by, triggered_by_id, status)
  VALUES (v_tenant_id, p_agent_id, p_input_data, p_entity_type, p_entity_id, 'user', (auth.jwt() ->> 'user_id')::UUID, 'pending')
  RETURNING id INTO v_run_id;
  
  RETURN v_run_id;
END;
$$;

-- Calculate next run time for scheduled task
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_frequency schedule_frequency,
  p_cron_expression TEXT DEFAULT NULL,
  p_interval_value INT DEFAULT NULL,
  p_last_run TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  CASE p_frequency
    WHEN 'once' THEN RETURN NULL;
    WHEN 'minutely' THEN RETURN p_last_run + (COALESCE(p_interval_value, 1) || ' minutes')::INTERVAL;
    WHEN 'hourly' THEN RETURN p_last_run + (COALESCE(p_interval_value, 1) || ' hours')::INTERVAL;
    WHEN 'daily' THEN RETURN p_last_run + '1 day'::INTERVAL;
    WHEN 'weekly' THEN RETURN p_last_run + '1 week'::INTERVAL;
    WHEN 'monthly' THEN RETURN p_last_run + '1 month'::INTERVAL;
    WHEN 'quarterly' THEN RETURN p_last_run + '3 months'::INTERVAL;
    WHEN 'yearly' THEN RETURN p_last_run + '1 year'::INTERVAL;
    ELSE RETURN p_last_run + '1 day'::INTERVAL;
  END CASE;
END;
$$;
