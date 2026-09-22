-- ====================================================================
-- Comprehensive Schema Sync for Missed Migrations
-- Ensures all columns, tables, and constraints exist idempotently
-- ====================================================================

-- 1. WORKGROUP MEMBERS (status & left_at)
ALTER TABLE public.workgroup_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.workgroup_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE;
UPDATE public.workgroup_members SET status = 'active' WHERE status IS NULL;

-- 2. WORKGROUP CHANNELS & POSTS
ALTER TABLE public.workgroup_channels ADD COLUMN IF NOT EXISTS is_broadcast boolean DEFAULT false;
ALTER TABLE public.workgroup_posts ADD COLUMN IF NOT EXISTS mentions uuid[] DEFAULT '{}';
ALTER TABLE public.workgroup_posts ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}';
ALTER TABLE public.workgroup_posts ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';

-- 3. DIRECT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    parent_id uuid REFERENCES public.direct_messages(id) ON DELETE CASCADE,
    attachments jsonb DEFAULT '[]',
    mentions uuid[] DEFAULT '{}',
    reactions jsonb DEFAULT '{}',
    is_edited boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_org_id ON public.direct_messages(org_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_receiver ON public.direct_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_sender ON public.direct_messages(receiver_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_parent ON public.direct_messages(parent_id);

-- 4. WORKGROUP NOTIFICATIONS COLUMNS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workgroup_notifications' AND column_name='org_id') THEN
        ALTER TABLE workgroup_notifications ADD COLUMN org_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workgroup_notifications' AND column_name='notification_type') THEN
        ALTER TABLE workgroup_notifications ADD COLUMN notification_type VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workgroup_notifications' AND column_name='data') THEN
        ALTER TABLE workgroup_notifications ADD COLUMN data JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workgroup_notifications' AND column_name='type') THEN
        ALTER TABLE workgroup_notifications ALTER COLUMN type DROP NOT NULL;
    END IF;
END $$;

-- 5. UNIBOX CAMPAIGN FOLDER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS unibox_campaign_folder_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    folder_id uuid NOT NULL REFERENCES unibox_campaign_folders(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (folder_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_unibox_folder_assignments_folder ON unibox_campaign_folder_assignments(folder_id);
CREATE INDEX IF NOT EXISTS idx_unibox_folder_assignments_user ON unibox_campaign_folder_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_unibox_folder_assignments_org ON unibox_campaign_folder_assignments(org_id);

-- 6. WORKGROUP MEMBERS CONSTRAINTS
ALTER TABLE workgroup_members DROP CONSTRAINT IF EXISTS workgroup_members_role_check;
ALTER TABLE workgroup_members ADD CONSTRAINT workgroup_members_role_check 
CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'guest'));

-- 7. WORKGROUP POSTS CONTENT TYPE CHECK
ALTER TABLE workgroup_posts DROP CONSTRAINT IF EXISTS workgroup_posts_content_type_check;
ALTER TABLE workgroup_posts ADD CONSTRAINT workgroup_posts_content_type_check 
CHECK (content_type IN ('text', 'file', 'image', 'link', 'code', 'system', 'call'));
