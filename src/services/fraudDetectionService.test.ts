// ============================================================
// Krantos Platform — FraudDetectionService Tests
// Unit tests (4.4) + Property-based tests (4.2, 4.3)
// **Validates: Requirements C4.1, C4.2, C4.3, C4.4**
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Supabase before importing the service
// ---------------------------------------------------------------------------

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import {
  reportFraud,
  terminateVendor,
  getFraudCount,
  isTerminated,
} from './fraudDetectionService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a chainable Supabase mock that resolves to the given value.
 */
function makeChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(resolveValue));
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(onFulfilled);
  chain.catch = (onRejected: (e: unknown) => unknown) =>
    Promise.resolve(resolveValue).catch(onRejected);
  return chain;
}

// ---------------------------------------------------------------------------
// 4.4 — Unit tests: reportFraud
// **Validates: Requirements C4.1, C4.2**
// ---------------------------------------------------------------------------

describe('FraudDetectionService — reportFraud (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('incrémente le fraud_count de 1 et retourne le nouveau compteur', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        callCount++;
        if (callCount === 1) {
          // First call: read current fraud_count
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { fraud_count: 1 }, error: null }),
          };
        }
        // Second call: update fraud_count (two .eq() calls chained)
        const eqChain = {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue(eqChain),
        };
      }
      return makeChain({ data: null, error: null });
    });

    const result = await reportFraud('vendor-1', 'lead-1');

    expect(result.newFraudCount).toBe(2);
    expect(result.terminated).toBe(false);
  });

  it('déclenche la résiliation au 3ème signalement (fraud_count passe à 3)', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    let vendorCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        vendorCallCount++;
        if (vendorCallCount === 1) {
          // Read: current fraud_count = 2
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { fraud_count: 2 }, error: null }),
          };
        }
        if (vendorCallCount === 2) {
          // Update fraud_count (two .eq() calls)
          const eqChain = {
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue(eqChain),
          };
        }
        // terminateVendor: update status
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'products') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    const result = await reportFraud('vendor-1', 'lead-3');

    expect(result.newFraudCount).toBe(3);
    expect(result.terminated).toBe(true);
  });

  it('déclenche la résiliation si fraud_count dépasse déjà 3 (ex: 4)', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    let vendorCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        vendorCallCount++;
        if (vendorCallCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { fraud_count: 3 }, error: null }),
          };
        }
        if (vendorCallCount === 2) {
          // Update fraud_count (two .eq() calls)
          const eqChain = {
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue(eqChain),
          };
        }
        // terminateVendor: update status
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'products') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    const result = await reportFraud('vendor-1', 'lead-4');

    expect(result.newFraudCount).toBe(4);
    expect(result.terminated).toBe(true);
  });

  it('lève une erreur si le vendeur est introuvable', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    }));

    await expect(reportFraud('unknown-vendor', 'lead-1')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4.4 — Unit tests: terminateVendor
// **Validates: Requirements C4.2, C4.4**
// ---------------------------------------------------------------------------

describe('FraudDetectionService — terminateVendor (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('met à jour le statut du vendeur à terminated', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const vendorUpdateMock = vi.fn().mockReturnThis();
    const vendorEqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          update: vendorUpdateMock,
          eq: vendorEqMock,
        };
      }
      // products
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await expect(terminateVendor('vendor-1')).resolves.toBeUndefined();

    expect(vendorUpdateMock).toHaveBeenCalledWith({ status: 'terminated' });
    expect(vendorEqMock).toHaveBeenCalledWith('id', 'vendor-1');
  });

  it('désactive tous les produits du vendeur (is_active = false)', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const productsUpdateMock = vi.fn().mockReturnThis();
    const productsEqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'products') {
        return {
          update: productsUpdateMock,
          eq: productsEqMock,
        };
      }
      return makeChain({ data: null, error: null });
    });

    await terminateVendor('vendor-1');

    expect(productsUpdateMock).toHaveBeenCalledWith({ is_active: false });
    expect(productsEqMock).toHaveBeenCalledWith('vendor_id', 'vendor-1');
  });

  it('ne touche pas aux tables leads, users ou appliances_input', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const calledTables: string[] = [];

    mockFrom.mockImplementation((table: string) => {
      calledTables.push(table);
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await terminateVendor('vendor-1');

    expect(calledTables).not.toContain('leads');
    expect(calledTables).not.toContain('users');
    expect(calledTables).not.toContain('appliances_input');
  });

  it('lève une erreur si la mise à jour du vendeur échoue', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    await expect(terminateVendor('vendor-1')).rejects.toThrow(
      'Erreur lors de la résiliation du vendeur'
    );
  });
});

// ---------------------------------------------------------------------------
// 4.4 — Unit tests: isTerminated
// **Validates: Requirements C4.2, C4.5**
// ---------------------------------------------------------------------------

describe('FraudDetectionService — isTerminated (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne true si le statut du vendeur est terminated', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { status: 'terminated' }, error: null }),
    }));

    const result = await isTerminated('vendor-1');
    expect(result).toBe(true);
  });

  it('retourne false si le statut du vendeur est active', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { status: 'active' }, error: null }),
    }));

    const result = await isTerminated('vendor-1');
    expect(result).toBe(false);
  });

  it('retourne false si le statut est expired (pas terminated)', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { status: 'expired' }, error: null }),
    }));

    const result = await isTerminated('vendor-1');
    expect(result).toBe(false);
  });

  it('lève une erreur si le vendeur est introuvable', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    }));

    await expect(isTerminated('unknown-vendor')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4.4 — Unit tests: getFraudCount
// **Validates: Requirements C4.1**
// ---------------------------------------------------------------------------

describe('FraudDetectionService — getFraudCount (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne le fraud_count actuel du vendeur', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { fraud_count: 2 }, error: null }),
    }));

    const count = await getFraudCount('vendor-1');
    expect(count).toBe(2);
  });

  it('retourne 0 si fraud_count est null (valeur par défaut)', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { fraud_count: null }, error: null }),
    }));

    const count = await getFraudCount('vendor-1');
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4.2 — Property C4: Fraud termination rule
// **Validates: Requirements C4.1, C4.2**
// ---------------------------------------------------------------------------

