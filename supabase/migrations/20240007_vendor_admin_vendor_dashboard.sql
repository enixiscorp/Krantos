-- ============================================================
-- Krantos Platform — Lot 2 (Vendors + Admin Vendor Ops)
-- ============================================================

-- 1) Align vendors table with auth/profile identity for vendor accounts
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_name text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_profile_id_unique
  ON public.vendors(profile_id)
  WHERE profile_id IS NOT NULL;

-- Keep backward compatibility with existing code using "name"
UPDATE public.vendors
SET company_name = COALESCE(company_name, name)
WHERE company_name IS NULL;

-- 2) Update vendor policies to use profile_id-based ownership
DROP POLICY IF EXISTS "vendors_self_read" ON public.vendors;
CREATE POLICY "vendors_self_read"
  ON public.vendors
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "products_vendor_own_read" ON public.products;
CREATE POLICY "products_vendor_own_read"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_vendor_own_insert" ON public.products;
CREATE POLICY "products_vendor_own_insert"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_vendor_own_update" ON public.products;
CREATE POLICY "products_vendor_own_update"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_vendor_own_delete" ON public.products;
CREATE POLICY "products_vendor_own_delete"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "leads_vendor_own_read" ON public.leads;
CREATE POLICY "leads_vendor_own_read"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = leads.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "leads_vendor_own_update" ON public.leads;
CREATE POLICY "leads_vendor_own_update"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = leads.vendor_id
        AND v.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = leads.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

