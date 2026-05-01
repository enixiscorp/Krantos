-- Migration: Create chatbot_configs table for vendor-specific AI chatbot settings
CREATE TABLE IF NOT EXISTS chatbot_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE UNIQUE,
    welcome_message TEXT DEFAULT 'Bonjour ! Je suis l''assistant virtuel de {vendor_name}. Comment puis-je vous aider ?',
    suggestions JSONB DEFAULT '[]'::jsonb, -- Array of {question: string, answer: string}
    ai_enabled BOOLEAN DEFAULT false,
    ai_context TEXT, -- Extra context for the generative AI
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE chatbot_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do everything
CREATE POLICY "Admin full access on chatbot_configs" 
ON chatbot_configs FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Policy: Vendors can read their own config
CREATE POLICY "Vendors read own chatbot_config" 
ON chatbot_configs FOR SELECT 
TO authenticated 
USING (vendor_id IN (SELECT id FROM vendors WHERE profile_id = auth.uid()));

-- Policy: Public read (for the frontend chatbot)
CREATE POLICY "Public read chatbot_configs" 
ON chatbot_configs FOR SELECT 
TO anon 
USING (true);
