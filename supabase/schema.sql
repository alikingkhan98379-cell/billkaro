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
    full_name TEXT DEFAULT '',
    last_login_at TIMESTAMPTZ DEFAULT now(),
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
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
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
        'Welcome to BillKaro! 🎉', 
        'Start by completing your Business Profile and adding your Bank / UPI details for instant QR invoices.',
        'welcome', 
        false
    );

    RETURN NEW;
END;
$$;

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

CREATE POLICY "Users and admins can view payment proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment_proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_current_user_admin()));

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

-- ==============================================================================
-- 10. Auth Activity Logs (Security Auditing & Login History)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.auth_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    event_type TEXT NOT NULL,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON public.auth_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_email ON public.auth_activity_logs(email, created_at DESC);

ALTER TABLE public.auth_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aal_select" ON public.auth_activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "aal_insert" ON public.auth_activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aal_insert_anon" ON public.auth_activity_logs FOR INSERT TO anon WITH CHECK (user_id IS NULL);

-- Ensure strict uniqueness on business profile email (if provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_profile_email ON public.business_profile (LOWER(email)) WHERE email != '' AND email IS NOT NULL;

-- ==============================================================================
-- 11. Check User Auth Status & Server-Side Duplicate Account Prevention
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_user_auth_status(lookup_email TEXT)
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    found_user RECORD;
    is_google BOOLEAN := false;
    is_email_pass BOOLEAN := false;
    user_providers JSONB;
BEGIN
    SELECT 
        u.id, 
        u.email, 
        u.raw_app_meta_data, 
        u.encrypted_password,
        COALESCE(u.raw_app_meta_data->'providers', '[]'::jsonb) as providers
    INTO found_user
    FROM auth.users u
    WHERE LOWER(u.email) = LOWER(TRIM(lookup_email))
    LIMIT 1;

    IF found_user.id IS NULL THEN
        -- Secondary check in business_profile table
        IF EXISTS (SELECT 1 FROM public.business_profile WHERE LOWER(email) = LOWER(TRIM(lookup_email))) THEN
            RETURN json_build_object(
                'exists', true,
                'has_google', false,
                'has_password', true,
                'provider', 'email'
            );
        END IF;
        RETURN json_build_object('exists', false);
    END IF;

    -- Check if user has Google provider identity
    IF EXISTS (
        SELECT 1 FROM auth.identities 
        WHERE user_id = found_user.id AND provider = 'google'
    ) OR (found_user.raw_app_meta_data->>'provider' = 'google') 
      OR (found_user.providers @> '["google"]'::jsonb) THEN
        is_google := true;
    END IF;

    -- Check if user has password / email provider
    IF (found_user.encrypted_password IS NOT NULL AND length(found_user.encrypted_password) > 0)
       OR (found_user.raw_app_meta_data->>'provider' = 'email')
       OR (found_user.providers @> '["email"]'::jsonb) THEN
        is_email_pass := true;
    END IF;

    RETURN json_build_object(
        'exists', true,
        'has_google', is_google,
        'has_password', is_email_pass,
        'provider', CASE 
            WHEN is_google AND is_email_pass THEN 'both'
            WHEN is_google THEN 'google'
            ELSE 'email'
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_auth_status(TEXT) TO anon, authenticated;

-- ==============================================================================
-- 12. Secure UPI Premium Payment System (Phase 1 Production)
-- ==============================================================================

-- 12.1 Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    upi_id TEXT NOT NULL DEFAULT '9638938258@ybl',
    payment_note TEXT NOT NULL DEFAULT 'BillKaro',
    utr TEXT,
    transaction_reference TEXT,
    screenshot_path TEXT,
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'WAITING_FOR_PAYMENT', 'SUBMITTED', 'VERIFYING', 'PENDING_ADMIN', 'APPROVED', 'REJECTED', 'EXPIRED')),
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPICIOUS')),
    verification_message TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 hour')
);

-- Partial Unique index: Prevent duplicate UTR reuse across non-rejected payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_utr_unique 
ON public.payments (LOWER(TRIM(utr))) 
WHERE utr IS NOT NULL AND utr != '' AND status NOT IN ('REJECTED', 'EXPIRED');

