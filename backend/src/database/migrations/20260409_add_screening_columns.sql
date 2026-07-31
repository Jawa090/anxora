-- Add screening and workflow columns to existing recruitment tables
-- Migration: 20260409_add_screening_columns.sql

-- Add screening columns to candidates table
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS screening_notes TEXT,
ADD COLUMN IF NOT EXISTS screening_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS screened_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS screened_by_name VARCHAR(255);

-- Update status enum to include new screening statuses
-- Note: PostgreSQL doesn't have ENUM modification, so we use CHECK constraints
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
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
    'selected', 
    'rejected'
));

-- Add interview scheduling columns to candidates table
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS interview_date DATE,
ADD COLUMN IF NOT EXISTS interview_time TIME,
ADD COLUMN IF NOT EXISTS interview_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS interview_type VARCHAR(100);

-- Add grade-specific form fields for different positions
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS leadership_experience TEXT,
ADD COLUMN IF NOT EXISTS strategic_planning TEXT,
ADD COLUMN IF NOT EXISTS budget_management TEXT,
ADD COLUMN IF NOT EXISTS team_size_managed INTEGER,
ADD COLUMN IF NOT EXISTS project_management TEXT,
ADD COLUMN IF NOT EXISTS technical_skills TEXT,
ADD COLUMN IF NOT EXISTS certifications TEXT,
ADD COLUMN IF NOT EXISTS internship_experience TEXT,
ADD COLUMN IF NOT EXISTS academic_projects TEXT,
ADD COLUMN IF NOT EXISTS extracurricular TEXT;

-- Create index for screening status
CREATE INDEX IF NOT EXISTS idx_candidates_screening_status ON candidates(status) WHERE status IN ('screened_passed', 'screened_failed');
CREATE INDEX IF NOT EXISTS idx_candidates_screening_date ON candidates(screening_date);

-- Add comments
COMMENT ON COLUMN candidates.screening_notes IS 'Notes from initial CV screening process';
COMMENT ON COLUMN candidates.screening_date IS 'Date when screening was completed';
COMMENT ON COLUMN candidates.screened_by IS 'User who performed the screening';
COMMENT ON COLUMN candidates.interview_date IS 'Scheduled interview date';
COMMENT ON COLUMN candidates.interview_time IS 'Scheduled interview time';
COMMENT ON COLUMN candidates.interview_location IS 'Interview location or meeting link';
COMMENT ON COLUMN candidates.leadership_experience IS 'Leadership experience for senior positions';
COMMENT ON COLUMN candidates.project_management IS 'Project management experience for mid-level positions';
COMMENT ON COLUMN candidates.academic_projects IS 'Academic projects for entry-level positions';