-- ============================================================
-- Krantos Platform — Lot 3 Security Hardening
-- ============================================================

-- 1) Admin action logs (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role app_role,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_actor_id ON public.admin_action_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON public.admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action ON public.admin_action_logs(action);

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_logs_super_admin_read" ON public.admin_action_logs;
CREATE POLICY "admin_logs_super_admin_read"
  ON public.admin_action_logs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "admin_logs_no_client_write" ON public.admin_action_logs;
CREATE POLICY "admin_logs_no_client_write"
  ON public.admin_action_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 2) Basic request rate-limiting store for Edge Functions
CREATE TABLE IF NOT EXISTS public.request_rate_limits (
  key text PRIMARY KEY,
  hit_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;

-- deny direct client access (service role bypasses RLS)
DROP POLICY IF EXISTS "rate_limits_no_client_access_select" ON public.request_rate_limits;
CREATE POLICY "rate_limits_no_client_access_select"
  ON public.request_rate_limits
  FOR SELECT
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "rate_limits_no_client_access_write" ON public.request_rate_limits;
CREATE POLICY "rate_limits_no_client_access_write"
  ON public.request_rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 3) Security helper SQL function for server-side rate limit checks
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, hits integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_hit_count integer;
BEGIN
  INSERT INTO public.request_rate_limits AS r (key, hit_count, window_start, updated_at)
  VALUES (p_key, 1, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
  SET hit_count = CASE
      WHEN EXTRACT(EPOCH FROM (v_now - r.window_start)) > p_window_seconds THEN 1
      ELSE r.hit_count + 1
    END,
    window_start = CASE
      WHEN EXTRACT(EPOCH FROM (v_now - r.window_start)) > p_window_seconds THEN v_now
      ELSE r.window_start
    END,
    updated_at = v_now
  RETURNING window_start, hit_count INTO v_window_start, v_hit_count;

  RETURN QUERY SELECT
    (v_hit_count <= p_max_hits),
    v_hit_count,
    (v_window_start + make_interval(secs => p_window_seconds));
END;
$$;

