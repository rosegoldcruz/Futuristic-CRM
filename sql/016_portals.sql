-- ===========================================================
-- 016_PORTALS.SQL
-- Installer & Homeowner Portals: Sessions, Messages, Notifications, Activities
-- Depends on: 000_common.sql, 005_tenants_users.sql, 006_installers.sql, 007_homeowners.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE portal_type AS ENUM (
  'installer',
  'homeowner',
  'partner',
  'supplier'
);

CREATE TYPE message_type AS ENUM (
  'text',
  'image',
  'file',
  'system',
  'quote',
  'invoice',
  'schedule',
  'status_update'
);

CREATE TYPE notification_type AS ENUM (
  'info',
  'success',
  'warning',
  'error',
  'action_required'
);

CREATE TYPE notification_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

CREATE TYPE activity_type AS ENUM (
  'login',
  'logout',
  'view',
  'create',
  'update',
  'delete',
  'download',
  'upload',
  'sign',
  'approve',
  'reject',
  'message',
  'payment',
  'schedule'
);

-- ============================================
-- PORTAL_SESSIONS TABLE
-- ============================================

CREATE TABLE portal_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Portal type
  portal_type portal_type NOT NULL,
  
  -- User reference (one of these will be set)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  installer_id UUID REFERENCES installers(id) ON DELETE CASCADE,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE CASCADE,
  
  -- Session info
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  
  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  
  -- Device info
  ip_address INET,
  user_agent TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  device_info JSONB DEFAULT '{}' CHECK (jsonb_typeof(device_info) = 'object'),
  
  -- Location
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  city TEXT,
  country TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Activity tracking
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  activity_count INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
) WITH (fillfactor = 90);

-- ============================================
-- PORTAL_MESSAGES TABLE
-- ============================================

CREATE TABLE portal_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Conversation context
  conversation_id UUID, -- Groups related messages
  parent_message_id UUID REFERENCES portal_messages(id) ON DELETE SET NULL,
  
  -- Related entity
  entity_type TEXT, -- 'job', 'quote', 'work_order'
  entity_id UUID,
  
  -- Sender
  sender_type TEXT NOT NULL, -- 'user', 'installer', 'homeowner', 'system'
  sender_id UUID,
  sender_name TEXT,
  
  -- Recipient
  recipient_type TEXT, -- 'user', 'installer', 'homeowner', 'all'
  recipient_id UUID,
  
  -- Message content
  message_type message_type NOT NULL DEFAULT 'text',
  subject TEXT,
  body TEXT NOT NULL,
  body_html TEXT,
  
  -- Attachments
  attachments JSONB DEFAULT '[]' CHECK (jsonb_typeof(attachments) = 'array'),
  -- Array of { file_id, file_name, file_url, file_type, file_size }
  
  -- Read tracking
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Status
  is_archived BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
) WITH (fillfactor = 90);

-- ============================================
-- PORTAL_NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE portal_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Recipient
  portal_type portal_type NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  installer_id UUID REFERENCES installers(id) ON DELETE CASCADE,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE CASCADE,
  
  -- Notification content
  notification_type notification_type NOT NULL DEFAULT 'info',
  priority notification_priority NOT NULL DEFAULT 'normal',
  
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- Action
  action_url TEXT,
  action_label TEXT,
  
  -- Related entity
  entity_type TEXT,
  entity_id UUID,
  
  -- Icon/image
  icon TEXT,
  image_url TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  
  -- Delivery
  channels_sent TEXT[] DEFAULT '{}', -- 'in_app', 'email', 'sms', 'push'
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  push_sent_at TIMESTAMPTZ,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- PORTAL_ACTIVITIES TABLE
-- ============================================

CREATE TABLE portal_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Who
  portal_type portal_type NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  installer_id UUID REFERENCES installers(id) ON DELETE SET NULL,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE SET NULL,
  session_id UUID REFERENCES portal_sessions(id) ON DELETE SET NULL,
  
  -- What
  activity_type activity_type NOT NULL,
  description TEXT,
  
  -- Entity affected
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  
  -- Details
  details JSONB DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  -- { old_value, new_value, fields_changed, etc. }
  
  -- Request info
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,
  
  -- Location
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- PORTAL_PREFERENCES TABLE
-- ============================================

