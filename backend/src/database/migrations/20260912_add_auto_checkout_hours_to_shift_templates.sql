-- backend/src/database/migrations/20260912_add_auto_checkout_hours_to_shift_templates.sql

-- 1. Add auto_checkout_hours column to shift_templates table
ALTER TABLE shift_templates
ADD COLUMN IF NOT EXISTS auto_checkout_hours NUMERIC(4,2);

-- 2. Populate auto_checkout_hours for existing shift templates based on start_time and end_time duration
UPDATE shift_templates
SET auto_checkout_hours = ROUND(
    (
        EXTRACT(EPOCH FROM (
            CASE 
                WHEN end_time < start_time THEN (end_time + INTERVAL '24 hours') - start_time
                ELSE end_time - start_time
            END
        )) / 3600.0
    )::numeric, 2
)
WHERE auto_checkout_hours IS NULL 
  AND start_time IS NOT NULL 
  AND end_time IS NOT NULL;
