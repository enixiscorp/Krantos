// ============================================================
// Tests unitaires — SupabaseClient
// Requirements: 14.3
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// 1. Vérification que la clé service n'est PAS exposée dans le code source
// ---------------------------------------------------------------------------
describe('Sécurité — clé service non exposée côté client', () => {
  it('ne doit pas contenir de référence à SUPABASE_SERVICE_ROLE_KEY dans le code source', () => {
    const sourceCode = readFileSync(resolve(__dirname, 'supabase.ts'), 'utf-8');
    expect(sourceCode).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(sourceCode).not.toContain('service_role');
    expect(sourceCode).not.toContain('serviceRoleKey');
  });

  it('ne doit utiliser que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY comme variables d\'environnement', () => {
    const sourceCode = readFileSync(resolve(__dirname, 'supabase.ts'), 'utf-8');
    // Les seules variables d'env référencées doivent être les deux publiques
    const envVarMatches = sourceCode.match(/import\.meta\.env\.\w+/g) ?? [];
    const allowedEnvVars = ['import.meta.env.VITE_SUPABASE_URL', 'import.meta.env.VITE_SUPABASE_ANON_KEY'];
    for (const match of envVarMatches) {
      expect(allowedEnvVars).toContain(match);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Vérification que les variables d'environnement sont utilisées correctement
// ---------------------------------------------------------------------------
describe('Initialisation du client Supabase avec les variables d\'environnement', () => {
  it('doit utiliser VITE_SUPABASE_URL pour initialiser le client', () => {
    const sourceCode = readFileSync(resolve(__dirname, 'supabase.ts'), 'utf-8');
    expect(sourceCode).toContain('import.meta.env.VITE_SUPABASE_URL');
  });

  it('doit utiliser VITE_SUPABASE_ANON_KEY pour initialiser le client', () => {
    const sourceCode = readFileSync(resolve(__dirname, 'supabase.ts'), 'utf-8');
    expect(sourceCode).toContain('import.meta.env.VITE_SUPABASE_ANON_KEY');
  });

  it('doit lever une erreur si VITE_SUPABASE_URL est absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    await expect(import('./supabase?missing-url=' + Date.now())).rejects.toThrow();

    vi.unstubAllEnvs();
  });

  it('doit lever une erreur si VITE_SUPABASE_ANON_KEY est absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(import('./supabase?missing-key=' + Date.now())).rejects.toThrow();

    vi.unstubAllEnvs();
  });

  it('doit passer les deux variables à createClient', () => {
    const sourceCode = readFileSync(resolve(__dirname, 'supabase.ts'), 'utf-8');
    // createClient doit être appelé avec les deux variables
    expect(sourceCode).toMatch(/createClient\s*\(\s*supabaseUrl\s*,\s*supabaseAnonKey\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// 3. Vérification des exports de types requis
// ---------------------------------------------------------------------------
describe('Exports de types requis (Exigence 14.3)', () => {
  it('doit exporter le client supabase typé', async () => {
    // On importe le module avec des variables d'env valides
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    const mod = await import('./supabase');
    expect(mod.supabase).toBeDefined();
    expect(typeof mod.supabase).toBe('object');

    vi.unstubAllEnvs();
  });

  it('doit exporter les types TypeScript requis (vérification statique via le code source)', () => {
    const sourceCode = readFileSync(resolve(__dirname, 'supabase.ts'), 'utf-8');

    const requiredExports = [
      'ApplianceInput',
      'ApplianceBreakdown',
      'Product',
      'Vendor',
      'Lead',
      'AppliancesInputRecord',
    ];

    for (const typeName of requiredExports) {
      expect(sourceCode, `Le type "${typeName}" doit être exporté`).toContain(`export interface ${typeName}`);
    }
  });

  it('doit exporter les types enum requis', () => {
    const sourceCode = readFileSync(resolve(__dirname, 'supabase.ts'), 'utf-8');
    expect(sourceCode).toContain('export type SubscriptionType');
    expect(sourceCode).toContain('export type VendorStatus');
    expect(sourceCode).toContain('export type LeadStatus');
    expect(sourceCode).toContain('export type PowerUnit');
  });
});
