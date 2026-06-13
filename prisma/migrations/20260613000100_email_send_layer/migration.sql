CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS email_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  phone text,
  industry text,
  company_type text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text DEFAULT 'US',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES email_companies(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  full_name text,
  email text NOT NULL UNIQUE,
  phone text,
  title text,
  source text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_contacts_status_check CHECK (status IN ('active', 'bounced', 'unsubscribed', 'do_not_contact', 'archived'))
);

CREATE TABLE IF NOT EXISTS email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, contact_id)
);

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text,
  body_html text,
  body_text text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  list_id uuid REFERENCES email_lists(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_campaigns_status_check CHECK (status IN ('draft', 'ready', 'active', 'paused', 'completed', 'archived'))
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft_ready',
  personalized_subject text,
  personalized_body text,
  personalized_html text,
  personalized_text text,
  sent_at timestamptz,
  replied_at timestamptz,
  last_error text,
  provider_message_id text,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id),
  CONSTRAINT email_campaign_recipients_status_check CHECK (status IN ('draft_ready', 'sending', 'sent', 'send_failed', 'sent_manually', 'replied', 'follow_up_needed', 'closed_won', 'closed_lost', 'skipped', 'suppressed'))
);

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES email_contacts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_suppressions_reason_check CHECK (reason IN ('bounced', 'unsubscribed', 'complaint', 'do_not_contact', 'invalid'))
);

CREATE TABLE IF NOT EXISTS email_inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES email_contacts(id) ON DELETE SET NULL,
  from_email text NOT NULL,
  subject text,
  body text,
  received_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_send_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_limit integer NOT NULL DEFAULT 25,
  batch_size integer NOT NULL DEFAULT 5,
  min_seconds_between_sends integer NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO email_send_settings (daily_limit, batch_size, min_seconds_between_sends, enabled)
SELECT 25, 5, 60, false
WHERE NOT EXISTS (SELECT 1 FROM email_send_settings);

CREATE INDEX IF NOT EXISTS email_contacts_company_id_idx ON email_contacts(company_id);
CREATE INDEX IF NOT EXISTS email_contacts_status_idx ON email_contacts(status);
CREATE INDEX IF NOT EXISTS email_list_members_contact_id_idx ON email_list_members(contact_id);
CREATE INDEX IF NOT EXISTS email_campaigns_template_id_idx ON email_campaigns(template_id);
CREATE INDEX IF NOT EXISTS email_campaigns_list_id_idx ON email_campaigns(list_id);
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS email_campaign_recipients_contact_id_idx ON email_campaign_recipients(contact_id);
CREATE INDEX IF NOT EXISTS email_campaign_recipients_status_idx ON email_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS email_events_campaign_id_idx ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS email_events_recipient_id_idx ON email_events(recipient_id);
CREATE INDEX IF NOT EXISTS email_events_contact_id_idx ON email_events(contact_id);
CREATE INDEX IF NOT EXISTS email_events_event_type_idx ON email_events(event_type);
CREATE INDEX IF NOT EXISTS email_inbound_messages_contact_id_idx ON email_inbound_messages(contact_id);
