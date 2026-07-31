-- Add lead_id column to deals table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'lead_id'
    ) THEN
        ALTER TABLE deals ADD COLUMN lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
    END IF;
END $$;
