-- Rename permissions column to module_permissions if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'invites' AND column_name = 'permissions') THEN
        ALTER TABLE public.invites RENAME COLUMN permissions TO module_permissions;
    END IF;
END $$;

-- Add missing columns if they don't exist
ALTER TABLE public.invites 
ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
ADD COLUMN IF NOT EXISTS organization_id UUID,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Rename name to full_name if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'invites' AND column_name = 'name') THEN
        ALTER TABLE public.invites RENAME COLUMN name TO full_name;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invites_invite_token ON public.invites (invite_token);
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON public.invites (expires_at);
CREATE INDEX IF NOT EXISTS idx_invites_invite_expires_at ON public.invites (invite_expires_at);