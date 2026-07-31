-- Add contact_person and industry columns to deals table
-- These fields exist on leads and should be carried over on conversion

ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
ADD COLUMN IF NOT EXISTS industry VARCHAR(255);
