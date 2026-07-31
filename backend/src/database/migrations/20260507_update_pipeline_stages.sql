-- Add probability and metadata to pipeline_stages
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS probability integer DEFAULT 0;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
