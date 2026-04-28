# Plan d'Implémentation : Gestion des Commissions, Contrats et Facturation

## Vue d'ensemble

Ce plan décompose le module de gestion des commissions, contrats et facturation en tâches de développement incrémentales. Chaque tâche s'appuie sur les précédentes et aboutit à un système entièrement câblé. Le module s'intègre dans la stack existante React 18 / TypeScript / Supabase / Tailwind CSS de Krantos.

## Tâches

- [x] 1. Migration de base de données — Extensions du schéma
  - [x] 1.1 Étendre l'enum `vendor_status_enum` et la table `vendors`
    - Créer la migration SQL `supabase/migrations/20240004_vendor_contracts_commissions.sql`
    - Ajouter les valeurs `expired` et `terminated` à l'enum `vendor_status_enum`
    - Ajouter les colonnes à la table `vendors` : `commission_rate float DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100)`, `contract_start_date date`, `contract_end_date date`, `fraud_count integer DEFAULT 0 CHECK (fraud_count >= 0)`
    - Créer l'index `idx_vendors_contract_end_date` sur `vendors(contract_end_date)`
    - Créer l'index `idx_vendors_status` sur `vendors(status)`
    - _Exigences : C9.1, C9.2_

  - [x] 1.2 Créer la table `commission_records`
    - Créer les enums SQL : `commission_status_enum` (`pending_verification`, `confirmed`, `rejected`, `rate_change`) et `commission_type_enum` (`conversion`, `rate_change`)
    - Créer la table `commission_records` avec tous les champs définis dans le design : `id`, `vendor_id` (FK → vendors), `lead_id` (FK → leads, NULLABLE), `commission_rate_applied`, `amount`, `status`, `type`, `notes`, `created_at`
    - Créer l'index composite `idx_commission_records_vendor_date` sur `commission_records(vendor_id, created_at)`
    - _Exigences : C2.1, C2.2_

  - [x] 1.3 Créer la table `admin_users`
    - Créer l'enum SQL `admin_role_enum` (`super_admin`, `admin_principal`, `admin_collaborateur`)
    - Créer la table `admin_users` avec tous les champs définis dans le design : `id`, `auth_user_id` (FK → auth.users, UNIQUE), `role`, `name`, `email`, `created_by` (FK → admin_users, NULLABLE), `created_at`
    - _Exigences : C8.1, C8.2_

- [x] 2. Politiques RLS — Nouvelles tables et extensions
  - [x] 2.1 Configurer RLS sur `commission_records`
    - Activer RLS sur `commission_records`
    - Politique lecture vendeur : un vendeur authentifié ne peut lire que ses propres enregistrements (`vendor_id = auth.uid()`)
    - Politique lecture admin : le rôle service a accès complet
    - Politique insertion publique : le système peut insérer lors d'une conversion (via service role)
    - _Exigences : C3.5, C9.5_

  - [x] 2.2 Configurer RLS sur `admin_users`
    - Activer RLS sur `admin_users`
    - Politique lecture : seuls les admins authentifiés peuvent lire les enregistrements
    - Politique insertion : seul le rôle service peut insérer (création via RPC sécurisée)
    - _Exigences : C8.4, C8.5_

  - [x] 2.3 Étendre les politiques RLS sur `vendors` et `products`
    - Mettre à jour la politique `vendors_public_read_active` pour exclure les statuts `expired` et `terminated`
    - Mettre à jour la politique `products_public_read_active` pour exclure les produits des vendeurs `expired` et `terminated`
    - _Exigences : C5.3, C6.3, C9.3_

