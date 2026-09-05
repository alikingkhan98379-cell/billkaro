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

ALTER TABLE IF EXISTS public.business_profile ADD COLUMN IF NOT EXISTS companies_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS public.business_profile ADD COLUMN IF NOT EXISTS active_company_id TEXT;

-- 1.1 Invoices Multi-Company Unique Constraint & Index
DO $$
BEGIN
    ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_user_id_invoice_number_key;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_user_company_num 
ON public.invoices (user_id, COALESCE(company_id, ''), LOWER(TRIM(invoice_number)));

-- 1.2 Invoices Transport & Delivery Details (Optional Fields)
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS transport_name TEXT;
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS lr_number TEXT;

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

-- 9. Secure Payment RPCs & Triggers Hardening (search_path fixed)
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

    IF p_plan_id = 'monthly' THEN
        v_amount := 49.00;
    ELSIF p_plan_id = 'six_months' THEN
        v_amount := 250.00;
    ELSIF p_plan_id = 'yearly' THEN
        v_amount := 470.00;
    ELSE
        RAISE EXCEPTION 'Invalid plan selected: %', p_plan_id;
    END IF;

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

    v_clean_utr := UPPER(TRIM(COALESCE(p_utr, '')));
    v_clean_txn_ref := UPPER(TRIM(COALESCE(p_transaction_reference, '')));
    IF v_clean_txn_ref = '' THEN 
        v_clean_txn_ref := NULL; 
    END IF;

    IF length(v_clean_utr) < 6 THEN
        RETURN jsonb_build_object('error', 'Please enter a valid 12-digit UPI / UTR Reference Number.');
    END IF;

    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE order_id = trim(p_order_id) AND user_id = v_user_id;

    IF v_payment.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Payment order not found.');
    END IF;

    IF v_payment.status = 'APPROVED' THEN
        RETURN jsonb_build_object('error', 'This payment order has already been approved and activated.');
    END IF;

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

    UPDATE public.payments SET
        utr = v_clean_utr,
        transaction_reference = v_clean_txn_ref,
        screenshot_path = COALESCE(p_screenshot_path, v_payment.screenshot_path),
        status = 'PENDING_ADMIN',
        verification_status = v_verification_status,
        submitted_at = now(),
        updated_at = now()
    WHERE id = v_payment.id;

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

GRANT EXECUTE ON FUNCTION public.create_payment_order(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 10. Storage RLS Policy (Admin & Owner Inspection)
DROP POLICY IF EXISTS "Users can view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users and admins can view payment proofs" ON storage.objects;
CREATE POLICY "Users and admins can view payment proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment_proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_current_user_admin()));

-- 11. Auth Activity Logs RLS Policy Tightening (Prevent spoofed log inserts)
DROP POLICY IF EXISTS "aal_insert_anon" ON public.auth_activity_logs;
CREATE POLICY "aal_insert_anon" ON public.auth_activity_logs FOR INSERT TO anon WITH CHECK (user_id IS NULL);

-- 12. Realtime publication settings for Subscriptions, Payments & Notifications
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

-- 13. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

