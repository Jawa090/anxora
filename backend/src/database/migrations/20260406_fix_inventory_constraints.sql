-- Fix not-null constraints that are causing issues with current controller logic
-- purchase_order_items: total_price is required by DB but not provided by controller
ALTER TABLE public.purchase_order_items ALTER COLUMN total_price DROP NOT NULL;
ALTER TABLE public.purchase_order_items ALTER COLUMN tax_rate SET DEFAULT 0;

-- stock_movements: movement_type is required by DB but controller uses 'type' column
ALTER TABLE public.stock_movements ALTER COLUMN movement_type DROP NOT NULL;

-- Ensure consistency across other potential missing columns
ALTER TABLE public.purchase_orders ALTER COLUMN order_date SET DEFAULT CURRENT_DATE;
