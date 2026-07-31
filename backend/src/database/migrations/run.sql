ALTER TABLE project_activity_logs ADD COLUMN IF NOT EXISTS entity_name varchar(255);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS timer_start_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS timer_user_id UUID DEFAULT NULL;

-- Backfill project progress based on task completion ratio
UPDATE public.projects p
SET progress = COALESCE(
  ROUND(
    (SELECT COUNT(*) FILTER (WHERE status = 'done' OR status = 'completed') FROM public.tasks t WHERE t.project_id = p.id)::numeric /
    NULLIF((SELECT COUNT(*) FROM public.tasks t WHERE t.project_id = p.id), 0) * 100
  ), 
  0
);