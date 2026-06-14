ALTER TABLE IF EXISTS email_queue
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS email_queue_lead_id_idx ON email_queue(lead_id);

CREATE UNIQUE INDEX IF NOT EXISTS email_queue_campaign_recipient_email_unique_idx
  ON email_queue(campaign_id, recipient_email)
  WHERE campaign_id IS NOT NULL;