CREATE TABLE portal_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Owner
  portal_type portal_type NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  installer_id UUID REFERENCES installers(id) ON DELETE CASCADE,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE CASCADE,
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  push_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  
  -- Notification types enabled
  notify_on_message BOOLEAN DEFAULT true,
  notify_on_status_change BOOLEAN DEFAULT true,
  notify_on_schedule_change BOOLEAN DEFAULT true,
  notify_on_payment BOOLEAN DEFAULT true,
  notify_on_document BOOLEAN DEFAULT true,
  
  -- Digest preferences
  daily_digest BOOLEAN DEFAULT false,
  weekly_digest BOOLEAN DEFAULT false,
  digest_time TIME DEFAULT '09:00',
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  -- Display preferences
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'America/Phoenix',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  time_format TEXT DEFAULT '12h', -- '12h' or '24h'
  
  -- Theme
  theme TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
  
  -- Dashboard preferences
  dashboard_layout JSONB DEFAULT '{}' CHECK (jsonb_typeof(dashboard_layout) = 'object'),
  default_view TEXT,
  items_per_page INT DEFAULT 25,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique per user per portal
  UNIQUE(portal_type, user_id),
  UNIQUE(portal_type, installer_id),
  UNIQUE(portal_type, homeowner_id)
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES
-- ============================================

-- portal_sessions
CREATE INDEX idx_portal_sessions_tenant ON portal_sessions(tenant_id);
CREATE INDEX idx_portal_sessions_token ON portal_sessions(session_token) WHERE is_active = true;
CREATE INDEX idx_portal_sessions_refresh ON portal_sessions(refresh_token) WHERE is_active = true;
CREATE INDEX idx_portal_sessions_user ON portal_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_portal_sessions_installer ON portal_sessions(installer_id) WHERE installer_id IS NOT NULL;
CREATE INDEX idx_portal_sessions_homeowner ON portal_sessions(homeowner_id) WHERE homeowner_id IS NOT NULL;
CREATE INDEX idx_portal_sessions_active ON portal_sessions(is_active, expires_at) WHERE is_active = true;

