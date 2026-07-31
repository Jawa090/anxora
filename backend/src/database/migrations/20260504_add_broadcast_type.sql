-- Add 'broadcast' to the allowed workgroup types
ALTER TABLE workgroups DROP CONSTRAINT IF EXISTS workgroups_type_check;

ALTER TABLE workgroups ADD CONSTRAINT workgroups_type_check 
CHECK (((type)::text = ANY (ARRAY[
    ('team'::character varying)::text, 
    ('project'::character varying)::text, 
    ('private'::character varying)::text, 
    ('department'::character varying)::text
])));
