-- Migration: Fix subscription upgrade RLS for super_admin
-- Objective: Ensure both admin and super_admin can see and manage upgrade requests.

DROP POLICY IF EXISTS "Admins can view and update all requests" ON public.subscription_requests;

CREATE POLICY "Admins can view and update all requests"
    ON public.subscription_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Also ensure vendors RLS allows admins to see them if RLS is enabled
-- (Just in case it was enabled in a way I missed)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'vendors' AND rowsecurity = true
    ) THEN
        DROP POLICY IF EXISTS "Admins can view all vendors" ON public.vendors;
        CREATE POLICY "Admins can view all vendors"
            ON public.vendors FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;