- [x] 3. CommissionService (`src/services/commissionService.ts`)
  - [x] 3.1 Implémenter CommissionService
    - Définir les types TypeScript : `CommissionRecord`, `CommissionSummary`, `CommissionFilters`, `TimePeriod` (`'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'annual'`)
    - Implémenter `setCommissionRate(vendorId: string, rate: number): Promise<void>` : valider que `rate` est un multiple de 5 entre 5 et 100, mettre à jour `vendors.commission_rate`, insérer dans `commission_records` avec `type: 'rate_change'`
    - Implémenter `recordConversion(leadId: string, vendorId: string, saleAmount: number): Promise<CommissionRecord>` : récupérer le taux actuel du vendeur, calculer `amount = saleAmount × rate / 100`, insérer dans `commission_records` avec `status: 'pending_verification'`
    - Implémenter `getCommissionSummary(vendorId: string, period: TimePeriod): Promise<CommissionSummary>` : calculer la plage de dates selon la période, requêter `commission_records` avec filtre `created_at`, agréger les totaux par statut
    - Implémenter `getCommissionHistory(vendorId: string, filters: CommissionFilters): Promise<CommissionRecord[]>` : requête paginée (20 par page) avec filtres optionnels sur statut et période
    - Implémenter `confirmCommission(recordId: string): Promise<void>` : mettre à jour `status = 'confirmed'`
    - Implémenter `rejectCommission(recordId: string, notes: string): Promise<void>` : mettre à jour `status = 'rejected'` avec notes
    - _Exigences : C1.2, C2.1, C2.2, C2.3, C3.3_

  - [x] 3.2 Écrire le test de propriété — Validité du taux de commission (Propriété C1)
    - **Propriété C1 : Validité du taux de commission**
    - Pour tout taux `r` accepté par `setCommissionRate`, `r` est un entier multiple de 5 compris entre 5 et 100 inclus
    - Utiliser fast-check : générer des entiers arbitraires et vérifier que seuls les multiples de 5 dans [5, 100] sont acceptés
    - **Valide : Exigences C1.1, C1.2**

  - [x] 3.3 Écrire le test de propriété — Calcul du montant de commission (Propriété C2)
    - **Propriété C2 : Calcul du montant de commission**
    - Pour tout montant de vente `v >= 0` et tout taux valide `r`, `amount = v × r / 100` et `0 <= amount <= v`
    - Utiliser fast-check : générer des paires (montant, taux) et vérifier la formule et les bornes
    - **Valide : Exigences C2.1, C2.2**

  - [x] 3.4 Écrire les tests unitaires pour CommissionService
    - Tester `setCommissionRate` avec un taux valide (ex: 15%)
    - Tester `setCommissionRate` avec un taux invalide (ex: 7%, 0%, 105%) — doit rejeter
    - Tester `recordConversion` : vérifier le calcul du montant et le statut initial
    - Tester `getCommissionSummary` : vérifier l'agrégation par statut et la plage de dates
    - Tester `confirmCommission` et `rejectCommission` : vérifier les transitions de statut
    - _Exigences : C1.1, C1.2, C2.1, C2.2, C2.3_

- [x] 4. FraudDetectionService (`src/services/fraudDetectionService.ts`)
  - [x] 4.1 Implémenter FraudDetectionService
    - Définir les types TypeScript : `FraudResult` (`{ newFraudCount: number; terminated: boolean }`)
    - Implémenter `reportFraud(vendorId: string, leadId: string): Promise<FraudResult>` : incrémenter `vendors.fraud_count` de manière atomique (transaction Supabase RPC), vérifier si `fraud_count >= 3`, si oui appeler `terminateVendor`
    - Implémenter `terminateVendor(vendorId: string): Promise<void>` : dans une transaction atomique — mettre à jour `vendors.status = 'terminated'`, mettre à jour `products.is_active = false WHERE vendor_id = vendorId`, invalider la session active du vendeur
    - Implémenter `getFraudCount(vendorId: string): Promise<number>` : lire `vendors.fraud_count`
    - Implémenter `isTerminated(vendorId: string): Promise<boolean>` : vérifier `vendors.status = 'terminated'`
    - Garantir que les données clients (`leads`, `users`, `appliances_input`) ne sont jamais supprimées
    - _Exigences : C4.1, C4.2, C4.3, C4.4, C4.5_

  - [ ]* 4.2 Écrire le test de propriété — Règle de résiliation pour fraude (Propriété C4)
    - **Propriété C4 : Règle de résiliation pour fraude**
    - Pour tout vendeur dont `fraud_count >= 3`, son statut est `terminated` et tous ses produits ont `is_active = false`
    - Utiliser fast-check : générer des séquences de signalements de fraude et vérifier l'invariant
    - **Valide : Exigences C4.1, C4.2**

  - [ ]* 4.3 Écrire le test de propriété — Monotonie du compteur de fraude (Propriété C8)
    - **Propriété C8 : Monotonie du compteur de fraude**
    - Pour toute séquence d'appels à `reportFraud`, le `fraud_count` est strictement croissant et ne peut jamais diminuer
    - **Valide : Exigences C4.1**

  - [ ]* 4.4 Écrire les tests unitaires pour FraudDetectionService
    - Tester `reportFraud` : vérifier l'incrémentation du compteur
    - Tester le déclenchement de la résiliation au 3ème signalement
    - Tester que les données clients sont conservées après résiliation
    - Tester `isTerminated` : vérifier la détection du statut
    - _Exigences : C4.1, C4.2, C4.3, C4.4_

