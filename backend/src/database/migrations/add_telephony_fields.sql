-- Migration: Add RingCentral telephony fields and SMS logs table
-- Run against database: CRM

-- Enhance call_logs with RC-specific and entity association fields
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS lead_id uuid;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS deal_id uuid;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS entity_type varchar(50);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS provider varchar(50) DEFAULT 'ringcentral';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS rc_session_id varchar(255);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS rc_call_id varchar(255);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_result varchar(100);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcript text;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ai_recap text;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS from_name varchar(255);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS to_name varchar(255);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS from_number varchar(50);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS to_number varchar(50);

-- SMS logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  contact_id uuid REFERENCES contacts(id),
  entity_type varchar(50),
  entity_id uuid,
  direction varchar(20) NOT NULL,
  phone_number varchar(50) NOT NULL,
  from_number varchar(50),
  to_number varchar(50),
  message_text text,
  provider varchar(50) DEFAULT 'ringcentral',
  rc_message_id varchar(255),
  status varchar(50) DEFAULT 'sent',
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_logs_entity ON call_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_org_date ON call_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_provider ON call_logs(provider);
CREATE INDEX IF NOT EXISTS idx_call_logs_rc_session ON call_logs(rc_session_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_org ON sms_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_entity ON sms_logs(entity_type, entity_id);
