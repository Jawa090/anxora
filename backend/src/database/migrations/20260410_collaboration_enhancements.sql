-- Add Broadcast support to Workgroup Channels
ALTER TABLE public.workgroup_channels ADD COLUMN IF NOT EXISTS is_broadcast boolean DEFAULT false;

-- Add Mentions and Reactions mapping support to Workgroup Posts
ALTER TABLE public.workgroup_posts ADD COLUMN IF NOT EXISTS mentions uuid[] DEFAULT '{}';
ALTER TABLE public.workgroup_posts ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}';
ALTER TABLE public.workgroup_posts ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';

-- Create Direct Messages Table (1:1 Chat)
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
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

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_app_direct_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS direct_messages_updated_at ON public.direct_messages;
CREATE TRIGGER direct_messages_updated_at BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION update_app_direct_messages_updated_at();
