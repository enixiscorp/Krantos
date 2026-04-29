-- ============================================================
-- Migration: 20240013_chatbot_settings
-- Objective: Externalize chatbot logic to a table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chatbot_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intent chatbot_intent_enum NOT NULL UNIQUE,
    response_template text NOT NULL,
    use_whatsapp boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Initial data
INSERT INTO public.chatbot_settings (intent, response_template, use_whatsapp)
VALUES 
    ('price', 'Le prix de {product_name} est de {price} FCFA. Voulez-vous contacter {vendor_name} directement sur WhatsApp ?', true),
    ('specs', 'Ce produit a une capacité de {power} et convient bien à votre besoin. {description}', false),
    ('lifetime', 'La durée de vie moyenne de ce type d''équipement est d''environ {lifetime} selon l''utilisation et la maintenance.', false),
    ('reliability', 'Ce produit est reconnu pour sa fiabilité et son usage régulier en environnement professionnel.', false),
    ('warranty', 'Pour la garantie et le SAV, je vous recommande de confirmer directement les conditions avec le vendeur.', true),
    ('order', 'Excellente décision. Je peux vous mettre en relation immédiate avec {vendor_name} sur WhatsApp pour finaliser la commande.', true),
    ('fallback', 'Je peux vous aider sur le prix, les caractéristiques ou la fiabilité du produit. Que souhaitez-vous savoir ?', false)
ON CONFLICT (intent) DO NOTHING;

-- RLS
ALTER TABLE public.chatbot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatbot_settings_read_public"
    ON public.chatbot_settings
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "chatbot_settings_manage_admin"
    ON public.chatbot_settings
    FOR ALL
    TO authenticated
    USING (public.check_is_admin())
    WITH CHECK (public.check_is_admin());
