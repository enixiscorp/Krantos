// ============================================================
// Krantos Platform — RecommendationEngine Property-Based Tests
// **Validates: Requirements 4.1, 4.2, 4.3**
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Supabase before importing the service
// ---------------------------------------------------------------------------

// We mock the supabase module so that getRecommendation's DB calls can be
// controlled in tests without a real database. This lets us test the filtering
// property in isolation.

vi.mock('../lib/supabase', () => {
  // Build a chainable mock that can be configured per-test via mockImplementation
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.gte = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve({ data: [], error: null }));
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => makeChain()),
    },
  };
});

import { getRecommendation } from './recommendationEngine';
import { supabase } from '../lib/supabase';
import type { Product, Vendor } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid Vendor object */
const vendorArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.string({ minLength: 1, maxLength: 30 }),
  phone: fc.string({ minLength: 8, maxLength: 15 }),
  email: fc.option(fc.emailAddress(), { nil: null }),
  subscription_type: fc.constantFrom('free' as const, 'basic' as const, 'premium' as const),
  status: fc.constant('active' as const),
  created_at: fc.constant(new Date().toISOString()),
});

/** Generates a Product with a given vendor_id and a power_rating that can be anything */
const productArbitrary = (vendorId: string) =>
  fc.record({
    id: fc.uuid(),
    vendor_id: fc.constant(vendorId),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    category: fc.string({ minLength: 1, maxLength: 30 }),
    // Use integer-based kVA values (0.1 to 1000) to avoid 32-bit float constraints
    power_rating: fc.integer({ min: 1, max: 10000 }).map((n) => n / 10),
    price: fc.integer({ min: 1, max: 10_000_000 }),
    description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
    keywords: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    is_active: fc.constant(true),
    created_at: fc.constant(new Date().toISOString()),
  });

/** Generates an array of products with their associated vendor */
const catalogArbitrary = fc
  .array(vendorArbitrary, { minLength: 0, maxLength: 20 })
  .chain((vendors) => {
    if (vendors.length === 0) {
      return fc.constant([] as Array<Product & { vendors: Vendor }>);
    }
    return fc
      .array(
        fc.integer({ min: 0, max: vendors.length - 1 }).chain((vendorIdx) =>
          productArbitrary(vendors[vendorIdx].id).map((product) => ({
            ...product,
            vendors: vendors[vendorIdx],
          }))
        ),
        { minLength: 0, maxLength: 30 }
      )
      .map((products) => products as Array<Product & { vendors: Vendor }>);
  });

