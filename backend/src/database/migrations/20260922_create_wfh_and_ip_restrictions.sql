-- ====================================================================
-- Migration: Work From Home (WFH) & Office IP Restrictions
-- ====================================================================

-- 1. Add IP restriction toggle to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS ip_restriction_enabled BOOLEAN DEFAULT false;

-- 2. Office IP Restrictions Table
CREATE TABLE IF NOT EXISTS public.office_ip_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    ip_address VARCHAR(100) NOT NULL,
    label VARCHAR(255) DEFAULT 'Office Network',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_ip_restrictions_org 
ON public.office_ip_restrictions (org_id, is_active);

-- 3. Work From Home (WFH) Requests Table
CREATE TABLE IF NOT EXISTS public.wfh_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested NUMERIC(4,1) DEFAULT 1,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT wfh_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_wfh_requests_org_dates_status 
ON public.wfh_requests (org_id, employee_id, start_date, end_date, status);

CREATE INDEX IF NOT EXISTS idx_wfh_requests_user 
ON public.wfh_requests (user_id, status);
