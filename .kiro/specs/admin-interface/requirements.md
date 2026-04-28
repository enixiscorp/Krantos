# Document de Requirements — Interface d'Administration

## Introduction

Ce document décrit les exigences fonctionnelles pour l'interface d'administration complète de la plateforme Krantos (calculateur intelligent de panneaux solaires / énergie). L'objectif est de consolider et compléter l'interface admin existante (React + TypeScript + Supabase) afin de couvrir le workflow complet :

**Inscription vendeur → Validation admin → Accès vendeur → Ajout de produits → Visibilité sur le site vitrine**

L'interface s'appuie sur l'architecture existante : pages dans `src/pages/`, services dans `src/services/`, composants dans `src/components/`, et le backend Supabase avec les tables `vendors`, `contracts`, `commissions`, `products`, `profiles`, `admin_users`.

---

## Glossaire

- **Admin_Interface** : L'ensemble des pages et composants React accessibles sous `/admin/*`
- **Admin_Auth_System** : Le système d'authentification à deux facteurs (email/mot de passe + TOTP) pour les administrateurs
- **Admin_Session** : La session administrateur stockée dans `localStorage` sous la clé `ENIXIS_ADMIN_SESSION`, valide 24 heures
- **Admin_Route_Guard** : Le composant `SuperAdminRoute` (et ses variantes par rôle) qui protège les routes admin
- **Vendor_Workflow** : Le cycle de vie complet d'un vendeur : inscription → validation → accès → produits → visibilité
- **Vendor** : Un partenaire commercial inscrit dans la table `vendors`, lié à un compte `auth.users` via `profile_id`
- **Admin_User** : Un utilisateur interne enregistré dans la table `admin_users` avec un rôle `super_admin`, `admin_principal`, ou `admin_collaborateur`
- **Permission_System** : Le système de contrôle d'accès basé sur les rôles admin (RBAC)
- **Sidebar** : La barre de navigation latérale rétractable de l'interface admin
- **Commission_Record** : Un enregistrement dans la table `commission_records` représentant une commission ou un changement de taux
- **Contract** : Les données de contrat d'un vendeur (dates, statut) stockées dans la table `vendors`
- **Vendor_Dashboard** : L'espace vendeur accessible via `/business-dashboard` après connexion
- **Vitrine** : Les pages publiques `/vendors` et `/vendor/:id` affichant les vendeurs actifs
- **TOTP** : Time-based One-Time Password, code à 6 chiffres généré par une application d'authentification
- **React_Query** : Bibliothèque de gestion du cache et des états asynchrones côté client
- **RLS** : Row Level Security, politiques de sécurité au niveau des lignes dans Supabase

---

## Requirements

---

### Requirement 1 : Authentification administrateur à deux facteurs

**User Story :** En tant qu'administrateur, je veux me connecter avec mon email, mon mot de passe et un code TOTP, afin de sécuriser l'accès à l'interface d'administration.

#### Acceptance Criteria

1. WHEN un administrateur soumet un email et un mot de passe valides, THE Admin_Auth_System SHALL vérifier les identifiants via Supabase Auth et afficher le formulaire de saisie du code TOTP.
2. WHEN un administrateur soumet un code TOTP valide, THE Admin_Auth_System SHALL créer une Admin_Session dans `localStorage` avec une durée de vie de 24 heures et rediriger vers `/admin`.
3. IF le mot de passe soumis est invalide, THEN THE Admin_Auth_System SHALL afficher un message d'erreur générique sans révéler si l'email existe.
4. IF le code TOTP soumis est invalide ou expiré, THEN THE Admin_Auth_System SHALL afficher un message d'erreur et incrémenter un compteur de tentatives.
5. IF un administrateur effectue 5 tentatives de connexion échouées consécutives dans une fenêtre de 15 minutes, THEN THE Admin_Auth_System SHALL bloquer les tentatives supplémentaires pendant 15 minutes.
6. THE Admin_Auth_System SHALL valider le format de l'email et la longueur minimale du mot de passe (8 caractères) via Zod avant toute requête réseau.
7. WHILE une Admin_Session est active, THE Admin_Auth_System SHALL limiter le nombre de sessions simultanées à 2 par administrateur.
8. WHEN une Admin_Session expire ou est révoquée, THE Admin_Auth_System SHALL rediriger l'administrateur vers la page de connexion.

---

### Requirement 2 : Système de permissions basé sur les rôles (RBAC)