-- Partial Unique index: Prevent duplicate Transaction Reference reuse across non-rejected payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_txn_ref_unique 
ON public.payments (LOWER(TRIM(transaction_reference))) 
WHERE transaction_reference IS NOT NULL AND transaction_reference != '' AND status NOT IN ('REJECTED', 'EXPIRED');

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);

-- 12.2 Payment Audit Logs Table
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_payment_id ON public.payment_audit_logs(payment_id, created_at DESC);

-- 12.3 Enhanced Subscriptions Table columns (if missing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'plan_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN plan_id TEXT DEFAULT 'free';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'start_date') THEN
        ALTER TABLE public.subscriptions ADD COLUMN start_date TIMESTAMPTZ DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'expiry_date') THEN
        ALTER TABLE public.subscriptions ADD COLUMN expiry_date TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'payment_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'status') THEN
        ALTER TABLE public.subscriptions ADD COLUMN status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED'));
    END IF;
END $$;

-- 12.4 Enable RLS on Payments & Audit Logs
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper to check if current user is Admin (Authoritative Server Check)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_email TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT 
        COALESCE(raw_app_meta_data->>'role', ''),
        COALESCE(email, '')
    INTO v_role, v_email
    FROM auth.users
    WHERE id = auth.uid();

    IF v_role = 'admin' OR LOWER(v_email) IN ('smartgstbill@gmail.com', 'admin@billkaro.com') THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- Payments RLS Policies (Zero Trust: Strict Scoping)
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payments_update_user" ON public.payments;
CREATE POLICY "payments_update_user" ON public.payments 
FOR UPDATE TO authenticated 
USING (auth.uid() = user_id AND status IN ('CREATED', 'WAITING_FOR_PAYMENT'))
WITH CHECK (auth.uid() = user_id AND status IN ('CREATED', 'WAITING_FOR_PAYMENT', 'SUBMITTED', 'PENDING_ADMIN'));

DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;
CREATE POLICY "payments_admin_all" ON public.payments 
FOR ALL TO authenticated 
USING (public.is_current_user_admin());

-- Audit Logs RLS Policies (Users can only read own, modification is strictly forbidden)
DROP POLICY IF EXISTS "audit_select" ON public.payment_audit_logs;
CREATE POLICY "audit_select" ON public.payment_audit_logs 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "audit_insert" ON public.payment_audit_logs;
CREATE POLICY "audit_insert" ON public.payment_audit_logs 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

-- Subscriptions RLS Hardening: Regular users cannot modify subscription status directly
DROP POLICY IF EXISTS "sub_update" ON public.subscriptions;
CREATE POLICY "sub_update_admin_only" ON public.subscriptions 
FOR UPDATE TO authenticated 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- 12.4.1 Database Integrity Triggers (Anti-Tampering & Immutable Pricing)

-- Trigger 1: Enforce Authoritative Payment Pricing, Plan Immutability & Prevent Unauthorized Status Escalation
CREATE OR REPLACE FUNCTION public.enforce_payment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- 1. Enforce Authoritative Plan Pricing (Database-level Zero Trust)
    IF NEW.plan_id = 'monthly' THEN
        NEW.amount := 49.00;
    ELSIF NEW.plan_id = 'six_months' THEN
        NEW.amount := 250.00;
    ELSIF NEW.plan_id = 'yearly' THEN
        NEW.amount := 470.00;
    ELSE
        RAISE EXCEPTION 'Invalid plan selected: %', NEW.plan_id;
    END IF;

    -- 2. Hardcoded destination details
    NEW.currency := 'INR';
    NEW.upi_id := '9638938258@ybl';
    NEW.payment_note := 'BillKaro';

    -- 3. Non-admin users cannot manipulate critical fields directly
    IF NOT public.is_current_user_admin() THEN
        IF TG_OP = 'INSERT' THEN
            NEW.status := 'WAITING_FOR_PAYMENT';
            NEW.verification_status := 'UNVERIFIED';
            NEW.approved_at := NULL;
            NEW.rejected_at := NULL;
        ELSIF TG_OP = 'UPDATE' THEN
            -- Block unauthorized status escalation to APPROVED / REJECTED
            IF NEW.status IN ('APPROVED', 'REJECTED') AND OLD.status NOT IN ('APPROVED', 'REJECTED') THEN
                RAISE EXCEPTION 'Unauthorized status modification. Status can only be verified and approved by administrators.';
            END IF;
            -- Enforce immutability of amount, plan_id, order_id, and user_id
            NEW.amount := OLD.amount;
            NEW.plan_id := OLD.plan_id;
            NEW.order_id := OLD.order_id;
            NEW.user_id := OLD.user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payment_integrity ON public.payments;
