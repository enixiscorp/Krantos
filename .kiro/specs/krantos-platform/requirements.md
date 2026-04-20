# Document de Exigences — Plateforme Krantos

## Introduction

Krantos est une marketplace intelligente dédiée à l'énergie et aux appareils électriques au Togo et en Afrique de l'Ouest. La plateforme permet aux particuliers et aux entreprises de calculer leurs besoins électriques, d'obtenir des recommandations de produits adaptées (groupes électrogènes, solutions solaires, etc.), et d'être mis en relation directement avec des vendeurs locaux vérifiés via WhatsApp.

Le modèle économique repose sur deux axes : un calculateur gratuit côté utilisateur (B2C) et un système d'abonnement, de leads payants et de commissions côté vendeurs (B2B). Chaque calcul effectué génère automatiquement un lead qualifié, liant l'utilisateur à un produit recommandé et à un vendeur.

---

## Glossaire

- **PowerCalculator** : Module de calcul de puissance électrique (`src/utils/powerCalculator.ts`)
- **RecommendationEngine** : Moteur de recommandation de produits (`src/services/recommendationEngine.ts`)
- **WhatsAppService** : Service de génération et d'envoi de messages WhatsApp (`src/services/whatsappService.ts`)
- **ChatbotEngine** : Moteur de réponse automatique basé sur des mots-clés (`src/services/chatbotEngine.ts`)
- **SupabaseClient** : Client centralisé pour les interactions avec Supabase (`src/lib/supabase.ts`)
- **Système** : La plateforme Krantos dans son ensemble
- **Utilisateur** : Particulier ou entreprise utilisant le calculateur de puissance (sans compte requis)
- **Vendeur** : Entreprise inscrite sur la plateforme proposant des produits énergétiques
- **Admin** : Administrateur de la plateforme Krantos
- **Lead** : Enregistrement qualifié liant un utilisateur, un produit recommandé et un vendeur
- **ApplianceInput** : Appareil électrique saisi par l'utilisateur (nom, quantité, puissance, unité)
- **kVA** : Kilovoltampère, unité de puissance apparente
- **FCFA** : Franc CFA, devise utilisée pour les prix
- **RLS** : Row Level Security, mécanisme de sécurité Supabase
- **JWT** : JSON Web Token, utilisé pour l'authentification des vendeurs et de l'admin

---

## Exigences

### Exigence 1 : Saisie des informations utilisateur

**User Story :** En tant qu'utilisateur, je veux saisir mes informations personnelles et ma localisation, afin que mes besoins électriques soient associés à un contexte géographique et que le vendeur puisse me contacter.

#### Critères d'Acceptation

1. THE Système SHALL afficher un formulaire de saisie sur la page `/calculate-power` comprenant les champs : prénom, nom, numéro de téléphone et localisation (ville/quartier).
2. WHEN un utilisateur soumet le formulaire avec des champs obligatoires vides, THE Système SHALL empêcher la soumission et afficher un message d'erreur pour chaque champ manquant.
3. WHEN un utilisateur saisit ses informations valides, THE Système SHALL conserver ces données en état local React pour les utiliser dans le calcul et la génération du lead.

---

### Exigence 2 : Saisie et gestion des appareils électriques

**User Story :** En tant qu'utilisateur, je veux ajouter mes appareils électriques avec leur quantité et leur puissance, afin que le calculateur puisse estimer mes besoins totaux.

#### Critères d'Acceptation

1. THE Système SHALL permettre à l'utilisateur d'ajouter un ou plusieurs appareils électriques, chacun avec un nom, une quantité (entier >= 1), une valeur de puissance et une unité (W, A ou V).
2. WHEN un utilisateur ajoute un appareil, THE Système SHALL l'ajouter à la liste des appareils en état local React.
3. WHEN un utilisateur supprime un appareil de la liste, THE Système SHALL retirer cet appareil de l'état local et recalculer la puissance totale.
4. IF la liste des appareils est vide lors de la soumission du formulaire, THEN THE Système SHALL empêcher la soumission et afficher un message d'erreur indiquant qu'au moins un appareil est requis.

---

### Exigence 3 : Calcul de la puissance électrique

**User Story :** En tant qu'utilisateur, je veux que mes besoins électriques soient calculés automatiquement à partir de mes appareils, afin d'obtenir une estimation fiable incluant une marge de sécurité.

