-- ============================================================
-- Migration: 20240012_fix_profiles_rls_final
-- Objective: Absolute fix for 500 error on profiles table.
--            Removes all existing policies and uses a non-recursive approach.
-- ============================================================

-- 1. CLEAN SLATE
DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_all_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_manage_super_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_manage_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_access" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 2. ROBUST ROLE HELPERS
-- These functions use SECURITY DEFINER and a fixed search_path to bypass RLS safely.

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role = 'super_admin'
  );
$$;

-- 3. FINAL POLICIES

-- Policy A: Own Profile (Direct ID check, zero recursion)
CREATE POLICY "profiles_v3_read_own"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Policy B: Admin Access (Uses helper function)
CREATE POLICY "profiles_v3_read_admin"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.check_is_admin());

-- Policy C: Own Update
CREATE POLICY "profiles_v3_update_own"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Policy D: Super Admin Full Control
CREATE POLICY "profiles_v3_super_admin_all"
    ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.check_is_super_admin())
    WITH CHECK (public.check_is_super_admin());

-- 4. RE-ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