-- portal_messages
CREATE INDEX idx_portal_messages_tenant ON portal_messages(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_portal_messages_conversation ON portal_messages(conversation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_portal_messages_entity ON portal_messages(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_portal_messages_sender ON portal_messages(sender_type, sender_id);
CREATE INDEX idx_portal_messages_recipient ON portal_messages(recipient_type, recipient_id);
CREATE INDEX idx_portal_messages_unread ON portal_messages(recipient_type, recipient_id, is_read) WHERE is_read = false AND deleted_at IS NULL;
CREATE INDEX idx_portal_messages_created ON portal_messages(tenant_id, created_at DESC);

-- portal_notifications
CREATE INDEX idx_portal_notifications_tenant ON portal_notifications(tenant_id);
CREATE INDEX idx_portal_notifications_user ON portal_notifications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_portal_notifications_installer ON portal_notifications(installer_id) WHERE installer_id IS NOT NULL;
CREATE INDEX idx_portal_notifications_homeowner ON portal_notifications(homeowner_id) WHERE homeowner_id IS NOT NULL;
CREATE INDEX idx_portal_notifications_unread ON portal_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_portal_notifications_created ON portal_notifications(tenant_id, created_at DESC);
CREATE INDEX idx_portal_notifications_entity ON portal_notifications(entity_type, entity_id);

-- portal_activities
CREATE INDEX idx_portal_activities_tenant ON portal_activities(tenant_id);
CREATE INDEX idx_portal_activities_user ON portal_activities(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_portal_activities_installer ON portal_activities(installer_id) WHERE installer_id IS NOT NULL;
CREATE INDEX idx_portal_activities_homeowner ON portal_activities(homeowner_id) WHERE homeowner_id IS NOT NULL;
CREATE INDEX idx_portal_activities_session ON portal_activities(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_portal_activities_entity ON portal_activities(entity_type, entity_id);
CREATE INDEX idx_portal_activities_type ON portal_activities(tenant_id, activity_type);
CREATE INDEX idx_portal_activities_created ON portal_activities(tenant_id, created_at DESC);

-- portal_preferences
CREATE INDEX idx_portal_preferences_user ON portal_preferences(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_portal_preferences_installer ON portal_preferences(installer_id) WHERE installer_id IS NOT NULL;
CREATE INDEX idx_portal_preferences_homeowner ON portal_preferences(homeowner_id) WHERE homeowner_id IS NOT NULL;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER portal_messages_updated_at BEFORE UPDATE ON portal_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER portal_preferences_updated_at BEFORE UPDATE ON portal_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate message number
CREATE OR REPLACE FUNCTION generate_message_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.message_number := 'MSG-' || next_tenant_sequence(NEW.tenant_id, 'portal_message');
  RETURN NEW;
END;
$$;

CREATE TRIGGER portal_messages_number BEFORE INSERT ON portal_messages FOR EACH ROW EXECUTE FUNCTION generate_message_number();

-- Generate conversation ID if not provided
CREATE OR REPLACE FUNCTION generate_conversation_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.conversation_id IS NULL AND NEW.parent_message_id IS NULL THEN
    NEW.conversation_id := uuid_generate_v4();
  ELSIF NEW.parent_message_id IS NOT NULL THEN
    SELECT conversation_id INTO NEW.conversation_id FROM portal_messages WHERE id = NEW.parent_message_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER portal_messages_conversation BEFORE INSERT ON portal_messages FOR EACH ROW EXECUTE FUNCTION generate_conversation_id();

-- Update session activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    UPDATE portal_sessions
    SET last_activity_at = NOW(), activity_count = activity_count + 1
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER portal_activities_session AFTER INSERT ON portal_activities FOR EACH ROW EXECUTE FUNCTION update_session_activity();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- portal_sessions
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY portal_sessions_select ON portal_sessions FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_sessions_insert ON portal_sessions FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_sessions_update ON portal_sessions FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_sessions_delete ON portal_sessions FOR DELETE USING (false);

-- portal_messages
ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY portal_messages_select ON portal_messages FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY portal_messages_insert ON portal_messages FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_messages_update ON portal_messages FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY portal_messages_delete ON portal_messages FOR DELETE USING (false);

-- portal_notifications
ALTER TABLE portal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY portal_notifications_select ON portal_notifications FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_notifications_insert ON portal_notifications FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_notifications_update ON portal_notifications FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_notifications_delete ON portal_notifications FOR DELETE USING (false);

-- portal_activities
ALTER TABLE portal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_activities FORCE ROW LEVEL SECURITY;

CREATE POLICY portal_activities_select ON portal_activities FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_activities_insert ON portal_activities FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_activities_update ON portal_activities FOR UPDATE USING (false);
CREATE POLICY portal_activities_delete ON portal_activities FOR DELETE USING (false);

-- portal_preferences
ALTER TABLE portal_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_preferences FORCE ROW LEVEL SECURITY;

CREATE POLICY portal_preferences_select ON portal_preferences FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_preferences_insert ON portal_preferences FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_preferences_update ON portal_preferences FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY portal_preferences_delete ON portal_preferences FOR DELETE USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Create portal session
CREATE OR REPLACE FUNCTION create_portal_session(
  p_portal_type portal_type,
  p_user_id UUID DEFAULT NULL,
  p_installer_id UUID DEFAULT NULL,
  p_homeowner_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (session_token TEXT, refresh_token TEXT, expires_at TIMESTAMPTZ)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_session_token TEXT;
  v_refresh_token TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_refresh_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := NOW() + INTERVAL '24 hours';
  
  INSERT INTO portal_sessions (
    tenant_id, portal_type, user_id, installer_id, homeowner_id,
    session_token, refresh_token, expires_at, refresh_expires_at,
    ip_address, user_agent
  )
  VALUES (
    v_tenant_id, p_portal_type, p_user_id, p_installer_id, p_homeowner_id,
    v_session_token, v_refresh_token, v_expires_at, NOW() + INTERVAL '7 days',
    p_ip_address, p_user_agent
  );
  
  RETURN QUERY SELECT v_session_token, v_refresh_token, v_expires_at;
END;
$$;

-- Send notification
CREATE OR REPLACE FUNCTION send_portal_notification(
  p_portal_type portal_type,
  p_recipient_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_notification_type notification_type DEFAULT 'info',
  p_priority notification_priority DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
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
  v_notification_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO portal_notifications (
    tenant_id, portal_type, 
    user_id, installer_id, homeowner_id,
    notification_type, priority, title, body, action_url,
    entity_type, entity_id
  )
  VALUES (
    v_tenant_id, p_portal_type,
    CASE WHEN p_portal_type = 'installer' THEN NULL ELSE p_recipient_id END,
    CASE WHEN p_portal_type = 'installer' THEN p_recipient_id ELSE NULL END,
    CASE WHEN p_portal_type = 'homeowner' THEN p_recipient_id ELSE NULL END,
    p_notification_type, p_priority, p_title, p_body, p_action_url,
    p_entity_type, p_entity_id
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Log activity
CREATE OR REPLACE FUNCTION log_portal_activity(
  p_portal_type portal_type,
  p_activity_type activity_type,
  p_description TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_activity_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO portal_activities (
    tenant_id, portal_type, user_id, activity_type, description,
    entity_type, entity_id, details
  )
  VALUES (
    v_tenant_id, p_portal_type, (auth.jwt() ->> 'user_id')::UUID,
    p_activity_type, p_description, p_entity_type, p_entity_id, p_details
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;

-- Mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(p_notification_ids UUID[])
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE portal_notifications
  SET is_read = true, read_at = NOW()
  WHERE id = ANY(p_notification_ids);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_portal_type portal_type,
  p_recipient_id UUID
)
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT COUNT(*)::INT
  FROM portal_notifications
  WHERE is_read = false
    AND is_dismissed = false
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
      (p_portal_type = 'installer' AND installer_id = p_recipient_id)
      OR (p_portal_type = 'homeowner' AND homeowner_id = p_recipient_id)
      OR user_id = p_recipient_id
    );
$$;
