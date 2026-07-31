-- =====================================================
-- EMAILS TABLE MIGRATION
-- =====================================================

-- Add columns IF NOT EXISTS
ALTER TABLE emails ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES connected_mailboxes(id) ON DELETE CASCADE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS snippet text;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS labels text[];
ALTER TABLE emails ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;

-- Add UNIQUE message_id constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name='emails' 
        AND constraint_type='UNIQUE'
        AND constraint_name='emails_message_id_key'
    ) THEN
        ALTER TABLE emails ADD CONSTRAINT emails_message_id_key UNIQUE (message_id);
    END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);

-- =====================================================
-- CALENDAR EVENT ATTENDEES MIGRATION
-- =====================================================
ALTER TABLE public.calendar_event_attendees 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS is_organizer boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS org_id uuid;

-- =====================================================
-- CALENDAR EVENTS MIGRATION (Extra fields)
-- =====================================================
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
