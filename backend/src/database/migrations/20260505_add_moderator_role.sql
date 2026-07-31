-- Add 'moderator' to workgroup_members role check
ALTER TABLE workgroup_members DROP CONSTRAINT IF EXISTS workgroup_members_role_check;
ALTER TABLE workgroup_members ADD CONSTRAINT workgroup_members_role_check 
CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'guest'));
