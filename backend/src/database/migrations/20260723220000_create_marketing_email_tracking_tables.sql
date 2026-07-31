CREATE TABLE IF NOT EXISTS marketing_email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES marketing_campaign_recipients(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    attempts INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES marketing_campaign_recipients(id) ON DELETE CASCADE,
    provider VARCHAR(100),
    message_id VARCHAR(255),
    status VARCHAR(50),
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_email_opens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES marketing_campaign_recipients(id) ON DELETE CASCADE,
    ip_address VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    device VARCHAR(100),
    browser VARCHAR(100),
    opened_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_email_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES marketing_campaign_recipients(id) ON DELETE CASCADE,
    url TEXT,
    ip_address VARCHAR(50),
    device VARCHAR(100),
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_email_bounces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES marketing_campaign_recipients(id) ON DELETE CASCADE,
    bounce_type VARCHAR(50),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_email_unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    contact_id UUID,
    email VARCHAR(255) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_email_queue_status ON marketing_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_marketing_email_queue_campaign ON marketing_email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_email_logs_campaign ON marketing_email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_email_opens_campaign ON marketing_email_opens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_email_clicks_campaign ON marketing_email_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_email_unsubscribes_email ON marketing_email_unsubscribes(email);
