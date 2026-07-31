UPDATE users SET ROLE='super_admin' WHERE email='superadmin2@bitwords.com';
ALTER TABLE public.crm_custom_field_templates ADD COLUMN IF NOT EXISTS after_field_id VARCHAR(255);
