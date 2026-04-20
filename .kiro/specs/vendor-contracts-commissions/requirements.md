# Document de Exigences — Gestion des Commissions, Contrats et Facturation

## Introduction

Ce module étend la plateforme Krantos avec un système de gestion contractuelle et financière des vendeurs. Il permet aux administrateurs de définir des taux de commission par vendeur, de suivre les conversions de leads, de générer des rapports de facturation exportables, et de gérer le cycle de vie complet des contrats (expiration, renouvellement, résiliation pour fraude). Un système de rôles administrateurs à trois niveaux contrôle les droits d'accès à ces fonctionnalités.

---

## Glossaire

- **CommissionService** : Module de gestion des taux et enregistrements de commission (`src/services/commissionService.ts`)
- **ContractService** : Module de gestion du cycle de vie des contrats vendeurs (`src/services/contractService.ts`)
- **BillingService** : Module de génération des rapports de facturation (`src/services/billingService.ts`)
- **FraudDetectionService** : Module de détection et traitement des fraudes (`src/services/fraudDetectionService.ts`)
- **Super Admin** : Administrateur avec accès total, peut créer tous les types d'admins
- **Admin Principal** : Administrateur avec les mêmes droits que le Super Admin sauf la création de Super Admins
- **Admin Collaborateur** : Administrateur avec droits limités (gestion vendeurs, rapports, pas de renouvellement ni création d'admins)
- **Commission** : Pourcentage prélevé sur le montant d'une vente conclue par un vendeur
- **Conversion** : Lead passant au statut `converted`, indiquant une vente conclue
- **Fraude** : Marquage d'un lead comme `converted` sans paiement réel vérifié
- **Contrat** : Période d'activité d'un vendeur sur la plateforme, définie par `contract_start_date` et `contract_end_date`
- **Rapport de facturation** : Document listant les commissions dues par un vendeur sur une période donnée
- **Période temporelle** : Filtre de dashboard parmi : journalier, hebdomadaire, mensuel, trimestriel, semestriel, annuel

---

## Exigences

### Exigence C1 : Définition du taux de commission par vendeur

**User Story :** En tant qu'administrateur, je veux définir un taux de commission pour chaque vendeur via un menu déroulant, afin que la plateforme puisse calculer automatiquement les commissions dues sur chaque vente.

#### Critères d'Acceptation

1. THE Système SHALL afficher sur la page `/admin/commissions` un menu déroulant permettant de sélectionner le taux de commission d'un vendeur parmi les valeurs : 5%, 10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%, 55%, 60%, 65%, 70%, 75%, 80%, 85%, 90%, 95%, 100%.
2. WHEN un administrateur sélectionne un taux et confirme, THE CommissionService SHALL mettre à jour le champ `commission_rate` dans la table `vendors` et insérer un enregistrement dans `commission_records` avec le type `rate_change` et un horodatage.
3. THE Système SHALL afficher la date et l'heure de la dernière modification du taux de commission pour chaque vendeur.
4. IF un taux invalide (non multiple de 5, hors de la plage 5–100) est soumis, THEN THE Système SHALL rejeter la valeur et afficher un message d'erreur en français.

---

### Exigence C2 : Calcul et enregistrement des commissions sur ventes

**User Story :** En tant qu'administrateur, je veux que chaque vente conclue génère automatiquement un enregistrement de commission horodaté, afin de disposer d'un historique complet et vérifiable.

#### Critères d'Acceptation

1. WHEN un vendeur marque un lead au statut `converted`, THE CommissionService SHALL insérer un enregistrement dans `commission_records` avec : `vendor_id`, `lead_id`, `commission_rate_applied` (taux actuel du vendeur), `status: pending_verification` et un horodatage.
2. THE CommissionService SHALL calculer le montant de commission selon la formule : `amount = valeur_vente × commission_rate / 100`.
3. WHEN un administrateur confirme qu'un paiement a bien eu lieu, THE Système SHALL mettre à jour le statut de l'enregistrement `commission_records` à `confirmed`.
4. WHEN un administrateur rejette une conversion (fraude suspectée), THE Système SHALL mettre à jour le statut à `rejected` et appeler le FraudDetectionService.
5. THE Système SHALL afficher dans le dashboard admin et vendeur l'historique de tous les enregistrements de commission avec leur statut.

---

### Exigence C3 : Dashboard de suivi des commissions

**User Story :** En tant qu'administrateur et vendeur, je veux consulter un tableau de bord de mes commissions avec des filtres temporels, afin de suivre mon activité financière sur la plateforme.

#### Critères d'Acceptation

1. THE Système SHALL afficher un dashboard de commissions accessible depuis `/admin/commissions` pour les admins et depuis l'onglet "Commissions" du `/business-dashboard` pour les vendeurs.
2. THE Système SHALL proposer les filtres temporels suivants : journalier, hebdomadaire, mensuel, trimestriel, semestriel, annuel.
3. WHEN un filtre temporel est sélectionné, THE CommissionService SHALL interroger la table `commission_records` avec une plage sur `created_at` correspondant à la période choisie.
4. THE Système SHALL afficher pour chaque période : le nombre de conversions, le total des commissions confirmées, et le total des commissions en attente de vérification.
5. WHILE un vendeur est authentifié, THE Système SHALL restreindre l'affichage aux seuls enregistrements de commission dont le `vendor_id` correspond à son identifiant (RLS).

---

### Exigence C4 : Détection et traitement des fraudes

**User Story :** En tant qu'administrateur, je veux que le système détecte et sanctionne automatiquement les vendeurs fraudeurs, afin de protéger l'intégrité de la marketplace.

#### Critères d'Acceptation

1. WHEN un administrateur signale une fraude pour un vendeur, THE FraudDetectionService SHALL incrémenter le champ `fraud_count` dans la table `vendors` de 1.
2. WHEN le `fraud_count` d'un vendeur atteint 3, THE FraudDetectionService SHALL automatiquement mettre à jour le statut du vendeur à `terminated`, désactiver tous ses produits (`is_active = false`) et invalider sa session active.
3. THE Système SHALL afficher un message explicite à l'admin confirmant la résiliation automatique lorsque le seuil de 3 fraudes est atteint.
4. WHEN un vendeur est résilié pour fraude, THE Système SHALL conserver intégralement les données de ses clients (tables `leads`, `users`, `appliances_input`) sans aucune suppression.
5. THE Système SHALL ne fournir aucune interface de réactivation pour un vendeur avec le statut `terminated`.

---

### Exigence C5 : Expiration automatique des contrats

**User Story :** En tant qu'administrateur, je veux que les contrats vendeurs expirent automatiquement à leur date de fin, afin que les vendeurs inactifs soient retirés de la plateforme sans intervention manuelle.

#### Critères d'Acceptation

1. WHEN la date courante dépasse le `contract_end_date` d'un vendeur avec le statut `active`, THE ContractService SHALL mettre à jour le statut du vendeur à `expired` et désactiver tous ses produits (`is_active = false`).
2. WHEN un vendeur a le statut `expired`, THE Système SHALL empêcher ce vendeur de se connecter et afficher le message : "Votre contrat a expiré. Contactez l'administration pour le renouveler."
3. WHEN un vendeur a le statut `expired`, THE RecommendationEngine SHALL exclure ses produits des recommandations et THE Système SHALL masquer ses produits de l'annuaire public `/vendors`.
4. THE Système SHALL conserver toutes les données du vendeur expiré et de ses clients (leads, produits désactivés, historique de commissions).
5. THE ContractService SHALL vérifier quotidiennement les contrats expirés via un job planifié Supabase.

---

### Exigence C6 : Renouvellement des contrats

**User Story :** En tant que Super Admin ou Admin Principal, je veux renouveler le contrat d'un vendeur expiré depuis l'interface admin, afin de réactiver son accès et ses produits sans créer de nouveau compte.

#### Critères d'Acceptation

1. THE Système SHALL afficher sur la page `/admin/contracts` la liste des vendeurs avec le statut `expired`, avec leur date d'expiration et leur historique de contrat.
2. WHEN un Super Admin ou Admin Principal sélectionne un vendeur expiré et choisit une nouvelle date de fin de contrat, THE ContractService SHALL mettre à jour le statut du vendeur à `active` et le champ `contract_end_date` avec la nouvelle date.
3. WHEN un contrat est renouvelé, THE ContractService SHALL réactiver tous les produits du vendeur (`is_active = true`).
4. IF un Admin Collaborateur tente d'accéder à l'action de renouvellement, THEN THE Système SHALL rejeter l'action et afficher le message : "Vous n'avez pas les droits pour effectuer cette action."
5. THE Système SHALL ne pas créer de nouveau compte vendeur lors du renouvellement — le renouvellement s'effectue sur le compte existant.

---

### Exigence C7 : Génération de rapports de facturation

**User Story :** En tant qu'administrateur, je veux générer un rapport de facturation pour un vendeur sur une période donnée, afin de lui communiquer les commissions dues.

#### Critères d'Acceptation

1. THE Système SHALL afficher sur la page `/admin/billing` un formulaire permettant de sélectionner un vendeur et une période (date de début et date de fin).
2. WHEN un administrateur génère un rapport, THE BillingService SHALL récupérer tous les enregistrements `commission_records` avec le statut `confirmed` pour ce vendeur sur la période sélectionnée.
3. THE BillingService SHALL calculer et afficher : la liste détaillée des commissions (date, lead associé, taux appliqué, montant), le total des commissions dues sur la période, et les informations du vendeur (nom, email).
4. THE Système SHALL permettre l'export du rapport en PDF via jsPDF avec un bouton "Exporter en PDF".
5. THE Système SHALL permettre l'envoi du rapport par email au vendeur concerné via un bouton "Envoyer au vendeur".
6. THE Système SHALL permettre aux admins collaborateurs de générer et envoyer des rapports de facturation.

---

### Exigence C8 : Gestion des rôles administrateurs

**User Story :** En tant que Super Admin, je veux gérer les comptes administrateurs avec différents niveaux de droits, afin de déléguer certaines tâches sans compromettre la sécurité de la plateforme.

#### Critères d'Acceptation

1. THE Système SHALL implémenter trois rôles administrateurs : `super_admin` (accès total), `admin_principal` (mêmes droits sauf création de Super Admins), `admin_collaborateur` (gestion vendeurs et rapports, sans renouvellement ni création d'admins).
2. WHEN un Super Admin ou Admin Principal crée un Admin Collaborateur, THE Système SHALL insérer un enregistrement dans la table `admin_users` avec le rôle `admin_collaborateur` et le `created_by` de l'admin créateur.
3. THE Système SHALL afficher sur la page `/admin/users` la liste des admins existants avec leur rôle, leur créateur et leur date de création (accessible uniquement aux Super Admins et Admins Principaux).
4. IF un Admin Collaborateur tente de créer un autre admin ou de renouveler un contrat, THEN THE Système SHALL rejeter l'action côté client (bouton masqué) et côté serveur (vérification RLS/RPC).
5. THE Système SHALL vérifier le rôle de l'administrateur connecté à chaque action sensible via une fonction Supabase RPC, pas uniquement côté client.

---

### Exigence C9 : Intégration avec le cycle de vie vendeur existant

**User Story :** En tant qu'administrateur, je veux que les nouveaux statuts et champs s'intègrent harmonieusement avec le système de gestion des vendeurs existant, afin de maintenir la cohérence de la plateforme.

#### Critères d'Acceptation

1. THE Système SHALL étendre l'enum `vendor_status_enum` existant avec les valeurs `expired` et `terminated` en plus des valeurs existantes (`pending`, `active`, `suspended`).
2. THE Système SHALL ajouter les champs `commission_rate`, `contract_start_date`, `contract_end_date` et `fraud_count` à la table `vendors` existante via une migration SQL.
3. WHEN un vendeur a le statut `expired` ou `terminated`, THE RecommendationEngine existant SHALL l'exclure des recommandations (extension de la Propriété 14 du spec principal).
4. THE Système SHALL afficher le statut `expired` dans la page `/admin/vendors` existante avec une indication visuelle distincte des statuts `pending`, `active` et `suspended`.
5. THE Système SHALL conserver la compatibilité avec toutes les politiques RLS existantes lors de l'ajout des nouvelles tables et champs.
