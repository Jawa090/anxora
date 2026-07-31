-- Update workgroup_posts content_type check to allow 'system' and 'call' types
ALTER TABLE workgroup_posts DROP CONSTRAINT IF EXISTS workgroup_posts_content_type_check;
ALTER TABLE workgroup_posts ADD CONSTRAINT workgroup_posts_content_type_check 
CHECK (content_type IN ('text', 'file', 'image', 'link', 'code', 'system', 'call'));

-- Add 'moderator' to workgroup_members role check
ALTER TABLE workgroup_members DROP CONSTRAINT IF EXISTS workgroup_members_role_check;
ALTER TABLE workgroup_members ADD CONSTRAINT workgroup_members_role_check 
CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'guest'));
