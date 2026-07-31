-- Add paid_status to leave_requests
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS paid_status VARCHAR(10) DEFAULT NULL;

-- Add monthly_limit to leave_types (optional per type)
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT NULL;
