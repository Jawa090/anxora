-- Migration to add assigned_to column to project_milestones table
ALTER TABLE public.project_milestones 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL;
