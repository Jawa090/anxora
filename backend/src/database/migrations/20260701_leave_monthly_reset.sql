-- Add resets_monthly flag to leave_types
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS resets_monthly BOOLEAN DEFAULT false;

-- Add last_monthly_reset date to employee_leave_balances to track when it was last reset
ALTER TABLE employee_leave_balances ADD COLUMN IF NOT EXISTS last_monthly_reset DATE;