CREATE TRIGGER trg_enforce_payment_integrity
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_integrity();

-- Trigger 2: Prevent Direct Client Modification of Subscriptions
CREATE OR REPLACE FUNCTION public.enforce_subscription_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NOT public.is_current_user_admin() THEN
            IF NEW.plan != OLD.plan OR NEW.is_active != OLD.is_active OR NEW.expiry_date != OLD.expiry_date THEN
                RAISE EXCEPTION 'Unauthorized direct subscription modification.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_subscription_integrity ON public.subscriptions;
CREATE TRIGGER trg_enforce_subscription_integrity
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_integrity();

-- Trigger 3: Immutability of Audit Logs (Cannot be altered or deleted)
CREATE OR REPLACE FUNCTION public.protect_audit_logs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Payment audit logs are immutable and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_audit_logs ON public.payment_audit_logs;
CREATE TRIGGER trg_protect_audit_logs
    BEFORE UPDATE OR DELETE ON public.payment_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.protect_audit_logs();


-- 12.5 Secure Payment RPCs

-- 1. Create Payment Order (Authoritative Server-side Price & Duration)
CREATE OR REPLACE FUNCTION public.create_payment_order(p_plan_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_amount NUMERIC(10,2);
    v_order_id TEXT;
    v_payment_id UUID;
    v_expires_at TIMESTAMPTZ := now() + INTERVAL '1 hour';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a payment order.';
    END IF;

    -- Authoritative server-side plan-to-price mapping (NEVER trust frontend amount)
    IF p_plan_id = 'monthly' THEN
        v_amount := 49.00;
    ELSIF p_plan_id = 'six_months' THEN
        v_amount := 250.00;
    ELSIF p_plan_id = 'yearly' THEN
        v_amount := 470.00;
    ELSE
        RAISE EXCEPTION 'Invalid plan selected: %', p_plan_id;
    END IF;

    -- Generate cryptographically random unique order ID: BILLKARO-YYYYMMDD-XXXXXXXX
    v_order_id := 'BILLKARO-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 8));

    INSERT INTO public.payments (
        user_id,
        order_id,
        plan_id,
        amount,
        currency,
        payment_method,
        upi_id,
        payment_note,
        status,
        verification_status,
        expires_at
    ) VALUES (
        v_user_id,
        v_order_id,
        p_plan_id,
        v_amount,
        'INR',
        'UPI',
        '9638938258@ybl',
        'BillKaro',
        'WAITING_FOR_PAYMENT',
        'UNVERIFIED',
        v_expires_at
    ) RETURNING id INTO v_payment_id;

    -- Log payment creation in audit
    INSERT INTO public.payment_audit_logs (payment_id, user_id, action, performed_by, metadata)
    VALUES (
        v_payment_id, 
        v_user_id, 
        'PAYMENT_CREATED', 
        v_user_id, 
        jsonb_build_object('order_id', v_order_id, 'plan_id', p_plan_id, 'amount', v_amount)
    );

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'order_id', v_order_id,
        'plan_id', p_plan_id,
        'amount', v_amount,
        'currency', 'INR',
        'upi_id', '9638938258@ybl',
        'payment_note', 'BillKaro',
        'expires_at', v_expires_at
    );
END;
$$;

