-- backend/src/database/migrations/20260911_create_shift_management_tables.sql

-- 1. Create shift_templates table
CREATE TABLE IF NOT EXISTS shift_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_mins INTEGER NOT NULL DEFAULT 15,
    description TEXT,
    color VARCHAR(30) DEFAULT '#f59e0b',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_org ON shift_templates(org_id);

-- 2. Create employee_shifts table
CREATE TABLE IF NOT EXISTS employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shift_templates(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_employee_shift_org UNIQUE (employee_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift ON employee_shifts(shift_id);

-- 3. Update attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS punctuality VARCHAR(20) DEFAULT 'on_time',
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_punctuality ON attendance(punctuality);
