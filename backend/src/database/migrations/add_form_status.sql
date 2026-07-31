-- Add form_status column to candidates table
-- This tracks: null (no form), 'generated' (form link created), 'submitted' (form filled and submitted)

ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS form_status VARCHAR(50) DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_candidates_form_status ON candidates(form_status);

-- Migration comment: This column tracks form generation and submission independently from interview status