-- 2. Submit Payment Proof (UTR + Transaction Reference + Screenshot)
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
    p_order_id TEXT, 
    p_utr TEXT, 
    p_transaction_reference TEXT DEFAULT NULL,
    p_screenshot_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_payment RECORD;
    v_clean_utr TEXT;
    v_clean_txn_ref TEXT;
    v_verification_status TEXT := 'UNDER_REVIEW';
    v_user_message TEXT := 'Your payment proof has been submitted successfully and is under review.';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 1. Identifier Normalization
    v_clean_utr := UPPER(TRIM(COALESCE(p_utr, '')));
    v_clean_txn_ref := UPPER(TRIM(COALESCE(p_transaction_reference, '')));
    IF v_clean_txn_ref = '' THEN 
        v_clean_txn_ref := NULL; 
    END IF;

    IF length(v_clean_utr) < 6 THEN
        RETURN jsonb_build_object('error', 'Please enter a valid 12-digit UPI / UTR Reference Number.');
    END IF;

    -- 2. Find payment order
    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE order_id = trim(p_order_id) AND user_id = v_user_id;

    IF v_payment.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Payment order not found.');
    END IF;

    IF v_payment.status = 'APPROVED' THEN
        RETURN jsonb_build_object('error', 'This payment order has already been approved and activated.');
    END IF;

    -- 3. Duplicate UTR Check (Cross-User & Cross-Order)
    IF EXISTS (
        SELECT 1 FROM public.payments 
        WHERE LOWER(TRIM(utr)) = LOWER(v_clean_utr) 
          AND id != v_payment.id 
          AND status NOT IN ('REJECTED', 'EXPIRED')
    ) THEN
        INSERT INTO public.payment_audit_logs (payment_id, user_id, action, performed_by, metadata)
        VALUES (
            v_payment.id, 
            v_user_id, 
            'DUPLICATE_UTR_ATTEMPT', 
            v_user_id, 
            jsonb_build_object('order_id', v_payment.order_id, 'utr', v_clean_utr)
        );
        RETURN jsonb_build_object('error', 'This transaction reference has already been submitted.');
    END IF;

    -- 4. Duplicate Transaction Reference Check (Cross-User & Cross-Order)
    IF v_clean_txn_ref IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.payments 
        WHERE LOWER(TRIM(transaction_reference)) = LOWER(v_clean_txn_ref) 
          AND id != v_payment.id 
          AND status NOT IN ('REJECTED', 'EXPIRED')
    ) THEN
        INSERT INTO public.payment_audit_logs (payment_id, user_id, action, performed_by, metadata)
        VALUES (
            v_payment.id, 
            v_user_id, 
            'DUPLICATE_TRANSACTION_ATTEMPT', 
            v_user_id, 
            jsonb_build_object('order_id', v_payment.order_id, 'transaction_reference', v_clean_txn_ref)
        );
        RETURN jsonb_build_object('error', 'This transaction reference has already been submitted.');
    END IF;

    -- 5. Anti-Replay / UTR == Transaction Reference Suspicion Rule
    IF v_clean_txn_ref IS NOT NULL AND v_clean_utr = v_clean_txn_ref THEN
        v_verification_status := 'SUSPICIOUS';
        v_user_message := 'Your payment details require additional verification.';

        INSERT INTO public.payment_audit_logs (payment_id, user_id, action, performed_by, metadata)
        VALUES (
            v_payment.id, 
            v_user_id, 
            'UTR_TRANSACTION_MATCH', 
            v_user_id, 
            jsonb_build_object(
                'order_id', v_payment.order_id, 
                'utr', v_clean_utr, 
                'transaction_reference', v_clean_txn_ref,
                'note', 'UTR and Transaction ID are identical'
            )
        );
    ELSE
        v_verification_status := 'UNDER_REVIEW';
        v_user_message := 'Your payment proof has been submitted successfully and is under review.';
    END IF;

    -- 6. Atomic State Update (Transition strictly to PENDING_ADMIN)
    UPDATE public.payments SET
        utr = v_clean_utr,
        transaction_reference = v_clean_txn_ref,
        screenshot_path = COALESCE(p_screenshot_path, v_payment.screenshot_path),
        status = 'PENDING_ADMIN',
        verification_status = v_verification_status,
        submitted_at = now(),
        updated_at = now()
    WHERE id = v_payment.id;

    -- 7. Audit Logging
    INSERT INTO public.payment_audit_logs (payment_id, user_id, action, performed_by, metadata)
    VALUES (
        v_payment.id, 
        v_user_id, 
        'PAYMENT_SUBMITTED', 
        v_user_id, 
        jsonb_build_object(
            'order_id', v_payment.order_id, 
            'utr', v_clean_utr, 
            'transaction_reference', v_clean_txn_ref,
            'verification_status', v_verification_status
        )
    );

    -- 8. In-App User Notification
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
        v_user_id,
        'Payment Under Verification ⏳',
        'We received your payment details for Order #' || v_payment.order_id || '. Verification takes a maximum of 4 hours.',
        'payment',
        false
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_payment.order_id,
        'status', 'PENDING_ADMIN',
        'verification_status', v_verification_status,
        'message', v_user_message
    );
