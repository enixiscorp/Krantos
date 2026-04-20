-- =============================================================================
-- Migration: Supabase Storage — Bucket product-images
-- Requirements: 12.2, 15.3
-- =============================================================================
-- Ce fichier configure le bucket de stockage pour les images produits.
-- Les images sont publiques (accessibles via CDN) pour une livraison rapide
-- sur les connexions mobiles en Afrique de l'Ouest.
--
-- Convention de chemin d'upload recommandée :
--   {vendor_id}/{filename}
--   Exemple : "a1b2c3d4-.../mon-generateur.webp"
--
-- Cette convention permet aux politiques de mise à jour et de suppression
-- de restreindre les opérations aux fichiers appartenant au vendeur connecté,
-- en comparant auth.uid() avec le premier segment du chemin (dossier).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Création du bucket product-images
-- Public = true : les objets sont accessibles publiquement via l'URL CDN
-- ON CONFLICT DO NOTHING : rend la migration idempotente (rejouable sans erreur)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Politique 1 : Lecture publique
-- Tout le monde (y compris les visiteurs non authentifiés) peut lire/télécharger
-- les images produits depuis le bucket. Nécessaire pour l'affichage public
-- des fiches produits et de l'annuaire vendeurs.
-- -----------------------------------------------------------------------------
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- -----------------------------------------------------------------------------
-- Politique 2 : Upload par les vendeurs authentifiés
-- Seuls les utilisateurs authentifiés (vendeurs) peuvent uploader de nouvelles
-- images dans le bucket. L'upload doit se faire dans un dossier portant
-- l'identifiant du vendeur : {vendor_id}/{filename}.
-- -----------------------------------------------------------------------------
CREATE POLICY "product_images_vendor_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- -----------------------------------------------------------------------------
-- Politique 3 : Mise à jour par le vendeur propriétaire
-- Un vendeur authentifié ne peut mettre à jour que les images situées dans
-- son propre dossier. La fonction storage.foldername(name) extrait les segments
-- du chemin, et [1] correspond au premier segment (vendor_id).
-- Cela garantit qu'un vendeur ne peut pas écraser les images d'un autre vendeur.
-- -----------------------------------------------------------------------------
CREATE POLICY "product_images_vendor_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- -----------------------------------------------------------------------------
-- Politique 4 : Suppression par le vendeur propriétaire
-- Même restriction que pour la mise à jour : un vendeur ne peut supprimer
-- que les images de son propre dossier ({vendor_id}/{filename}).
-- -----------------------------------------------------------------------------
CREATE POLICY "product_images_vendor_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
