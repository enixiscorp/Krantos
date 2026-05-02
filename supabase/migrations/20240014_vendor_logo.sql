-- Add logo_url column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Update RLS policies to allow vendors to update their own logo_url
-- Assuming vendors can update their own row.
-- The existing policy for UPDATE on vendors table should cover this if it allows profile_id = auth.uid()
