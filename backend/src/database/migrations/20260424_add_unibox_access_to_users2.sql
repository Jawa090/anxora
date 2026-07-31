-- Add unibox access column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_unibox_access BOOLEAN DEFAULT FALSE;

-- Grant access to all super admins by default
UPDATE users 
SET has_unibox_access = TRUE 
WHERE role = 'super_admin';
