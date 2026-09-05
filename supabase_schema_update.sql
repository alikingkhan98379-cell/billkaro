-- =========================================================================
-- 🏢 BillKaro Comprehensive Database Schema & Payment Sync Update
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

-- 4. Authoritative Admin Approve Payment Function (Atomic + Expiry Extension + In-App Notification)
CREATE OR REPLACE FUNCTION public.admin_approve_payment(
    p_payment_id UUID, 
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_payment RECORD;
    v_existing_sub RECORD;
    v_duration INT := 30;
    v_new_expiry TIMESTAMPTZ;
    v_start_date TIMESTAMPTZ := now();
    v_plan_title TEXT;
BEGIN
    -- Security: Validate Admin Privileges
    IF NOT public.is_current_user_admin() THEN
        RAISE EXCEPTION 'Unauthorized. Only administrators can approve payments.';
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users (role checked inside function)
GRANT EXECUTE ON FUNCTION public.admin_approve_payment(UUID, TEXT) TO authenticated;

-- 5. Realtime publication settings for Subscriptions and Payments
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

-- 6. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
