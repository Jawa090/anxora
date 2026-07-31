-- Add form token columns to candidates table for public form access

ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS form_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS form_token_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS father_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS father_occupation VARCHAR(255),
ADD COLUMN IF NOT EXISTS mobile_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
ADD COLUMN IF NOT EXISTS number_of_children INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS residence_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS academic_records JSONB,
ADD COLUMN IF NOT EXISTS work_experience JSONB,
ADD COLUMN IF NOT EXISTS joining_availability VARCHAR(255);

-- Create index on form_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_candidates_form_token ON candidates(form_token);


ALTER TABLE leads
ADD COLUMN IF NOT EXISTS industry VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);