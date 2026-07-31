-- Accounts Payable Tables

CREATE TABLE IF NOT EXISTS finance_vendor_bills (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
    invoice_number varchar(100) NOT NULL UNIQUE,
    invoice_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date,
    currency uuid REFERENCES finance_currencies(id) ON DELETE SET NULL,
    amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    status varchar(50) DEFAULT 'draft', -- draft, posted, paid, partially_paid
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_vendor_payments (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_bill_id uuid NOT NULL REFERENCES finance_vendor_bills(id) ON DELETE CASCADE,
    payment_date date NOT NULL DEFAULT CURRENT_DATE,
    payment_method varchar(100) NOT NULL, -- cash, bank_transfer, cheque, credit_card
    bank_account uuid NOT NULL REFERENCES finance_chart_accounts(id) ON DELETE CASCADE,
    amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    reference varchar(100),
    created_at timestamp DEFAULT now()
);

ALTER TABLE finance_vendor_bills 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS address TEXT;