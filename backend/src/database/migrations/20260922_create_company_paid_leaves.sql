-- Migration: Create company_paid_leaves table
CREATE TABLE IF NOT EXISTS public.company_paid_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    country VARCHAR(10) DEFAULT 'ALL',
    description TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT company_paid_leaves_org_date_country_unique UNIQUE(org_id, date, country)
);

CREATE INDEX IF NOT EXISTS idx_company_paid_leaves_org_date ON public.company_paid_leaves (org_id, date);