END;
$$;

-- 3. Admin Approve Payment (Idempotent, Atomic Activation & Subscription Extension)
CREATE OR REPLACE FUNCTION public.admin_approve_payment(
    p_payment_id UUID, 
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_payment RECORD;
    v_existing_sub RECORD;
    v_duration INT := 30;
    v_new_expiry TIMESTAMPTZ;
    v_start_date TIMESTAMPTZ := now();
BEGIN
    -- Security: Authoritative Server-Side Admin Validation
    IF NOT public.is_current_user_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    -- Lock payment record
    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE id = p_payment_id 
    FOR UPDATE;

    IF v_payment.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Payment record not found.');
    END IF;

    -- Idempotency Check
    IF v_payment.status = 'APPROVED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Payment is already approved.');
    END IF;

    -- Determine authoritative plan duration
    IF v_payment.plan_id = 'monthly' THEN
        v_duration := 30;
    ELSIF v_payment.plan_id = 'six_months' THEN
        v_duration := 180;
    ELSIF v_payment.plan_id = 'yearly' THEN
        v_duration := 365;
    END IF;

    -- Fetch user existing subscription to protect remaining paid time
    SELECT * INTO v_existing_sub 
    FROM public.subscriptions 
    WHERE user_id = v_payment.user_id 
    FOR UPDATE;

    IF v_existing_sub.id IS NOT NULL AND v_existing_sub.is_active = true AND v_existing_sub.expiry_date IS NOT NULL AND v_existing_sub.expiry_date > now() THEN
        -- Existing active subscription -> Extend from existing expiry date
        v_start_date := COALESCE(v_existing_sub.start_date, now());
        v_new_expiry := v_existing_sub.expiry_date + (v_duration || ' days')::INTERVAL;
    ELSE
        -- Brand new or expired subscription -> Start from right now
        v_start_date := now();
        v_new_expiry := now() + (v_duration || ' days')::INTERVAL;
    END IF;

    -- 1. Atomically Update Payment Status
    UPDATE public.payments SET
        status = 'APPROVED',
        verification_status = 'VERIFIED',
        approved_at = now(),
        verified_at = now(),
        admin_notes = COALESCE(p_admin_note, admin_notes),
        updated_at = now()
    WHERE id = p_payment_id;

    -- 2. Atomically Upsert Active Subscription
    INSERT INTO public.subscriptions (
        user_id,
        plan,
        plan_id,
        status,
        is_active,
        start_date,
        expiry_date,
        payment_id,
        upgraded_at,
        updated_at
    ) VALUES (
        v_payment.user_id,
        'premium',
        v_payment.plan_id,
        'ACTIVE',
        true,
        v_start_date,
        v_new_expiry,
        p_payment_id,
        now(),
        now()
    ) ON CONFLICT (user_id) DO UPDATE SET
        plan = 'premium',
        plan_id = EXCLUDED.plan_id,
        status = 'ACTIVE',
        is_active = true,
        start_date = EXCLUDED.start_date,
        expiry_date = EXCLUDED.expiry_date,
        payment_id = EXCLUDED.payment_id,
        upgraded_at = now(),
        updated_at = now();

    -- 3. Log Audit Trail
    INSERT INTO public.payment_audit_logs (payment_id, user_id, action, performed_by, metadata)
    VALUES (
        p_payment_id,
        v_payment.user_id,
        'PAYMENT_APPROVED',
        v_admin_id,
        jsonb_build_object(
            'order_id', v_payment.order_id,
            'plan_id', v_payment.plan_id,
            'amount', v_payment.amount,
            'expiry_date', v_new_expiry,
            'admin_notes', p_admin_note
        )
    );

    -- 4. In-App User Success Notification
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
        v_payment.user_id,
        'Premium Activated 🎉',
        'Your BillKaro payment of ₹' || v_payment.amount || ' for ' || 
            CASE 
                WHEN v_payment.plan_id = 'monthly' THEN 'Monthly Plan (₹49)'
                WHEN v_payment.plan_id = 'six_months' THEN '6-Month Plan (₹250)'
                WHEN v_payment.plan_id = 'yearly' THEN 'Yearly Plan (₹470)'
                ELSE upper(v_payment.plan_id)
            END || ' has been verified! Premium is active until ' || to_char(v_new_expiry, 'DD Mon YYYY') || '. Ads are OFF.',
        'payment',
        false
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment approved and premium subscription successfully activated.',
        'expiry_date', v_new_expiry
    );
