# Plan d'Implémentation : Plateforme Krantos

## Vue d'ensemble

Ce plan décompose la plateforme Krantos en tâches de développement incrémentales. Chaque tâche s'appuie sur les précédentes et aboutit à un système entièrement câblé. La stack est React 18 / TypeScript (frontend) + Supabase (backend-as-a-service), avec Vite comme outil de build et Tailwind CSS pour les styles.

## Tâches

- [x] 1. Initialisation du projet et configuration de l'environnement
  - Vérifier et compléter la configuration Vite + TypeScript + Tailwind CSS
  - Configurer les variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) dans `.env.local`
  - Installer les dépendances manquantes : `@supabase/supabase-js`, `framer-motion`, `sonner`, `lucide-react`, `jspdf`, `fast-check` (pour les tests)
  - Mettre en place la structure de dossiers : `src/utils/`, `src/services/`, `src/lib/`, `src/components/`, `src/pages/`
  - Configurer le routeur React (React Router v6) avec les routes : `/`, `/calculate-power`, `/results`, `/vendors`, `/vendor/:id`, `/business-login`, `/business-dashboard`, `/add-product`, `/leads`, `/admin`, `/admin/vendors`, `/admin/leads`
  - Implémenter le code splitting par route via `React.lazy` et `Suspense`
  - _Exigences : 15.1_

- [x] 2. Schéma de base de données Supabase et sécurité
  - [x] 2.1 Créer le schéma SQL Supabase
    - Écrire les migrations SQL pour les tables : `users`, `vendors`, `products`, `leads`, `appliances_input` avec tous les champs, types, contraintes et valeurs par défaut définis dans le design
    - Créer les index sur `products.power_rating`, `leads.vendor_id`, `leads.status`
    - Définir les types enum pour `vendors.subscription_type`, `vendors.status`, `leads.status`, `appliances_input.unit`
    - _Exigences : 5.1, 5.2, 15.2_

  - [x] 2.2 Configurer Row Level Security (RLS)
    - Activer RLS sur toutes les tables Supabase
    - Écrire les politiques RLS pour `products` : lecture publique des produits actifs de vendeurs actifs ; lecture/écriture restreinte au `vendor_id = auth.uid()` pour les vendeurs authentifiés
    - Écrire les politiques RLS pour `leads` : lecture/écriture restreinte au `vendor_id = auth.uid()` pour les vendeurs ; accès complet pour l'admin
    - Écrire les politiques RLS pour `vendors` : lecture publique des vendeurs actifs ; accès complet pour l'admin
    - _Exigences : 14.1, 14.2_

  - [x] 2.3 Configurer Supabase Storage
    - Créer le bucket `product-images` avec accès public en lecture
    - Configurer les politiques de storage : upload restreint aux vendeurs authentifiés
    - _Exigences : 12.2, 15.3_

- [x] 3. Client Supabase centralisé (`src/lib/supabase.ts`)
  - [x] 3.1 Implémenter le SupabaseClient
    - Initialiser le client Supabase avec `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` uniquement (ne jamais exposer la clé service)
    - Exporter le client typé avec les types TypeScript générés depuis le schéma Supabase
    - Exporter les types partagés : `ApplianceInput`, `ApplianceBreakdown`, `Product`, `Vendor`, `Lead`, `AppliancesInputRecord`
    - _Exigences : 14.3_

  - [x] 3.2 Écrire les tests unitaires pour SupabaseClient
    - Vérifier que les variables d'environnement sont utilisées correctement
    - Vérifier que la clé service n'est pas exposée côté client
    - _Exigences : 14.3_

