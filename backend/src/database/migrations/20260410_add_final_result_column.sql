-- Add final_result column to candidate_interviews table
ALTER TABLE candidate_interviews 
ADD COLUMN final_result VARCHAR(50);

-- Add constraint to ensure valid values
ALTER TABLE candidate_interviews 
ADD CONSTRAINT final_result_check 
CHECK (final_result IS NULL OR final_result IN ('selected', 'rejected'));

-- Add comment
COMMENT ON COLUMN candidate_interviews.final_result IS 'Final decision: selected or rejected (null if not yet decided)';