// ---------------------------------------------------------------------------
// Helper: simulate the DB-side filtering that Supabase would apply
// (power_rating >= totalKVA, is_active = true, vendors.status = 'active')
// ---------------------------------------------------------------------------
function simulateDbFilter(
  catalog: Array<Product & { vendors: Vendor }>,
  totalKVA: number
): Array<Product & { vendors: Vendor }> {
  return catalog
    .filter(
      (p) =>
        p.power_rating >= totalKVA &&
        p.is_active === true &&
        p.vendors.status === 'active'
    )
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Propriété 3 — Filtrage des produits par capacité
// **Validates: Requirements 4.1**
// ---------------------------------------------------------------------------

describe('RecommendationEngine — Propriété 3 : Filtrage des produits par capacité', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété 3 : Pour tout `totalKVA` et tout catalogue de produits,
   * chaque produit retourné par le RecommendationEngine a `power_rating >= totalKVA`.
   * Aucun produit sous-dimensionné ne doit jamais être recommandé.
   *
   * **Validates: Requirements 4.1**
   */
  it('Propriété 3 — Tout produit recommandé a power_rating >= totalKVA', async () => {
    // Generate positive totalKVA values (0.1 to 500 kVA) and random product catalogs
    // Using integer-mapped values to avoid 32-bit float constraints in fast-check
    const totalKVAArbitrary = fc.integer({ min: 1, max: 5000 }).map((n) => n / 10);

    await fc.assert(
      fc.asyncProperty(totalKVAArbitrary, catalogArbitrary, async (totalKVA, catalog) => {
        // Simulate what the DB query would return: only products with
        // power_rating >= totalKVA, is_active = true, vendor.status = 'active',
        // ordered by price ASC, limited to 10.
        const filteredCatalog = simulateDbFilter(catalog, totalKVA);

        // Configure the Supabase mock to return the pre-filtered catalog
        const mockLimit = vi.fn().mockResolvedValue({
          data: filteredCatalog,
          error: null,
        });
        const mockChain = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: mockLimit,
        };
        vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

        // Call the engine
        const result = await getRecommendation(totalKVA);

        // If a product is returned, it MUST have power_rating >= totalKVA
        if (result.product !== null) {
          expect(result.product.power_rating).toBeGreaterThanOrEqual(totalKVA);
        }

        // If no product is returned, vendor must also be null (Requirement 4.4)
        if (result.product === null) {
          expect(result.vendor).toBeNull();
        }

        // If a product is returned, a vendor must also be returned
        if (result.product !== null) {
          expect(result.vendor).not.toBeNull();
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Edge case: when the catalog is empty, the engine returns null for both
   * product and vendor (Requirement 4.4).
   */
  it('Cas limite — Catalogue vide : retourne null pour produit et vendeur', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    const result = await getRecommendation(5);
    expect(result.product).toBeNull();
    expect(result.vendor).toBeNull();
  });

  /**
   * Edge case: when no product in the catalog meets the power_rating threshold,
   * the engine returns null (Requirement 4.4).
   */
  it('Cas limite — Aucun produit ne satisfait power_rating >= totalKVA : retourne null', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    // Very high totalKVA — no product in a typical catalog would match
    const result = await getRecommendation(99999);
    expect(result.product).toBeNull();
    expect(result.vendor).toBeNull();
  });

  /**
   * Deterministic example: given a catalog with one product that exactly meets
   * the threshold, it should be returned.
   */
  it('Exemple déterministe — Produit avec power_rating == totalKVA est retourné', async () => {
    const vendor: Vendor = {
      id: 'vendor-1',
      name: 'Énergie Togo',
      category: 'énergie',
      phone: '+22890000000',
      email: 'contact@energietogo.tg',
      subscription_type: 'premium',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const product: Product & { vendors: Vendor } = {
      id: 'product-1',
      vendor_id: 'vendor-1',
      name: 'Groupe électrogène 5 kVA',
      category: 'générateur',
      power_rating: 5,
      price: 500000,
      description: 'Groupe électrogène fiable',
      keywords: 'générateur, énergie',
      is_active: true,
      created_at: new Date().toISOString(),
      vendors: vendor,
    };

    const mockLimit = vi.fn().mockResolvedValue({ data: [product], error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    const result = await getRecommendation(5);

    expect(result.product).not.toBeNull();
    expect(result.product!.power_rating).toBeGreaterThanOrEqual(5);
    expect(result.product!.id).toBe('product-1');
    expect(result.vendor).not.toBeNull();
    expect(result.vendor!.id).toBe('vendor-1');
  });
});

// ---------------------------------------------------------------------------
// Propriété 4 — Ordre de priorité des recommandations
// **Validates: Requirements 4.2, 4.3**
// ---------------------------------------------------------------------------

/**
 * Priority map used by the RecommendationEngine (mirrors the implementation).
 * premium → 2, basic → 1, free → 0
 */
const PRIORITY: Record<string, number> = { premium: 2, basic: 1, free: 0 };

/**
 * Simulate the full client-side sort that the engine applies after the DB query:
 * 1. subscription priority DESC (premium first)
 * 2. price ASC (tie-break)
 */
function simulateEngineSort(
  rows: Array<Product & { vendors: Vendor }>
): Array<Product & { vendors: Vendor }> {
  return [...rows].sort((a, b) => {
    const pa = PRIORITY[a.vendors.subscription_type] ?? 0;
    const pb = PRIORITY[b.vendors.subscription_type] ?? 0;
    if (pb !== pa) return pb - pa;
    return a.price - b.price;
  });
}

describe('RecommendationEngine — Propriété 4 : Ordre de priorité des recommandations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété 4 : Pour tout ensemble de produits filtrés retournés par Supabase,
   * le RecommendationEngine doit :
   *   a) Placer tous les produits premium avant les produits basic/free.
   *   b) À priorité égale, trier par prix croissant.
   *   c) Retourner le premier élément de la liste triée comme recommandation principale.
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  it('Propriété 4 — Les produits premium apparaissent avant basic/free ; à priorité égale, tri par prix croissant', async () => {
    // Arbitrary: generate a non-empty list of products with varying subscription types
    const rowsArbitrary = fc
      .array(vendorArbitrary, { minLength: 1, maxLength: 10 })
      .chain((vendors) =>
        fc
          .array(
            fc.integer({ min: 0, max: vendors.length - 1 }).chain((idx) =>
              productArbitrary(vendors[idx].id).map((p) => ({
                ...p,
                vendors: vendors[idx],
              }))
            ),
            { minLength: 1, maxLength: 20 }
          )
          .map((rows) => rows as Array<Product & { vendors: Vendor }>)
      );

    await fc.assert(
      fc.asyncProperty(rowsArbitrary, async (rows) => {
        // The mock returns the rows pre-sorted by price only (as Supabase would),
        // so the engine must apply the subscription-priority sort client-side.
        const dbRows = [...rows].sort((a, b) => a.price - b.price).slice(0, 10);

        const mockLimit = vi.fn().mockResolvedValue({ data: dbRows, error: null });
        const mockChain = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: mockLimit,
        };
        vi.mocked(supabase.from).mockReturnValue(
          mockChain as ReturnType<typeof supabase.from>
        );

        const result = await getRecommendation(0);

        // There is at least one row, so a product must be returned.
        expect(result.product).not.toBeNull();
        expect(result.vendor).not.toBeNull();

        // Compute the expected sorted order independently.
        const expected = simulateEngineSort(dbRows);
        const best = expected[0];

        // (c) The recommended product is the first element of the sorted list.
        expect(result.product!.id).toBe(best.id);
        expect(result.vendor!.id).toBe(best.vendors.id);

        // (a) No product with a lower priority appears before a higher-priority product.
        // We verify this by checking that the recommended product has the maximum priority
        // among all candidates.
        const maxPriority = Math.max(
          ...dbRows.map((r) => PRIORITY[r.vendors.subscription_type] ?? 0)
        );
        const recommendedPriority = PRIORITY[result.vendor!.subscription_type] ?? 0;
        expect(recommendedPriority).toBe(maxPriority);

        // (b) Among all candidates that share the same (maximum) priority, the recommended
        // product has the lowest price.
        const topTierRows = dbRows.filter(
          (r) => (PRIORITY[r.vendors.subscription_type] ?? 0) === maxPriority
        );
        const minPriceInTopTier = Math.min(...topTierRows.map((r) => r.price));
        expect(result.product!.price).toBe(minPriceInTopTier);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Deterministic example: given a mix of premium, basic, and free products,
   * the premium product with the lowest price is always recommended.
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  it('Exemple déterministe — Le produit premium le moins cher est toujours recommandé', async () => {
    const makeVendor = (id: string, sub: 'premium' | 'basic' | 'free'): Vendor => ({
      id,
      name: `Vendeur ${id}`,
      category: 'énergie',
      phone: '+22890000000',
      email: null,
      subscription_type: sub,
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const makeProduct = (
      id: string,
      vendorId: string,
      price: number,
      vendor: Vendor
    ): Product & { vendors: Vendor } => ({
      id,
      vendor_id: vendorId,
      name: `Produit ${id}`,
      category: 'générateur',
      power_rating: 10,
      price,
      description: null,
      keywords: null,
      is_active: true,
      created_at: new Date().toISOString(),
      vendors: vendor,
    });

    const premiumVendor = makeVendor('v-premium', 'premium');
    const basicVendor = makeVendor('v-basic', 'basic');
    const freeVendor = makeVendor('v-free', 'free');

    // premium products: prices 300 000 and 200 000 → cheapest premium wins
    const p1 = makeProduct('p-premium-expensive', 'v-premium', 300_000, premiumVendor);
    const p2 = makeProduct('p-premium-cheap', 'v-premium', 200_000, premiumVendor);
    // basic and free products with lower prices — must NOT win
    const p3 = makeProduct('p-basic', 'v-basic', 50_000, basicVendor);
    const p4 = makeProduct('p-free', 'v-free', 10_000, freeVendor);

    // Supabase returns rows sorted by price ASC (as configured in the query)
    const dbRows = [p4, p3, p2, p1]; // price order: 10k, 50k, 200k, 300k

    const mockLimit = vi.fn().mockResolvedValue({ data: dbRows, error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(
      mockChain as ReturnType<typeof supabase.from>
    );

    const result = await getRecommendation(5);

    // The cheapest premium product must be recommended
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p-premium-cheap');
    expect(result.vendor).not.toBeNull();
    expect(result.vendor!.subscription_type).toBe('premium');
    expect(result.product!.price).toBe(200_000);
  });

  /**
   * Deterministic example: when all products share the same subscription tier,
   * the one with the lowest price is recommended.
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  it('Exemple déterministe — À priorité égale, le produit le moins cher est recommandé', async () => {
    const makeVendor = (id: string): Vendor => ({
      id,
      name: `Vendeur ${id}`,
      category: 'énergie',
      phone: '+22890000000',
      email: null,
      subscription_type: 'basic',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const makeProduct = (
      id: string,
      vendorId: string,
      price: number,
      vendor: Vendor
    ): Product & { vendors: Vendor } => ({
      id,
      vendor_id: vendorId,
      name: `Produit ${id}`,
      category: 'générateur',
      power_rating: 10,
      price,
      description: null,
      keywords: null,
      is_active: true,
      created_at: new Date().toISOString(),
      vendors: vendor,
    });

    const v1 = makeVendor('v1');
    const v2 = makeVendor('v2');
    const v3 = makeVendor('v3');

    const p1 = makeProduct('p-expensive', 'v1', 500_000, v1);
    const p2 = makeProduct('p-cheapest', 'v2', 100_000, v2);
    const p3 = makeProduct('p-mid', 'v3', 300_000, v3);

    // Supabase returns rows sorted by price ASC
    const dbRows = [p2, p3, p1];

    const mockLimit = vi.fn().mockResolvedValue({ data: dbRows, error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(
      mockChain as ReturnType<typeof supabase.from>
    );

    const result = await getRecommendation(5);

    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p-cheapest');
    expect(result.product!.price).toBe(100_000);
  });
});

// ---------------------------------------------------------------------------
// Propriété 5 — Borne maximale des résultats de recommandation
// **Validates: Requirements 4.5**
// ---------------------------------------------------------------------------

describe('RecommendationEngine — Propriété 5 : Borne maximale des résultats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété 5 : Pour tout `totalKVA` et tout catalogue de produits (0–30 produits),
   * le RecommendationEngine ne retourne jamais plus de 10 produits dans sa liste de résultats.
   *
   * Concrètement :
   * - La méthode `.limit()` est toujours appelée avec la valeur 10 (MAX_RESULTS).
   * - Quand le mock retourne exactement 10 lignes, le moteur retourne exactement 1 produit (le meilleur).
   * - Quand le mock retourne 0 lignes, le moteur retourne null.
   *
   * **Validates: Requirements 4.5**
   */
  it('Propriété 5 — .limit(10) est toujours appelé ; le moteur retourne au plus 1 recommandation', async () => {
    const totalKVAArbitrary = fc.integer({ min: 1, max: 5000 }).map((n) => n / 10);

    await fc.assert(
      fc.asyncProperty(totalKVAArbitrary, catalogArbitrary, async (totalKVA, catalog) => {
        // Simulate DB-side filtering + LIMIT 10
        const filteredRows = simulateDbFilter(catalog, totalKVA);

        const mockLimit = vi.fn().mockResolvedValue({ data: filteredRows, error: null });
        const mockChain = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: mockLimit,
        };
        vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

        const result = await getRecommendation(totalKVA);

        // .limit() must always be called with 10 (MAX_RESULTS)
        expect(mockLimit).toHaveBeenCalledWith(10);

        // The engine returns a single { product, vendor } pair — never an array
        // When rows are available, exactly 1 product is returned
        if (filteredRows.length > 0) {
          expect(result.product).not.toBeNull();
          expect(result.vendor).not.toBeNull();
        } else {
          // When no rows match, null is returned (Requirement 4.4)
          expect(result.product).toBeNull();
          expect(result.vendor).toBeNull();
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Exemple déterministe : catalogue de 15 produits (tous éligibles).
   * Le mock simule le LIMIT DB en ne retournant que les 10 premiers (triés par prix ASC).
   * Vérifie que :
   * - `.limit` est appelé avec 10
   * - Le moteur retourne un produit (non null)
   * - Le produit retourné est le meilleur parmi les 10 (priorité subscription DESC, puis prix ASC)
   *
   * **Validates: Requirements 4.5**
   */
  it('Exemple déterministe — Catalogue de 15 produits : seuls les 10 premiers (LIMIT) sont considérés', async () => {
    const totalKVA = 5;

    const makeVendor = (id: string, sub: 'premium' | 'basic' | 'free'): Vendor => ({
      id,
      name: `Vendeur ${id}`,
      category: 'énergie',
      phone: '+22890000000',
      email: null,
      subscription_type: sub,
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const makeProduct = (
      id: string,
      vendorId: string,
      price: number,
      vendor: Vendor
    ): Product & { vendors: Vendor } => ({
      id,
      vendor_id: vendorId,
      name: `Produit ${id}`,
      category: 'générateur',
      power_rating: 10, // all >= totalKVA
      price,
      description: null,
      keywords: null,
      is_active: true,
      created_at: new Date().toISOString(),
      vendors: vendor,
    });

    // Build 15 products with varying prices and subscription types
    const freeVendor = makeVendor('v-free', 'free');
    const basicVendor = makeVendor('v-basic', 'basic');
    const premiumVendor = makeVendor('v-premium', 'premium');

    // 15 products sorted by price ASC; the DB LIMIT 10 returns only the first 10
    const allProducts: Array<Product & { vendors: Vendor }> = [
      makeProduct('p-01', 'v-free', 10_000, freeVendor),
      makeProduct('p-02', 'v-free', 20_000, freeVendor),
      makeProduct('p-03', 'v-basic', 30_000, basicVendor),
      makeProduct('p-04', 'v-free', 40_000, freeVendor),
      makeProduct('p-05', 'v-basic', 50_000, basicVendor),
      makeProduct('p-06', 'v-free', 60_000, freeVendor),
      makeProduct('p-07', 'v-basic', 70_000, basicVendor),
      makeProduct('p-08', 'v-free', 80_000, freeVendor),
      makeProduct('p-09', 'v-basic', 90_000, basicVendor),
      makeProduct('p-10', 'v-free', 100_000, freeVendor),
      // Products 11–15 are beyond the LIMIT and must NOT be considered
      makeProduct('p-11', 'v-premium', 110_000, premiumVendor),
      makeProduct('p-12', 'v-premium', 120_000, premiumVendor),
      makeProduct('p-13', 'v-premium', 130_000, premiumVendor),
      makeProduct('p-14', 'v-premium', 140_000, premiumVendor),
      makeProduct('p-15', 'v-premium', 150_000, premiumVendor),
    ];

    // Simulate DB LIMIT 10: only the first 10 rows (sorted by price ASC)
    const dbRows = allProducts.slice(0, 10);

    const mockLimit = vi.fn().mockResolvedValue({ data: dbRows, error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    const result = await getRecommendation(totalKVA);

    // .limit must be called with 10
    expect(mockLimit).toHaveBeenCalledWith(10);

    // A product must be returned (rows are non-empty)
    expect(result.product).not.toBeNull();
    expect(result.vendor).not.toBeNull();

    // The best match among the 10 DB rows: highest subscription priority, then lowest price.
    // Among the 10 rows: basic products (p-03, p-05, p-07, p-09) have priority 1;
    // free products (p-01, p-02, p-04, p-06, p-08, p-10) have priority 0.
    // Best = cheapest basic = p-03 (price 30 000).
    const expectedBest = simulateEngineSort(dbRows)[0];
    expect(result.product!.id).toBe(expectedBest.id);
    expect(result.vendor!.id).toBe(expectedBest.vendors.id);
  });

  /**
   * Cas limite — Quand le mock retourne exactement 10 lignes (le maximum),
   * le moteur retourne exactement 1 recommandation (pas un tableau de 10).
   *
   * **Validates: Requirements 4.5**
   */
  it('Cas limite — 10 lignes retournées par le mock : le moteur retourne exactement 1 recommandation', async () => {
    const makeVendor = (id: string): Vendor => ({
      id,
      name: `Vendeur ${id}`,
      category: 'énergie',
      phone: '+22890000000',
      email: null,
      subscription_type: 'basic',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const makeProduct = (
      id: string,
      price: number,
      vendor: Vendor
    ): Product & { vendors: Vendor } => ({
      id,
      vendor_id: vendor.id,
      name: `Produit ${id}`,
      category: 'générateur',
      power_rating: 10,
      price,
      description: null,
      keywords: null,
      is_active: true,
      created_at: new Date().toISOString(),
      vendors: vendor,
    });

    // Exactly 10 rows — the maximum allowed by MAX_RESULTS
    const rows: Array<Product & { vendors: Vendor }> = Array.from({ length: 10 }, (_, i) => {
      const vendor = makeVendor(`v-${i}`);
      return makeProduct(`p-${i}`, (i + 1) * 10_000, vendor);
    });

    const mockLimit = vi.fn().mockResolvedValue({ data: rows, error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    const result = await getRecommendation(5);

    // .limit must be called with 10
    expect(mockLimit).toHaveBeenCalledWith(10);

    // The result is a single { product, vendor } pair — NOT an array of 10
    expect(result.product).not.toBeNull();
    expect(result.vendor).not.toBeNull();

    // Verify the result is a plain object with product/vendor keys, not an array
    expect(Array.isArray(result)).toBe(false);
    expect(typeof result).toBe('object');
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['product', 'vendor']));

    // The recommended product is the best match (cheapest among all-basic = p-0)
    const expectedBest = simulateEngineSort(rows)[0];
    expect(result.product!.id).toBe(expectedBest.id);
  });
});

// ---------------------------------------------------------------------------
// Propriété 14 — Exclusion des produits inactifs et des vendeurs suspendus
// **Validates: Requirements 12.3, 13.3**
// ---------------------------------------------------------------------------

describe('RecommendationEngine — Propriété 14 : Exclusion des produits inactifs et des vendeurs suspendus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Arbitraries specific to Property 14
  // -------------------------------------------------------------------------

  /** Generates a vendor with any status (active, pending, suspended) */
  const anyStatusVendorArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    category: fc.string({ minLength: 1, maxLength: 30 }),
    phone: fc.string({ minLength: 8, maxLength: 15 }),
    email: fc.option(fc.emailAddress(), { nil: null }),
    subscription_type: fc.constantFrom('free' as const, 'basic' as const, 'premium' as const),
    status: fc.constantFrom('active' as const, 'pending' as const, 'suspended' as const),
    created_at: fc.constant(new Date().toISOString()),
  });

  /** Generates a product with any is_active value (true or false) */
  const anyActiveProductArbitrary = (vendorId: string) =>
    fc.record({
      id: fc.uuid(),
      vendor_id: fc.constant(vendorId),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      category: fc.string({ minLength: 1, maxLength: 30 }),
      power_rating: fc.integer({ min: 1, max: 10000 }).map((n) => n / 10),
      price: fc.integer({ min: 1, max: 10_000_000 }),
      description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
      keywords: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
      is_active: fc.boolean(),
      created_at: fc.constant(new Date().toISOString()),
    });

  /**
   * Generates a mixed catalog: products with any is_active value, vendors with any status.
   * This represents the full DB state before filtering.
   */
  const mixedCatalogArbitrary = fc
    .array(anyStatusVendorArbitrary, { minLength: 1, maxLength: 15 })
    .chain((vendors) =>
      fc
        .array(
          fc.integer({ min: 0, max: vendors.length - 1 }).chain((idx) =>
            anyActiveProductArbitrary(vendors[idx].id).map((product) => ({
              ...product,
              vendors: vendors[idx],
            }))
          ),
          { minLength: 1, maxLength: 30 }
        )
        .map((products) => products as Array<Product & { vendors: Vendor }>)
    );

  /**
   * Simulates the DB-side filtering that Supabase applies:
   * - is_active = true
   * - vendors.status = 'active'
   * - power_rating >= totalKVA
   * - ORDER BY price ASC, LIMIT 10
   *
   * This is what the mock returns — the engine must never see inactive/suspended rows.
   */
  function simulateStrictDbFilter(
    catalog: Array<Product & { vendors: Vendor }>,
    totalKVA: number
  ): Array<Product & { vendors: Vendor }> {
    return catalog
      .filter(
        (p) =>
          p.is_active === true &&
          p.vendors.status === 'active' &&
          p.power_rating >= totalKVA
      )
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);
  }

  // -------------------------------------------------------------------------
  // Property test
  // -------------------------------------------------------------------------

  /**
   * Propriété 14 : Pour tout catalogue contenant un mélange de produits actifs/inactifs
   * et de vendeurs actifs/suspendus/pending, le RecommendationEngine ne retourne jamais :
   *   a) Un produit avec `is_active = false`
   *   b) Un produit appartenant à un vendeur avec `status = 'suspended'` ou `status = 'pending'`
   *
   * Le mock simule le comportement de Supabase qui applique les filtres
   * `is_active = true` et `vendors.status = 'active'` côté DB (via RLS + query filters).
   * Le moteur ne doit donc jamais recevoir — ni retourner — de tels produits.
   *
   * **Validates: Requirements 12.3, 13.3**
   */
  it('Propriété 14 — Aucun produit inactif ou vendeur suspendu/pending n\'est retourné', async () => {
    const totalKVAArbitrary = fc.integer({ min: 1, max: 5000 }).map((n) => n / 10);

    await fc.assert(
      fc.asyncProperty(totalKVAArbitrary, mixedCatalogArbitrary, async (totalKVA, catalog) => {
        // Simulate what Supabase returns after applying DB-level filters:
        // only active products from active vendors that meet the power threshold.
        const filteredRows = simulateStrictDbFilter(catalog, totalKVA);

        const mockLimit = vi.fn().mockResolvedValue({ data: filteredRows, error: null });
        const mockChain = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: mockLimit,
        };
        vi.mocked(supabase.from).mockReturnValue(
          mockChain as ReturnType<typeof supabase.from>
        );

        const result = await getRecommendation(totalKVA);

        // (a) The returned product must never be inactive
        if (result.product !== null) {
          expect(result.product.is_active).toBe(true);
        }

        // (b) The returned vendor must never be suspended or pending
        if (result.vendor !== null) {
          expect(result.vendor.status).toBe('active');
          expect(result.vendor.status).not.toBe('suspended');
          expect(result.vendor.status).not.toBe('pending');
        }

        // (c) product and vendor are always both null or both non-null
        if (result.product === null) {
          expect(result.vendor).toBeNull();
        }
        if (result.vendor === null) {
          expect(result.product).toBeNull();
        }

        // (d) When the filtered catalog is empty (all products were inactive or
        //     their vendors were suspended/pending), the engine returns null.
        if (filteredRows.length === 0) {
          expect(result.product).toBeNull();
          expect(result.vendor).toBeNull();
        }
      }),
      { numRuns: 300 }
    );
  });

  // -------------------------------------------------------------------------
  // Deterministic examples
  // -------------------------------------------------------------------------

  /**
   * Exemple déterministe 1 : Catalogue avec uniquement des produits inactifs.
   * Le moteur doit retourner null (aucun produit éligible).
   *
   * **Validates: Requirements 12.3**
   */
  it('Exemple déterministe — Catalogue avec uniquement des produits inactifs : retourne null', async () => {
    const vendor: Vendor = {
      id: 'v-active',
      name: 'Vendeur Actif',
      category: 'énergie',
      phone: '+22890000000',
      email: null,
      subscription_type: 'premium',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    // All products are inactive — Supabase filters them out, mock returns empty array
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    const result = await getRecommendation(5);

    expect(result.product).toBeNull();
    expect(result.vendor).toBeNull();

    // Verify the query applied the is_active filter
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
  });

  /**
   * Exemple déterministe 2 : Catalogue avec uniquement des vendeurs suspendus.
   * Le moteur doit retourner null (aucun vendeur actif).
   *
   * **Validates: Requirements 13.3**
   */
  it('Exemple déterministe — Catalogue avec uniquement des vendeurs suspendus : retourne null', async () => {
    // Supabase filters out suspended vendors, mock returns empty array
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    const result = await getRecommendation(5);

    expect(result.product).toBeNull();
    expect(result.vendor).toBeNull();

    // Verify the query applied the vendor status filter
    expect(mockChain.eq).toHaveBeenCalledWith('vendors.status', 'active');
  });

  /**
   * Exemple déterministe 3 : Catalogue mixte — produits actifs et inactifs,
   * vendeurs actifs et suspendus. Seul le produit actif d'un vendeur actif
   * doit être retourné.
   *
   * **Validates: Requirements 12.3, 13.3**
   */
  it('Exemple déterministe — Catalogue mixte : seul le produit actif d\'un vendeur actif est retourné', async () => {
    const activeVendor: Vendor = {
      id: 'v-active',
      name: 'Vendeur Actif',
      category: 'énergie',
      phone: '+22890000000',
      email: 'actif@example.com',
      subscription_type: 'basic',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const suspendedVendor: Vendor = {
      id: 'v-suspended',
      name: 'Vendeur Suspendu',
      category: 'énergie',
      phone: '+22890000001',
      email: 'suspendu@example.com',
      subscription_type: 'premium',
      status: 'suspended',
      created_at: new Date().toISOString(),
    };

    const pendingVendor: Vendor = {
      id: 'v-pending',
      name: 'Vendeur En Attente',
      category: 'énergie',
      phone: '+22890000002',
      email: 'pending@example.com',
      subscription_type: 'premium',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // The only eligible product: active product from active vendor
    const eligibleProduct: Product & { vendors: Vendor } = {
      id: 'p-eligible',
      vendor_id: 'v-active',
      name: 'Groupe électrogène 10 kVA',
      category: 'générateur',
      power_rating: 10,
      price: 750_000,
      description: 'Produit fiable',
      keywords: 'générateur',
      is_active: true,
      created_at: new Date().toISOString(),
      vendors: activeVendor,
    };

    // Supabase filters out: inactive products, suspended vendors, pending vendors.
    // Only eligibleProduct passes all filters.
    const mockLimit = vi.fn().mockResolvedValue({ data: [eligibleProduct], error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    const result = await getRecommendation(5);

    // The eligible product must be returned
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p-eligible');
    expect(result.product!.is_active).toBe(true);

    // The associated vendor must be active
    expect(result.vendor).not.toBeNull();
    expect(result.vendor!.id).toBe('v-active');
    expect(result.vendor!.status).toBe('active');

    // Suspended and pending vendors must not appear
    expect(result.vendor!.id).not.toBe('v-suspended');
    expect(result.vendor!.id).not.toBe('v-pending');
  });

  /**
   * Exemple déterministe 4 : Vérifie que les filtres Supabase corrects sont appliqués.
   * Le moteur doit appeler `.eq('is_active', true)` et `.eq('vendors.status', 'active')`
   * pour garantir l'exclusion côté DB.
   *
   * **Validates: Requirements 12.3, 13.3**
   */
  it('Exemple déterministe — Les filtres is_active et vendors.status sont appliqués dans la requête Supabase', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    await getRecommendation(5);

    // Verify that the query explicitly filters inactive products
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);

    // Verify that the query explicitly filters suspended/pending vendors
    expect(mockChain.eq).toHaveBeenCalledWith('vendors.status', 'active');
  });
});

// ============================================================
// Tests unitaires — RecommendationEngine
// Tâche 5.6 : Tests unitaires ciblés
// Exigences : 4.1, 4.2, 4.3, 4.4, 4.5
// ============================================================

// ---------------------------------------------------------------------------
// Helpers partagés pour les tests unitaires
// ---------------------------------------------------------------------------

function makeVendorUnit(
  id: string,
  sub: 'premium' | 'basic' | 'free' = 'basic'
): Vendor {
  return {
    id,
    name: `Vendeur ${id}`,
    category: 'énergie',
    phone: '+22890000000',
    email: null,
    subscription_type: sub,
    status: 'active',
    created_at: new Date().toISOString(),
  };
}

function makeProductUnit(
  id: string,
  vendorId: string,
  powerRating: number,
  price: number,
  vendor: Vendor
): Product & { vendors: Vendor } {
  return {
    id,
    vendor_id: vendorId,
    name: `Produit ${id}`,
    category: 'générateur',
    power_rating: powerRating,
    price,
    description: null,
    keywords: null,
    is_active: true,
    created_at: new Date().toISOString(),
    vendors: vendor,
  };
}

function mockSupabaseWith(rows: Array<Product & { vendors: Vendor }>) {
  const mockLimit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: mockLimit,
  };
  vi.mocked(supabase.from).mockReturnValue(
    mockChain as ReturnType<typeof supabase.from>
  );
  return { mockChain, mockLimit };
}

// ---------------------------------------------------------------------------
// Tests unitaires 5.6.1 — Filtrage par power_rating (Exigence 4.1)
// ---------------------------------------------------------------------------

describe('Tests unitaires — Filtrage par power_rating (Exigence 4.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Retourne le produit dont power_rating == totalKVA (égalité exacte)', async () => {
    const vendor = makeVendorUnit('v1');
    const product = makeProductUnit('p1', 'v1', 5, 100_000, vendor);

    mockSupabaseWith([product]);

    const result = await getRecommendation(5);

    expect(result.product).not.toBeNull();
    expect(result.product!.power_rating).toBeGreaterThanOrEqual(5);
    expect(result.product!.id).toBe('p1');
  });

  it('Retourne le produit dont power_rating > totalKVA', async () => {
    const vendor = makeVendorUnit('v1');
    const product = makeProductUnit('p1', 'v1', 10, 100_000, vendor);

    mockSupabaseWith([product]);

    const result = await getRecommendation(5);

    expect(result.product).not.toBeNull();
    expect(result.product!.power_rating).toBeGreaterThanOrEqual(5);
  });

  it('Retourne null quand le mock ne retourne aucun produit (power_rating < totalKVA simulé côté DB)', async () => {
    // Supabase filtre les produits sous-dimensionnés côté DB ; le mock retourne []
    mockSupabaseWith([]);

    const result = await getRecommendation(100);

    expect(result.product).toBeNull();
    expect(result.vendor).toBeNull();
  });

  it('Vérifie que .gte("power_rating", totalKVA) est appelé dans la requête', async () => {
    const { mockChain } = mockSupabaseWith([]);

    await getRecommendation(7.5);

    expect(mockChain.gte).toHaveBeenCalledWith('power_rating', 7.5);
  });

  it('Retourne le produit avec le power_rating le plus bas parmi les éligibles (tri prix ASC)', async () => {
    const vendor = makeVendorUnit('v1');
    // Deux produits éligibles ; le moins cher doit être retourné (même priorité)
    const p1 = makeProductUnit('p-cheap', 'v1', 6, 50_000, vendor);
    const p2 = makeProductUnit('p-expensive', 'v1', 20, 200_000, vendor);

    // Mock retourne déjà trié par prix ASC (comme Supabase le ferait)
    mockSupabaseWith([p1, p2]);

    const result = await getRecommendation(5);

    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p-cheap');
  });
});

// ---------------------------------------------------------------------------
// Tests unitaires 5.6.2 — Tri par priorité vendeur puis prix (Exigences 4.2, 4.3)
// ---------------------------------------------------------------------------

describe('Tests unitaires — Tri par priorité vendeur puis prix (Exigences 4.2, 4.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Un produit premium est recommandé avant un produit basic, même si le basic est moins cher', async () => {
    const premiumVendor = makeVendorUnit('v-premium', 'premium');
    const basicVendor = makeVendorUnit('v-basic', 'basic');

    const premiumProduct = makeProductUnit('p-premium', 'v-premium', 10, 500_000, premiumVendor);
    const basicProduct = makeProductUnit('p-basic', 'v-basic', 10, 10_000, basicVendor);

    // Mock retourne les deux produits (triés par prix ASC comme Supabase)
    mockSupabaseWith([basicProduct, premiumProduct]);

    const result = await getRecommendation(5);

    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p-premium');
    expect(result.vendor!.subscription_type).toBe('premium');
  });

  it('Un produit premium est recommandé avant un produit free, même si le free est moins cher', async () => {
    const premiumVendor = makeVendorUnit('v-premium', 'premium');
    const freeVendor = makeVendorUnit('v-free', 'free');

    const premiumProduct = makeProductUnit('p-premium', 'v-premium', 10, 999_000, premiumVendor);
    const freeProduct = makeProductUnit('p-free', 'v-free', 10, 1_000, freeVendor);

    mockSupabaseWith([freeProduct, premiumProduct]);

    const result = await getRecommendation(5);

    expect(result.product!.id).toBe('p-premium');
    expect(result.vendor!.subscription_type).toBe('premium');
  });

  it('Un produit basic est recommandé avant un produit free', async () => {
    const basicVendor = makeVendorUnit('v-basic', 'basic');
    const freeVendor = makeVendorUnit('v-free', 'free');

    const basicProduct = makeProductUnit('p-basic', 'v-basic', 10, 300_000, basicVendor);
    const freeProduct = makeProductUnit('p-free', 'v-free', 10, 5_000, freeVendor);

    mockSupabaseWith([freeProduct, basicProduct]);

    const result = await getRecommendation(5);

    expect(result.product!.id).toBe('p-basic');
    expect(result.vendor!.subscription_type).toBe('basic');
  });

  it('À priorité égale (premium vs premium), le produit le moins cher est recommandé', async () => {
    const v1 = makeVendorUnit('v1', 'premium');
    const v2 = makeVendorUnit('v2', 'premium');

    const cheap = makeProductUnit('p-cheap', 'v1', 10, 100_000, v1);
    const expensive = makeProductUnit('p-expensive', 'v2', 10, 500_000, v2);

    // Mock retourne déjà trié par prix ASC
    mockSupabaseWith([cheap, expensive]);

    const result = await getRecommendation(5);

    expect(result.product!.id).toBe('p-cheap');
    expect(result.product!.price).toBe(100_000);
  });

  it('À priorité égale (basic vs basic), le produit le moins cher est recommandé', async () => {
    const v1 = makeVendorUnit('v1', 'basic');
    const v2 = makeVendorUnit('v2', 'basic');

    const p1 = makeProductUnit('p1', 'v1', 10, 200_000, v1);
    const p2 = makeProductUnit('p2', 'v2', 10, 80_000, v2);

    // Mock retourne trié par prix ASC
    mockSupabaseWith([p2, p1]);

    const result = await getRecommendation(5);

    expect(result.product!.id).toBe('p2');
    expect(result.product!.price).toBe(80_000);
  });

  it('Ordre complet : premium < basic < free — le meilleur premium le moins cher gagne', async () => {
    const premiumVendor = makeVendorUnit('v-premium', 'premium');
    const basicVendor = makeVendorUnit('v-basic', 'basic');
    const freeVendor = makeVendorUnit('v-free', 'free');

    const p1 = makeProductUnit('p-premium-1', 'v-premium', 10, 400_000, premiumVendor);
    const p2 = makeProductUnit('p-premium-2', 'v-premium', 10, 200_000, premiumVendor);
    const p3 = makeProductUnit('p-basic', 'v-basic', 10, 50_000, basicVendor);
    const p4 = makeProductUnit('p-free', 'v-free', 10, 10_000, freeVendor);

    // Mock retourne trié par prix ASC (comme Supabase)
    mockSupabaseWith([p4, p3, p2, p1]);

    const result = await getRecommendation(5);

    // Le produit premium le moins cher doit gagner
    expect(result.product!.id).toBe('p-premium-2');
    expect(result.vendor!.subscription_type).toBe('premium');
    expect(result.product!.price).toBe(200_000);
  });
});

// ---------------------------------------------------------------------------
// Tests unitaires 5.6.3 — Cas "aucun produit disponible" (Exigence 4.4)
// ---------------------------------------------------------------------------

describe('Tests unitaires — Aucun produit disponible (Exigence 4.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Retourne { product: null, vendor: null } quand le mock retourne un tableau vide', async () => {
    mockSupabaseWith([]);

    const result = await getRecommendation(5);

    expect(result.product).toBeNull();
    expect(result.vendor).toBeNull();
  });

  it('Retourne { product: null, vendor: null } pour un totalKVA très élevé (aucun produit éligible)', async () => {
    // Supabase filtre tout côté DB ; le mock retourne []
    mockSupabaseWith([]);

    const result = await getRecommendation(999999);

    expect(result.product).toBeNull();
    expect(result.vendor).toBeNull();
  });

  it('La structure de retour est toujours { product, vendor } même quand null', async () => {
    mockSupabaseWith([]);

    const result = await getRecommendation(5);

    expect(result).toHaveProperty('product');
    expect(result).toHaveProperty('vendor');
    expect(result.product).toBeNull();
    expect(result.vendor).toBeNull();
  });

  it('product et vendor sont toujours tous les deux null ou tous les deux non-null', async () => {
    // Cas null
    mockSupabaseWith([]);
    const nullResult = await getRecommendation(5);
    expect(nullResult.product).toBeNull();
    expect(nullResult.vendor).toBeNull();

    // Cas non-null
    vi.clearAllMocks();
    const vendor = makeVendorUnit('v1');
    const product = makeProductUnit('p1', 'v1', 10, 100_000, vendor);
    mockSupabaseWith([product]);
    const nonNullResult = await getRecommendation(5);
    expect(nonNullResult.product).not.toBeNull();
    expect(nonNullResult.vendor).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests unitaires 5.6.4 — Limite à 10 résultats (Exigence 4.5)
// ---------------------------------------------------------------------------

describe('Tests unitaires — Limite à 10 résultats (Exigence 4.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Appelle toujours .limit(10) quelle que soit la taille du catalogue', async () => {
    const vendor = makeVendorUnit('v1');
    const products = Array.from({ length: 5 }, (_, i) =>
      makeProductUnit(`p${i}`, 'v1', 10, (i + 1) * 10_000, vendor)
    );

    const { mockLimit } = mockSupabaseWith(products);

    await getRecommendation(5);

    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('Appelle .limit(10) même quand le catalogue est vide', async () => {
    const { mockLimit } = mockSupabaseWith([]);

    await getRecommendation(5);

    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('Retourne exactement 1 recommandation (pas un tableau) quand 10 lignes sont disponibles', async () => {
    const vendor = makeVendorUnit('v1', 'basic');
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeProductUnit(`p${i}`, 'v1', 10, (i + 1) * 10_000, vendor)
    );

    mockSupabaseWith(rows);

    const result = await getRecommendation(5);

    // Le résultat est un objet { product, vendor }, pas un tableau
    expect(Array.isArray(result)).toBe(false);
    expect(result).toHaveProperty('product');
    expect(result).toHaveProperty('vendor');
    expect(result.product).not.toBeNull();
    expect(result.vendor).not.toBeNull();
  });

  it('Parmi 10 lignes retournées par le mock, retourne le meilleur produit (priorité + prix)', async () => {
    const freeVendor = makeVendorUnit('v-free', 'free');
    const basicVendor = makeVendorUnit('v-basic', 'basic');

    // 8 produits free + 2 produits basic dans les 10 lignes
    const rows: Array<Product & { vendors: Vendor }> = [
      makeProductUnit('p-free-1', 'v-free', 10, 10_000, freeVendor),
      makeProductUnit('p-free-2', 'v-free', 10, 20_000, freeVendor),
      makeProductUnit('p-basic-1', 'v-basic', 10, 30_000, basicVendor),
      makeProductUnit('p-free-3', 'v-free', 10, 40_000, freeVendor),
      makeProductUnit('p-free-4', 'v-free', 10, 50_000, freeVendor),
      makeProductUnit('p-basic-2', 'v-basic', 10, 60_000, basicVendor),
      makeProductUnit('p-free-5', 'v-free', 10, 70_000, freeVendor),
      makeProductUnit('p-free-6', 'v-free', 10, 80_000, freeVendor),
      makeProductUnit('p-free-7', 'v-free', 10, 90_000, freeVendor),
      makeProductUnit('p-free-8', 'v-free', 10, 100_000, freeVendor),
    ];

    mockSupabaseWith(rows);

    const result = await getRecommendation(5);

    // Le meilleur parmi les 10 : basic (priorité 1) le moins cher = p-basic-1
    expect(result.product!.id).toBe('p-basic-1');
    expect(result.vendor!.subscription_type).toBe('basic');
  });

  it('Ne retourne jamais plus de 1 produit (la structure est toujours { product, vendor })', async () => {
    const vendor = makeVendorUnit('v1');
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeProductUnit(`p${i}`, 'v1', 10, (i + 1) * 5_000, vendor)
    );

    mockSupabaseWith(rows);

    const result = await getRecommendation(5);

    // Vérifie que le résultat n'est pas un tableau et contient exactement product + vendor
    expect(typeof result).toBe('object');
    expect(Array.isArray(result)).toBe(false);
    const keys = Object.keys(result);
    expect(keys).toContain('product');
    expect(keys).toContain('vendor');
    // Pas de clé supplémentaire inattendue (pas de tableau de résultats)
    expect(keys.length).toBe(2);
  });
});