- [x] 5. Checkpoint — Vérifier que tous les tests passent
  - S'assurer que tous les tests unitaires et de propriété des modules CommissionService et FraudDetectionService passent.

- [x] 6. ContractService (`src/services/contractService.ts`)
  - [x] 6.1 Implémenter ContractService
    - Définir les types TypeScript : `VendorContract` (`{ vendorId: string; name: string; contractEndDate: Date; status: string }`)
    - Implémenter `checkExpiredContracts(): Promise<string[]>` : requêter `vendors WHERE contract_end_date <= now() AND status = 'active'`, pour chaque vendeur expiré mettre à jour `status = 'expired'` et `products.is_active = false`
    - Implémenter `renewContract(vendorId: string, newEndDate: Date, adminId: string): Promise<void>` : vérifier que l'admin a le rôle `super_admin` ou `admin_principal` via RPC Supabase, mettre à jour `vendors.status = 'active'` et `contract_end_date = newEndDate`, réactiver les produits (`is_active = true`)
    - Implémenter `getExpiringContracts(daysAhead: number): Promise<VendorContract[]>` : vendeurs dont `contract_end_date` est dans les `daysAhead` prochains jours
    - Implémenter `terminateContract(vendorId: string, reason: string): Promise<void>` : déléguer à `FraudDetectionService.terminateVendor` avec journalisation de la raison
    - _Exigences : C5.1, C5.2, C5.4, C5.5, C6.2, C6.3_

  - [ ]* 6.2 Écrire le test de propriété — Exclusion des vendeurs expirés (Propriété C6)
    - **Propriété C6 : Exclusion des vendeurs expirés de l'annuaire public**
    - Pour tout vendeur avec le statut `expired` ou `terminated`, aucun de ses produits n'est `is_active = true`
    - Utiliser fast-check : générer des états vendeurs et vérifier la cohérence statut/produits
    - **Valide : Exigences C5.1, C5.3**

  - [ ]* 6.3 Écrire le test de propriété — Cohérence statut vendeur et visibilité produits (Propriété C9)
    - **Propriété C9 : Cohérence du statut vendeur et de la visibilité des produits**
    - Il n'existe aucun état où un produit est `is_active = true` pour un vendeur non `active`
    - **Valide : Exigences C5.1, C5.3, C4.2**

  - [ ]* 6.4 Écrire les tests unitaires pour ContractService
    - Tester `checkExpiredContracts` : vérifier la détection et la mise à jour du statut
    - Tester `renewContract` : vérifier la réactivation du vendeur et de ses produits
    - Tester `renewContract` avec un Admin Collaborateur : doit rejeter
    - Tester `getExpiringContracts` : vérifier le filtre par nombre de jours
    - _Exigences : C5.1, C5.5, C6.2, C6.4_

- [ ] 7. BillingService (`src/services/billingService.ts`)
  - [ ] 7.1 Implémenter BillingService
    - Définir les types TypeScript : `BillingReport` (`{ vendor: VendorInfo; period: { start: Date; end: Date }; lines: BillingLine[]; total: number }`), `BillingLine` (`{ date: Date; leadId: string; rateApplied: number; amount: number }`)
    - Implémenter `generateReport(vendorId: string, startDate: Date, endDate: Date): Promise<BillingReport>` : requêter `commission_records WHERE vendor_id AND created_at BETWEEN dates AND status = 'confirmed' AND type = 'conversion'`, récupérer les informations du vendeur, calculer le total
    - Implémenter `exportToPDF(report: BillingReport): void` : utiliser jsPDF pour générer un PDF avec en-tête Krantos, informations vendeur, tableau des commissions, total, déclencher le téléchargement
    - Implémenter `sendInvoice(vendorId: string, report: BillingReport): Promise<void>` : récupérer l'email du vendeur, appeler la fonction Supabase Edge Function ou l'API email pour envoyer le PDF en pièce jointe
    - _Exigences : C7.1, C7.2, C7.3, C7.4, C7.5_

  - [ ]* 7.2 Écrire le test de propriété — Cohérence du total de facturation (Propriété C3)
    - **Propriété C3 : Cohérence du total de facturation**
    - Pour tout rapport généré, le total est exactement la somme des montants des commissions `confirmed` sur la période — aucune commission `pending_verification` ou `rejected` n'est incluse
    - Utiliser fast-check : générer des ensembles de commissions avec statuts mixtes et vérifier le total
    - **Valide : Exigences C7.2, C7.3**

  - [ ]* 7.3 Écrire les tests unitaires pour BillingService
    - Tester `generateReport` : vérifier le filtrage par statut `confirmed` uniquement
    - Tester `generateReport` : vérifier le calcul du total
    - Tester `exportToPDF` : vérifier que le PDF contient les informations requises (nom vendeur, période, lignes, total)
    - _Exigences : C7.2, C7.3, C7.4_

