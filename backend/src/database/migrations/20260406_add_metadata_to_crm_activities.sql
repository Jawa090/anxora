DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_activities' AND column_name='metadata') THEN 
        ALTER TABLE public.crm_activities ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb; 
    END IF; 
END $$;