- [x] 4. PowerCalculator (`src/utils/powerCalculator.ts`)
  - [x] 4.1 Implémenter le PowerCalculator
    - Définir l'interface `ApplianceInput` : `{ name: string; quantity: number; power: number; unit: 'W' | 'A' | 'V' }`
    - Définir l'interface `ApplianceBreakdown` : `{ name: string; powerInWatts: number; totalWatts: number }`
    - Définir l'interface `PowerCalculationResult` : `{ totalWatts: number; totalKVA: number; breakdown: ApplianceBreakdown[] }`
    - Implémenter la normalisation des unités : W → valeur directe, A → valeur × 220, V → valeur directe
    - Implémenter le calcul de puissance par appareil : `powerInWatts × quantity`
    - Appliquer le facteur de marge de sécurité 1.3 à la somme totale
    - Convertir en kVA : `totalWatts / 1000`
    - Retourner `{ totalWatts, totalKVA, breakdown }`
    - _Exigences : 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Écrire le test de propriété — Normalisation des unités (Propriété 1)
    - **Propriété 1 : Normalisation des unités d'appareils**
    - Pour tout appareil valide (W, A, V), `power_in_watts` est strictement positif et cohérent avec l'unité
    - **Valide : Exigences 3.1, 3.2**

  - [x] 4.3 Écrire le test de propriété — Invariant de marge et conversion kVA (Propriété 2)
    - **Propriété 2 : Invariant de marge de sécurité et conversion kVA**
    - Pour tout ensemble non vide d'appareils valides, `totalWatts = Σ(powerInWatts × quantity) × 1.3` et `totalKVA = totalWatts / 1000`
    - **Valide : Exigences 3.3, 3.4, 3.5**

  - [x] 4.4 Écrire les tests unitaires pour PowerCalculator
    - Tester la conversion W (valeur directe)
    - Tester la conversion A (× 220V)
    - Tester la conversion V (valeur directe)
    - Tester la marge de sécurité 1.3
    - Tester la conversion kVA
    - Tester avec plusieurs appareils de quantités différentes
    - _Exigences : 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. RecommendationEngine (`src/services/recommendationEngine.ts`)
  - [x] 5.1 Implémenter le RecommendationEngine
    - Implémenter `getRecommendation(totalKVA: number): Promise<{ product: Product | null; vendor: Vendor | null }>`
    - Requête Supabase : `SELECT products.*, vendors.* FROM products JOIN vendors ON products.vendor_id = vendors.id WHERE products.power_rating >= totalKVA AND products.is_active = true AND vendors.status = 'active' ORDER BY vendors.subscription_type DESC, products.price ASC LIMIT 10`
    - Retourner le premier résultat comme recommandation principale
    - Retourner `{ product: null, vendor: null }` si aucun résultat
    - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5, 12.3, 13.3_

  - [x] 5.2 Écrire le test de propriété — Filtrage par capacité (Propriété 3)
    - **Propriété 3 : Filtrage des produits par capacité**
    - Pour tout `totalKVA` et tout catalogue, chaque produit retourné a `power_rating >= totalKVA`
    - **Valide : Exigences 4.1**

  - [x] 5.3 Écrire le test de propriété — Ordre de priorité (Propriété 4)
    - **Propriété 4 : Ordre de priorité des recommandations**
    - Les produits premium apparaissent avant basic/free ; à priorité égale, tri par prix croissant
    - **Valide : Exigences 4.2, 4.3**

  - [x] 5.4 Écrire le test de propriété — Borne maximale des résultats (Propriété 5)
    - **Propriété 5 : Borne maximale des résultats de recommandation**
    - Le RecommendationEngine ne retourne jamais plus de 10 produits
    - **Valide : Exigences 4.5**

  - [x] 5.5 Écrire le test de propriété — Exclusion des produits inactifs et vendeurs suspendus (Propriété 14)
    - **Propriété 14 : Exclusion des produits inactifs et des vendeurs suspendus**
    - Aucun produit `is_active = false` ou appartenant à un vendeur `suspended` n'est retourné
    - **Valide : Exigences 12.3, 13.3**

  - [x] 5.6 Écrire les tests unitaires pour RecommendationEngine
    - Tester le filtrage par `power_rating`
    - Tester le tri par priorité vendeur puis prix
    - Tester le cas "aucun produit disponible" (retourne null)
    - Tester la limite à 10 résultats
    - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6. Checkpoint — Vérifier que tous les tests passent
  - S'assurer que tous les tests unitaires et de propriété des modules PowerCalculator et RecommendationEngine passent. Poser des questions à l'utilisateur si nécessaire.

