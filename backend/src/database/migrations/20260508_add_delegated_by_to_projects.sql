-- Add delegated_by column to projects table
-- Tracks who delegated the project (e.g. User 2 who re-assigned manager to User 3)
-- so that the delegator can still see and manage the project

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS delegated_by uuid REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.delegated_by IS
  'The user who last delegated/re-assigned this project via delegation permission. Allows delegator to track and manage projects they forwarded.';
