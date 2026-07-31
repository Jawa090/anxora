-- Migration: Assign unibox campaign folders to specific team members

ALTER TABLE unibox_campaign_folders
ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_unibox_campaign_folders_assigned_user
ON unibox_campaign_folders(assigned_user_id);