**User Story :** En tant que super_admin, je veux que chaque rôle admin ait des accès distincts, afin de contrôler précisément ce que chaque collaborateur peut faire.

#### Acceptance Criteria

1. THE Permission_System SHALL définir trois rôles : `super_admin` (accès total + création d'admins), `admin_principal` (accès total + création de collaborateurs), `admin_collaborateur` (accès limité : Demandes, Factures, Profil uniquement).
2. WHEN un utilisateur avec le rôle `admin_collaborateur` tente d'accéder à une route réservée (`/admin/vendors`, `/admin/contracts`, `/admin/commissions`, `/admin/users`), THE Admin_Route_Guard SHALL rediriger vers `/admin` avec un message d'accès refusé.
3. WHEN un utilisateur avec le rôle `admin_principal` tente de créer un `super_admin`, THE Permission_System SHALL rejeter l'opération et retourner une erreur d'autorisation.
4. THE Admin_Route_Guard SHALL vérifier le rôle de l'utilisateur connecté via la table `profiles` à chaque navigation vers une route protégée.
5. IF le profil de l'utilisateur connecté est introuvable dans la table `profiles`, THEN THE Admin_Route_Guard SHALL déconnecter l'utilisateur et le rediriger vers `/business-login`.
6. WHERE la fonctionnalité de création d'administrateurs est activée, THE Permission_System SHALL permettre uniquement aux rôles `super_admin` et `admin_principal` de créer de nouveaux Admin_User.

---

### Requirement 3 : Layout admin avec sidebar rétractable

**User Story :** En tant qu'administrateur, je veux une interface avec une sidebar de navigation persistante et un thème clair/sombre, afin de naviguer efficacement entre les sections.

#### Acceptance Criteria

1. THE Sidebar SHALL afficher une largeur de 256px en mode étendu et 64px en mode rétracté.
2. WHEN un administrateur bascule l'état de la Sidebar, THE Sidebar SHALL persister cet état dans `localStorage` et le restaurer lors des visites suivantes.
3. WHEN la largeur de l'écran est inférieure à 768px, THE Sidebar SHALL se transformer en overlay plein écran déclenché par un bouton hamburger.
4. WHEN l'overlay mobile de la Sidebar est ouvert et que l'utilisateur clique en dehors, THE Sidebar SHALL se fermer automatiquement.
5. THE Admin_Interface SHALL proposer un bouton de bascule thème clair/sombre dont l'état est persisté dans `localStorage`.
6. THE Sidebar SHALL afficher uniquement les liens de navigation accessibles selon le rôle de l'Admin_User connecté.
7. WHEN un Admin_User se déconnecte via la Sidebar, THE Admin_Auth_System SHALL invalider la Admin_Session et rediriger vers `/business-login`.

---

### Requirement 4 : Validation des vendeurs (approbation / rejet)

**User Story :** En tant qu'admin, je veux approuver ou rejeter les inscriptions de vendeurs en attente, afin de contrôler qui peut accéder à la plateforme.

#### Acceptance Criteria

1. WHEN un Admin_User charge la page `/admin/vendors`, THE Admin_Interface SHALL afficher la liste de tous les Vendor avec leur statut (`pending`, `active`, `suspended`, `expired`, `terminated`), nom, catégorie, téléphone et date d'inscription.
2. WHEN un Admin_User clique sur "Valider" pour un Vendor avec le statut `pending`, THE Admin_Interface SHALL mettre à jour le statut du Vendor à `active` dans la table `vendors` et afficher une confirmation.
3. WHEN un Admin_User clique sur "Rejeter" pour un Vendor avec le statut `pending`, THE Admin_Interface SHALL mettre à jour le statut du Vendor à `terminated` dans la table `vendors` et afficher une confirmation.
4. WHEN un Admin_User clique sur "Suspendre" pour un Vendor avec le statut `active`, THE Admin_Interface SHALL mettre à jour le statut du Vendor à `suspended` et désactiver tous les produits associés dans la table `products`.
5. THE Admin_Interface SHALL afficher un badge d'alerte sur le tableau de bord `/admin` indiquant le nombre de Vendor avec le statut `pending`.
6. WHEN un Admin_User effectue une action de validation ou de rejet, THE Admin_Interface SHALL enregistrer l'action dans la table `admin_action_logs` avec l'identifiant de l'acteur, le rôle, l'action et l'identifiant du Vendor cible.
7. THE Admin_Interface SHALL permettre de filtrer les Vendor par statut et de rechercher par nom ou email.
8. IF une erreur Supabase survient lors de la mise à jour du statut, THEN THE Admin_Interface SHALL afficher un message d'erreur et annuler la mise à jour locale.

---

### Requirement 5 : Gestion de l'accès vendeur (activation / désactivation / rôles)

**User Story :** En tant qu'admin, je veux activer ou désactiver l'accès d'un vendeur et modifier son type d'abonnement, afin de gérer finement les droits de chaque partenaire.

#### Acceptance Criteria

1. WHEN un Admin_User modifie le statut d'un Vendor de `suspended` à `active`, THE Admin_Interface SHALL réactiver tous les produits du Vendor dont `is_active` était `true` avant la suspension.
2. WHEN un Admin_User modifie le type d'abonnement (`subscription_type`) d'un Vendor, THE Admin_Interface SHALL mettre à jour le champ `subscription_type` dans la table `vendors` et afficher une confirmation.
3. THE Admin_Interface SHALL afficher le type d'abonnement actuel (`free`, `basic`, `premium`) de chaque Vendor dans la liste et permettre sa modification via un sélecteur.
4. WHEN un Admin_User accède à la fiche détail d'un Vendor, THE Admin_Interface SHALL afficher les informations complètes : nom, email, téléphone, catégorie, statut, abonnement, date de création, date de fin de contrat, taux de commission, et nombre de produits actifs.
5. IF un Vendor a le statut `suspended` ou `terminated`, THEN THE Admin_Interface SHALL afficher un indicateur visuel distinctif sur sa fiche et dans la liste.
6. WHEN un Admin_User modifie l'accès d'un Vendor, THE Admin_Interface SHALL invalider le cache React_Query associé aux données du Vendor.

---

### Requirement 6 : Validation des contrats vendeurs

**User Story :** En tant qu'admin, je veux gérer le cycle de vie des contrats vendeurs (renouvellement, résiliation), afin de maintenir des relations contractuelles à jour.

#### Acceptance Criteria

1. WHEN un Admin_User charge la page `/admin/contracts`, THE Admin_Interface SHALL afficher tous les Vendor avec leur `contract_end_date`, leur statut de contrat, et le nombre de jours restants.
2. WHEN un Admin_User renouvelle un Contract en définissant une nouvelle `contract_end_date`, THE Admin_Interface SHALL mettre à jour le statut du Vendor à `active`, enregistrer la nouvelle date dans `vendors.contract_end_date`, et réactiver les produits du Vendor.
3. WHEN un Admin_User résilie un Contract, THE Admin_Interface SHALL mettre à jour le statut du Vendor à `terminated` et désactiver tous les produits associés.
4. THE Admin_Interface SHALL afficher une alerte visuelle pour les Vendor dont le `contract_end_date` est dans moins de 7 jours.
5. WHEN le système détecte un Vendor avec `status = 'active'` et `contract_end_date <= now()`, THE Admin_Interface SHALL afficher ce Vendor dans une section "Contrats expirés" avec une action de renouvellement.
6. IF un Admin_User avec le rôle `admin_collaborateur` tente de renouveler ou résilier un Contract, THEN THE Admin_Interface SHALL rejeter l'opération et afficher un message d'accès refusé.
7. WHEN un renouvellement de Contract est confirmé, THE Admin_Interface SHALL enregistrer l'action dans `admin_action_logs`.

---

### Requirement 7 : Gestion des commissions

**User Story :** En tant qu'admin, je veux confirmer ou rejeter les commissions en attente et modifier les taux par vendeur, afin de gérer les revenus de la plateforme.

#### Acceptance Criteria

1. WHEN un Admin_User charge la page `/admin/commissions`, THE Admin_Interface SHALL afficher tous les Commission_Record avec le nom du Vendor associé, le montant, le taux appliqué, le statut et la date.
2. WHEN un Admin_User confirme un Commission_Record avec le statut `pending_verification`, THE Admin_Interface SHALL mettre à jour le statut à `confirmed` dans la table `commission_records`.
3. WHEN un Admin_User rejette un Commission_Record avec le statut `pending_verification`, THE Admin_Interface SHALL mettre à jour le statut à `rejected` et enregistrer une note de rejet.
4. WHEN un Admin_User modifie le taux de commission d'un Vendor, THE Admin_Interface SHALL valider que le nouveau taux est un multiple de 5 compris entre 5 et 100, mettre à jour `vendors.commission_rate`, et créer un Commission_Record de type `rate_change`.
5. THE Admin_Interface SHALL permettre de filtrer les Commission_Record par statut (`pending_verification`, `confirmed`, `rejected`, `rate_change`) et de rechercher par nom de Vendor.
6. THE Admin_Interface SHALL afficher un résumé des totaux : montant total confirmé, montant total en attente, nombre de conversions sur la période sélectionnée.
7. IF le taux de commission soumis n'est pas un multiple de 5 ou est hors de la plage [5, 100], THEN THE Admin_Interface SHALL afficher un message de validation et bloquer la soumission.

---

### Requirement 8 : Accès vendeur au tableau de bord et ajout de produits

**User Story :** En tant que vendeur validé, je veux me connecter à mon espace et ajouter mes produits, afin de les rendre disponibles sur le calculateur solaire.

#### Acceptance Criteria

1. WHEN un Vendor avec le statut `active` se connecte via `/business-login`, THE Admin_Auth_System SHALL rediriger vers `/business-dashboard` après authentification réussie.
2. IF un Vendor avec le statut `pending`, `suspended`, `expired`, ou `terminated` tente de se connecter, THEN THE Admin_Auth_System SHALL afficher un message indiquant que le compte n'est pas encore activé ou a été suspendu.
3. WHEN un Vendor accède à `/business-dashboard`, THE Vendor_Dashboard SHALL afficher ses statistiques : nombre de produits actifs, nombre de leads reçus, taux de conversion, et commissions en attente.
4. WHEN un Vendor soumet le formulaire d'ajout de produit sur `/add-product`, THE Vendor_Dashboard SHALL valider que tous les champs obligatoires (nom, catégorie, puissance, prix) sont remplis avant d'insérer dans la table `products`.
5. WHEN un produit est ajouté avec succès, THE Vendor_Dashboard SHALL afficher une confirmation et mettre à jour la liste des produits du Vendor.
6. IF un Vendor tente d'accéder à `/add-product` sans être authentifié, THEN THE Admin_Route_Guard SHALL rediriger vers `/business-login`.
7. WHILE un Vendor a le statut `active`, THE Vendor_Dashboard SHALL permettre d'activer ou désactiver individuellement chaque produit via le champ `products.is_active`.

---

### Requirement 9 : Visibilité des vendeurs validés sur la vitrine

**User Story :** En tant qu'utilisateur du calculateur solaire, je veux voir uniquement les vendeurs actifs avec leurs produits, afin d'obtenir des recommandations pertinentes.

#### Acceptance Criteria

1. WHEN un utilisateur charge la page `/vendors`, THE Vitrine SHALL afficher uniquement les Vendor avec le statut `active`.
2. WHEN un utilisateur accède à la page `/vendor/:id`, THE Vitrine SHALL afficher les détails du Vendor et uniquement ses produits avec `is_active = true`.
3. IF un Vendor a le statut `suspended`, `expired`, ou `terminated`, THEN THE Vitrine SHALL exclure ce Vendor et ses produits de toutes les pages publiques et des résultats du calculateur.
4. WHEN le statut d'un Vendor passe à `active`, THE Vitrine SHALL rendre ce Vendor visible dans les résultats du calculateur dans un délai maximal de 5 minutes (invalidation du cache).
5. THE Vitrine SHALL afficher pour chaque Vendor actif : nom, catégorie, type d'abonnement, et liste de produits actifs avec puissance et prix.
6. WHEN le moteur de recommandation sélectionne des produits pour un lead, THE Vitrine SHALL considérer uniquement les produits dont le Vendor associé a le statut `active` et `is_active = true`.

---

### Requirement 10 : Tableau de bord admin et statistiques

**User Story :** En tant qu'admin, je veux un tableau de bord centralisé avec les métriques clés, afin de piloter la performance de la plateforme.

#### Acceptance Criteria

1. WHEN un Admin_User charge la page `/admin`, THE Admin_Interface SHALL afficher : nombre total de Vendor, nombre de Vendor actifs, nombre de Vendor en attente, nombre total de produits, nombre total de leads, et taux de conversion global.
2. THE Admin_Interface SHALL afficher un graphique des leads des 14 derniers jours sur le tableau de bord.
3. THE Admin_Interface SHALL afficher le classement des top Vendor par nombre de leads et taux de conversion.
4. WHEN un Admin_User clique sur un lien de navigation du tableau de bord, THE Admin_Interface SHALL naviguer vers la section correspondante sans rechargement de page.
5. IF la récupération des données du tableau de bord échoue, THEN THE Admin_Interface SHALL afficher un message d'erreur et proposer un bouton de rechargement.
6. THE Admin_Interface SHALL afficher les alertes actives : Vendor en attente de validation, contrats expirant dans moins de 7 jours, commissions en attente de vérification.

---

### Requirement 11 : Gestion des utilisateurs administrateurs

**User Story :** En tant que super_admin, je veux créer, lister et supprimer des comptes administrateurs, afin de gérer l'équipe interne.

#### Acceptance Criteria

1. WHEN un Admin_User avec le rôle `super_admin` ou `admin_principal` charge la page `/admin/users`, THE Admin_Interface SHALL afficher la liste de tous les Admin_User avec leur nom, email, rôle et date de création.
2. WHEN un Admin_User avec le rôle `super_admin` crée un nouvel Admin_User, THE Admin_Interface SHALL appeler la Edge Function `admin-create-user` pour créer le compte Supabase Auth et l'enregistrement dans `admin_users`.
3. WHEN un Admin_User avec le rôle `admin_principal` crée un nouvel Admin_User, THE Permission_System SHALL limiter le rôle assignable à `admin_collaborateur` uniquement.
4. WHEN un Admin_User supprime un Admin_User, THE Admin_Interface SHALL supprimer l'enregistrement de la table `admin_users` et révoquer l'accès Supabase Auth correspondant.
5. IF un Admin_User tente de supprimer son propre compte, THEN THE Admin_Interface SHALL bloquer l'opération et afficher un message d'erreur.
6. THE Admin_Interface SHALL permettre de rechercher les Admin_User par nom ou email.
7. WHEN un Admin_User est créé ou supprimé, THE Admin_Interface SHALL enregistrer l'action dans `admin_action_logs`.

---

### Requirement 12 : Facturation et export PDF

**User Story :** En tant qu'admin, je veux générer des rapports de facturation par vendeur et les exporter en PDF, afin de produire des documents comptables.

#### Acceptance Criteria

1. WHEN un Admin_User sélectionne un Vendor et une période sur `/admin/billing`, THE Admin_Interface SHALL générer un rapport listant toutes les Commission_Record confirmées du Vendor sur la période.
2. THE Admin_Interface SHALL afficher le total à facturer calculé comme la somme des montants des Commission_Record confirmées de la période.
3. WHEN un Admin_User clique sur "Télécharger le PDF", THE Admin_Interface SHALL générer un fichier PDF via `jsPDF` contenant le rapport et déclencher son téléchargement.
4. IF aucune Commission_Record confirmée n'existe pour la période sélectionnée, THEN THE Admin_Interface SHALL afficher un message informatif et désactiver le bouton de téléchargement PDF.
5. THE Admin_Interface SHALL valider que la date de début est antérieure à la date de fin avant de générer le rapport.

---

### Requirement 13 : Sécurité et audit

**User Story :** En tant que super_admin, je veux que toutes les actions sensibles soient tracées et que les accès non autorisés soient bloqués, afin de garantir la sécurité de la plateforme.

#### Acceptance Criteria

1. THE Admin_Interface SHALL appliquer les politiques RLS Supabase pour toutes les opérations sur les tables `vendors`, `products`, `commission_records`, `admin_users`, et `admin_action_logs`.
2. WHEN un Admin_User effectue une action sensible (validation/rejet de Vendor, modification de taux, renouvellement/résiliation de contrat, création/suppression d'Admin_User), THE Admin_Interface SHALL enregistrer un enregistrement dans `admin_action_logs` avec l'acteur, le rôle, l'action, la cible et les métadonnées.
3. THE Admin_Interface SHALL ne jamais exposer la clé de service Supabase (`SUPABASE_SERVICE_ROLE_KEY`) dans le bundle client ; les opérations privilégiées SHALL être déléguées aux Edge Functions.
4. IF une requête Supabase retourne une erreur d'autorisation (code 403 ou RLS violation), THEN THE Admin_Interface SHALL afficher un message d'accès refusé sans exposer les détails techniques de l'erreur.
5. THE Admin_Interface SHALL utiliser des requêtes paramétrées via le client Supabase pour toutes les interactions avec la base de données, sans concaténation de chaînes SQL.
