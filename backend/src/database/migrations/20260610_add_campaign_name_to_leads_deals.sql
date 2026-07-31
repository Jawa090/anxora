-- Migration: Add campaign_name column to leads and deals tables
-- This allows displaying campaign name in the leads/deals list views

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255);

ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255);