END;
$$;

-- 4. Admin Reject Payment
CREATE OR REPLACE FUNCTION public.admin_reject_payment(
    p_payment_id UUID, 
    p_reason TEXT, 
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_payment RECORD;
BEGIN
    -- Security: Authoritative Server-Side Admin Validation
    IF NOT public.is_current_user_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE id = p_payment_id;

    IF v_payment.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Payment record not found.');
    END IF;

    UPDATE public.payments SET
        status = 'REJECTED',
        verification_status = 'REJECTED',
        rejected_at = now(),
        verification_message = COALESCE(p_reason, 'Payment could not be verified in the bank account.'),
        admin_notes = COALESCE(p_admin_note, admin_notes),
        updated_at = now()
    WHERE id = p_payment_id;

    -- Audit log
    INSERT INTO public.payment_audit_logs (payment_id, user_id, action, performed_by, metadata)
    VALUES (
        p_payment_id,
        v_payment.user_id,
        'PAYMENT_REJECTED',
        v_admin_id,
        jsonb_build_object('order_id', v_payment.order_id, 'reason', p_reason, 'admin_notes', p_admin_note)
    );

    -- In-app notification
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
        v_payment.user_id,
        'Payment Verification Notice',
        'Payment for Order #' || v_payment.order_id || ' could not be verified. Reason: ' || COALESCE(p_reason, 'Transaction not found in bank account.'),
        'payment',
        false
    );

    RETURN jsonb_build_object('success', true, 'message', 'Payment rejected.');
END;
$$;

-- 5. Admin Get All Payments (Search by UTR, Transaction ID, Order ID, Email, Status)
CREATE OR REPLACE FUNCTION public.admin_get_payments(
    p_search TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    order_id TEXT,
    plan_id TEXT,
    amount NUMERIC,
    currency TEXT,
    payment_method TEXT,
    upi_id TEXT,
    payment_note TEXT,
    utr TEXT,
    transaction_reference TEXT,
    screenshot_path TEXT,
    status TEXT,
    verification_status TEXT,
    verification_message TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    user_email TEXT,
    user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Security: Authoritative Server-Side Admin Validation
    IF NOT public.is_current_user_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.order_id,
        p.plan_id,
        p.amount,
        p.currency,
        p.payment_method,
        p.upi_id,
        p.payment_note,
        p.utr,
        p.transaction_reference,
        p.screenshot_path,
        p.status,
        p.verification_status,
        p.verification_message,
        p.admin_notes,
        p.created_at,
        p.submitted_at,
        p.approved_at,
        p.rejected_at,
        COALESCE(u.email, bp.email, '') as user_email,
        COALESCE(bp.name, bp.full_name, 'Business User') as user_name
    FROM public.payments p
    LEFT JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.business_profile bp ON bp.user_id = p.user_id
    WHERE 
        (p_status IS NULL OR p_status = 'ALL' OR p.status = p_status)
        AND (
            p_search IS NULL OR p_search = '' 
            OR p.utr ILIKE '%' || p_search || '%'
            OR p.transaction_reference ILIKE '%' || p_search || '%'
            OR p.order_id ILIKE '%' || p_search || '%'
            OR u.email ILIKE '%' || p_search || '%'
            OR bp.name ILIKE '%' || p_search || '%'
        )
    ORDER BY p.created_at DESC;
END;
$$;

-- Revoke all default execution permissions from PUBLIC & anon
REVOKE ALL ON FUNCTION public.admin_approve_payment(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reject_payment(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_payments(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon;

-- Grant EXECUTE only to authenticated users (role authorization checked inside each function)
GRANT EXECUTE ON FUNCTION public.create_payment_order(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_payment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_payments(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;


