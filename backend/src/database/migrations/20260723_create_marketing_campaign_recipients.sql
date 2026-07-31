CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    contact_id UUID,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Queued', 'Sending', 'Delivered', 'Opened', 'Clicked', 'Bounce', 'Failed', 'Unsubscribed')),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_campaign ON marketing_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_email ON marketing_campaign_recipients(email);
