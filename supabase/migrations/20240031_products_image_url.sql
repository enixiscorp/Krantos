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
