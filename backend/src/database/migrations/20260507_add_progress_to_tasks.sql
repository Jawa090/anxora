-- Add progress column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- Update existing completed tasks to 100% progress
UPDATE public.tasks SET progress = 100 WHERE status = 'completed';
