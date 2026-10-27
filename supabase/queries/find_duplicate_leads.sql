-- ============================================================
-- Lecture seule : repérer les demandes (leads) en double
-- ============================================================
-- Avant la correction, un clic sur WhatsApp pouvait créer une 2e demande
-- pour le même client (même téléphone, même vendeur, à quelques minutes
-- d'intervalle). Cette requête les liste ; elle ne supprime rien.
-- À exécuter dans Supabase > SQL Editor.

SELECT
  a.id            AS lead_original,
  b.id            AS lead_doublon,
  a.user_name,
  a.user_phone,
  a.vendor_id,
  a.status        AS statut_original,
  b.status        AS statut_doublon,
  a.created_at    AS cree_le_original,
  b.created_at    AS cree_le_doublon
FROM leads a
JOIN leads b
  ON  b.user_phone = a.user_phone
  AND b.vendor_id IS NOT DISTINCT FROM a.vendor_id
  AND b.total_power_needed = a.total_power_needed
  AND b.created_at >  a.created_at
  AND b.created_at <= a.created_at + INTERVAL '30 minutes'
ORDER BY a.created_at DESC;
