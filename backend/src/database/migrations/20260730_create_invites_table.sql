CREATE TABLE IF NOT EXISTS public.invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    full_name TEXT,
    role VARCHAR(50) NOT NULL,
    phone TEXT,
    position TEXT,
    department TEXT,
    module_permissions JSONB DEFAULT '{}'::jsonb,
    org_id UUID,
    invite_token TEXT UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_email ON public.invites (email);
