-- ============================================
-- VULPINE CRM: CALL EVENTS TABLE (v2)
-- VICIdial + WebRTC Integration
-- Full RLS, Soft Delete, Auditing
-- ============================================
-- MIGRATION ORDER: 002
-- Depends on: 001 (leads + tenant_sequences)
-- Uses: leads table, next_tenant_sequence function
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE call_direction AS ENUM (
  'inbound',
  'outbound'
);

CREATE TYPE call_status AS ENUM (
  'initiated',
  'ringing',
  'in_progress',
  'completed',
  'no_answer',
  'busy',
  'failed',
  'voicemail',
  'cancelled'
);

CREATE TYPE call_disposition AS ENUM (
  'interested',
  'not_interested',
  'callback_requested',
  'wrong_number',
  'disconnected',
  'do_not_call',
  'left_voicemail',
  'appointment_set',
  'quote_requested',
  'sale',
  'other'
);

CREATE TYPE call_source AS ENUM (
  'vicidial',
  'webrtc',
  'twilio',
  'manual',
  'other'
);

-- ============================================
-- CALL EVENTS TABLE
-- ============================================

CREATE TABLE call_events (
  -- Storage optimization for high-write table
  -- fillfactor 90 leaves room for HOT updates
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Human-readable ID
  call_number TEXT UNIQUE,

  -- Tenant isolation
  tenant_id UUID NOT NULL,

  -- Relationships
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  homeowner_id UUID, -- Will reference homeowners table when created

  -- Agent info
  agent_user_id UUID, -- Will reference users table when created
  agent_name TEXT, -- Denormalized for reporting
  agent_extension TEXT,

  -- Call details
  direction call_direction NOT NULL,
  status call_status NOT NULL DEFAULT 'initiated',
  disposition call_disposition,
  source call_source NOT NULL DEFAULT 'vicidial',

  -- Phone numbers
  from_number TEXT,
  to_number TEXT,

  -- Timing
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  ring_duration_seconds INT DEFAULT 0,
  hold_duration_seconds INT DEFAULT 0,

  -- Recording
  recording_url TEXT,
  recording_duration_seconds INT,
  recording_storage_path TEXT,

  -- VICIdial specific fields
  vicidial_call_id TEXT,
  vicidial_lead_id TEXT,
  vicidial_campaign_id TEXT,
  vicidial_list_id TEXT,
  vicidial_user TEXT,
  vicidial_phone_code TEXT,

  -- Call quality metrics
  quality_score NUMERIC(3,2) CHECK (quality_score >= 0 AND quality_score <= 5),

  -- Notes and metadata
  notes TEXT,
  call_script_used TEXT,
  raw_payload JSONB DEFAULT '{}' CHECK (jsonb_typeof(raw_payload) = 'object'),
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  -- Audit
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookups
CREATE INDEX idx_call_events_tenant_id ON call_events(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_call_events_lead_id ON call_events(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_call_events_homeowner_id ON call_events(homeowner_id) WHERE deleted_at IS NULL AND homeowner_id IS NOT NULL;
CREATE INDEX idx_call_events_agent_user_id ON call_events(tenant_id, agent_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_call_events_status ON call_events(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_call_events_disposition ON call_events(tenant_id, disposition) WHERE deleted_at IS NULL;
CREATE INDEX idx_call_events_direction ON call_events(tenant_id, direction) WHERE deleted_at IS NULL;

-- Time-based queries
CREATE INDEX idx_call_events_initiated_at ON call_events(tenant_id, initiated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_call_events_date ON call_events(tenant_id, DATE(initiated_at)) WHERE deleted_at IS NULL;

-- Phone number lookups
CREATE INDEX idx_call_events_from_number ON call_events(from_number) WHERE deleted_at IS NULL AND from_number IS NOT NULL;
CREATE INDEX idx_call_events_to_number ON call_events(to_number) WHERE deleted_at IS NULL AND to_number IS NOT NULL;

-- VICIdial lookups
CREATE INDEX idx_call_events_vicidial_call_id ON call_events(vicidial_call_id) WHERE vicidial_call_id IS NOT NULL;
CREATE INDEX idx_call_events_vicidial_campaign ON call_events(tenant_id, vicidial_campaign_id) WHERE deleted_at IS NULL AND vicidial_campaign_id IS NOT NULL;

-- GIN indexes for JSONB (with proper operator class)
CREATE INDEX idx_call_events_raw_payload_gin ON call_events USING GIN (raw_payload jsonb_path_ops);
CREATE INDEX idx_call_events_metadata_gin ON call_events USING GIN (metadata jsonb_path_ops);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-generate call_number and set created_by
CREATE OR REPLACE FUNCTION generate_call_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.call_number IS NULL THEN
    NEW.call_number := next_tenant_sequence(NEW.tenant_id, 'call', 'VUL');
  END IF;

  -- Auto-set created_by from JWT if not provided
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_number_trigger
  BEFORE INSERT ON call_events
  FOR EACH ROW
  EXECUTE FUNCTION generate_call_number();

-- Auto-update updated_at (reuses function from 001)
CREATE TRIGGER call_events_updated_at
  BEFORE UPDATE ON call_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Calculate duration when call ends
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.answered_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.answered_at))::INT;
  END IF;
  IF NEW.answered_at IS NOT NULL AND NEW.initiated_at IS NOT NULL THEN
    NEW.ring_duration_seconds := EXTRACT(EPOCH FROM (NEW.answered_at - NEW.initiated_at))::INT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_events_duration
  BEFORE INSERT OR UPDATE ON call_events
  FOR EACH ROW
  EXECUTE FUNCTION calculate_call_duration();

-- ============================================
-- ROW LEVEL SECURITY (Supabase + Backend compatible)
-- ============================================

ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events FORCE ROW LEVEL SECURITY;

CREATE POLICY call_events_select ON call_events
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND deleted_at IS NULL
  );

CREATE POLICY call_events_insert ON call_events
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    -- Prevent linking to another tenant's lead
    AND (
      lead_id IS NULL OR
      EXISTS (SELECT 1 FROM leads WHERE id = lead_id AND leads.tenant_id = call_events.tenant_id)
    )
    -- Prevent linking to another tenant's homeowner (when table exists)
    -- AND (
    --   homeowner_id IS NULL OR
    --   EXISTS (SELECT 1 FROM homeowners WHERE id = homeowner_id AND homeowners.tenant_id = call_events.tenant_id)
    -- )
  );

CREATE POLICY call_events_update ON call_events
  FOR UPDATE
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY call_events_delete ON call_events
  FOR DELETE
  USING (false);

-- ============================================
-- CALL METRICS VIEW (for dashboards)
-- ============================================

CREATE OR REPLACE VIEW call_metrics_daily AS
SELECT
  tenant_id,
  DATE(initiated_at) AS call_date,
  agent_user_id,
  direction,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_calls,
  COUNT(*) FILTER (WHERE status = 'no_answer') AS no_answer_calls,
  COUNT(*) FILTER (WHERE disposition = 'interested') AS interested_calls,
  COUNT(*) FILTER (WHERE disposition = 'appointment_set') AS appointments_set,
  COUNT(*) FILTER (WHERE disposition = 'sale') AS sales,
  AVG(duration_seconds) FILTER (WHERE status = 'completed') AS avg_duration_seconds,
  SUM(duration_seconds) FILTER (WHERE status = 'completed') AS total_talk_time_seconds,
  AVG(ring_duration_seconds) AS avg_ring_time_seconds
FROM call_events
WHERE deleted_at IS NULL
GROUP BY tenant_id, DATE(initiated_at), agent_user_id, direction;

-- ============================================
-- LOG CALL TO LEAD ACTIVITY
-- ============================================

CREATE OR REPLACE FUNCTION log_call_to_lead_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type activity_type;
  v_title TEXT;
BEGIN
  -- Only log if call is linked to a lead and has ended
  IF NEW.lead_id IS NOT NULL AND NEW.status IN ('completed', 'no_answer', 'busy', 'voicemail', 'failed') THEN

    -- Determine activity type
    v_activity_type := CASE
      WHEN NEW.direction = 'outbound' AND NEW.status = 'completed' THEN 'call_outbound'::activity_type
      WHEN NEW.direction = 'inbound' AND NEW.status = 'completed' THEN 'call_inbound'::activity_type
      WHEN NEW.status IN ('no_answer', 'busy', 'voicemail') THEN 'call_missed'::activity_type
      ELSE 'call_outbound'::activity_type
    END;

    -- Build title
    v_title := CASE NEW.status
      WHEN 'completed' THEN
        INITCAP(NEW.direction::TEXT) || ' call - ' ||
        COALESCE(NEW.duration_seconds || 's', 'unknown duration') ||
        CASE WHEN NEW.disposition IS NOT NULL THEN ' - ' || REPLACE(NEW.disposition::TEXT, '_', ' ') ELSE '' END
      WHEN 'no_answer' THEN 'No answer'
      WHEN 'busy' THEN 'Line busy'
      WHEN 'voicemail' THEN 'Left voicemail'
      WHEN 'failed' THEN 'Call failed'
      ELSE 'Call ' || NEW.status::TEXT
    END;

    INSERT INTO lead_activities (
      lead_id,
      tenant_id,
      type,
      title,
      description,
      metadata,
      performed_by,
      performed_by_name
    ) VALUES (
      NEW.lead_id,
      NEW.tenant_id,
      v_activity_type,
      v_title,
      NEW.notes,
      jsonb_build_object(
        'call_id', NEW.id,
        'call_number', NEW.call_number,
        'direction', NEW.direction,
        'status', NEW.status,
        'disposition', NEW.disposition,
        'duration_seconds', NEW.duration_seconds,
        'from_number', NEW.from_number,
        'to_number', NEW.to_number,
        'recording_url', NEW.recording_url
      ),
      NEW.agent_user_id,
      NEW.agent_name
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_events_log_to_lead
  AFTER INSERT OR UPDATE ON call_events
  FOR EACH ROW
  EXECUTE FUNCTION log_call_to_lead_activity();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Soft delete
CREATE OR REPLACE FUNCTION soft_delete_call_event(
  p_call_id UUID,
  p_deleted_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE call_events
  SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    updated_by = p_deleted_by
  WHERE id = p_call_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Get calls for lead
CREATE OR REPLACE FUNCTION get_lead_calls(
  p_lead_id UUID,
  p_limit INT DEFAULT 50
) RETURNS SETOF call_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM call_events
  WHERE lead_id = p_lead_id
    AND deleted_at IS NULL
  ORDER BY initiated_at DESC
  LIMIT p_limit;
END;
$$;

-- Get agent call stats for date range
CREATE OR REPLACE FUNCTION get_agent_call_stats(
  p_agent_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  total_calls BIGINT,
  completed_calls BIGINT,
  total_talk_time_seconds BIGINT,
  avg_call_duration_seconds NUMERIC,
  appointments_set BIGINT,
  sales BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_calls,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS completed_calls,
    COALESCE(SUM(duration_seconds) FILTER (WHERE status = 'completed'), 0)::BIGINT AS total_talk_time_seconds,
    COALESCE(AVG(duration_seconds) FILTER (WHERE status = 'completed'), 0)::NUMERIC AS avg_call_duration_seconds,
    COUNT(*) FILTER (WHERE disposition = 'appointment_set')::BIGINT AS appointments_set,
    COUNT(*) FILTER (WHERE disposition = 'sale')::BIGINT AS sales,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0
      THEN (COUNT(*) FILTER (WHERE disposition IN ('appointment_set', 'sale'))::NUMERIC /
            COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC * 100)
      ELSE 0
    END AS conversion_rate
  FROM call_events
  WHERE agent_user_id = p_agent_user_id
    AND DATE(initiated_at) BETWEEN p_start_date AND p_end_date
    AND deleted_at IS NULL;
END;
$$;

-- ============================================
-- CALL TRANSCRIPTS TABLE (AI-ready)
-- For transcript storage, AI summarization, sentiment analysis
-- ============================================

CREATE TABLE call_event_transcripts (
  -- Primary key is the call_id (1:1 relationship)
  call_id UUID PRIMARY KEY REFERENCES call_events(id) ON DELETE CASCADE,
  
  -- Tenant isolation (denormalized for RLS)
  tenant_id UUID NOT NULL,
  
  -- Raw transcript
  transcript TEXT,
  
  -- AI-generated summary
  ai_summary JSONB DEFAULT '{}',
  -- Expected: { "summary": "", "key_points": [], "action_items": [], "objections": [], "rebuttals_used": [] }
  
  -- Sentiment analysis (-1 to 1 scale)
  sentiment_score NUMERIC(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  customer_sentiment NUMERIC(3,2) CHECK (customer_sentiment >= -1 AND customer_sentiment <= 1),
  agent_sentiment NUMERIC(3,2) CHECK (agent_sentiment >= -1 AND agent_sentiment <= 1),
  
  -- Topic extraction
  topics TEXT[] DEFAULT '{}',
  
  -- QA scoring
  qa_score NUMERIC(5,2) CHECK (qa_score >= 0 AND qa_score <= 100),
  qa_feedback JSONB DEFAULT '{}',
  -- Expected: { "strengths": [], "improvements": [], "script_adherence": 0.85 }
  
  -- Processing status
  transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transcribed_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ
);

-- Indexes for transcripts
CREATE INDEX idx_call_transcripts_tenant_id ON call_event_transcripts(tenant_id);
CREATE INDEX idx_call_transcripts_status ON call_event_transcripts(transcription_status, analysis_status);
CREATE INDEX idx_call_transcripts_topics_gin ON call_event_transcripts USING GIN (topics array_ops);
CREATE INDEX idx_call_transcripts_ai_summary_gin ON call_event_transcripts USING GIN (ai_summary jsonb_path_ops);

-- RLS for transcripts
ALTER TABLE call_event_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_event_transcripts FORCE ROW LEVEL SECURITY;

CREATE POLICY call_transcripts_select ON call_event_transcripts
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY call_transcripts_insert ON call_event_transcripts
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

CREATE POLICY call_transcripts_update ON call_event_transcripts
  FOR UPDATE
  USING (
    tenant_id = COALESCE(
      (auth.jwt() ->> 'tenant_id')::UUID,
      NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    )
  );

-- Trigger for updated_at
CREATE TRIGGER call_transcripts_updated_at
  BEFORE UPDATE ON call_event_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
