-- =========================================================================
-- 🏢 BillKaro Multi-Company Schema Migration (Flexible TEXT Type)
-- Run this in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Invoices table (ensure column exists and is TEXT)
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.invoices ALTER COLUMN company_id TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);

-- 2. Customers table (ensure column exists and is TEXT)
ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.customers ALTER COLUMN company_id TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);

-- 3. Products table (ensure column exists and is TEXT)
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.products ALTER COLUMN company_id TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);

-- 4. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
