ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS status character varying(50) DEFAULT 'active';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS created_by uuid;
