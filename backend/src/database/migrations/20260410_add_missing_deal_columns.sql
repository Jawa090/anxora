-- Add all missing columns to deals table

ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS available_to_everyone BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS client_type TEXT,
ADD COLUMN IF NOT EXISTS project_type TEXT,
ADD COLUMN IF NOT EXISTS scope TEXT,
ADD COLUMN IF NOT EXISTS feedback TEXT,
ADD COLUMN IF NOT EXISTS feedback_details TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS invoice_link TEXT,
ADD COLUMN IF NOT EXISTS qa_status TEXT,
ADD COLUMN IF NOT EXISTS quotation_received TEXT,
ADD COLUMN IF NOT EXISTS hours_of_work TEXT,
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS hourly_rate_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS proposal_amount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS proposal_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS invoice_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS project_blueprints JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb; ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;