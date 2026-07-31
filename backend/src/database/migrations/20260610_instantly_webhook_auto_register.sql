-- Migration: Store Instantly API webhook registration IDs

ALTER TABLE instantly_integrations
ADD COLUMN IF NOT EXISTS registered_webhook_ids jsonb DEFAULT '[]'::jsonb;
