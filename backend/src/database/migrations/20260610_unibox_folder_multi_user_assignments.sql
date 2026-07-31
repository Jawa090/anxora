-- Migration: Allow multiple users per unibox campaign folder

CREATE TABLE IF NOT EXISTS unibox_campaign_folder_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    folder_id uuid NOT NULL REFERENCES unibox_campaign_folders(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (folder_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_unibox_folder_assignments_folder ON unibox_campaign_folder_assignments(folder_id);
CREATE INDEX IF NOT EXISTS idx_unibox_folder_assignments_user ON unibox_campaign_folder_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_unibox_folder_assignments_org ON unibox_campaign_folder_assignments(org_id);

-- Migrate existing single-user assignments
INSERT INTO unibox_campaign_folder_assignments (org_id, folder_id, user_id)
SELECT org_id, id, assigned_user_id
FROM unibox_campaign_folders
WHERE assigned_user_id IS NOT NULL
ON CONFLICT (folder_id, user_id) DO NOTHING;

ALTER TABLE unibox_campaign_folders DROP COLUMN IF EXISTS assigned_user_id;

DROP INDEX IF EXISTS idx_unibox_campaign_folders_assigned_user;
