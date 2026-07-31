-- Add auto_add_leads to instantly_integrations
ALTER TABLE instantly_integrations 
ADD COLUMN IF NOT EXISTS auto_add_leads BOOLEAN DEFAULT false;