- [x] 7. WhatsAppService (`src/services/whatsappService.ts`)
  - [x] 7.1 Implémenter le WhatsAppService
    - Implémenter `buildWhatsAppMessage(user, appliances, totalWatts, totalKVA, product): string` selon le format défini dans le design
    - Implémenter `sendWhatsAppMessage(vendorPhone: string, message: string): void` : encoder avec `encodeURIComponent`, ouvrir `wa.me/{vendorPhone}?text={encodedMessage}` dans un nouvel onglet
    - Implémenter `updateLeadStatus(leadId: string, status: 'contacted'): Promise<void>` via Supabase
    - Gérer le cas `vendorPhone` null/vide : ne pas générer le lien, retourner une erreur
    - _Exigences : 7.1, 7.2, 7.3, 7.4, 14.5_

  - [x] 7.2 Écrire le test de propriété — Contenu du message WhatsApp (Propriété 7)
    - **Propriété 7 : Contenu du message WhatsApp**
    - Pour tout utilisateur et produit, le message contient : prénom/nom, téléphone, localisation, appareils, puissance W et kVA, nom produit, prix FCFA
    - **Valide : Exigences 7.1**

  - [x] 7.3 Écrire le test de propriété — Format de l'URL WhatsApp (Propriété 8)
    - **Propriété 8 : Format de l'URL WhatsApp**
    - L'URL produite est de la forme `wa.me/{vendor_phone}?text={encodeURIComponent(message)}`
    - **Valide : Exigences 7.2**

  - [x] 7.4 Écrire le test de propriété — Restriction aux vendeurs validés (Propriété 17)
    - **Propriété 17 : Restriction des redirections WhatsApp aux vendeurs validés**
    - Aucune redirection vers un vendeur `pending` ou `suspended` n'est possible
    - **Valide : Exigences 14.5**

  - [x] 7.5 Écrire les tests unitaires pour WhatsAppService
    - Tester la construction du message avec tous les champs requis
    - Tester l'encodage URL du message
    - Tester le format du lien `wa.me`
    - Tester le comportement avec un numéro de téléphone null/vide
    - _Exigences : 7.1, 7.2, 7.3, 7.4_

- [x] 8. ChatbotEngine (`src/services/chatbotEngine.ts`)
  - [x] 8.1 Implémenter le ChatbotEngine
    - Définir la map de mots-clés : `prix`/`coût`/`tarif` → `price` ; `caractéristiques`/`specs`/`puissance` → `power_rating` + `description` ; `durée de vie`/`longévité`/`fiabilité`/`qualité`/`garantie` → `description`
    - Implémenter `extractKeywords(message: string): string[]`
    - Implémenter `processMessage(message: string, productId: string): Promise<string>` : extraire les mots-clés, récupérer le produit depuis Supabase, construire la réponse en français
    - Implémenter la réponse générique de fallback en français pour les messages sans mot-clé reconnu
    - Toutes les réponses doivent être en français
    - _Exigences : 8.2, 8.3, 8.4, 8.5_

  - [x] 8.2 Écrire le test de propriété — Réponse aux mots-clés connus (Propriété 9)
    - **Propriété 9 : Réponse du chatbot aux mots-clés connus**
    - Pour tout message contenant un mot-clé reconnu, le chatbot retourne une réponse non vide avec les informations du champ produit correspondant
    - **Valide : Exigences 8.2, 8.3**

  - [x] 8.3 Écrire le test de propriété — Réponse générique pour mots-clés inconnus (Propriété 10)
    - **Propriété 10 : Réponse générique pour les mots-clés inconnus**
    - Pour tout message sans mot-clé reconnu, la réponse est la réponse générique de fallback (non vide)
    - **Valide : Exigences 8.4**

  - [ ]* 8.4 Écrire les tests unitaires pour ChatbotEngine
    - Tester la détection de chaque mot-clé supporté
    - Tester la construction des réponses pour chaque catégorie de mot-clé
    - Tester le fallback générique
    - Tester que toutes les réponses sont en français
    - _Exigences : 8.2, 8.3, 8.4, 8.5_

- [x] 9. Checkpoint — Vérifier que tous les tests passent
  - S'assurer que tous les tests unitaires et de propriété des modules WhatsAppService et ChatbotEngine passent. Poser des questions à l'utilisateur si nécessaire.

- [x] 10. Page de calcul de puissance (`src/pages/CalculatePower.tsx`)
  - [x] 10.1 Implémenter le formulaire utilisateur
    - Créer le composant de formulaire avec les champs : prénom, nom, numéro de téléphone, localisation (ville/quartier)
    - Implémenter la validation côté client : tous les champs sont obligatoires, afficher un message d'erreur par champ manquant
    - Stocker les données utilisateur en état local React
    - _Exigences : 1.1, 1.2, 1.3, 14.4_

  - [x] 10.2 Implémenter la gestion des appareils électriques
    - Créer le composant d'ajout d'appareil avec les champs : nom, quantité (entier >= 1), valeur de puissance, unité (W, A, V)
    - Implémenter l'ajout d'un appareil à la liste en état local React
    - Implémenter la suppression d'un appareil de la liste avec recalcul automatique
    - Valider que la liste n'est pas vide lors de la soumission (afficher un message d'erreur sinon)
    - _Exigences : 2.1, 2.2, 2.3, 2.4, 14.4_

  - [x] 10.3 Câbler le calcul, la recommandation et l'enregistrement du lead
    - À la soumission du formulaire, appeler `PowerCalculator.calculateTotalPower(appliances)`
    - Appeler `RecommendationEngine.getRecommendation(totalKVA)`
    - Insérer le lead dans la table `leads` via Supabase avec tous les champs requis et le statut initial `new`
    - Insérer les appareils dans `appliances_input` liés au `lead_id`
    - Gérer le cas "aucun produit disponible" : enregistrer le lead avec `recommended_product_id = null`
    - En cas d'échec d'insertion : afficher `toast.error()` en français, conserver les résultats en état local, afficher un bouton de retry
    - Rediriger vers `/results` avec les données de calcul et de recommandation après succès
    - _Exigences : 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 10.4 Écrire le test de propriété — Cardinalité des appareils dans un lead (Propriété 6)
    - **Propriété 6 : Cardinalité des appareils dans un lead**
    - Pour tout lead créé avec N appareils (N >= 1), `appliances_input` contient exactement N enregistrements liés au `lead_id`
    - **Valide : Exigences 5.2**

  - [ ]* 10.5 Écrire le test de propriété — Validation des saisies avant envoi à Supabase (Propriété 16)
    - **Propriété 16 : Validation des saisies utilisateur avant envoi à Supabase**
    - Pour toute saisie invalide (champs vides, valeurs hors limites), le système rejette côté client sans envoyer à Supabase
    - **Valide : Exigences 14.4**