describe('FraudDetectionService — Propriété C4 : Règle de résiliation pour fraude', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété C4 : Pour tout vendeur dont fraud_count >= 3 après une séquence de
   * reportFraud, son statut est terminated et tous ses produits ont is_active = false.
   *
   * On simule une séquence de n signalements et on vérifie que dès que le compteur
   * atteint 3, terminateVendor est appelé (statut = terminated, produits désactivés).
   *
   * **Validates: Requirements C4.1, C4.2**
   */
  it('C4 — Tout vendeur avec fraud_count >= 3 est terminated avec tous ses produits désactivés', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    // Generate sequences of fraud reports: between 3 and 6 reports
    const numReportsArb = fc.integer({ min: 3, max: 6 });

    await fc.assert(
      fc.asyncProperty(numReportsArb, async (numReports) => {
        vi.clearAllMocks();

        // Track state
        let currentFraudCount = 0;
        let vendorStatus = 'active';
        let productsActive = true;

        mockFrom.mockImplementation((table: string) => {
          if (table === 'vendors') {
            // Return a chain that handles both read (select) and write (update) paths
            const capturedCount = currentFraudCount;
            return {
              // Read path: select().eq().single()
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { fraud_count: capturedCount },
                    error: null,
                  }),
                }),
              }),
              // Write path: update().eq().eq() — fraud_count increment
              // Also handles: update().eq() — status update in terminateVendor
              update: vi.fn().mockImplementation((data: { fraud_count?: number; status?: string }) => {
                if (data.fraud_count !== undefined) {
                  currentFraudCount = data.fraud_count;
                }
                if (data.status) {
                  vendorStatus = data.status;
                }
                const innerEq = {
                  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                  then: (onFulfilled: (v: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: null }).then(onFulfilled),
                  catch: (onRejected: (e: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: null }).catch(onRejected),
                };
                return {
                  eq: vi.fn().mockReturnValue(innerEq),
                  then: (onFulfilled: (v: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: null }).then(onFulfilled),
                  catch: (onRejected: (e: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: null }).catch(onRejected),
                };
              }),
            };
          }

          if (table === 'products') {
            return {
              update: vi.fn().mockImplementation((data: { is_active?: boolean }) => {
                if (data.is_active === false) productsActive = false;
                return {
                  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                };
              }),
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }

          return makeChain({ data: null, error: null });
        });

        // Run the sequence of fraud reports
        for (let i = 0; i < numReports; i++) {
          await reportFraud('vendor-test', `lead-${i}`);
        }

        // Invariant: if fraud_count >= 3, vendor must be terminated and products inactive
        if (currentFraudCount >= 3) {
          expect(vendorStatus).toBe('terminated');
          expect(productsActive).toBe(false);
        }
      }),
      { numRuns: 10 }
    );
  });
});

// ---------------------------------------------------------------------------
// 4.3 — Property C8: Fraud counter monotonicity
// **Validates: Requirements C4.1**
// ---------------------------------------------------------------------------

describe('FraudDetectionService — Propriété C8 : Monotonie du compteur de fraude', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété C8 : Pour toute séquence d'appels à reportFraud, le fraud_count
   * est strictement croissant et ne peut jamais diminuer.
   *
   * **Validates: Requirements C4.1**
   */
  it('C8 — Le fraud_count est strictement croissant après chaque reportFraud', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    // Generate sequences of 1 to 5 fraud reports starting from a random initial count
    const initialCountArb = fc.integer({ min: 0, max: 2 });
    const numReportsArb = fc.integer({ min: 1, max: 5 });

    await fc.assert(
      fc.asyncProperty(initialCountArb, numReportsArb, async (initialCount, numReports) => {
        vi.clearAllMocks();

        let currentFraudCount = initialCount;
        const observedCounts: number[] = [];

        mockFrom.mockImplementation((table: string) => {
          if (table === 'vendors') {
            const capturedCount = currentFraudCount;
            return {
              // Read path
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { fraud_count: capturedCount },
                    error: null,
                  }),
                }),
              }),
              // Write path
              update: vi.fn().mockImplementation((data: { fraud_count?: number; status?: string }) => {
                if (data.fraud_count !== undefined) {
                  currentFraudCount = data.fraud_count;
                  observedCounts.push(currentFraudCount);
                }
                const innerEq = {
                  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                  then: (onFulfilled: (v: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: null }).then(onFulfilled),
                  catch: (onRejected: (e: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: null }).catch(onRejected),
                };
                return {
                  eq: vi.fn().mockReturnValue(innerEq),
                  then: (onFulfilled: (v: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: null }).then(onFulfilled),
                  catch: (onRejected: (e: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: null }).catch(onRejected),
                };
              }),
            };
          }

          if (table === 'products') {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }

          return makeChain({ data: null, error: null });
        });

        // Run the sequence
        for (let i = 0; i < numReports; i++) {
          await reportFraud('vendor-test', `lead-${i}`);
        }

        // Verify strict monotonicity: each observed count is greater than the previous
        for (let i = 1; i < observedCounts.length; i++) {
          expect(observedCounts[i]).toBeGreaterThan(observedCounts[i - 1]);
        }

        // Verify the final count equals initialCount + numReports
        expect(currentFraudCount).toBe(initialCount + numReports);
      }),
      { numRuns: 20 }
    );
  });
});
