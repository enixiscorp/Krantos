-- Migration: Enable Realtime for key tables
-- Objective: Allow NotificationProvider to receive events.

-- 1. Enable replication for leads
ALTER TABLE public.leads REPLICA IDENTITY FULL;
-- 2. Enable replication for vendors
ALTER TABLE public.vendors REPLICA IDENTITY FULL;

-- 3. Add tables to the realtime publication
-- We check if they are already in the publication first (if possible) 
-- but simpler to just try adding.
BEGIN;
  -- If you already have a publication named 'supabase_realtime'
  ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  ALTER PUBLICATION supabase_realtime ADD TABLE vendors;
COMMIT;
