-- =========================================================================
-- 🏢 BillKaro Multi-Company Schema Migration
-- Run this in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Invoices table
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS company_id UUID;
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);

-- 2. Customers table
ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS company_id UUID;
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);

-- 3. Products table
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS company_id UUID;
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);

-- 4. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
