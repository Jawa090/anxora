-- Migration to add missing deleted_at column to calendar_events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
