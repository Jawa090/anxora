-- Migration: Add access_level column to lead_workspace_access table
-- Created at: 2026-04-06

ALTER TABLE public.lead_workspace_access 
ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'view';

-- Update existing records if any
UPDATE public.lead_workspace_access SET access_level = 'view' WHERE access_level IS NULL;
