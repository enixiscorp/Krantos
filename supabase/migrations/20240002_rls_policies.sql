-- ============================================================
-- Krantos Platform — Row Level Security (RLS) Policies
-- Requirements: 14.1, 14.2
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- Requirement 14.1: RLS must be active on every table
-- ============================================================

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE appliances_input ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- POLICIES: users
-- ============================================================

-- Public insert: unauthenticated calculator users can create a user record
-- (the calculator flow does not require an account)
CREATE POLICY "users_public_insert"
    ON users
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Admin full access: service role can read and manage all user records
CREATE POLICY "users_admin_full_access"
    ON users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ============================================================
-- POLICIES: vendors
-- ============================================================

-- Public read: anyone can view vendors that are active
-- (used by the public vendor directory and recommendation engine)
CREATE POLICY "vendors_public_read_active"
    ON vendors
    FOR SELECT
    TO public
    USING (status = 'active');

-- Vendor self-read: an authenticated vendor can read their own record
-- regardless of status (e.g. to check their own pending/suspended state)
CREATE POLICY "vendors_self_read"
    ON vendors
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Admin full access: service role can INSERT, UPDATE, DELETE and SELECT
-- all vendor records regardless of status (used for admin validation flow)
CREATE POLICY "vendors_admin_full_access"
    ON vendors
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ============================================================
-- POLICIES: products
-- ============================================================

-- Public read: anyone can view products that are active AND belong to an
-- active vendor (prevents showing products of suspended vendors)
CREATE POLICY "products_public_read_active"
    ON products
    FOR SELECT
    TO public
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1
            FROM vendors v
            WHERE v.id = products.vendor_id
              AND v.status = 'active'
        )
    );

-- Vendor own read: authenticated vendors can read all their own products
-- (including inactive ones, so they can manage them from the dashboard)
CREATE POLICY "products_vendor_own_read"
    ON products
    FOR SELECT
    TO authenticated
    USING (vendor_id = auth.uid());

-- Vendor own write: authenticated vendors can INSERT, UPDATE and DELETE
-- only their own products (Requirement 14.2)
CREATE POLICY "products_vendor_own_insert"
    ON products
    FOR INSERT
    TO authenticated
    WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "products_vendor_own_update"
    ON products
    FOR UPDATE
    TO authenticated
    USING (vendor_id = auth.uid())
    WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "products_vendor_own_delete"
    ON products
    FOR DELETE
    TO authenticated
    USING (vendor_id = auth.uid());

-- Admin full access: service role has unrestricted access to all products
CREATE POLICY "products_admin_full_access"
    ON products
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ============================================================
-- POLICIES: leads
-- ============================================================

-- Public insert: unauthenticated users can create a lead
-- (the calculator flow does not require an account — Requirement 5.1)
CREATE POLICY "leads_public_insert"
    ON leads
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Vendor own read: authenticated vendors can read leads assigned to them
-- (Requirement 14.2 — vendor sees only their own leads)
CREATE POLICY "leads_vendor_own_read"
    ON leads
    FOR SELECT
    TO authenticated
    USING (vendor_id = auth.uid());

-- Vendor own update: authenticated vendors can update the status of their
-- own leads (e.g. mark as contacted, converted, lost)
CREATE POLICY "leads_vendor_own_update"
    ON leads
    FOR UPDATE
    TO authenticated
    USING (vendor_id = auth.uid())
    WITH CHECK (vendor_id = auth.uid());

-- Admin full access: service role can read and manage all leads
CREATE POLICY "leads_admin_full_access"
    ON leads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ============================================================
-- POLICIES: appliances_input
-- ============================================================

-- Public insert: unauthenticated users can insert appliance records
-- (created as part of the lead creation flow — Requirement 5.2)
CREATE POLICY "appliances_input_public_insert"
    ON appliances_input
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Vendor read via lead: authenticated vendors can read appliance records
-- that belong to leads assigned to them (uses EXISTS subquery to join
-- through the leads table without exposing other vendors' data)
CREATE POLICY "appliances_input_vendor_read_via_lead"
    ON appliances_input
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM leads l
            WHERE l.id = appliances_input.lead_id
              AND l.vendor_id = auth.uid()
        )
    );

-- Admin full access: service role has unrestricted access to all appliance records
CREATE POLICY "appliances_input_admin_full_access"
    ON appliances_input
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
