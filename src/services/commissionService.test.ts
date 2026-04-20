// ============================================================
// Krantos Platform — CommissionService Property-Based Tests
// **Validates: Requirements C1.1, C1.2**
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Supabase before importing the service
// ---------------------------------------------------------------------------

// We mock the supabase module so that setCommissionRate's DB calls succeed
// without a real database. This lets us test the validation logic in isolation.
vi.mock('../lib/supabase', () => {
  const mockFrom = vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    // Resolve with no error for update/insert chains
    then: undefined,
  }));

  // Build a chainable mock that resolves to { error: null } at the end
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const resolve = { data: null, error: null };
    chain.update = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve(resolve));
    // Make the chain itself thenable so `await supabase.from(...).update(...).eq(...)` works
    chain.then = (onFulfilled: (v: typeof resolve) => unknown) => Promise.resolve(resolve).then(onFulfilled);
    chain.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve(resolve).catch(onRejected);
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => makeChain()),
    },
  };
});

import { setCommissionRate, recordConversion } from './commissionService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true iff `r` is a valid commission rate: integer multiple of 5 in [5, 100]. */
function isValidRate(r: number): boolean {
  return Number.isInteger(r) && r >= 5 && r <= 100 && r % 5 === 0;
}

// ---------------------------------------------------------------------------
// Propriété C1 — Validité du taux de commission
// **Validates: Requirements C1.1, C1.2**
// ---------------------------------------------------------------------------

