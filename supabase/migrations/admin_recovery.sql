-- ============================================================
-- SQL Recovery Script: Restore Admin Access
-- Use this script to manually set your account as super_admin.
-- ============================================================

DO $$
DECLARE
    target_email text := 'contacteccorp@gmail.com';
    target_uid uuid;
BEGIN
    -- 1. Find the UID from auth.users
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NULL THEN
        RAISE NOTICE 'User with email % not found in auth.users', target_email;
    ELSE
        -- 2. Ensure the profile exists and has the super_admin role
        INSERT INTO public.profiles (id, role, first_name, last_name)
        VALUES (target_uid, 'super_admin', 'Admin', 'Krantos')
        ON CONFLICT (id) DO UPDATE
        SET role = 'super_admin';

        -- 3. Also ensure they are in the admin_users table as admin_principal for full coverage
        INSERT INTO public.admin_users (auth_user_id, role, name, email)
        VALUES (target_uid, 'admin_principal', 'Admin Krantos', target_email)
        ON CONFLICT (auth_user_id) DO UPDATE
        SET role = 'admin_principal';

        RAISE NOTICE 'User % (ID: %) has been promoted to super_admin and admin_principal.', target_email, target_uid;
    END IF;
END $$;
