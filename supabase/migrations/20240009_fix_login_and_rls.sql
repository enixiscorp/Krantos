-- ============================================================
-- Migration: 20240009_fix_login_and_rls
-- Objective: Resolve infinite RLS recursion on 'profiles' table 
--            and ensure robust login for admin/super_admin.
-- ============================================================

-- 1. DROP ALL POTENTIALLY CONFLICTING POLICIES
-- This ensures a clean slate for the profiles table.
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_manage_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_access" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 2. REDEFINE ROLE HELPERS (ROBUST VERSION)
-- We use plpgsql, SECURITY DEFINER, and explicit search_path to bypass RLS safely.

-- Helper to check if the current user is an admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin_staff()
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

-- Helper to check if the current user is specifically a super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role = 'super_admin'
  );
END;
$$;

-- 3. CREATE NEW, CLEAN POLICIES

-- Policy 1: Any authenticated user can read THEIR OWN profile.
-- This is a simple direct comparison, no function call, zero recursion risk.
CREATE POLICY "profiles_read_own"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Policy 2: Admins and Super Admins can read ALL profiles.
-- Uses the SECURITY DEFINER helper to avoid recursion.
CREATE POLICY "profiles_read_all_admin"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff());

-- Policy 3: Users can update THEIR OWN profile (excluding sensitive fields like role).
-- Note: 'role' should not be changeable by the user themselves in the app logic.
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Policy 4: Super Admins can do EVERYTHING.
-- Full management capability for the highest tier.
CREATE POLICY "profiles_manage_super_admin"
    ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 4. ENSURE RLS IS ENABLED
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. AUDIT: Log this security fix (optional)
-- INSERT INTO public.admin_action_logs (action, target_type, metadata)
-- VALUES ('security_fix_rls_profiles', 'table_rls', '{"version": "20240009_v1"}'::jsonb);
