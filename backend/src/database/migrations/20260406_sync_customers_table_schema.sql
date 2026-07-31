-- Migration: Sync customers table with CRM controllers
-- Created at: 2026-04-06

ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS name varchar(255),
ADD COLUMN IF NOT EXISTS email varchar(255),
ADD COLUMN IF NOT EXISTS phone varchar(50),
ADD COLUMN IF NOT EXISTS tier varchar(50),
ADD COLUMN IF NOT EXISTS total_revenue numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS lead_id uuid,
ADD COLUMN IF NOT EXISTS deal_id uuid;

-- Optional: Link lifetime_value to total_revenue if needed, but the controller uses total_revenue
-- For now we just ensure columns exist to prevent 500 errors.
