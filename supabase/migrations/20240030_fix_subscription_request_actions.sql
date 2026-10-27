-- ============================================================
-- Migration: fix "Approuver" / "Rejeter" on subscription change requests
-- ============================================================
-- Bugs fixed:
-- 1. approve_subscription_request assigned a text value to
--    vendors.subscription_type (enum subscription_type_enum) → Postgres error.
-- 2. Rejecting used a direct UPDATE that RLS could silently block (0 rows).
-- 3. approve_subscription_request was SECURITY DEFINER without any admin check:
--    any logged-in user could call it.
-- Both actions now go through admin-checked SECURITY DEFINER functions.

-- Admin check helper (already defined in 20240019, recreated for safety)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
END;
$$;

-- ------------------------------------------------------------
-- Approve
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_subscription_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_vendor_id uuid;
  r_tier      subscription_type_enum;
  r_period    billing_period_type;
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : réservé aux administrateurs.';
  END IF;

  SELECT vendor_id,
         lower(requested_tier)::subscription_type_enum,
         lower(requested_period)::billing_period_type
    INTO r_vendor_id, r_tier, r_period
    FROM public.subscription_requests
   WHERE id = request_id
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable ou déjà traitée.';
  END IF;

  UPDATE public.vendors
     SET subscription_type = r_tier,
         billing_period    = r_period,
         status            = 'active',
         contract_end_date = (CASE r_period
             WHEN 'weekly'      THEN now() + interval '1 week'
             WHEN 'monthly'     THEN now() + interval '1 month'
             WHEN 'quarterly'   THEN now() + interval '3 months'
             WHEN 'semi-annual' THEN now() + interval '6 months'
           END)::date
   WHERE id = r_vendor_id;

  UPDATE public.subscription_requests
     SET status = 'approved'
   WHERE id = request_id;
END;
$$;

-- ------------------------------------------------------------
-- Reject
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_subscription_request(request_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : réservé aux administrateurs.';
  END IF;

  UPDATE public.subscription_requests
     SET status = 'rejected',
         notes  = COALESCE(reason, notes)
   WHERE id = request_id
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable ou déjà traitée.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_subscription_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_subscription_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_subscription_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_subscription_request(uuid, text) TO authenticated;

-- Make the API (PostgREST) see the new functions right away
NOTIFY pgrst, 'reload schema';
