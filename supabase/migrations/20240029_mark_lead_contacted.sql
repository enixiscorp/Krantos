-- ============================================================
-- Migration: allow anonymous clients to mark their lead as "contacted"
-- ============================================================
-- Anonymous visitors cannot UPDATE leads (RLS: vendors/admins only).
-- This function only moves a lead from 'new' to 'contacted', nothing else,
-- so it is safe to expose to anon.

CREATE OR REPLACE FUNCTION public.mark_lead_contacted(p_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.leads
     SET status = 'contacted'
   WHERE id = p_lead_id
     AND status = 'new';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_lead_contacted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_lead_contacted(uuid) TO anon, authenticated;

-- Make the API (PostgREST) see the new functions right away
NOTIFY pgrst, 'reload schema';
