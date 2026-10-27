-- ============================================================
-- Migration: Back-office team management (edit / archive / restore)
-- ============================================================
-- Rules:
-- * The main administrator (contacteccorp@gmail.com, or profiles.role =
--   'super_admin') can edit his own details. Nobody else can edit him.
-- * Admins "Principal" and the main admin can edit team members
--   (name, phone, role). A collaborator can only edit his own details.
-- * Only the main admin can "delete" a member: the account is ARCHIVED
--   (kept, access removed) and can be restored later.
-- admin_users is writable by the service role only (RLS), so every change
-- goes through the SECURITY DEFINER functions below.

ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS previous_profile_role app_role;

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_main_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'super_admin')
      OR EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND lower(email) = 'contacteccorp@gmail.com');
$$;

-- 'main' | 'super_admin' | 'admin_principal' | 'admin_collaborateur' | NULL
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF public.is_main_admin(auth.uid()) THEN RETURN 'main'; END IF;
  SELECT role::text INTO v_role
    FROM public.admin_users
   WHERE auth_user_id = auth.uid() AND archived_at IS NULL;
  RETURN v_role;
END;
$$;

-- ------------------------------------------------------------
-- Read access to the team list
-- ------------------------------------------------------------
-- The old policy queried admin_users inside its own policy (Postgres error
-- "infinite recursion detected in policy") and excluded the main admin when
-- he is only in profiles. current_staff_role() is SECURITY DEFINER, so it
-- does not go through RLS. Everyone can also read his own row (needed to
-- detect an archived account).
DROP POLICY IF EXISTS "admin_users_authenticated_read" ON public.admin_users;
CREATE POLICY "admin_users_authenticated_read"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL OR auth_user_id = auth.uid());

-- ------------------------------------------------------------
-- Edit a team member (or yourself)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_admin_user(
  p_admin_id uuid,
  p_name text,
  p_phone text DEFAULT NULL,
  p_role admin_role_enum DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller text := public.current_staff_role();
  v_target public.admin_users%ROWTYPE;
  v_is_self boolean;
  v_first text;
  v_last text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  SELECT * INTO v_target FROM public.admin_users WHERE id = p_admin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable.';
  END IF;

  v_is_self := v_target.auth_user_id = auth.uid();

  IF public.is_main_admin(v_target.auth_user_id) AND NOT v_is_self THEN
    RAISE EXCEPTION 'Seul l''administrateur principal peut modifier son propre profil.';
  END IF;
  IF NOT v_is_self AND v_caller NOT IN ('main', 'super_admin', 'admin_principal') THEN
    RAISE EXCEPTION 'Un collaborateur ne peut modifier que son propre profil.';
  END IF;
  IF v_target.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Restaurez d''abord ce profil avant de le modifier.';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Le nom est obligatoire.';
  END IF;

  -- Role changes: never on yourself, never to super_admin
  IF p_role IS NOT NULL AND p_role <> v_target.role THEN
    IF v_is_self THEN
      RAISE EXCEPTION 'Vous ne pouvez pas changer votre propre rôle.';
    END IF;
    IF p_role = 'super_admin' THEN
      RAISE EXCEPTION 'Ce rôle ne peut pas être attribué.';
    END IF;
  END IF;

  UPDATE public.admin_users
     SET name  = trim(p_name),
         phone = nullif(trim(coalesce(p_phone, '')), ''),
         role  = CASE WHEN v_is_self OR p_role IS NULL THEN role ELSE p_role END
   WHERE id = p_admin_id;

  v_first := split_part(trim(p_name), ' ', 1);
  v_last  := nullif(trim(substr(trim(p_name), length(v_first) + 1)), '');
  UPDATE public.profiles
     SET first_name = v_first,
         last_name  = coalesce(v_last, last_name),
         phone      = nullif(trim(coalesce(p_phone, '')), '')
   WHERE id = v_target.auth_user_id;
END;
$$;

-- ------------------------------------------------------------
-- Main admin (or anyone) edits his own profile, even without an
-- admin_users row (the main admin is often only in profiles)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_staff_profile(
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_staff_role() IS NULL THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;
  IF coalesce(trim(p_first_name), '') = '' THEN
    RAISE EXCEPTION 'Le prénom est obligatoire.';
  END IF;

  UPDATE public.profiles
     SET first_name = trim(p_first_name),
         last_name  = nullif(trim(coalesce(p_last_name, '')), ''),
         phone      = nullif(trim(coalesce(p_phone, '')), '')
   WHERE id = auth.uid();

  UPDATE public.admin_users
     SET name  = trim(trim(p_first_name) || ' ' || coalesce(trim(p_last_name), '')),
         phone = nullif(trim(coalesce(p_phone, '')), '')
   WHERE auth_user_id = auth.uid();
END;
$$;

-- ------------------------------------------------------------
-- Archive ("delete") and restore: main admin only
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_admin_user(p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.admin_users%ROWTYPE;
BEGIN
  IF public.current_staff_role() IS DISTINCT FROM 'main' THEN
    RAISE EXCEPTION 'Seul l''administrateur principal peut supprimer un profil.';
  END IF;

  SELECT * INTO v_target FROM public.admin_users WHERE id = p_admin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable.';
  END IF;
  IF public.is_main_admin(v_target.auth_user_id) THEN
    RAISE EXCEPTION 'Le profil de l''administrateur principal ne peut pas être supprimé.';
  END IF;
  IF v_target.archived_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.admin_users
     SET archived_at = now(),
         archived_by = auth.uid(),
         previous_profile_role = (SELECT role FROM public.profiles WHERE id = v_target.auth_user_id)
   WHERE id = p_admin_id;

  -- Remove back-office access (admins only; vendors keep their role)
  UPDATE public.profiles
     SET role = 'user'
   WHERE id = v_target.auth_user_id
     AND role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_admin_user(p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.admin_users%ROWTYPE;
BEGIN
  IF public.current_staff_role() IS DISTINCT FROM 'main' THEN
    RAISE EXCEPTION 'Seul l''administrateur principal peut restaurer un profil.';
  END IF;

  SELECT * INTO v_target FROM public.admin_users WHERE id = p_admin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable.';
  END IF;

  UPDATE public.admin_users
     SET archived_at = NULL,
         archived_by = NULL,
         previous_profile_role = NULL
   WHERE id = p_admin_id;

  UPDATE public.profiles
     SET role = coalesce(v_target.previous_profile_role, 'admin')
   WHERE id = v_target.auth_user_id
     AND role = 'user';
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_user(uuid, text, text, admin_role_enum) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_staff_profile(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_admin_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_main_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_user(uuid, text, text, admin_role_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_staff_profile(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_admin_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_admin_user(uuid) TO authenticated;
