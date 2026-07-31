-- Update candidate status constraints to include new offer-related statuses
-- Migration: 20260409_update_candidate_status_enum.sql

-- Drop existing constraint if it exists
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;

-- Add new constraint with offer-related statuses
ALTER TABLE candidates ADD CONSTRAINT candidates_status_check 
CHECK (status IN (
    'cv_received', 
    'screened_passed', 
    'screened_failed', 
    'shortlisted', 
    'interview_scheduled', 
    'interviewed', 
    'final_round', 
    'form_generated',
    'offer_pending',
    'offer_sent',
    'offer_accepted',
    'offer_rejected',
    'selected', 
    'rejected',
    'hired',
    'onboarding'
));

-- Add comment
COMMENT ON COLUMN candidates.status IS 'Candidate status throughout recruitment lifecycle including offer management';