describe('CommissionService — Propriété C1 : Validité du taux de commission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété C1a : Pour tout entier valide (multiple de 5, entre 5 et 100 inclus),
   * setCommissionRate doit accepter le taux sans lever d'erreur.
   *
   * **Validates: Requirements C1.1, C1.2**
   */
  it('C1a — Tout taux valide (multiple de 5, entre 5 et 100) est accepté', async () => {
    // Generate valid rates: multiples of 5 from 5 to 100 (i.e. 5, 10, 15, ..., 100)
    const validRateArbitrary = fc.integer({ min: 1, max: 20 }).map((n) => n * 5);

    await fc.assert(
      fc.asyncProperty(validRateArbitrary, async (rate) => {
        // A valid rate must not throw
        await expect(
          setCommissionRate('vendor-test-id', rate)
        ).resolves.not.toThrow();
      }),
      { numRuns: 20 } // 20 values covers all 20 valid rates (5, 10, ..., 100)
    );
  });

  /**
   * Propriété C1b : Pour tout entier invalide (non multiple de 5, ou hors de [5, 100]),
   * setCommissionRate doit rejeter le taux en levant une erreur.
   *
   * **Validates: Requirements C1.1, C1.2**
   */
  it('C1b — Tout taux invalide est rejeté avec une erreur', async () => {
    // Generate arbitrary integers and filter to keep only invalid ones
    const invalidRateArbitrary = fc
      .integer({ min: -1000, max: 1000 })
      .filter((r) => !isValidRate(r));

    await fc.assert(
      fc.asyncProperty(invalidRateArbitrary, async (rate) => {
        // An invalid rate must throw
        await expect(
          setCommissionRate('vendor-test-id', rate)
        ).rejects.toThrow();
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Propriété C1c : La frontière exacte — seuls les multiples de 5 dans [5, 100] sont acceptés.
   * Pour tout entier `r`, setCommissionRate accepte r si et seulement si isValidRate(r) est vrai.
   *
   * **Validates: Requirements C1.1, C1.2**
   */
  it('C1c — setCommissionRate accepte r ⟺ r est un multiple de 5 dans [5, 100]', async () => {
    // Generate a wide range of integers including boundary values
    const anyIntegerArbitrary = fc.integer({ min: -200, max: 200 });

    await fc.assert(
      fc.asyncProperty(anyIntegerArbitrary, async (rate) => {
        const valid = isValidRate(rate);

        if (valid) {
          await expect(
            setCommissionRate('vendor-test-id', rate)
          ).resolves.not.toThrow();
        } else {
          await expect(
            setCommissionRate('vendor-test-id', rate)
          ).rejects.toThrow();
        }
      }),
      { numRuns: 400 }
    );
  });
});

// ---------------------------------------------------------------------------
// Propriété C2 — Calcul du montant de commission
// **Validates: Requirements C2.1, C2.2**
// ---------------------------------------------------------------------------

describe('CommissionService — Propriété C2 : Calcul du montant de commission', () => {
  /**
   * Propriété C2 : Pour tout montant de vente v >= 0 et tout taux valide r,
   * le montant calculé vérifie :
   *   - amount = v × r / 100  (formule correcte)
   *   - amount >= 0            (borne inférieure)
   *   - amount <= v            (borne supérieure, car r <= 100)
   *
   * On teste la logique de calcul directement en configurant le mock Supabase
   * pour retourner un taux donné et capturer le montant inséré.
   *
   * **Validates: Requirements C2.1, C2.2**
   */
  it('C2 — amount = saleAmount × rate / 100, avec 0 <= amount <= saleAmount', async () => {
    const { supabase } = await import('../lib/supabase');

    const saleAmountArb = fc.integer({ min: 0, max: 1_000_000 });
    const rateArb = fc.integer({ min: 1, max: 20 }).map((n) => n * 5);

    await fc.assert(
      fc.asyncProperty(saleAmountArb, rateArb, async (saleAmount, rate) => {
        // Configure the Supabase mock:
        // - First call (vendor lookup): returns { commission_rate: rate }
        // - Second call (insert commission_record): returns the inserted record
        const expectedAmount = (saleAmount * rate) / 100;

        let capturedAmount: number | undefined;

        const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
        mockFrom.mockImplementation((table: string) => {
          if (table === 'vendors') {
            // Vendor lookup chain: .select().eq().single()
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { commission_rate: rate },
                error: null,
              }),
            };
          }
          if (table === 'commission_records') {
            // Insert chain: .insert().select().single()
            return {
              insert: vi.fn().mockImplementation((record: { amount: number }) => {
                capturedAmount = record.amount;
                return {
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'test-id',
                      vendor_id: 'vendor-id',
                      lead_id: 'lead-id',
                      commission_rate_applied: rate,
                      amount: record.amount,
                      status: 'pending_verification',
                      type: 'conversion',
                      notes: null,
                      created_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                };
              }),
            };
          }
          // Fallback
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        });

        const result = await recordConversion('lead-id', 'vendor-id', saleAmount);

        // Verify formula correctness
        expect(result.amount).toBe(expectedAmount);

        // Verify lower bound: amount >= 0
        expect(result.amount).toBeGreaterThanOrEqual(0);

        // Verify upper bound: amount <= saleAmount (since rate <= 100)
        expect(result.amount).toBeLessThanOrEqual(saleAmount);

        // Also verify the captured amount matches
        expect(capturedAmount).toBe(expectedAmount);
      }),
      { numRuns: 100 }
    );
  });
});


// ============================================================
// CommissionService — Tests Unitaires
// **Validates: Requirements C1.1, C1.2, C2.1, C2.2, C2.3**
// ============================================================

import {
  getCommissionSummary,
  getCommissionHistory,
  confirmCommission,
  rejectCommission,
  getDateRangeForPeriod,
} from './commissionService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal CommissionRecord-like object for mock responses. */
function makeRecord(overrides: Partial<{
  id: string;
  vendor_id: string;
  lead_id: string | null;
  commission_rate_applied: number;
  amount: number | null;
  status: 'pending_verification' | 'confirmed' | 'rejected' | 'rate_change';
  type: 'conversion' | 'rate_change';
  notes: string | null;
  created_at: string;
}> = {}) {
  return {
    id: 'record-1',
    vendor_id: 'vendor-1',
    lead_id: 'lead-1',
    commission_rate_applied: 15,
    amount: 150,
    status: 'pending_verification' as const,
    type: 'conversion' as const,
    notes: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// setCommissionRate — Tests unitaires
// **Validates: Requirements C1.1, C1.2**
// ---------------------------------------------------------------------------

describe('CommissionService — setCommissionRate (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepte un taux valide de 15% et met à jour la base de données', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (onFulfilled: (v: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }));

    await expect(setCommissionRate('vendor-1', 15)).resolves.toBeUndefined();
  });

  it('accepte les valeurs limites valides : 5 et 100', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (onFulfilled: (v: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }));

    await expect(setCommissionRate('vendor-1', 5)).resolves.toBeUndefined();
    await expect(setCommissionRate('vendor-1', 100)).resolves.toBeUndefined();
  });

  it('rejette un taux non multiple de 5 (ex: 7%)', async () => {
    await expect(setCommissionRate('vendor-1', 7)).rejects.toThrow(
      'Le taux de commission doit être un multiple de 5 compris entre 5 et 100.'
    );
  });

  it('rejette un taux de 0%', async () => {
    await expect(setCommissionRate('vendor-1', 0)).rejects.toThrow(
      'Le taux de commission doit être un multiple de 5 compris entre 5 et 100.'
    );
  });

  it('rejette un taux supérieur à 100 (ex: 105%)', async () => {
    await expect(setCommissionRate('vendor-1', 105)).rejects.toThrow(
      'Le taux de commission doit être un multiple de 5 compris entre 5 et 100.'
    );
  });

  it('rejette un taux négatif', async () => {
    await expect(setCommissionRate('vendor-1', -5)).rejects.toThrow(
      'Le taux de commission doit être un multiple de 5 compris entre 5 et 100.'
    );
  });
});

