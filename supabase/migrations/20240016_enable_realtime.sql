-- ============================================================
-- Activer Supabase Realtime pour les tables leads et vendors
-- Nécessaire pour les notifications sonores et l'affichage 
-- en temps réel sur les dashboards Admin et Vendeur.
-- ============================================================

-- Activer replica identity sur FULL (optionnel mais recommandé pour avoir les anciennes valeurs)
ALTER TABLE leads REPLICA IDENTITY FULL;
ALTER TABLE vendors REPLICA IDENTITY FULL;

-- Activer les tables dans la publication realtime de Supabase
DO $$
BEGIN
  -- Créer la publication supabase_realtime si elle n'existe pas (standard sur Supabase)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  
  -- Ajouter la table leads
  ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  
  -- Ajouter la table vendors
  ALTER PUBLICATION supabase_realtime ADD TABLE vendors;
EXCEPTION
  WHEN duplicate_object THEN
    -- Si la table est déjà dans la publication, l'erreur est ignorée
    NULL;
END
$$;
