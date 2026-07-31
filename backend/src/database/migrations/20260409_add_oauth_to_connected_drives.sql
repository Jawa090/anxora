-- Migration: Add OAuth columns to connected_drives table
ALTER TABLE connected_drives ADD COLUMN IF NOT EXISTS access_token text;
ALTER TABLE connected_drives ADD COLUMN IF NOT EXISTS refresh_token text;
ALTER TABLE connected_drives ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone;
ALTER TABLE connected_drives ADD COLUMN IF NOT EXISTS status varchar(50) DEFAULT 'available';
