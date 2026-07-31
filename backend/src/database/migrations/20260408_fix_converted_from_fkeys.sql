-- Drop the existing foreign key constraints
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_converted_from_deal_id_fkey;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_converted_from_lead_id_fkey;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_converted_from_lead_id_fkey;

-- Recreate the foreign key constraints with ON DELETE SET NULL
ALTER TABLE public.customers
    ADD CONSTRAINT customers_converted_from_deal_id_fkey
    FOREIGN KEY (converted_from_deal_id)
    REFERENCES public.deals(id)
    ON DELETE SET NULL;

ALTER TABLE public.customers
    ADD CONSTRAINT customers_converted_from_lead_id_fkey
    FOREIGN KEY (converted_from_lead_id)
    REFERENCES public.leads(id)
    ON DELETE SET NULL;

ALTER TABLE public.deals
    ADD CONSTRAINT deals_converted_from_lead_id_fkey
    FOREIGN KEY (converted_from_lead_id)
    REFERENCES public.leads(id)
    ON DELETE SET NULL;
