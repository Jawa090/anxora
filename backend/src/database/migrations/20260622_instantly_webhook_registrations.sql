CREATE TABLE IF NOT EXISTS instantly_webhook_registrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  webhook_id  TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, event_type)
);
