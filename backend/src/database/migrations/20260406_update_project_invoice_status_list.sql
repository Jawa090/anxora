
-- Add 'cancelled' to the allowed statuses for project invoices
ALTER TABLE public.project_invoices DROP CONSTRAINT IF EXISTS project_invoices_status_check;
ALTER TABLE public.project_invoices ADD CONSTRAINT project_invoices_status_check 
    CHECK (status IN ('draft', 'sent', 'paid', 'void', 'overdue', 'cancelled'));
