-- Update interview status constraints to include in_progress
-- Migration: 20260409_update_interview_status.sql

-- Drop existing constraint if it exists
ALTER TABLE candidate_interviews DROP CONSTRAINT IF EXISTS candidate_interviews_status_check;

-- Add new constraint with in_progress status
ALTER TABLE candidate_interviews ADD CONSTRAINT candidate_interviews_status_check 
CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));

-- Add comment
COMMENT ON COLUMN candidate_interviews.status IS 'Interview status: scheduled, in_progress, completed, cancelled';