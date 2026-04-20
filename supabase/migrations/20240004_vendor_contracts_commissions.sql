-- =============================================================================
-- Migration: Vendor Contracts & Commissions — Schema Extensions
-- Requirements: C9.1, C9.2
-- =============================================================================
-- Extends the vendors table with contract and commission fields, and adds
-- the 'expired' and 'terminated' values to vendor_status_enum.
--
-- This migration is idempotent:
--   - ALTER TYPE ... ADD VALUE IF NOT EXISTS
--   - ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   - CREATE INDEX IF NOT EXISTS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend vendor_status_enum with new lifecycle statuses
-- -----------------------------------------------------------------------------

ALTER TYPE vendor_status_enum ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE vendor_status_enum ADD VALUE IF NOT EXISTS 'terminated';

-- -----------------------------------------------------------------------------
-- 2. Extend the vendors table with contract and commission fields
-- -----------------------------------------------------------------------------

ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS commission_rate float DEFAULT 0
        CHECK (commission_rate >= 0 AND commission_rate <= 100);

ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS contract_start_date date;

ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS contract_end_date date;

ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS fraud_count integer DEFAULT 0
        CHECK (fraud_count >= 0);

-- -----------------------------------------------------------------------------
-- 3. Indexes for performance (Requirement C9.1, C9.2)
-- idx_vendors_contract_end_date : used by the daily contract expiry job
-- idx_vendors_status            : used by public directory and admin filters
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_vendors_contract_end_date ON vendors(contract_end_date);
CREATE INDEX IF NOT EXISTS idx_vendors_status             ON vendors(status);

-- =============================================================================
-- Task 1.2 — commission_records table
-- Requirements: C2.1, C2.2
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4. Enum types for commission_records
-- -----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE commission_status_enum AS ENUM (
        'pending_verification',
        'confirmed',
        'rejected',
        'rate_change'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE commission_type_enum AS ENUM (
        'conversion',
        'rate_change'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Table commission_records
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS commission_records (
    id                     uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id              uuid                    NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    lead_id                uuid                    REFERENCES leads(id) ON DELETE SET NULL,
    commission_rate_applied float                  NOT NULL,
    amount                 decimal(12,2),
    status                 commission_status_enum  NOT NULL,
    type                   commission_type_enum    NOT NULL,
    notes                  text,
    created_at             timestamp with time zone DEFAULT now() NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. Index for dashboard queries filtered by vendor and date
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_commission_records_vendor_date
    ON commission_records(vendor_id, created_at);

-- =============================================================================
-- Task 1.3 — admin_users table
-- Requirements: C8.1, C8.2
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7. Enum type for admin_users roles
-- -----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE admin_role_enum AS ENUM (
        'super_admin',
        'admin_principal',
        'admin_collaborateur'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 8. Table admin_users
-- Self-referential FK on created_by (nullable for the initial Super Admin)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid         UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role         admin_role_enum NOT NULL,
    name         varchar(200) NOT NULL,
    email        varchar(200) UNIQUE NOT NULL,
    created_by   uuid         REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at   timestamp with time zone DEFAULT now() NOT NULL
);
