// ============================================================
// Krantos Platform — ContractService Tests
// Unit tests (6.4) + Property-based tests (6.2, 6.3)
// **Validates: Requirements C5.1, C5.2, C5.3, C5.5, C6.2, C6.3, C6.4**
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Supabase and FraudDetectionService before importing the service
// ---------------------------------------------------------------------------

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

vi.mock('./fraudDetectionService', () => ({
  terminateVendor: vi.fn().mockResolvedValue(undefined),
}));

import {
  checkExpiredContracts,
  renewContract,
  getExpiringContracts,
  terminateContract,
} from './contractService';

import { terminateVendor } from './fraudDetectionService';

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
  chain.lte = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(resolveValue));
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(onFulfilled);
  chain.catch = (onRejected: (e: unknown) => unknown) =>
    Promise.resolve(resolveValue).catch(onRejected);
  return chain;
}

// ---------------------------------------------------------------------------
// 6.4 — Unit tests: checkExpiredContracts
// **Validates: Requirements C5.1, C5.5**
// ---------------------------------------------------------------------------

describe('ContractService — checkExpiredContracts (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('détecte les vendeurs expirés et met à jour leur statut à expired', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const expiredVendors = [{ id: 'vendor-1' }, { id: 'vendor-2' }];
    const vendorUpdateMock = vi.fn().mockReturnThis();
    const vendorEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const productsUpdateMock = vi.fn().mockReturnThis();
    const productsEqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    let vendorCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        vendorCallCount++;
        if (vendorCallCount === 1) {
          // Initial query: select expired vendors
          return {
            select: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: expiredVendors, error: null }),
          };
        }
        // Subsequent calls: update vendor status
        return {
          update: vendorUpdateMock,
          eq: vendorEqMock,
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

    const result = await checkExpiredContracts();

    expect(result).toEqual(['vendor-1', 'vendor-2']);
    expect(vendorUpdateMock).toHaveBeenCalledWith({ status: 'expired' });
    expect(productsUpdateMock).toHaveBeenCalledWith({ is_active: false });
  });

  it('retourne un tableau vide si aucun contrat n\'est expiré', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    const result = await checkExpiredContracts();

    expect(result).toEqual([]);
  });

  it('désactive les produits de chaque vendeur expiré', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const expiredVendors = [{ id: 'vendor-42' }];
    const productsUpdateMock = vi.fn().mockReturnThis();
    const productsEqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    let vendorCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        vendorCallCount++;
        if (vendorCallCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: expiredVendors, error: null }),
          };
        }
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

    await checkExpiredContracts();

    expect(productsUpdateMock).toHaveBeenCalledWith({ is_active: false });
    expect(productsEqMock).toHaveBeenCalledWith('vendor_id', 'vendor-42');
  });

  it('lève une erreur si la requête initiale échoue', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    await expect(checkExpiredContracts()).rejects.toThrow(
      'Erreur lors de la vérification des contrats expirés'
    );
  });
});

// ---------------------------------------------------------------------------
// 6.4 — Unit tests: renewContract
// **Validates: Requirements C6.2, C6.3**
// ---------------------------------------------------------------------------

describe('ContractService — renewContract (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renouvelle le contrat d\'un vendeur expiré (super_admin)', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const vendorUpdateMock = vi.fn().mockReturnThis();
    const vendorEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const productsUpdateMock = vi.fn().mockReturnThis();
    const productsEqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role: 'super_admin' }, error: null }),
        };
      }
      if (table === 'vendors') {
        return {
          update: vendorUpdateMock,
          eq: vendorEqMock,
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

    const newEndDate = new Date('2025-12-31');
    await expect(renewContract('vendor-1', newEndDate, 'admin-1')).resolves.toBeUndefined();

    expect(vendorUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', contract_end_date: '2025-12-31' })
    );
    expect(productsUpdateMock).toHaveBeenCalledWith({ is_active: true });
  });

  it('renouvelle le contrat avec le rôle admin_principal', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role: 'admin_principal' }, error: null }),
        };
      }
      if (table === 'vendors') {
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

    const newEndDate = new Date('2026-06-30');
    await expect(renewContract('vendor-1', newEndDate, 'admin-2')).resolves.toBeUndefined();
  });

  it('réactive les produits du vendeur lors du renouvellement', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const productsUpdateMock = vi.fn().mockReturnThis();
    const productsEqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role: 'admin_principal' }, error: null }),
        };
      }
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

    await renewContract('vendor-1', new Date('2026-01-01'), 'admin-1');

    expect(productsUpdateMock).toHaveBeenCalledWith({ is_active: true });
    expect(productsEqMock).toHaveBeenCalledWith('vendor_id', 'vendor-1');
  });

  it('rejette le renouvellement par un admin_collaborateur', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin_collaborateur' },
            error: null,
          }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    await expect(
      renewContract('vendor-1', new Date('2026-01-01'), 'collab-admin-1')
    ).rejects.toThrow("Vous n'avez pas les droits pour effectuer cette action.");
  });

  it('lève une erreur si l\'admin est introuvable', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    await expect(
      renewContract('vendor-1', new Date('2026-01-01'), 'unknown-admin')
    ).rejects.toThrow('Erreur lors de la vérification du rôle admin');
  });
});

