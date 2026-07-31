-- Stores every raw incoming Instantly webhook request for debugging
CREATE TABLE IF NOT EXISTS instantly_webhook_raw_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      text        NOT NULL,
  headers     jsonb,
  payload     jsonb,
  status      text,       -- accepted | rejected | error
  note        text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iwrl_org_received ON instantly_webhook_raw_log (org_id, received_at DESC);

-- Auto-purge logs older than 7 days (keep table small)
CREATE OR REPLACE FUNCTION purge_old_webhook_raw_logs() RETURNS void LANGUAGE sql AS $$
  DELETE FROM instantly_webhook_raw_log WHERE received_at < now() - interval '7 days';
$$;
