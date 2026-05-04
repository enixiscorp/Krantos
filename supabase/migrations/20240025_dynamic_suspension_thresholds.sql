-- Migration: Dynamic suspension thresholds based on billing period
-- Objective: Implement the rules for Weekly (4), Monthly (3), Quarterly (4), Semi-Annual (2).

-- 1. Add billing_period to vendors
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_period_type') THEN
        CREATE TYPE billing_period_type AS ENUM ('weekly', 'monthly', 'quarterly', 'semi-annual');
    END IF;
END $$;

ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS billing_period billing_period_type DEFAULT 'monthly';

-- 2. Update notify_vendor_payment function
CREATE OR REPLACE FUNCTION public.notify_vendor_payment(v_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_count integer;
    v_period billing_period_type;
    v_threshold integer;
BEGIN
    -- Get vendor info
    SELECT payment_notifications_count, billing_period 
    INTO current_count, v_period
    FROM public.vendors
    WHERE id = v_id;

    -- Determine threshold
    v_threshold := CASE v_period
        WHEN 'weekly' THEN 4
        WHEN 'monthly' THEN 3
        WHEN 'quarterly' THEN 4
        WHEN 'semi-annual' THEN 2
        ELSE 3 -- fallback
    END;

    -- Increment count
    UPDATE public.vendors
    SET 
        payment_notifications_count = payment_notifications_count + 1,
        last_notification_date = now()
    WHERE id = v_id
    RETURNING payment_notifications_count INTO current_count;

    -- Suspend if threshold reached
    IF current_count >= v_threshold THEN
        UPDATE public.vendors
        SET status = 'suspended'
        WHERE id = v_id;
    END IF;
END;
$$;

-- 3. Add column for last_notification_read_at if missing (it was used in frontend but maybe not in schema)
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS last_notification_read_at timestamp with time zone;
