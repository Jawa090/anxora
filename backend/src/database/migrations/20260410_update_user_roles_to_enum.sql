-- Migration: Update Users Table to use ENUM Role (Drop/Add Version)
-- Description: Drops the existing role column and adds it back as a strict ENUM type.

DO $$ 
BEGIN 
    -- 1. Create the user_role ENUM type if it doesn't already exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'super_admin',
            'admin',
            'manager',
            'team_lead',
            'employee'
        );
    END IF;

    -- 2. Handle the 'role' column (Drop and Re-add as requested)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        -- We drop the existing column to clear constraints/defaults
        ALTER TABLE users DROP COLUMN role;
        
        -- Add it back with the new ENUM type
        ALTER TABLE users ADD COLUMN role user_role DEFAULT 'employee'::user_role;
    END IF;

    -- 3. Ensure organization relationship columns exist (Defensive)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='org_id') THEN
        ALTER TABLE users ADD COLUMN org_id UUID REFERENCES organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='organization_id') THEN
        ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;

END $$;
