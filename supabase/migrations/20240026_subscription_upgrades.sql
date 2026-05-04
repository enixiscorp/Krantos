-- Migration: Subscription upgrade requests and notifications
-- Objective: Allow vendors to request upgrades and admins to validate them.

-- 1. Create subscription_requests table
CREATE TABLE IF NOT EXISTS public.subscription_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
    requested_tier text NOT NULL, -- 'free', 'basic', 'premium'
    requested_period text NOT NULL, -- 'weekly', 'monthly', 'quarterly', 'semi-annual'
    status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Add RLS policies
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view their own requests"
    ON public.subscription_requests FOR SELECT
    USING (auth.uid() IN (SELECT profile_id FROM vendors WHERE id = vendor_id));

CREATE POLICY "Vendors can create requests"
    ON public.subscription_requests FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT profile_id FROM vendors WHERE id = vendor_id));

CREATE POLICY "Admins can view and update all requests"
    ON public.subscription_requests FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_subscription_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_requests_updated_at_trigger
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION update_subscription_requests_updated_at();

-- 4. Function to approve a request and update the vendor
CREATE OR REPLACE FUNCTION approve_subscription_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_vendor_id uuid;
    r_tier text;
    r_period billing_period_type;
BEGIN
    -- Get request details
    SELECT vendor_id, requested_tier, requested_period::billing_period_type
    INTO r_vendor_id, r_tier, r_period
    FROM public.subscription_requests
    WHERE id = request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed';
    END IF;

    -- Update vendor
    UPDATE public.vendors
    SET 
        subscription_type = r_tier,
        billing_period = r_period,
        status = 'active', -- Ensure vendor is active if they upgrade
        contract_end_date = CASE 
            WHEN r_period = 'weekly' THEN now() + interval '1 week'
            WHEN r_period = 'monthly' THEN now() + interval '1 month'
            WHEN r_period = 'quarterly' THEN now() + interval '3 months'
            WHEN r_period = 'semi-annual' THEN now() + interval '6 months'
            ELSE contract_end_date
        END
    WHERE id = r_vendor_id;

    -- Update request status
    UPDATE public.subscription_requests
    SET status = 'approved'
    WHERE id = request_id;
END;
$$;
