-- backend/src/database/migrations/20260710_attendance_schema_updates.sql

ALTER TABLE users
ADD COLUMN IF NOT EXISTS attendance_machine_id character varying(100);

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS attendance_machine_ip character varying(100),
ADD COLUMN IF NOT EXISTS working_hours_per_day numeric(5,2) DEFAULT 9.00,
ADD COLUMN IF NOT EXISTS break_time_hours numeric(5,2) DEFAULT 1.00;

ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS source_ip character varying(100),
ADD COLUMN IF NOT EXISTS total_hours_worked numeric(5,2),
ADD COLUMN IF NOT EXISTS extra_time numeric(5,2),
ADD COLUMN IF NOT EXISTS less_time numeric(5,2),
ADD COLUMN IF NOT EXISTS raw_device_log jsonb;

CREATE INDEX IF NOT EXISTS idx_users_attendance_machine_id ON users (attendance_machine_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance (status);
