-- Add delegated_by column to tasks table
-- This tracks who delegated the task (e.g. User 2 who re-assigned to User 3)
-- so that the delegator can still see and manage the task

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS delegated_by uuid REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.delegated_by IS
  'The user who last delegated/re-assigned this task via delegation permission. Allows delegator to track and manage tasks they forwarded.';

ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'event';