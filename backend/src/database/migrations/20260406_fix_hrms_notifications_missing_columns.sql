-- Fix missing columns in hrms_notifications table
ALTER TABLE public.hrms_notifications 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Ensure type have a default to avoid NOT NULL constraints on creation
ALTER TABLE public.hrms_notifications 
ALTER COLUMN type SET DEFAULT 'info';

-- Fix missing columns in project_notifications table for consistency
ALTER TABLE public.project_notifications
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
