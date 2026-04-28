-- =============================================================================
-- Migration: Vendor access control (status + restrictions + reason)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE vendor_access_status_enum AS ENUM (
    'pending_validation',
    'active',
    'disabled',
    'restricted_3d',
    'restricted_7d',
    'restricted_30d',
    'subscription_expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS access_status vendor_access_status_enum NOT NULL DEFAULT 'pending_validation',
  ADD COLUMN IF NOT EXISTS access_restricted_until date,
  ADD COLUMN IF NOT EXISTS access_block_reason text;

CREATE INDEX IF NOT EXISTS idx_vendors_access_status ON public.vendors(access_status);
CREATE INDEX IF NOT EXISTS idx_vendors_access_restricted_until ON public.vendors(access_restricted_until);

-- Keep compatibility with previous statuses if present:
-- - pending -> pending_validation
-- - active -> active
-- - suspended -> disabled
UPDATE public.vendors
SET access_status = CASE
  WHEN status::text = 'active' THEN 'active'
  WHEN status::text IN ('suspended', 'terminated') THEN 'disabled'
  WHEN status::text IN ('expired') THEN 'subscription_expired'
  ELSE 'pending_validation'
END::vendor_access_status_enum
WHERE access_status IS NULL OR access_status = 'pending_validation';