#### Critères d'Acceptation

1. WHEN l'utilisateur soumet la liste des appareils, THE PowerCalculator SHALL normaliser chaque appareil en Watts selon son unité : W (valeur directe), A (Ampères × 220 Volts), V (valeur directe en Watts).
2. THE PowerCalculator SHALL calculer la puissance totale de chaque appareil en multipliant la puissance normalisée par la quantité.
3. THE PowerCalculator SHALL appliquer un facteur de marge de sécurité de 1.3 à la somme des puissances de tous les appareils.
4. THE PowerCalculator SHALL convertir la puissance totale en Watts en kVA en divisant par 1000.
5. THE PowerCalculator SHALL retourner un objet contenant `totalWatts`, `totalKVA` et un tableau `breakdown` détaillant la puissance calculée par appareil.

---

### Exigence 4 : Recommandation de produit

**User Story :** En tant qu'utilisateur, je veux recevoir une recommandation de produit adaptée à mes besoins calculés, afin de trouver rapidement un équipement approprié.

#### Critères d'Acceptation

1. WHEN le PowerCalculator retourne un `totalKVA`, THE RecommendationEngine SHALL interroger la base de données pour récupérer les produits dont `power_rating >= totalKVA`.
2. THE RecommendationEngine SHALL trier les produits filtrés par priorité vendeur (abonnement premium en premier), puis par prix croissant.
3. THE RecommendationEngine SHALL retourner le premier produit de la liste triée comme recommandation principale, ainsi que le vendeur associé.
4. IF aucun produit ne satisfait la condition `power_rating >= totalKVA`, THEN THE RecommendationEngine SHALL retourner `null` pour le produit et le vendeur.
5. THE RecommendationEngine SHALL limiter la requête à 10 résultats maximum pour éviter les surcharges.

---

### Exigence 5 : Génération et enregistrement du lead

**User Story :** En tant qu'administrateur et vendeur, je veux que chaque calcul génère automatiquement un lead qualifié, afin de disposer d'un pipeline de conversion mesurable.

#### Critères d'Acceptation

1. WHEN le calcul de puissance et la recommandation sont complétés, THE Système SHALL insérer un enregistrement dans la table `leads` contenant : `user_id`, `user_name`, `user_phone`, `location`, `total_power_needed`, `recommended_product_id`, `vendor_id` et le statut initial `new`.
2. WHEN le lead est créé, THE Système SHALL insérer dans la table `appliances_input` un enregistrement pour chaque appareil saisi, lié au `lead_id`, contenant : `appliance_name`, `quantity`, `power`, `unit` et `power_in_watts`.
3. IF aucun produit n'est disponible pour le besoin calculé, THEN THE Système SHALL quand même enregistrer le lead avec `recommended_product_id = null`.
4. IF l'insertion du lead échoue (erreur réseau ou contrainte DB), THEN THE Système SHALL afficher un message d'erreur explicite en français via `toast.error()` et conserver les résultats du calcul en état local React.
5. WHEN l'insertion du lead échoue, THE Système SHALL afficher un bouton de retry permettant à l'utilisateur de retenter l'enregistrement.

---

### Exigence 6 : Affichage des résultats et recommandations

**User Story :** En tant qu'utilisateur, je veux voir les résultats de mon calcul et le produit recommandé sur une page dédiée, afin de comprendre mes besoins et les options disponibles.

#### Critères d'Acceptation

1. WHEN le lead est enregistré avec succès, THE Système SHALL rediriger l'utilisateur vers la page `/results` avec les données de calcul et de recommandation.
2. THE Système SHALL afficher sur `/results` : le produit recommandé, son prix (avec animation), ses détails techniques et le vendeur associé.
3. IF aucun produit n'est disponible pour le besoin calculé, THEN THE Système SHALL afficher sur `/results` un message d'information indiquant qu'aucun produit ne correspond exactement, avec une suggestion de consulter l'annuaire `/vendors`.
4. THE Système SHALL proposer un export PDF des résultats via la bibliothèque jsPDF.

---

### Exigence 7 : Contact vendeur via WhatsApp

**User Story :** En tant qu'utilisateur, je veux contacter le vendeur directement via WhatsApp avec un message pré-rempli, afin de faciliter la prise de contact et d'accélérer la conversion.

