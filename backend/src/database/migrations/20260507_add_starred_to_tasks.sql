-- Add is_starred column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;
