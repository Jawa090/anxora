-- Add delay_reason column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS delay_reason TEXT;
