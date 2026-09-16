-- backend/src/database/migrations/20260916_add_attendance_metrics_to_salary_slips.sql

ALTER TABLE salary_slips
ADD COLUMN IF NOT EXISTS absent_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worked_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 30;

-- Alter absent_days, worked_days, total_days to NUMERIC(6, 2) in salary_slips to support half-day (0.5) deductions
ALTER TABLE salary_slips 
ALTER COLUMN absent_days TYPE NUMERIC(6, 2),
ALTER COLUMN worked_days TYPE NUMERIC(6, 2),
ALTER COLUMN total_days TYPE NUMERIC(6, 2);

-- Add break configuration to shift_templates
ALTER TABLE public.shift_templates
ADD COLUMN IF NOT EXISTS break_duration_hours NUMERIC(4,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS auto_deduct_break BOOLEAN DEFAULT TRUE;

UPDATE public.shift_templates
SET break_duration_hours = 1.00, auto_deduct_break = TRUE
WHERE break_duration_hours IS NULL;
