import { writeFileSync } from 'fs';
const p = '.kiro/specs/vendor-commission-contracts/design.md';
const bt = String.fromCharCode(96);
function bts(s) { return bt+s+bt; }
function bt3() { return bt+bt+bt; }
const arr = '\u2192';
const x = '\u00d7';
const chk = '\u2705';
const crs = '\u274c';
const sig = '\u03a3';

const sections = [];

// Title & Overview
sections.push('# Design Document : Gestion des Commissions, Contrats et Facturation Vendeurs');
sections.push('');
sections.push("## Vue d\u2019ensemble");
sections.push('');
sections.push("Cette fonctionnalit\u00e9 \u00e9tend la plateforme Krantos avec un syst\u00e8me complet de gestion des commissions, des contrats vendeurs et de la facturation. Elle permet \u00e0 l\u2019\u00e9quipe administrative de d\u00e9finir des taux de commission par vendeur, de g\u00e9rer le cycle de vie des contrats (activation, expiration, renouvellement), de d\u00e9tecter les tentatives de fraude, et de g\u00e9n\u00e9rer des rapports de facturation p\u00e9riodiques.");
sections.push('');
sections.push("Le syst\u00e8me s\u2019appuie sur les tables existantes (" + bts('vendors') + ", " + bts('products') + ", " + bts('leads') + ") et y ajoute de nouvelles entit\u00e9s : " + bts('vendor_contracts') + ", " + bts('commissions') + ", " + bts('billing_reports') + " et " + bts('fraud_attempts') + ". L\u2019acc\u00e8s est contr\u00f4l\u00e9 par deux niveaux de r\u00f4les administratifs : Super Administrateur et Administrateur collaborateur.");
sections.push('');
sections.push('---');
sections.push('');

// Architecture
sections.push('## Architecture Globale');
sections.push('');
sections.push(bt3() + 'mermaid');
sections.push('graph TD');
sections.push('    subgraph "Interfaces Admin"');
sections.push('        UI_CONTRACTS["/admin/contracts\\nGestion des contrats"]');
sections.push('        UI_COMMISSIONS["/admin/commissions\\nTableau de bord commissions"]');
sections.push('        UI_BILLING["/admin/billing\\nRapports de facturation"]');
sections.push('        UI_FRAUD["/admin/fraud\\nSuivi des fraudes"]');
sections.push('    end');
sections.push('    subgraph "Interface Vendeur (\u00e9tendue)"');
sections.push('        UI_VENDOR_DASH["/business-dashboard\\nTableau de bord vendeur"]');
sections.push('        UI_VENDOR_LEADS["/leads\\nGestion des leads"]');
sections.push('    end');
sections.push('    subgraph "Couche Service"');
sections.push('        SVC_CONTRACT[ContractService\\nGestion cycle de vie contrat]');
sections.push('        SVC_COMMISSION[CommissionService\\nCalcul et suivi commissions]');
sections.push('        SVC_BILLING[BillingService\\nG\u00e9n\u00e9ration rapports PDF]');
sections.push('        SVC_FRAUD[FraudDetectionService\\nD\u00e9tection et sanction fraude]');
sections.push('        SVC_SUPABASE[SupabaseClient\\nsrc/lib/supabase.ts]');
sections.push('    end');
sections.push('    subgraph "Backend \u2014 Supabase"');
sections.push('        DB_CONTRACTS[(vendor_contracts)]');
sections.push('        DB_COMMISSIONS[(commissions)]');
sections.push('        DB_BILLING[(billing_reports)]');
sections.push('        DB_FRAUD[(fraud_attempts)]');
sections.push('        DB_VENDORS[(vendors)]');
sections.push('        DB_LEADS[(leads)]');
sections.push('        AUTH[Supabase Auth\\nR\u00f4les admin]');
sections.push('    end');
sections.push('    UI_CONTRACTS --> SVC_CONTRACT');
sections.push('    UI_COMMISSIONS --> SVC_COMMISSION');
sections.push('    UI_BILLING --> SVC_BILLING');
sections.push('    UI_FRAUD --> SVC_FRAUD');
sections.push('    UI_VENDOR_DASH --> SVC_COMMISSION');
sections.push('    UI_VENDOR_LEADS --> SVC_COMMISSION');
sections.push('    SVC_CONTRACT --> SVC_SUPABASE');
sections.push('    SVC_COMMISSION --> SVC_SUPABASE');
sections.push('    SVC_BILLING --> SVC_SUPABASE');
sections.push('    SVC_FRAUD --> SVC_SUPABASE');
sections.push('    SVC_SUPABASE --> DB_CONTRACTS');
sections.push('    SVC_SUPABASE --> DB_COMMISSIONS');
sections.push('    SVC_SUPABASE --> DB_BILLING');
sections.push('    SVC_SUPABASE --> DB_FRAUD');
sections.push('    SVC_SUPABASE --> DB_VENDORS');
sections.push('    SVC_SUPABASE --> DB_LEADS');
sections.push('    SVC_SUPABASE --> AUTH');
sections.push(bt3());
sections.push('');
sections.push('---');
sections.push('');

writeFileSync(p, sections.join('\n'), 'utf8');
console.log('done arch');