-- ============================================================
-- Migration: Fix leads RLS - allow admin/super_admin to read all leads
-- and vendors to read their own leads
-- ============================================================

-- 1. Public can insert leads (keep existing)
DROP POLICY IF EXISTS "leads_public_insert" ON leads;
CREATE POLICY "leads_public_insert"
    ON leads FOR INSERT TO public WITH CHECK (true);

-- 2. Super admin can read ALL leads
DROP POLICY IF EXISTS "leads_admin_select" ON leads;
CREATE POLICY "leads_admin_select"
    ON leads FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
      )
    );

-- 3. Vendors can read leads assigned to them
DROP POLICY IF EXISTS "leads_vendor_select" ON leads;
CREATE POLICY "leads_vendor_select"
    ON leads FOR SELECT
    TO authenticated
    USING (
      vendor_id IN (
        SELECT id FROM vendors WHERE profile_id = auth.uid()
      )
    );

-- 4. Vendors can update status of their own leads (converted/lost)
DROP POLICY IF EXISTS "leads_vendor_update" ON leads;
CREATE POLICY "leads_vendor_update"
    ON leads FOR UPDATE
    TO authenticated
    USING (
      vendor_id IN (
        SELECT id FROM vendors WHERE profile_id = auth.uid()
      )
    )
    WITH CHECK (true);

-- 5. Admin can update any lead
DROP POLICY IF EXISTS "leads_admin_update" ON leads;
CREATE POLICY "leads_admin_update"
    ON leads FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
      )
    )
    WITH CHECK (true);

-- 6. Ensure RLS is enabled
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 7. Also fix appliances_input: public insert only
DROP POLICY IF EXISTS "appliances_input_public_insert" ON appliances_input;
CREATE POLICY "appliances_input_public_insert"
    ON appliances_input FOR INSERT TO public WITH CHECK (true);

ALTER TABLE appliances_input ENABLE ROW LEVEL SECURITY;
