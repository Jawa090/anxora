ALTER TABLE leads
  ALTER COLUMN responsible_person TYPE uuid USING responsible_person::uuid;

ALTER TABLE unibox_campaign_folder_assignments
  ADD COLUMN IF NOT EXISTS auto_convert_leads boolean NOT NULL DEFAULT false;
