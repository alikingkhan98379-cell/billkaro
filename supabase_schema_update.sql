-- =========================================================================
-- 🏢 BillKaro Zero-Trust Security & Admin Authorization Migration
-- Run this in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Multi-Company Support Columns
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.invoices ALTER COLUMN company_id TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);

ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.customers ALTER COLUMN company_id TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);

ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.products ALTER COLUMN company_id TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);

-- 2. Subscriptions Table Columns (Ensure all fields exist)
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
        ALTER TABLE public.subscriptions ADD COLUMN status TEXT DEFAULT 'ACTIVE';
    END IF;
END $$;

-- 3. Notifications Table Check Constraint (Support all notification types)
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('payment', 'PAYMENT_APPROVED', 'invoice_created', 'invoice_overdue', 'welcome', 'system', 'security'));

-- 4. Authoritative Server-Side Admin Role Function
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

-- 5. Authoritative Admin Approve Payment Function (Atomic + Expiry Extension + In-App Notification)
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
    v_plan_title TEXT;
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

    -- Determine authoritative plan duration & title
    IF v_payment.plan_id = 'monthly' THEN
        v_duration := 30;
        v_plan_title := 'Monthly Plan (₹49)';
    ELSIF v_payment.plan_id = 'six_months' THEN
        v_duration := 180;
        v_plan_title := '6-Month Plan (₹250)';
    ELSIF v_payment.plan_id = 'yearly' THEN
        v_duration := 365;
        v_plan_title := 'Yearly Plan (₹470)';
    ELSE
        v_duration := 30;
        v_plan_title := upper(v_payment.plan_id);
    END IF;

    -- Fetch user existing subscription to protect remaining paid time (Extension logic)
    SELECT * INTO v_existing_sub 
    FROM public.subscriptions 
    WHERE user_id = v_payment.user_id 
    FOR UPDATE;

    IF v_existing_sub.id IS NOT NULL AND v_existing_sub.is_active = true AND v_existing_sub.expiry_date IS NOT NULL AND v_existing_sub.expiry_date > now() THEN
        -- Existing active subscription -> Extend from existing future expiry date
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

    -- 4. In-App User Success Notification (Delivered under SECURITY DEFINER bypass of RLS)
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
        v_payment.user_id,
        'Premium Activated 🎉',
        'Your BillKaro payment of ₹' || v_payment.amount || ' for ' || v_plan_title || ' has been verified! Premium is active until ' || to_char(v_new_expiry, 'DD Mon YYYY') || '. Ads are OFF.',
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

-- 6. Authoritative Admin Reject Payment Function
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

-- 7. Authoritative Admin Get All Payments Function
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

-- 8. Revoke all default execution permissions from PUBLIC & anon
REVOKE ALL ON FUNCTION public.admin_approve_payment(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reject_payment(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_payments(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon;

-- Grant execution to authenticated users (role checked inside function)
GRANT EXECUTE ON FUNCTION public.admin_approve_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_payment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_payments(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- 9. Realtime publication settings for Subscriptions and Payments
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- 10. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

