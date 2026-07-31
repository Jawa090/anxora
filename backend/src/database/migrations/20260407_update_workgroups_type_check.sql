-- Remove the old restrictive constraint
ALTER TABLE workgroups DROP CONSTRAINT IF EXISTS workgroups_type_check;

-- Add the expanded constraint that includes 'department'
ALTER TABLE workgroups ADD CONSTRAINT workgroups_type_check 
CHECK (((type)::text = ANY (ARRAY[
    ('team'::character varying)::text, 
    ('project'::character varying)::text, 
    ('private'::character varying)::text, 
    ('department'::character varying)::text
])));
