-- Migration: Enable Realtime for key tables
-- Objective: Allow NotificationProvider to receive events.

-- 1. Enable replication identity (Crucial for Realtime)
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.vendors REPLICA IDENTITY FULL;

-- 2. Add to publication (One by one to avoid block failure)
-- If you get "already member" error for some, just run the others.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'vendors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors;
  END IF;
END $$;

