# Design Document : Gestion des Commissions, Contrats et Facturation Vendeurs

## Vue d’ensemble

Cette fonctionnalité étend la plateforme Krantos avec un système complet de gestion des commissions, des contrats vendeurs et de la facturation. Elle permet à l’équipe administrative de définir des taux de commission par vendeur, de gérer le cycle de vie des contrats (activation, expiration, renouvellement), de détecter les tentatives de fraude, et de générer des rapports de facturation périodiques.

Le système s’appuie sur les tables existantes (`vendors`, `products`, `leads`) et y ajoute de nouvelles entités : `vendor_contracts`, `commissions`, `billing_reports` et `fraud_attempts`. L’accès est contrôlé par deux niveaux de rôles administratifs : Super Administrateur et Administrateur collaborateur.

---

## Architecture Globale

```mermaid
graph TD
    subgraph "Interfaces Admin"
        UI_CONTRACTS["/admin/contracts\nGestion des contrats"]
        UI_COMMISSIONS["/admin/commissions\nTableau de bord commissions"]
        UI_BILLING["/admin/billing\nRapports de facturation"]
        UI_FRAUD["/admin/fraud\nSuivi des fraudes"]
    end
    subgraph "Interface Vendeur (étendue)"
        UI_VENDOR_DASH["/business-dashboard\nTableau de bord vendeur"]
        UI_VENDOR_LEADS["/leads\nGestion des leads"]
    end
    subgraph "Couche Service"
        SVC_CONTRACT[ContractService\nGestion cycle de vie contrat]
        SVC_COMMISSION[CommissionService\nCalcul et suivi commissions]
        SVC_BILLING[BillingService\nGénération rapports PDF]
        SVC_FRAUD[FraudDetectionService\nDétection et sanction fraude]
        SVC_SUPABASE[SupabaseClient\nsrc/lib/supabase.ts]
    end
    subgraph "Backend — Supabase"
        DB_CONTRACTS[(vendor_contracts)]
        DB_COMMISSIONS[(commissions)]
        DB_BILLING[(billing_reports)]
        DB_FRAUD[(fraud_attempts)]
        DB_VENDORS[(vendors)]
        DB_LEADS[(leads)]
        AUTH[Supabase Auth\nRôles admin]
    end
    UI_CONTRACTS --> SVC_CONTRACT
    UI_COMMISSIONS --> SVC_COMMISSION
    UI_BILLING --> SVC_BILLING
    UI_FRAUD --> SVC_FRAUD
    UI_VENDOR_DASH --> SVC_COMMISSION
    UI_VENDOR_LEADS --> SVC_COMMISSION
    SVC_CONTRACT --> SVC_SUPABASE
    SVC_COMMISSION --> SVC_SUPABASE
    SVC_BILLING --> SVC_SUPABASE
    SVC_FRAUD --> SVC_SUPABASE
    SVC_SUPABASE --> DB_CONTRACTS
    SVC_SUPABASE --> DB_COMMISSIONS
    SVC_SUPABASE --> DB_BILLING
    SVC_SUPABASE --> DB_FRAUD
    SVC_SUPABASE --> DB_VENDORS
    SVC_SUPABASE --> DB_LEADS
    SVC_SUPABASE --> AUTH
```

---
