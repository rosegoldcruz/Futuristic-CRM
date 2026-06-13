CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS email_companies
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE IF EXISTS email_contacts
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'unknown';

ALTER TABLE IF EXISTS email_lists
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'static',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE IF EXISTS email_templates
  ADD COLUMN IF NOT EXISTS preheader text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

ALTER TABLE IF EXISTS email_campaigns
  ADD COLUMN IF NOT EXISTS subject_override text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

ALTER TABLE IF EXISTS email_events
  ADD COLUMN IF NOT EXISTS queue_id uuid;

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  website text,
  industry text,
  source text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  email text,
  first_name text,
  last_name text,
  title text,
  phone text,
  source text,
  status text NOT NULL DEFAULT 'active',
  consent_status text NOT NULL DEFAULT 'unknown',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES email_contacts(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  status text NOT NULL DEFAULT 'queued',
  provider text,
  provider_message_id text,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL,
  from_email text NOT NULL,
  from_name text,
  reply_to_email text,
  status text NOT NULL DEFAULT 'inactive',
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES file_folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES file_folders(id) ON DELETE SET NULL,
  owner_type text,
  owner_id uuid,
  original_name text NOT NULL,
  storage_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_driver text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input jsonb,
  output jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text,
  actor_email text,
  entity_type text NOT NULL,
  entity_id text,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_lists_name_unique_idx ON email_lists(name);
CREATE INDEX IF NOT EXISTS companies_name_idx ON companies(name);
CREATE INDEX IF NOT EXISTS companies_domain_idx ON companies(domain);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(email);
CREATE INDEX IF NOT EXISTS contacts_company_id_idx ON contacts(company_id);
CREATE INDEX IF NOT EXISTS email_queue_campaign_id_idx ON email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS email_queue_contact_id_idx ON email_queue(contact_id);
CREATE INDEX IF NOT EXISTS email_queue_recipient_id_idx ON email_queue(recipient_id);
CREATE INDEX IF NOT EXISTS email_queue_status_idx ON email_queue(status);
CREATE INDEX IF NOT EXISTS email_queue_next_attempt_at_idx ON email_queue(next_attempt_at);
CREATE INDEX IF NOT EXISTS email_events_queue_id_idx ON email_events(queue_id);
CREATE INDEX IF NOT EXISTS email_provider_accounts_provider_idx ON email_provider_accounts(provider);
CREATE INDEX IF NOT EXISTS email_provider_accounts_status_idx ON email_provider_accounts(status);
CREATE INDEX IF NOT EXISTS files_folder_id_idx ON files(folder_id);
CREATE INDEX IF NOT EXISTS files_owner_idx ON files(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS files_status_idx ON files(status);
CREATE INDEX IF NOT EXISTS file_events_file_id_idx ON file_events(file_id);
CREATE INDEX IF NOT EXISTS file_events_event_type_idx ON file_events(event_type);
CREATE INDEX IF NOT EXISTS automation_runs_source_idx ON automation_runs(source);
CREATE INDEX IF NOT EXISTS automation_runs_action_idx ON automation_runs(action);
CREATE INDEX IF NOT EXISTS automation_runs_status_idx ON automation_runs(status);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events(created_at);
