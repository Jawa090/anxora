ALTER TABLE public.workgroup_posts
ADD COLUMN IF NOT EXISTS deleted_for_users uuid[] DEFAULT '{}'::uuid[];

