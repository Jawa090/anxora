-- Migration: CRM Schema Fixes
-- Added on: 2026-05-07
-- Description: Adds missing columns to organizations and deals tables to support branding and bulk imports.

-- Add logo_url to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url character varying(500);

-- Add tracking columns to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS import_id uuid;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS pipeline character varying(100);
