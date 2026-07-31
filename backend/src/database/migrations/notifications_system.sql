-- ============================================================
-- XCLATIX: Unified Notifications System
-- Enhanced migration to handle potential legacy table conflicts
-- ============================================================

-- 1. Ensure the base table exists
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- 2. Robustly add all required columns if they are missing
DO $$ 
BEGIN 
    -- Organization reference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='org_id') THEN
        ALTER TABLE public.notifications ADD COLUMN org_id UUID;
    END IF;

    -- Target User (Recipient)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='target_user_id') THEN
        ALTER TABLE public.notifications ADD COLUMN target_user_id UUID;
    END IF;

    -- Actor User (Triggerer, NULL = system)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='actor_user_id') THEN
        ALTER TABLE public.notifications ADD COLUMN actor_user_id UUID;
    END IF;

    -- Type (e.g., 'lead_assigned')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='type') THEN
        ALTER TABLE public.notifications ADD COLUMN type VARCHAR(80);
    END IF;

    -- Category (e.g., 'crm', 'hrms')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='category') THEN
        ALTER TABLE public.notifications ADD COLUMN category VARCHAR(40) DEFAULT 'general';
    END IF;

    -- Content
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='title') THEN
        ALTER TABLE public.notifications ADD COLUMN title VARCHAR(255) DEFAULT 'Notification';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='message') THEN
        ALTER TABLE public.notifications ADD COLUMN message TEXT DEFAULT '';
    END IF;

    -- Actions & Metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='action_url') THEN
        ALTER TABLE public.notifications ADD COLUMN action_url VARCHAR(500);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='metadata') THEN
        ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    -- State
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='is_read') THEN
        ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='created_at') THEN
        ALTER TABLE public.notifications ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

END $$;

-- 3. Set NOT NULL where required (safely)
ALTER TABLE public.notifications ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN target_user_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN type SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN category SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN message SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN metadata SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN created_at SET NOT NULL;

-- 4. Create indices (safely handles existence)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (target_user_id, org_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_org
    ON public.notifications (target_user_id, org_id);

-- 5. Auto-cleanup Trigger
CREATE OR REPLACE FUNCTION prune_old_notifications() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE target_user_id = NEW.target_user_id
    AND id NOT IN (
      SELECT id FROM public.notifications
      WHERE target_user_id = NEW.target_user_id
      ORDER BY created_at DESC
      LIMIT 200
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_notifications ON public.notifications;
CREATE TRIGGER trg_prune_notifications
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION prune_old_notifications();
