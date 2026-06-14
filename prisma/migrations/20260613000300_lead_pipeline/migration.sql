CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES email_companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES email_contacts(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  title text,
  source text,
  campaign text,
  status text NOT NULL DEFAULT 'new',
  interest_level text NOT NULL DEFAULT 'unknown',
  assigned_to text,
  estimated_value numeric(12,2),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_status_check CHECK (status IN (
    'new',
    'attempted_contact',
    'contacted',
    'qualified',
    'proposal_needed',
    'proposal_sent',
    'follow_up',
    'won',
    'lost',
    'do_not_contact'
  )),
  CONSTRAINT leads_interest_level_check CHECK (interest_level IN ('hot', 'warm', 'cold', 'unknown'))
);

CREATE TABLE IF NOT EXISTS lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to text NOT NULL,
  assigned_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(email);
CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads(phone);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_source_idx ON leads(source);
CREATE INDEX IF NOT EXISTS leads_campaign_idx ON leads(campaign);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS leads_interest_level_idx ON leads(interest_level);
CREATE INDEX IF NOT EXISTS leads_next_follow_up_at_idx ON leads(next_follow_up_at);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at);
CREATE INDEX IF NOT EXISTS leads_company_id_idx ON leads(company_id);
CREATE INDEX IF NOT EXISTS leads_contact_id_idx ON leads(contact_id);
CREATE INDEX IF NOT EXISTS lead_events_lead_id_idx ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS lead_events_event_type_idx ON lead_events(event_type);
CREATE INDEX IF NOT EXISTS lead_events_created_at_idx ON lead_events(created_at);
CREATE INDEX IF NOT EXISTS lead_notes_lead_id_idx ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS lead_notes_created_at_idx ON lead_notes(created_at);
CREATE INDEX IF NOT EXISTS lead_assignments_lead_id_idx ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS lead_assignments_assigned_to_idx ON lead_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS lead_assignments_created_at_idx ON lead_assignments(created_at);
