-- Add can_assign column to projects table to allow hierarchical delegation at the project level
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS can_assign BOOLEAN DEFAULT false;

-- If a project has a manager_id and can_assign is true, that manager can assign tasks and manage members.