// ---------------------------------------------------------------------------
// recordConversion — Tests unitaires
// **Validates: Requirements C2.1, C2.2**
// ---------------------------------------------------------------------------

describe('CommissionService — recordConversion (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcule correctement le montant : saleAmount × rate / 100', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const saleAmount = 1000;
    const rate = 15;
    const expectedAmount = (saleAmount * rate) / 100; // 150

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { commission_rate: rate }, error: null }),
        };
      }
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: makeRecord({ amount: expectedAmount, commission_rate_applied: rate }),
          error: null,
        }),
      };
    });

    const result = await recordConversion('lead-1', 'vendor-1', saleAmount);

    expect(result.amount).toBe(expectedAmount);
  });

  it('enregistre le statut initial à pending_verification', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { commission_rate: 20 }, error: null }),
        };
      }
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: makeRecord({ status: 'pending_verification', commission_rate_applied: 20, amount: 200 }),
          error: null,
        }),
      };
    });

    const result = await recordConversion('lead-1', 'vendor-1', 1000);

    expect(result.status).toBe('pending_verification');
  });

  it('enregistre le taux appliqué au moment de la conversion', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const rate = 30;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { commission_rate: rate }, error: null }),
        };
      }
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: makeRecord({ commission_rate_applied: rate, amount: 300 }),
          error: null,
        }),
      };
    });

    const result = await recordConversion('lead-1', 'vendor-1', 1000);

    expect(result.commission_rate_applied).toBe(rate);
  });

  it('lève une erreur si le vendeur est introuvable', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        };
      }
      return {};
    });

    await expect(recordConversion('lead-1', 'unknown-vendor', 1000)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getCommissionSummary — Tests unitaires
// **Validates: Requirements C3.3**
// ---------------------------------------------------------------------------

describe('CommissionService — getCommissionSummary (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('agrège correctement les totaux par statut (confirmed et pending)', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const records = [
      { status: 'confirmed', amount: 100 },
      { status: 'confirmed', amount: 200 },
      { status: 'pending_verification', amount: 50 },
      { status: 'rejected', amount: 75 }, // should not be counted
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: records, error: null }),
    }));

    const summary = await getCommissionSummary('vendor-1', 'monthly');

    expect(summary.totalConversions).toBe(4); // all records count as conversions
    expect(summary.totalConfirmed).toBe(300);  // 100 + 200
    expect(summary.totalPending).toBe(50);     // 50 only
  });

  it('retourne des totaux à zéro quand il n\'y a aucun enregistrement', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    const summary = await getCommissionSummary('vendor-1', 'daily');

    expect(summary.totalConversions).toBe(0);
    expect(summary.totalConfirmed).toBe(0);
    expect(summary.totalPending).toBe(0);
  });

  it('retourne la plage de dates correcte pour la période demandée', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    const summary = await getCommissionSummary('vendor-1', 'annual');
    const expectedRange = getDateRangeForPeriod('annual');

    // Start date should be January 1st of the current year
    expect(summary.startDate.getFullYear()).toBe(expectedRange.startDate.getFullYear());
    expect(summary.startDate.getMonth()).toBe(0); // January
    expect(summary.startDate.getDate()).toBe(1);

    // End date should be today at end of day
    expect(summary.endDate.getHours()).toBe(23);
    expect(summary.endDate.getMinutes()).toBe(59);
  });

  it('inclut le vendorId et la période dans le résumé retourné', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    const summary = await getCommissionSummary('vendor-42', 'weekly');

    expect(summary.vendorId).toBe('vendor-42');
    expect(summary.period).toBe('weekly');
  });
});

