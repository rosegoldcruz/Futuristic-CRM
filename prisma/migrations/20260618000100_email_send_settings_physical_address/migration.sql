-- Add physical_address field to email_send_settings for CAN-SPAM compliance.
-- This field is optional; sending is not blocked when it is NULL.
ALTER TABLE IF EXISTS email_send_settings
  ADD COLUMN IF NOT EXISTS physical_address text;