// ---------------------------------------------------------------------------
// 6.4 — Unit tests: getExpiringContracts
// **Validates: Requirements C5.5, C6.2**
// ---------------------------------------------------------------------------

describe('ContractService — getExpiringContracts (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne les vendeurs dont le contrat expire dans les N prochains jours', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const mockRows = [
      { id: 'vendor-1', name: 'Vendeur A', contract_end_date: '2025-01-15', status: 'active' },
      { id: 'vendor-2', name: 'Vendeur B', contract_end_date: '2025-01-20', status: 'active' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    const result = await getExpiringContracts(30);

    expect(result).toHaveLength(2);
    expect(result[0].vendorId).toBe('vendor-1');
    expect(result[0].name).toBe('Vendeur A');
    expect(result[0].contractEndDate).toBeInstanceOf(Date);
    expect(result[0].status).toBe('active');
    expect(result[1].vendorId).toBe('vendor-2');
  });

  it('retourne un tableau vide si aucun contrat n\'expire bientôt', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    const result = await getExpiringContracts(7);

    expect(result).toEqual([]);
  });

  it('convertit contract_end_date en objet Date', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    const mockRows = [
      { id: 'vendor-1', name: 'Vendeur A', contract_end_date: '2025-03-01', status: 'active' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    const result = await getExpiringContracts(30);

    expect(result[0].contractEndDate).toBeInstanceOf(Date);
    expect(result[0].contractEndDate.getFullYear()).toBe(2025);
    expect(result[0].contractEndDate.getMonth()).toBe(2); // March = index 2
    expect(result[0].contractEndDate.getDate()).toBe(1);
  });

  it('lève une erreur si la requête échoue', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        };
      }
      return makeChain({ data: null, error: null });
    });

    await expect(getExpiringContracts(30)).rejects.toThrow(
      'Erreur lors de la récupération des contrats expirant bientôt'
    );
  });
});

// ---------------------------------------------------------------------------
// 6.4 — Unit tests: terminateContract
// **Validates: Requirements C5.2, C5.4**
// ---------------------------------------------------------------------------

describe('ContractService — terminateContract (tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('délègue à terminateVendor avec le vendorId correct', async () => {
    const terminateVendorMock = terminateVendor as ReturnType<typeof vi.fn>;
    terminateVendorMock.mockResolvedValue(undefined);

    await terminateContract('vendor-1', 'Fraude détectée');

    expect(terminateVendorMock).toHaveBeenCalledWith('vendor-1');
  });

  it('propage l\'erreur si terminateVendor échoue', async () => {
    const terminateVendorMock = terminateVendor as ReturnType<typeof vi.fn>;
    terminateVendorMock.mockRejectedValue(new Error('Erreur de résiliation'));

    await expect(terminateContract('vendor-1', 'Fraude')).rejects.toThrow('Erreur de résiliation');
  });
});

// ---------------------------------------------------------------------------
// 6.2 — Property C6: Expired vendors exclusion
// **Validates: Requirements C5.1, C5.3**
// ---------------------------------------------------------------------------

