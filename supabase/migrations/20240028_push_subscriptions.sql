-- ============================================================
-- Migration: 20240028_push_subscriptions.sql
-- Description: Crée la table pour stocker les abonnements aux notifications push
--              et définit les politiques de sécurité RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT null,
    subscription JSONB NOT null,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT null,
    UNIQUE(user_id, subscription)
);

-- Active RLS sur la table
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Crée la politique d'accès pour les utilisateurs connectés
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions" 
    ON public.push_subscriptions
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Ajoute des index pour optimiser la recherche par utilisateur
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