#### Critères d'Acceptation

1. WHEN l'utilisateur clique sur le bouton "Contacter via WhatsApp" sur la page `/results`, THE WhatsAppService SHALL construire un message structuré contenant : prénom et nom de l'utilisateur, numéro de téléphone, localisation, liste des appareils, puissance totale (W et kVA), nom du produit recommandé et prix en FCFA.
2. THE WhatsAppService SHALL encoder le message avec `encodeURIComponent` et ouvrir l'URL `wa.me/{vendor_phone}?text={message_encodé}` dans un nouvel onglet.
3. WHEN le lien WhatsApp est ouvert, THE WhatsAppService SHALL mettre à jour le statut du lead correspondant à `contacted` dans la base de données.
4. IF le numéro de téléphone du vendeur est null ou vide, THEN THE Système SHALL masquer le bouton WhatsApp, afficher un message d'erreur via `toast.error()` et afficher l'email du vendeur comme alternative de contact.

---

### Exigence 8 : Chatbot de conseil personnalisé

**User Story :** En tant qu'utilisateur, je veux poser des questions sur le produit recommandé via un chatbot, afin d'obtenir des informations détaillées sans quitter la plateforme.

#### Critères d'Acceptation

1. THE Système SHALL afficher une interface chatbot accessible depuis la page `/results` via un bouton "Conseil personnalisé".
2. WHEN l'utilisateur envoie un message au chatbot, THE ChatbotEngine SHALL extraire les mots-clés du message et les mapper aux champs du produit associé.
3. THE ChatbotEngine SHALL supporter les mots-clés suivants et retourner les informations correspondantes : `prix`/`coût`/`tarif` → prix en FCFA ; `caractéristiques`/`specs`/`puissance` → puissance en kVA et description ; `durée de vie`/`longévité`, `fiabilité`/`qualité`, `garantie` → informations extraites de la description du produit.
4. IF le message de l'utilisateur ne contient aucun mot-clé reconnu, THEN THE ChatbotEngine SHALL retourner une réponse générique en français invitant l'utilisateur à reformuler ou à contacter le vendeur directement.
5. THE ChatbotEngine SHALL construire toutes ses réponses en langue française.

---

### Exigence 9 : Annuaire des vendeurs

**User Story :** En tant qu'utilisateur, je veux consulter l'annuaire des vendeurs vérifiés, afin de trouver un fournisseur local même sans passer par le calculateur.

#### Critères d'Acceptation

1. THE Système SHALL afficher sur la page `/vendors` la liste de tous les vendeurs avec le statut `active`.
2. THE Système SHALL afficher sur la page `/vendor/:id` la fiche détaillée d'un vendeur, incluant son nom, sa catégorie, ses produits actifs et ses informations de contact.
3. WHILE un vendeur a le statut `pending` ou `suspended`, THE Système SHALL ne pas afficher ce vendeur dans l'annuaire public.

---

### Exigence 10 : Inscription et authentification des vendeurs

**User Story :** En tant que vendeur, je veux m'inscrire sur la plateforme et me connecter à mon espace métier, afin de gérer mes produits et mes leads.

#### Critères d'Acceptation

1. WHEN un vendeur soumet le formulaire d'inscription sur `/business-login`, THE Système SHALL insérer un enregistrement dans la table `vendors` avec le statut initial `pending`.
2. WHEN un vendeur tente de se connecter avec un compte dont le statut est `pending`, THE Système SHALL afficher le message : "Votre compte est en cours de validation par notre équipe." et empêcher l'accès au tableau de bord.
3. WHEN un vendeur se connecte avec des identifiants valides et un compte `active`, THE Système SHALL authentifier le vendeur via Supabase Auth, créer une session JWT et rediriger vers `/business-dashboard`.
4. IF les identifiants de connexion sont incorrects, THEN THE Système SHALL afficher un message d'erreur en français et ne pas créer de session.

---

### Exigence 11 : Tableau de bord vendeur

**User Story :** En tant que vendeur, je veux accéder à un tableau de bord affichant mes produits et mes leads, afin de suivre mon activité commerciale sur la plateforme.

#### Critères d'Acceptation