- [ ] 8. Checkpoint — Vérifier que tous les tests passent
  - S'assurer que tous les tests unitaires et de propriété des modules ContractService et BillingService passent.

- [ ] 9. Interface Admin — Gestion des commissions (`src/pages/AdminCommissions.tsx`)
  - [ ] 9.1 Implémenter la page `/admin/commissions`
    - Protéger la route : accessible uniquement aux admins authentifiés (tous rôles)
    - Afficher la liste des vendeurs avec leur taux de commission actuel et la date de dernière modification
    - Implémenter le menu déroulant de sélection du taux (5% à 100% par pas de 5%)
    - Au changement de taux, appeler `CommissionService.setCommissionRate(vendorId, rate)` et afficher une confirmation avec horodatage
    - Afficher le dashboard de commissions avec les filtres temporels (journalier, hebdomadaire, mensuel, trimestriel, semestriel, annuel)
    - Afficher la liste des commissions `pending_verification` avec les boutons "Confirmer" et "Rejeter (fraude)"
    - Au clic "Confirmer" : appeler `CommissionService.confirmCommission(recordId)`
    - Au clic "Rejeter (fraude)" : appeler `CommissionService.rejectCommission(recordId, notes)` puis `FraudDetectionService.reportFraud(vendorId, leadId)`
    - Afficher un message d'alerte si la résiliation automatique est déclenchée (fraud_count = 3)
    - _Exigences : C1.1, C1.2, C1.3, C2.3, C2.4, C3.1, C3.2, C3.4, C4.1, C4.2, C4.3_

- [ ] 10. Interface Admin — Rapports de facturation (`src/pages/AdminBilling.tsx`)
  - [ ] 10.1 Implémenter la page `/admin/billing`
    - Protéger la route : accessible à tous les rôles admin
    - Afficher un formulaire de sélection : vendeur (liste déroulante) + période (date de début, date de fin)
    - Au clic "Générer le rapport", appeler `BillingService.generateReport(vendorId, startDate, endDate)` et afficher l'aperçu
    - Afficher le rapport : informations vendeur, tableau des commissions (date, lead, taux, montant), total
    - Implémenter le bouton "Exporter en PDF" : appeler `BillingService.exportToPDF(report)`
    - Implémenter le bouton "Envoyer au vendeur" : appeler `BillingService.sendInvoice(vendorId, report)` et afficher une confirmation
    - _Exigences : C7.1, C7.2, C7.3, C7.4, C7.5, C7.6_

- [ ] 11. Interface Admin — Gestion des contrats (`src/pages/AdminContracts.tsx`)
  - [ ] 11.1 Implémenter la page `/admin/contracts`
    - Protéger la route : accessible à tous les rôles admin (lecture), renouvellement réservé aux Super Admin et Admin Principal
    - Afficher la liste des vendeurs avec leur statut de contrat, `contract_start_date`, `contract_end_date`
    - Mettre en évidence les vendeurs `expired` avec une indication visuelle distincte (badge rouge)
    - Afficher les vendeurs dont le contrat expire dans les 30 prochains jours (badge orange, via `ContractService.getExpiringContracts(30)`)
    - Implémenter le formulaire de renouvellement : sélection de la nouvelle date de fin, appel à `ContractService.renewContract(vendorId, newEndDate, adminId)`
    - Masquer le bouton de renouvellement pour les Admin Collaborateurs (vérification du rôle côté client)
    - Afficher un message de confirmation après renouvellement avec la nouvelle date de fin
    - _Exigences : C6.1, C6.2, C6.3, C6.4, C6.5, C9.4_

