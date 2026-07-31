-- Fix Scoring Tables Constraints
-- Migration: 20260409_fix_scoring_constraints.sql
-- Adds unique constraints for ON CONFLICT clauses

-- Add unique constraint to candidate_scores if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'candidate_scores_unique_constraint'
    ) THEN
        ALTER TABLE candidate_scores 
        ADD CONSTRAINT candidate_scores_unique_constraint 
        UNIQUE (candidate_id, criteria_id, scored_by);
    END IF;
END $$;

-- Add unique constraint to candidate_rankings if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'candidate_rankings_unique_constraint'
    ) THEN
        ALTER TABLE candidate_rankings 
        ADD CONSTRAINT candidate_rankings_unique_constraint 
        UNIQUE (candidate_id, requisition_id);
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_candidate_scores_unique 
ON candidate_scores(candidate_id, criteria_id, scored_by);

CREATE INDEX IF NOT EXISTS idx_candidate_rankings_unique 
ON candidate_rankings(candidate_id, requisition_id);

-- Add comments
COMMENT ON CONSTRAINT candidate_scores_unique_constraint ON candidate_scores 
IS 'Ensures one score per candidate per criteria per scorer';

COMMENT ON CONSTRAINT candidate_rankings_unique_constraint ON candidate_rankings 
IS 'Ensures one ranking per candidate per requisition';
