-- Migration: Add IMAP/SMTP support for mailboxes
ALTER TABLE public.connected_mailboxes 
ADD COLUMN IF NOT EXISTS imap_host character varying(255),
ADD COLUMN IF NOT EXISTS imap_port integer,
ADD COLUMN IF NOT EXISTS smtp_host character varying(255),
ADD COLUMN IF NOT EXISTS smtp_port integer,
ADD COLUMN IF NOT EXISTS imap_username character varying(255),
ADD COLUMN IF NOT EXISTS smtp_username character varying(255),
ADD COLUMN IF NOT EXISTS encrypted_password text;

-- Add index for sync efficiency
CREATE INDEX IF NOT EXISTS idx_mailboxes_is_active ON public.connected_mailboxes (is_active);