- [ ] 12. Interface Admin — Gestion des admins (`src/pages/AdminUsers.tsx`)
  - [ ] 12.1 Implémenter la page `/admin/users`
    - Protéger la route : accessible uniquement aux Super Admins et Admins Principaux
    - Afficher la liste des admins existants avec leur rôle, leur créateur et leur date de création
    - Implémenter le formulaire de création d'Admin Collaborateur : nom, email, mot de passe temporaire
    - Au clic "Créer", insérer dans `admin_users` via RPC Supabase sécurisée et créer le compte Supabase Auth
    - Masquer l'option de création de Super Admin pour les Admins Principaux
    - _Exigences : C8.1, C8.2, C8.3, C8.4_

- [ ] 13. Extension du tableau de bord vendeur — Onglet Commissions
  - [ ] 13.1 Ajouter l'onglet "Commissions" au `/business-dashboard`
    - Ajouter un onglet "Commissions" dans la navigation du tableau de bord vendeur existant
    - Afficher le taux de commission actuel du vendeur (lecture seule)
    - Afficher le dashboard de commissions avec les filtres temporels (journalier, hebdomadaire, mensuel, trimestriel, semestriel, annuel)
    - Appeler `CommissionService.getCommissionSummary(vendorId, period)` au changement de filtre
    - Afficher : nombre de conversions, total des commissions confirmées, total en attente de vérification
    - Afficher l'historique paginé des enregistrements de commission (via `CommissionService.getCommissionHistory`)
    - _Exigences : C3.1, C3.2, C3.3, C3.4, C3.5_

- [ ] 14. Extension de la gestion des leads vendeur — Marquage de conversion
  - [ ] 14.1 Étendre la page `/leads` pour le déclenchement des commissions
    - Ajouter un champ "Montant de la vente (FCFA)" lors du passage d'un lead au statut `converted`
    - WHEN le vendeur marque un lead comme `converted`, appeler `CommissionService.recordConversion(leadId, vendorId, saleAmount)` après la mise à jour du statut
    - Afficher une confirmation indiquant que la commission a été enregistrée et est en attente de vérification
    - _Exigences : C2.1, C2.2_

- [ ] 15. Mise à jour du routeur et de la navigation admin
  - [ ] 15.1 Ajouter les nouvelles routes admin
    - Ajouter les routes dans `src/App.tsx` : `/admin/commissions`, `/admin/billing`, `/admin/contracts`, `/admin/users`
    - Implémenter la protection des routes par rôle : vérifier le rôle dans `admin_users` avant d'afficher la page
    - Ajouter les liens de navigation dans la page `/admin` existante vers les nouvelles sections
    - Implémenter le code splitting via `React.lazy` et `Suspense` pour les nouvelles pages admin
    - _Exigences : C8.4, C8.5_

- [ ] 16. Checkpoint final — Vérifier que tous les tests passent
  - S'assurer que tous les tests unitaires, de propriété et d'intégration passent.
  - Vérifier les politiques RLS sur les nouvelles tables.
  - Vérifier que les nouveaux statuts `expired` et `terminated` sont correctement exclus des requêtes publiques.
  - Vérifier la compatibilité avec les politiques RLS existantes du spec principal.

## Notes

- Les tâches marquées avec `*` sont optionnelles et peuvent être ignorées pour un MVP plus rapide
- Chaque tâche référence les exigences spécifiques pour la traçabilité
- Les tests de propriété utilisent la bibliothèque `fast-check` (déjà installée dans le projet)
- Les tests unitaires et de propriété sont complémentaires — ne pas substituer l'un à l'autre
- Les checkpoints garantissent une validation incrémentale à chaque étape clé
- La migration SQL (tâche 1) doit être appliquée avant toute implémentation de service
- Les opérations de fraude (tâche 4) utilisent des transactions Supabase RPC pour garantir l'atomicité
- Le job quotidien de vérification des contrats expirés (tâche 6) peut être implémenté via Supabase pg_cron ou une Edge Function déclenchée par un cron externe
