-- Migration: Add notification settings to users
-- Default: All categories enabled

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS notification_settings JSONB 
DEFAULT '{
  "crm": true, 
  "tasks": true, 
  "hrms": true, 
  "recruitment": true, 
  "collaboration": true, 
  "general": true
}'::jsonb;

-- Ensure existing users have the default if needed (though DEFAULT handles it for new NULLs during column creation)
UPDATE public.users SET notification_settings = '{
  "crm": true, 
  "tasks": true, 
  "hrms": true, 
  "recruitment": true, 
  "collaboration": true, 
  "general": true
}'::jsonb WHERE notification_settings IS NULL;
