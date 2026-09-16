-- backend/src/database/migrations/20260916_add_attendance_thresholds_to_orgs_and_shifts.sql

-- 1. Add threshold columns to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS half_day_min_percentage NUMERIC(5,2) DEFAULT 25.00,
ADD COLUMN IF NOT EXISTS full_day_min_percentage NUMERIC(5,2) DEFAULT 75.00;

-- Update default working_hours_per_day to 8.00 if it was 9.00
UPDATE public.organizations 
SET working_hours_per_day = 8.00 
WHERE working_hours_per_day IS NULL OR working_hours_per_day = 9.00;

UPDATE public.organizations
SET half_day_min_percentage = 25.00
WHERE half_day_min_percentage IS NULL;

UPDATE public.organizations
SET full_day_min_percentage = 75.00
WHERE full_day_min_percentage IS NULL;

-- 2. Add threshold columns to shift_templates
ALTER TABLE public.shift_templates
ADD COLUMN IF NOT EXISTS working_hours NUMERIC(5,2) DEFAULT 8.00,
ADD COLUMN IF NOT EXISTS half_day_min_percentage NUMERIC(5,2) DEFAULT 25.00,
ADD COLUMN IF NOT EXISTS full_day_min_percentage NUMERIC(5,2) DEFAULT 75.00;

UPDATE public.shift_templates
SET working_hours = 8.00
WHERE working_hours IS NULL;

UPDATE public.shift_templates
SET half_day_min_percentage = 25.00
WHERE half_day_min_percentage IS NULL;

UPDATE public.shift_templates
SET full_day_min_percentage = 75.00
WHERE full_day_min_percentage IS NULL;