- [x] 11. Page de résultats (`src/pages/Results.tsx`)
  - [x] 11.1 Implémenter l'affichage des résultats et du produit recommandé
    - Récupérer les données de calcul et de recommandation depuis l'état de navigation React Router
    - Afficher le produit recommandé : nom, prix (avec animation Framer Motion), détails techniques, vendeur associé
    - Afficher le cas "aucun produit disponible" : message d'information en français avec lien vers `/vendors`
    - _Exigences : 6.1, 6.2, 6.3_

  - [x] 11.2 Implémenter l'export PDF
    - Intégrer jsPDF pour générer un PDF des résultats (puissance calculée, produit recommandé, détails)
    - Ajouter un bouton "Exporter en PDF" sur la page `/results`
    - _Exigences : 6.4_

  - [x] 11.3 Intégrer le bouton WhatsApp
    - Afficher le bouton "Contacter via WhatsApp" si `vendor.phone` est non null/vide
    - Au clic, appeler `WhatsAppService.sendWhatsAppMessage()` et `WhatsAppService.updateLeadStatus(leadId, 'contacted')`
    - Si `vendor.phone` est null/vide : masquer le bouton, afficher `toast.error()` en français, afficher l'email du vendeur comme alternative
    - _Exigences : 7.1, 7.2, 7.3, 7.4_

  - [x] 11.4 Intégrer le chatbot
    - Afficher un bouton "Conseil personnalisé" sur la page `/results`
    - Au clic, afficher l'interface chatbot (composant modal ou panneau latéral)
    - Câbler l'interface chatbot avec `ChatbotEngine.processMessage(message, productId)`
    - Afficher les réponses du chatbot dans l'interface
    - _Exigences : 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 12. Checkpoint — Vérifier que tous les tests passent
  - S'assurer que tous les tests unitaires et de propriété des pages CalculatePower et Results passent. Poser des questions à l'utilisateur si nécessaire.

- [x] 13. Annuaire des vendeurs (`src/pages/Vendors.tsx` et `src/pages/VendorDetail.tsx`)
  - [x] 13.1 Implémenter la page `/vendors`
    - Requête Supabase : récupérer tous les vendeurs avec `status = 'active'`
    - Afficher la liste des vendeurs actifs avec nom, catégorie, informations de contact
    - Ne pas afficher les vendeurs `pending` ou `suspended`
    - _Exigences : 9.1, 9.3_

  - [x] 13.2 Implémenter la page `/vendor/:id`
    - Requête Supabase : récupérer le vendeur par `id` et ses produits actifs (`is_active = true`)
    - Afficher la fiche détaillée : nom, catégorie, produits actifs, informations de contact
    - _Exigences : 9.2_

  - [ ]* 13.3 Écrire le test de propriété — Filtrage des vendeurs actifs (Propriété 11)
    - **Propriété 11 : Filtrage des vendeurs actifs dans l'annuaire public**
    - Pour tout ensemble de vendeurs, `/vendors` n'affiche que les vendeurs `active`
    - **Valide : Exigences 9.1, 9.3**

