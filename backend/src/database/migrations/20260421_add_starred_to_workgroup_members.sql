-- Add is_starred column to workgroup_members table
ALTER TABLE workgroup_members 
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workgroup_members_starred ON workgroup_members(user_id, is_starred) WHERE is_starred = true;

COMMENT ON COLUMN workgroup_members.is_starred IS 'Whether the user has starred/favorited this workgroup';
