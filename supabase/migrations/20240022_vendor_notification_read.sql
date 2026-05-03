-- Migration: Add last_notification_read_at to track vendor acknowledgement
-- Objective: Allow vendors to mark payment reminders as read.

ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS last_notification_read_at timestamp with time zone;

-- Update the existing vendors to have a default value if needed
-- (not strictly necessary but helpful for logic)
