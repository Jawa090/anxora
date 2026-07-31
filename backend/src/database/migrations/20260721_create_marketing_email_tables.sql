CREATE TABLE IF NOT EXISTS marketing_campaign_audiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    audience_type VARCHAR(50) CHECK (audience_type IN ('Contact', 'Lead', 'Customer', 'Manual Email', 'Segment')),
    segment_id UUID,
    contact_id UUID,
    customer_id UUID,
    lead_id UUID,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_templates_org ON marketing_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_org ON marketing_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_audiences_campaign ON marketing_campaign_audiences(campaign_id);