- [x] 14. Authentification et espace vendeur
  - [x] 14.1 Implémenter la page `/business-login` (inscription et connexion)
    - Implémenter le formulaire d'inscription : insérer un enregistrement dans `vendors` avec `status = 'pending'`
    - Implémenter le formulaire de connexion : appeler `supabase.auth.signInWithPassword()`
    - Gérer le cas `status = 'pending'` : afficher le message "Votre compte est en cours de validation par notre équipe." et bloquer l'accès
    - Gérer les identifiants incorrects : afficher un message d'erreur en français, ne pas créer de session
    - En cas de succès avec compte `active` : créer la session JWT et rediriger vers `/business-dashboard`
    - _Exigences : 10.1, 10.2, 10.3, 10.4_

  - [x] 14.2 Implémenter le tableau de bord vendeur (`src/pages/BusinessDashboard.tsx`)
    - Protéger la route `/business-dashboard` : rediriger vers `/business-login` si non authentifié
    - Requête Supabase : récupérer uniquement les produits et leads du `vendor_id` de l'utilisateur authentifié (RLS appliqué)
    - Afficher les métriques : nombre de leads `new`, `contacted`, `converted`, `lost`
    - _Exigences : 11.1, 11.2_

  - [x] 14.3 Implémenter la page de gestion des leads vendeur (`src/pages/Leads.tsx`)
    - Afficher la liste des leads du vendeur authentifié avec statut et informations utilisateur
    - Permettre la mise à jour du statut d'un lead (`contacted`, `converted`, `lost`)
    - _Exigences : 11.3_

  - [x] 14.4 Implémenter la page d'ajout de produit (`src/pages/AddProduct.tsx`)
    - Créer le formulaire d'ajout avec les champs : `name`, `category`, `power_rating`, `price`, `description`, `keywords`
    - Valider les champs obligatoires côté client : afficher un message d'erreur par champ manquant
    - Implémenter l'upload d'image via Supabase Storage (bucket `product-images`)
    - Insérer le produit dans `products` avec `is_active = true` et le `vendor_id` de l'utilisateur authentifié
    - _Exigences : 12.1, 12.2, 12.4, 14.4_

  - [ ]* 14.5 Écrire le test de propriété — Validation des champs obligatoires du formulaire produit (Propriété 15)
    - **Propriété 15 : Validation des champs obligatoires du formulaire produit**
    - Pour toute combinaison de champs obligatoires manquants, le système rejette la soumission et affiche un message d'erreur par champ, sans insérer en base
    - **Valide : Exigences 12.4**

- [x] 15. Interface d'administration
  - [x] 15.1 Implémenter la page `/admin/vendors`
    - Protéger la route `/admin` : accessible uniquement à l'admin (rôle Supabase)
    - Afficher tous les vendeurs quel que soit leur statut (`pending`, `active`, `suspended`)
    - Implémenter l'action "Valider" : mettre à jour `vendors.status = 'active'`
    - Implémenter l'action "Suspendre" : mettre à jour `vendors.status = 'suspended'`
    - _Exigences : 13.1, 13.2, 13.3_

  - [x] 15.2 Implémenter la page `/admin/leads`
    - Afficher tous les leads avec statut, informations utilisateur et vendeur associé
    - _Exigences : 13.4_

  - [ ]* 15.3 Écrire le test de propriété — Isolation des données vendeur RLS (Propriété 12)
    - **Propriété 12 : Isolation des données vendeur (sécurité RLS)**
    - Pour tout vendeur authentifié, les opérations sur `products` et `leads` ne retournent que les enregistrements avec `vendor_id = auth.uid()`
    - **Valide : Exigences 11.1, 14.2**

  - [ ]* 15.4 Écrire le test de propriété — Exactitude des métriques du tableau de bord (Propriété 13)
    - **Propriété 13 : Exactitude des métriques du tableau de bord vendeur**
    - Pour tout vendeur avec un ensemble de leads, les métriques affichées correspondent exactement aux comptages réels par statut
    - **Valide : Exigences 11.2**

- [x] 16. Checkpoint final — Vérifier que tous les tests passent
  - S'assurer que tous les tests unitaires, de propriété et d'intégration passent. Vérifier le code splitting, les index DB et les politiques RLS. Poser des questions à l'utilisateur si nécessaire.

## Notes

- Les tâches marquées avec `*` sont optionnelles et peuvent être ignorées pour un MVP plus rapide
- Chaque tâche référence les exigences spécifiques pour la traçabilité
- Les tests de propriété utilisent la bibliothèque `fast-check` (TypeScript)
- Les tests unitaires et de propriété sont complémentaires — ne pas substituer l'un à l'autre
- Les checkpoints garantissent une validation incrémentale à chaque étape clé
- La stack complète : React 18 + TypeScript + Vite + Tailwind CSS + Supabase + Framer Motion + Sonner + jsPDF
