-- Migration to fix missing columns in workgroup_notifications table
-- Created at: 2026-04-27

DO $$ 
BEGIN 
    -- 1. Add org_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workgroup_notifications' AND column_name='org_id') THEN
        ALTER TABLE workgroup_notifications ADD COLUMN org_id UUID;
    END IF;

    -- 2. Add notification_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workgroup_notifications' AND column_name='notification_type') THEN
        ALTER TABLE workgroup_notifications ADD COLUMN notification_type VARCHAR(50);
    END IF;

    -- 3. Add data if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workgroup_notifications' AND column_name='data') THEN
        ALTER TABLE workgroup_notifications ADD COLUMN data JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 4. Make old 'type' column nullable as we now use 'notification_type'
    ALTER TABLE workgroup_notifications ALTER COLUMN type DROP NOT NULL;
END $$;