1. WHILE un vendeur est authentifié, THE Système SHALL afficher sur `/business-dashboard` uniquement les produits et les leads associés à son `vendor_id`.
2. THE Système SHALL afficher sur le tableau de bord des métriques incluant : nombre de leads reçus, nombre de leads contactés et nombre de leads convertis.
3. WHEN un vendeur accède à `/leads`, THE Système SHALL afficher la liste de ses leads avec leur statut (`new`, `contacted`, `converted`, `lost`) et les informations de l'utilisateur associé.

---

### Exigence 12 : Gestion des produits par le vendeur

**User Story :** En tant que vendeur, je veux ajouter et gérer mes produits sur la plateforme, afin qu'ils soient inclus dans les recommandations aux utilisateurs.

#### Critères d'Acceptation

1. WHEN un vendeur soumet le formulaire d'ajout de produit sur `/add-product`, THE Système SHALL insérer un enregistrement dans la table `products` avec les champs : `name`, `category`, `power_rating`, `price`, `description`, `keywords` et `is_active = true`, lié au `vendor_id` du vendeur connecté.
2. THE Système SHALL permettre au vendeur d'uploader une image produit via Supabase Storage.
3. WHEN un vendeur désactive un produit (`is_active = false`), THE RecommendationEngine SHALL exclure ce produit des recommandations futures.
4. IF un champ obligatoire (`name`, `category`, `power_rating`, `price`) est manquant lors de l'ajout d'un produit, THEN THE Système SHALL empêcher la soumission et afficher un message d'erreur pour chaque champ manquant.

---

### Exigence 13 : Administration des vendeurs

**User Story :** En tant qu'administrateur, je veux valider les inscriptions des vendeurs et gérer leur statut, afin de garantir la qualité et la fiabilité de la marketplace.

#### Critères d'Acceptation

1. THE Système SHALL afficher sur `/admin/vendors` la liste de tous les vendeurs, quel que soit leur statut (`pending`, `active`, `suspended`).
2. WHEN un administrateur valide un vendeur en définissant son statut à `active`, THE Système SHALL mettre à jour le champ `status` dans la table `vendors` et permettre au vendeur de se connecter.
3. WHEN un administrateur suspend un vendeur en définissant son statut à `suspended`, THE Système SHALL empêcher ce vendeur de se connecter et masquer ses produits des recommandations et de l'annuaire public.
4. THE Système SHALL afficher sur `/admin/leads` la liste de tous les leads avec leur statut, les informations utilisateur et le vendeur associé.

---

### Exigence 14 : Sécurité et contrôle d'accès

**User Story :** En tant qu'administrateur, je veux que les données de chaque vendeur soient isolées et protégées, afin d'éviter tout accès non autorisé entre vendeurs.

#### Critères d'Acceptation

1. THE SupabaseClient SHALL activer Row Level Security (RLS) sur toutes les tables Supabase.
2. WHILE un vendeur est authentifié, THE Système SHALL restreindre les opérations de lecture et d'écriture sur les tables `products` et `leads` aux seuls enregistrements dont le `vendor_id` correspond à l'identifiant de l'utilisateur authentifié (`auth.uid()`).
3. THE Système SHALL utiliser uniquement les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` côté client, sans jamais exposer la clé service Supabase dans le frontend.
4. THE Système SHALL valider toutes les saisies utilisateur côté client avant tout envoi à Supabase.
5. THE WhatsAppService SHALL rediriger uniquement vers des numéros de téléphone de vendeurs ayant le statut `active` et validés par l'administrateur.

---

### Exigence 15 : Performance et accessibilité mobile

**User Story :** En tant qu'utilisateur en Afrique de l'Ouest, je veux que la plateforme soit rapide et utilisable sur mobile avec une connexion variable, afin d'accéder au service dans des conditions réseau dégradées.

#### Critères d'Acceptation

1. THE Système SHALL implémenter le code splitting par route via React lazy et Suspense pour minimiser le bundle initial chargé au démarrage.
2. THE Système SHALL créer des index de base de données sur les colonnes `products.power_rating`, `leads.vendor_id` et `leads.status` pour optimiser les requêtes fréquentes.
3. THE Système SHALL stocker les images produits sur Supabase Storage avec CDN intégré, au format WebP recommandé.
4. THE Système SHALL utiliser Framer Motion uniquement pour les éléments d'interface critiques (animation du prix, transitions de page) et non sur les listes longues.