// ---------------------------------------------------------------------------
// confirmCommission — Tests unitaires
// **Validates: Requirements C2.3**
// ---------------------------------------------------------------------------

describe('CommissionService — confirmCommission (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('met à jour le statut à confirmed sans erreur', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation(() => ({
      update: updateMock,
      eq: eqMock,
    }));

    await expect(confirmCommission('record-1')).resolves.toBeUndefined();

    expect(updateMock).toHaveBeenCalledWith({ status: 'confirmed' });
    expect(eqMock).toHaveBeenCalledWith('id', 'record-1');
  });

  it('lève une erreur si la mise à jour échoue', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }));

    await expect(confirmCommission('record-1')).rejects.toThrow(
      'Erreur lors de la confirmation de la commission'
    );
  });
});

// ---------------------------------------------------------------------------
// rejectCommission — Tests unitaires
// **Validates: Requirements C2.3**
// ---------------------------------------------------------------------------

describe('CommissionService — rejectCommission (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('met à jour le statut à rejected avec les notes fournies', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation(() => ({
      update: updateMock,
      eq: eqMock,
    }));

    const notes = 'Paiement non reçu — fraude suspectée';
    await expect(rejectCommission('record-1', notes)).resolves.toBeUndefined();

    expect(updateMock).toHaveBeenCalledWith({ status: 'rejected', notes });
    expect(eqMock).toHaveBeenCalledWith('id', 'record-1');
  });

  it('lève une erreur si la mise à jour échoue', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }));

    await expect(rejectCommission('record-1', 'fraude')).rejects.toThrow(
      'Erreur lors du rejet de la commission'
    );
  });
});

// ---------------------------------------------------------------------------
// getDateRangeForPeriod — Tests unitaires (helper)
// ---------------------------------------------------------------------------

describe('CommissionService — getDateRangeForPeriod (tests unitaires)', () => {
  it('daily : startDate est aujourd\'hui à 00:00:00', () => {
    const { startDate, endDate } = getDateRangeForPeriod('daily');
    const now = new Date();

    expect(startDate.getFullYear()).toBe(now.getFullYear());
    expect(startDate.getMonth()).toBe(now.getMonth());
    expect(startDate.getDate()).toBe(now.getDate());
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getMinutes()).toBe(0);

    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);
  });

  it('monthly : startDate est le 1er du mois courant', () => {
    const { startDate } = getDateRangeForPeriod('monthly');
    const now = new Date();

    expect(startDate.getFullYear()).toBe(now.getFullYear());
    expect(startDate.getMonth()).toBe(now.getMonth());
    expect(startDate.getDate()).toBe(1);
  });

  it('annual : startDate est le 1er janvier de l\'année courante', () => {
    const { startDate } = getDateRangeForPeriod('annual');
    const now = new Date();

    expect(startDate.getFullYear()).toBe(now.getFullYear());
    expect(startDate.getMonth()).toBe(0);
    expect(startDate.getDate()).toBe(1);
  });

  it('quarterly : startDate est le 1er du trimestre courant', () => {
    const { startDate } = getDateRangeForPeriod('quarterly');
    const now = new Date();
    const expectedQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;

    expect(startDate.getMonth()).toBe(expectedQuarterStartMonth);
    expect(startDate.getDate()).toBe(1);
  });

  it('biannual : startDate est le 1er janvier ou le 1er juillet', () => {
    const { startDate } = getDateRangeForPeriod('biannual');
    const now = new Date();
    const expectedMonth = now.getMonth() < 6 ? 0 : 6;

    expect(startDate.getMonth()).toBe(expectedMonth);
    expect(startDate.getDate()).toBe(1);
  });
});
