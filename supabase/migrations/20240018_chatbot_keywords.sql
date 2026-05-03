-- Migration: Add keyword-specific fields to chatbot_configs
ALTER TABLE public.chatbot_configs 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS delivery_info TEXT,
ADD COLUMN IF NOT EXISTS consumption_info TEXT,
ADD COLUMN IF NOT EXISTS usage_info TEXT;
