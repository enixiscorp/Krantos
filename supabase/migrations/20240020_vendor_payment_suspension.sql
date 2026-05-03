-- Migration: Add payment notification tracking and suspension logic
-- Objective: Support the 3-notification rule for vendor suspension.

-- 1. Update vendors table
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS payment_notifications_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_notification_date timestamp with time zone;

-- 2. Function to record a notification and suspend if necessary
CREATE OR REPLACE FUNCTION public.notify_vendor_payment(v_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_count integer;
BEGIN
    -- Increment count
    UPDATE public.vendors
    SET 
        payment_notifications_count = payment_notifications_count + 1,
        last_notification_date = now()
    WHERE id = v_id
    RETURNING payment_notifications_count INTO current_count;

    -- Suspend if threshold reached
    IF current_count >= 3 THEN
        UPDATE public.vendors
        SET status = 'suspended'
        WHERE id = v_id;
    END IF;
END;
$$;
