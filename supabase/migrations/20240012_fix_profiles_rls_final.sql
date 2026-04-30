-- ============================================================
-- Migration: 20240012_fix_profiles_rls_final
-- Objective: Absolute fix for 500 error on profiles table.
--            Uses a robust non-recursive approach with SECURITY DEFINER.
-- ============================================================

-- 1. DISABLE RLS TEMPORARILY
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. CLEAN UP OLD POLICIES
DROP POLICY IF EXISTS "profiles_v3_read_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_v3_read_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_v3_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_v3_super_admin_all" ON public.profiles;
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

-- 3. CREATE NON-RECURSIVE HELPER FUNCTIONS
-- SECURITY DEFINER ensures the function runs as the owner (postgres), bypassing RLS.
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

CREATE OR REPLACE FUNCTION public.check_is_super_admin()
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

-- 4. APPLY FINAL POLICIES (Non-recursive)

-- User can always read their own profile (Direct ID check)
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Admin can read all (Uses helper function)
CREATE POLICY "profiles_select_admin"
ON public.profiles FOR SELECT
TO authenticated
USING (public.check_is_admin());

-- User can update their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Super Admin has full control
CREATE POLICY "profiles_super_admin_all"
ON public.profiles FOR ALL
TO authenticated
USING (public.check_is_super_admin())
WITH CHECK (public.check_is_super_admin());

-- 5. RE-ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. PROVISION THE SUPER ADMIN ACCOUNT
DO $$
DECLARE
    target_email text := 'contacteccorp@gmail.com';
    target_uid uuid;
BEGIN
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    IF target_uid IS NOT NULL THEN
        INSERT INTO public.profiles (id, role, first_name, last_name)
        VALUES (target_uid, 'super_admin', 'Admin', 'Principal')
        ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

        INSERT INTO public.admin_users (auth_user_id, role, name, email)
        VALUES (target_uid, 'admin_principal', 'Admin Krantos', target_email)
        ON CONFLICT (auth_user_id) DO UPDATE SET role = 'admin_principal';
    END IF;
END $$;

