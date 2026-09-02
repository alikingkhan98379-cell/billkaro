-- ==============================================================================
-- BillKaro - Production-Grade GST Billing & Invoice Database Schema
-- High Security: Explicit Per-Operation RLS, Constraints, Triggers & Storage
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Business Profile
CREATE TABLE IF NOT EXISTS public.business_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    account_no TEXT DEFAULT '',
    ifsc TEXT DEFAULT '',
    signature_url TEXT DEFAULT '',
    upi_id TEXT DEFAULT '',
    terms_conditions TEXT DEFAULT '1. Goods once sold will not be taken back.
2. Payment due within 15 days of invoice date.
3. Subject to local jurisdiction.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Customers Master
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    state TEXT DEFAULT 'Delhi',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Products / Items Master
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    hsn_code TEXT DEFAULT '',
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    unit TEXT NOT NULL DEFAULT 'PCS',
    gst_percent NUMERIC(5,2) NOT NULL DEFAULT 18.00 CHECK (gst_percent >= 0 AND gst_percent <= 28),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    tax_type TEXT NOT NULL DEFAULT 'CGST_SGST' CHECK (tax_type IN ('CGST_SGST', 'IGST', 'NONE')),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    cgst NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (cgst >= 0),
    sgst NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (sgst >= 0),
    igst NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (igst >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('PAID', 'UNPAID', 'PARTIAL', 'OVERDUE')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, invoice_number)
);

-- 5. Invoice Line Items
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    hsn_code TEXT DEFAULT '',
    qty NUMERIC(10,2) NOT NULL DEFAULT 1.00 CHECK (qty > 0),
    unit TEXT NOT NULL DEFAULT 'PCS',
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    gst_percent NUMERIC(5,2) NOT NULL DEFAULT 18.00 CHECK (gst_percent >= 0 AND gst_percent <= 28),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT '',
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('payment', 'invoice_created', 'invoice_overdue', 'welcome', 'system', 'security')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    upgraded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Subscription Upgrade Requests (UPI Screenshots)
CREATE TABLE IF NOT EXISTS public.subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    utr_number TEXT NOT NULL,
    screenshot_url TEXT DEFAULT '',
    amount NUMERIC(10,2) DEFAULT 499.00,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- Enable RLS
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- Explicit Policies per Operation
CREATE POLICY "bp_select" ON public.business_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bp_insert" ON public.business_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bp_update" ON public.business_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bp_delete" ON public.business_profile FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "cust_select" ON public.customers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cust_insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cust_update" ON public.customers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cust_delete" ON public.customers FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "prod_select" ON public.products FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "prod_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prod_update" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prod_delete" ON public.products FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "inv_select" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "inv_insert" ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inv_update" ON public.invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inv_delete" ON public.invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "item_select" ON public.invoice_items FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.invoices WHERE public.invoices.id = invoice_items.invoice_id AND public.invoices.user_id = auth.uid()));

CREATE POLICY "item_insert" ON public.invoice_items FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.invoices WHERE public.invoices.id = invoice_items.invoice_id AND public.invoices.user_id = auth.uid()));

CREATE POLICY "item_update" ON public.invoice_items FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.invoices WHERE public.invoices.id = invoice_items.invoice_id AND public.invoices.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.invoices WHERE public.invoices.id = invoice_items.invoice_id AND public.invoices.user_id = auth.uid()));

CREATE POLICY "item_delete" ON public.invoice_items FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.invoices WHERE public.invoices.id = invoice_items.invoice_id AND public.invoices.user_id = auth.uid()));

CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sub_select" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sub_insert" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sub_update" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sub_delete" ON public.subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sub_req_select" ON public.subscription_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sub_req_insert" ON public.subscription_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sub_req_update" ON public.subscription_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-provisioning trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.business_profile (user_id, name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business'), COALESCE(NEW.email, ''))
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.subscriptions (user_id, plan, is_active)
    VALUES (NEW.id, 'free', true)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
        NEW.id, 
        'Welcome to BillKaro! ??', 
        'Start by completing your Business Profile and adding your Bank / UPI details for instant QR invoices.',
        'welcome', 
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('logos', 'logos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('signatures', 'signatures', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('payment_proofs', 'payment_proofs', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies
CREATE POLICY "Users can upload their own logo" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read logo" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'logos');

CREATE POLICY "Users can update their own logo" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own logo" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload their own signature" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read signature" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'signatures');

CREATE POLICY "Users can update their own signature" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own signature" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload payment proofs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment_proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view payment proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment_proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ==============================================================================
-- 9. GSTIN Lookup Log (Backend Proxy Rate Limiting & Auditing)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.gstin_lookup_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gstin TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gstin_lookup_log_user_time ON public.gstin_lookup_log(user_id, created_at);

ALTER TABLE public.gstin_lookup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gll_select" ON public.gstin_lookup_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "gll_insert" ON public.gstin_lookup_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
