-- Migration: Add knowledge base columns to chatbot_configs and enable AI by default
ALTER TABLE chatbot_configs 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS delivery_info TEXT,
ADD COLUMN IF NOT EXISTS consumption_info TEXT,
ADD COLUMN IF NOT EXISTS usage_info TEXT,
ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini-1.5-flash';

-- Enable AI by default for all current and future configs
ALTER TABLE chatbot_configs ALTER COLUMN ai_enabled SET DEFAULT true;
UPDATE chatbot_configs SET ai_enabled = true WHERE ai_enabled IS FALSE;

-- Ensure all vendors have a config
INSERT INTO chatbot_configs (vendor_id, ai_enabled)
SELECT id, true FROM vendors
ON CONFLICT (vendor_id) DO UPDATE SET ai_enabled = true;
