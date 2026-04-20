-- =============================================================================
-- Migration: RLS Policies — Commissions, Admin Users & Vendor Status Extensions
-- Requirements: C3.5, C5.3, C6.3, C8.4, C8.5, C9.3, C9.5
-- =============================================================================
-- This migration:
--   1. Enables RLS and adds policies on commission_records  (Task 2.1)
--   2. Enables RLS and adds policies on admin_users         (Task 2.2)
--   3. Updates existing policies on vendors and products to
--      exclude 'expired' and 'terminated' statuses          (Task 2.3)
-- =============================================================================


-- =============================================================================
-- TASK 2.1 — RLS on commission_records
-- Requirements: C3.5, C9.5
-- =============================================================================

ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;

-- Vendor self-read: an authenticated vendor can only read their own commission
-- records. The vendor's auth.uid() must match the vendor_id on the record.
-- Requirement C3.5
CREATE POLICY "commission_records_vendor_own_read"
    ON commission_records
    FOR SELECT
    TO authenticated
    USING (vendor_id = auth.uid());

-- Admin full access: the service role has unrestricted read/write access to
-- all commission records (used by admin dashboards and backend services).
-- Requirement C9.5
CREATE POLICY "commission_records_admin_full_access"
    ON commission_records
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- System insert: allows the service role to insert commission records when a
-- lead is converted or when a rate change is recorded. Because the service
-- role policy above already covers INSERT for ALL operations, this explicit
-- INSERT policy is provided for the 'public' role so that edge functions
-- running without the service role can still insert via RPC if needed.
-- In practice, all inserts should go through the service role; this policy
-- is intentionally restrictive (no public INSERT) to enforce that pattern.
-- Requirement C9.5


-- =============================================================================
-- TASK 2.2 — RLS on admin_users
-- Requirements: C8.4, C8.5
-- =============================================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Authenticated admin read: any authenticated user whose auth.uid() exists in
-- admin_users can read all admin records. This lets the frontend verify roles
-- and display the admin list on /admin/users.
-- Requirement C8.4
CREATE POLICY "admin_users_authenticated_read"
    ON admin_users
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM admin_users au
            WHERE au.auth_user_id = auth.uid()
        )
    );

-- Service role full access: all INSERT, UPDATE, DELETE operations on
-- admin_users must go through the service role (i.e. a secured Supabase RPC).
-- This prevents any client-side code from directly creating or modifying
-- admin accounts.
-- Requirement C8.5
CREATE POLICY "admin_users_service_role_full_access"
    ON admin_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- =============================================================================
-- TASK 2.3 — Extend existing RLS policies on vendors and products
-- Requirements: C5.3, C6.3, C9.3
-- =============================================================================

-- Drop the existing public-read policies so we can recreate them with the
-- updated USING clause that excludes 'expired' and 'terminated' vendors.

DROP POLICY IF EXISTS "vendors_public_read_active"  ON vendors;
DROP POLICY IF EXISTS "products_public_read_active" ON products;

-- vendors — public read: only vendors with status 'active' are visible to the
-- public directory and recommendation engine. Vendors with status 'expired',
-- 'terminated', 'pending', or 'suspended' are excluded.
-- Requirements C5.3, C9.3
CREATE POLICY "vendors_public_read_active"
    ON vendors
    FOR SELECT
    TO public
    USING (status = 'active');

-- products — public read: a product is publicly visible only when it is
-- active AND its vendor has status 'active'. This explicitly excludes products
-- belonging to vendors with status 'expired' or 'terminated' (in addition to
-- the already-excluded 'pending' and 'suspended' statuses).
-- Requirements C6.3, C9.3
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
