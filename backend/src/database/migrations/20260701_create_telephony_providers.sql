-- Create telephony_providers table
CREATE TABLE IF NOT EXISTS telephony_providers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(50) NOT NULL,
  display_name varchar(100) NOT NULL,
  is_enabled boolean DEFAULT false,
  settings jsonb DEFAULT '{}',
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_telephony_providers_org ON telephony_providers(org_id);
