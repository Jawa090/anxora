CREATE TABLE IF NOT EXISTS public.workgroup_post_reads (
  post_id uuid NOT NULL REFERENCES public.workgroup_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workgroup_post_reads_post_id
  ON public.workgroup_post_reads (post_id);

