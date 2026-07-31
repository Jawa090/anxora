CREATE TABLE IF NOT EXISTS marketing_email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_campaign_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE UNIQUE,
    sent INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    opened INTEGER DEFAULT 0,
    clicked INTEGER DEFAULT 0,
    bounced INTEGER DEFAULT 0,
    spam INTEGER DEFAULT 0,
    unsubscribed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_campaign_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    activity VARCHAR(100) NOT NULL,
    description TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE,
    provider VARCHAR(50) DEFAULT 'SMTP',
    host VARCHAR(255),
    port INTEGER,
    username VARCHAR(255),
    password TEXT,
    encryption VARCHAR(20) DEFAULT 'TLS',
    from_name VARCHAR(255),
    from_email VARCHAR(255),
    reply_to VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_campaign_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    schedule_type VARCHAR(50) DEFAULT 'once',
    timezone VARCHAR(50) DEFAULT 'UTC',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    repeat_every VARCHAR(50),
    next_run TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_email_attachments_campaign ON marketing_email_attachments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_activities_campaign ON marketing_campaign_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_schedules_campaign ON marketing_campaign_schedules(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_email_settings_org ON marketing_email_settings(organization_id);
