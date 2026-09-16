-- backend/src/database/migrations/20260916_add_attendance_metrics_to_salary_slips.sql

ALTER TABLE salary_slips
ADD COLUMN IF NOT EXISTS absent_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worked_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 30;