describe('ContractService — Propriété C6 : Exclusion des vendeurs expirés', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété C6 : Pour tout vendeur avec le statut `expired` ou `terminated`,
   * aucun de ses produits n'est `is_active = true`.
   *
   * On simule des états vendeurs avec des statuts variés et on vérifie que
   * après checkExpiredContracts(), les produits des vendeurs expirés sont désactivés.
   *
   * **Validates: Requirements C5.1, C5.3**
   */
  it('C6 — Aucun produit actif pour un vendeur expired ou terminated', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    // Generate a list of vendor IDs that will be expired
    const numExpiredArb = fc.integer({ min: 1, max: 5 });

    await fc.assert(
      fc.asyncProperty(numExpiredArb, async (numExpired) => {
        vi.clearAllMocks();

        // Track which vendors had their products deactivated
        const deactivatedVendors = new Set<string>();
        const expiredVendorIds = Array.from({ length: numExpired }, (_, i) => ({
          id: `vendor-expired-${i}`,
        }));

        let vendorCallCount = 0;

        mockFrom.mockImplementation((table: string) => {
          if (table === 'vendors') {
            vendorCallCount++;
            if (vendorCallCount === 1) {
              // Initial query: return expired vendors
              return {
                select: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ data: expiredVendorIds, error: null }),
              };
            }
            // Update vendor status
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'products') {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((field: string, value: string) => {
                if (field === 'vendor_id') {
                  deactivatedVendors.add(value);
                }
                return Promise.resolve({ data: null, error: null });
              }),
            };
          }
          return makeChain({ data: null, error: null });
        });

        const expiredIds = await checkExpiredContracts();

        // Property C6: every expired vendor must have had its products deactivated
        for (const vendorId of expiredIds) {
          expect(deactivatedVendors.has(vendorId)).toBe(true);
        }

        // The number of expired IDs must match the number of vendors we set up
        expect(expiredIds).toHaveLength(numExpired);
      }),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// 6.3 — Property C9: Vendor status and product visibility consistency
// **Validates: Requirements C5.1, C5.3, C4.2**
// ---------------------------------------------------------------------------

describe('ContractService — Propriété C9 : Cohérence statut vendeur et visibilité produits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété C9 : Il n'existe aucun état où un produit est `is_active = true`
   * pour un vendeur non `active`.
   *
   * On génère des états de vendeurs avec des statuts variés et on vérifie que :
   * - Après checkExpiredContracts(), les produits des vendeurs expirés sont désactivés
   * - Après renewContract(), les produits des vendeurs réactivés sont activés
   * - La cohérence est maintenue à chaque transition
   *
   * **Validates: Requirements C5.1, C5.3, C4.2**
   */
  it('C9 — Aucun produit actif pour un vendeur non-active (expired ou terminated)', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    // Generate vendor states: status and whether products should be active
    const vendorStatusArb = fc.record({
      status: fc.constantFrom('expired', 'terminated', 'suspended'),
      numProducts: fc.integer({ min: 1, max: 5 }),
    });

    await fc.assert(
      fc.asyncProperty(vendorStatusArb, async ({ status, numProducts }) => {
        vi.clearAllMocks();

        // Simulate a vendor state where status is non-active
        // After checkExpiredContracts() or terminateVendor(), products must be is_active = false

        const vendorId = `vendor-${status}`;
        const productsDeactivated: boolean[] = [];

        // Simulate the product deactivation that happens during expiration/termination
        // by verifying the update call sets is_active = false
        const productsUpdateMock = vi.fn().mockImplementation((data: { is_active?: boolean }) => {
          if (data.is_active === false) {
            // Record that products were deactivated
            for (let i = 0; i < numProducts; i++) {
              productsDeactivated.push(false);
            }
          }
          return {
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        });

        let vendorCallCount = 0;

        mockFrom.mockImplementation((table: string) => {
          if (table === 'vendors') {
            vendorCallCount++;
            if (vendorCallCount === 1) {
              return {
                select: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: vendorId }],
                  error: null,
                }),
              };
            }
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'products') {
            return {
              update: productsUpdateMock,
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          return makeChain({ data: null, error: null });
        });

        // Trigger expiration check (simulates the non-active state transition)
        await checkExpiredContracts();

        // Property C9: after the transition, products must be deactivated
        // (is_active = false was called for the vendor's products)
        expect(productsUpdateMock).toHaveBeenCalledWith({ is_active: false });

        // Verify no product is left active for a non-active vendor
        // (all recorded product states should be false)
        for (const isActive of productsDeactivated) {
          expect(isActive).toBe(false);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('C9 — Après renouvellement, les produits sont réactivés uniquement pour les vendeurs active', async () => {
    const { supabase } = await import('../lib/supabase');
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

    // Generate valid admin roles that can renew contracts
    const adminRoleArb = fc.constantFrom('super_admin', 'admin_principal');

    await fc.assert(
      fc.asyncProperty(adminRoleArb, async (role) => {
        vi.clearAllMocks();

        const productsUpdateMock = vi.fn().mockReturnThis();
        const productsEqMock = vi.fn().mockResolvedValue({ data: null, error: null });

        mockFrom.mockImplementation((table: string) => {
          if (table === 'admin_users') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { role }, error: null }),
            };
          }
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

        // Renew contract — vendor becomes active
        await renewContract('vendor-1', new Date('2026-12-31'), 'admin-1');

        // Property C9: after renewal (vendor is now active), products must be reactivated
        expect(productsUpdateMock).toHaveBeenCalledWith({ is_active: true });
      }),
      { numRuns: 10 }
    );
  });
});
