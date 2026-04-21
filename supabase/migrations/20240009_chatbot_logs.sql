-- ============================================================
-- Krantos Platform — Chatbot logs
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_intent_enum') THEN
    CREATE TYPE chatbot_intent_enum AS ENUM (
      'price',
      'specs',
      'lifetime',
      'reliability',
      'warranty',
      'order',
      'fallback'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  detected_intent chatbot_intent_enum NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_logs_product_id ON public.chat_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON public.chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_intent ON public.chat_logs(detected_intent);

ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_logs_public_insert" ON public.chat_logs;
CREATE POLICY "chat_logs_public_insert"
  ON public.chat_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "chat_logs_admin_read" ON public.chat_logs;
CREATE POLICY "chat_logs_admin_read"
  ON public.chat_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super_admin());

