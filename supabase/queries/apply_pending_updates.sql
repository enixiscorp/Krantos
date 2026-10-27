-- ============================================================
-- Krantos - Mises à jour de la base à appliquer (octobre 2026)
-- ============================================================
-- À copier en entier dans Supabase > SQL Editor, puis cliquer sur Run.
-- Le script peut être relancé sans risque (chaque partie est idempotente).
-- Il regroupe, dans l’ordre :
--   1. 20240029_mark_lead_contacted.sql : Statut « contacté » quand le client clique sur WhatsApp
--   2. 20240030_fix_subscription_request_actions.sql : Boutons Approuver / Rejeter des demandes de contrat
--   3. 20240031_products_image_url.sql : Colonne image des produits
--   4. 20240032_admin_users_management.sql : Gestion de l’équipe : modifier, archiver, restaurer
-- Fichier généré à partir de supabase/migrations/ : modifier les migrations,
-- pas ce fichier.


-- >>>>>>>>>> 20240029_mark_lead_contacted.sql (Statut « contacté » quand le client clique sur WhatsApp)
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


-- >>>>>>>>>> 20240030_fix_subscription_request_actions.sql (Boutons Approuver / Rejeter des demandes de contrat)
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


-- >>>>>>>>>> 20240031_products_image_url.sql (Colonne image des produits)
-- ============================================================
-- Migration: products.image_url (product picture)
-- ============================================================
-- The app saves the product picture in products.image_url, but no migration
-- ever created this column → every save returned
-- 400 "Could not find the 'image_url' column of 'products' in the schema cache".
--
-- products.unit is also sent by the admin "add product" form and was never
-- created either. IF NOT EXISTS keeps this safe if they were added by hand.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit text DEFAULT 'W';

-- Make the API (PostgREST) see the new columns right away
NOTIFY pgrst, 'reload schema';


-- >>>>>>>>>> 20240032_admin_users_management.sql (Gestion de l’équipe : modifier, archiver, restaurer)
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
--
-- Safe to run several times.

-- ------------------------------------------------------------
-- Types used below (normally created by earlier migrations)
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'vendor', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_role_enum AS ENUM ('super_admin', 'admin_principal', 'admin_collaborateur');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- Columns
-- ------------------------------------------------------------
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS archived_by uuid;
-- text (not enum): works whatever the type of profiles.role
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS previous_profile_role text;

-- Old signatures from a previous version of this file
DROP FUNCTION IF EXISTS public.update_admin_user(uuid, text, text, public.admin_role_enum);

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
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role::text = 'super_admin')
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
  IF v_role IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid()) THEN
    v_role := 'admin_collaborateur';
  END IF;
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
  p_role text DEFAULT NULL
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
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_first text;
  v_last text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Accès refusé : vous ne faites pas partie de l''équipe active.';
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
  IF v_name = '' THEN
    RAISE EXCEPTION 'Le nom est obligatoire.';
  END IF;

  -- Role changes: never on yourself, never on the main admin, only to staff roles
  IF p_role IS NOT NULL AND p_role <> v_target.role::text THEN
    IF v_is_self OR public.is_main_admin(v_target.auth_user_id) THEN
      RAISE EXCEPTION 'Ce rôle ne peut pas être modifié.';
    END IF;
    IF p_role NOT IN ('admin_principal', 'admin_collaborateur') THEN
      RAISE EXCEPTION 'Rôle invalide.';
    END IF;
    UPDATE public.admin_users SET role = p_role::public.admin_role_enum WHERE id = p_admin_id;
  END IF;

  UPDATE public.admin_users
     SET name  = v_name,
         phone = v_phone
   WHERE id = p_admin_id;

  v_first := split_part(v_name, ' ', 1);
  v_last  := nullif(trim(substr(v_name, length(v_first) + 1)), '');
  UPDATE public.profiles
     SET first_name = v_first,
         last_name  = coalesce(v_last, last_name),
         phone      = v_phone
   WHERE id = v_target.auth_user_id;
END;
$$;

-- ------------------------------------------------------------
-- Edit your own profile (the main admin is often only in profiles)
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
DECLARE
  v_first text := trim(coalesce(p_first_name, ''));
  v_last  text := nullif(trim(coalesce(p_last_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
BEGIN
  IF public.current_staff_role() IS NULL THEN
    RAISE EXCEPTION 'Accès refusé : vous ne faites pas partie de l''équipe active.';
  END IF;
  IF v_first = '' THEN
    RAISE EXCEPTION 'Le prénom est obligatoire.';
  END IF;

  UPDATE public.profiles
     SET first_name = v_first,
         last_name  = v_last,
         phone      = v_phone
   WHERE id = auth.uid();

  -- No profile row yet (possible for the main admin): create it
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, first_name, last_name, phone, role)
    VALUES (
      auth.uid(), v_first, v_last, v_phone,
      (CASE WHEN public.is_main_admin(auth.uid()) THEN 'super_admin' ELSE 'admin' END)::public.app_role
    );
  END IF;

  UPDATE public.admin_users
     SET name  = trim(v_first || ' ' || coalesce(v_last, '')),
         phone = v_phone
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
         previous_profile_role = (SELECT role::text FROM public.profiles WHERE id = v_target.auth_user_id)
   WHERE id = p_admin_id;

  -- Remove back-office access (admins only; vendors keep their role)
  UPDATE public.profiles
     SET role = 'user'::public.app_role
   WHERE id = v_target.auth_user_id
     AND role::text = 'admin';
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
     SET role = coalesce(v_target.previous_profile_role, 'admin')::public.app_role
   WHERE id = v_target.auth_user_id
     AND role::text = 'user';
END;
$$;

-- ------------------------------------------------------------
-- Rights
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.update_admin_user(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_staff_profile(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_admin_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_main_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_user(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_staff_profile(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_admin_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_admin_user(uuid) TO authenticated;

-- Make the API (PostgREST) see the new functions and columns right away
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Vérification : chaque ligne doit afficher true
-- ------------------------------------------------------------
SELECT 'colonne products.image_url' AS element,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_url') AS ok
UNION ALL
SELECT 'colonne admin_users.archived_at',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'archived_at')
UNION ALL
SELECT 'fonction ' || f, EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = f)
FROM unnest(ARRAY['mark_lead_contacted','approve_subscription_request','reject_subscription_request','update_admin_user','update_my_staff_profile','archive_admin_user','restore_admin_user']) AS f;
