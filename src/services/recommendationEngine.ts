// ============================================================
// Krantos Platform — RecommendationEngine
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.3, 13.3
// ============================================================

import { supabase } from '../lib/supabase';
import type { Product, Vendor } from '../lib/supabase';
import { productsCacheStore, vendorsCacheStore } from '../lib/offlineDB';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The result returned by `getRecommendation`.
 *
 * - `product` — the best-matching product, or `null` if none found
 * - `vendor`  — the vendor associated with the product, or `null` if none found
 */
export interface RecommendationResult {
  product: Product | null;
  vendor: Vendor | null;
  alternatives: { product: Product; vendor: Vendor }[];
  fromCache?: boolean;
}

/**
 * A raw row returned by the Supabase join query.
 * Product fields are at the top level; vendor fields are nested under `vendors`.
 */
interface ProductWithVendor extends Product {
  vendors: Vendor;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of candidates fetched from the DB (Requirement 4.5). */
const MAX_RESULTS = 10;

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Returns the best product recommendation for a given power requirement.
 *
 * Offline fallback: if Supabase is unreachable, uses the local IndexedDB cache
 * populated during the last successful online session.
 *
 * @param totalKVA - The calculated power requirement in kVA.
 * @returns The `{ product, vendor, alternatives, fromCache? }` result.
 */
export async function getRecommendation(totalKVA: number): Promise<RecommendationResult> {
  // ── Online path ────────────────────────────────────────────────────────────
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(
          `
          *,
          vendors!inner (
            id,
            name,
            category,
            phone,
            email,
            subscription_type,
            status,
            created_at
          )
        `
        )
        .gte('power_rating', totalKVA)
        .eq('is_active', true)
        .eq('vendors.status', 'active')
        .order('price', { ascending: true })
        .limit(MAX_RESULTS);

      if (!error && data && data.length > 0) {
        // Populate caches for offline use (best-effort, non-blocking)
        const products: Product[] = [];
        const vendorMap = new Map<string, Vendor>();

        (data as ProductWithVendor[]).forEach((item) => {
          const { vendors: v, ...p } = item;
          products.push(p as Product);
          vendorMap.set(v.id, v);
        });

        productsCacheStore.setAll(products).catch(() => {});
        vendorsCacheStore.setAll(Array.from(vendorMap.values())).catch(() => {});

        return buildResult(data as ProductWithVendor[], false);
      }

      if (error) {
        console.warn('[RecommendationEngine] Supabase error, falling back to cache:', error.message);
      }
    } catch (err) {
      console.warn('[RecommendationEngine] Network error, falling back to cache:', err);
    }
  }

  // ── Offline / fallback path ────────────────────────────────────────────────
  return await getRecommendationFromCache(totalKVA);
}

// ---------------------------------------------------------------------------
// Offline cache recommendation
// ---------------------------------------------------------------------------

async function getRecommendationFromCache(totalKVA: number): Promise<RecommendationResult> {
  const [cachedProducts, cachedVendors] = await Promise.all([
    productsCacheStore.getAll(),
    vendorsCacheStore.getAll(),
  ]);

  if (cachedProducts.length === 0) {
    return { product: null, vendor: null, alternatives: [], fromCache: true };
  }

  const vendorMap = new Map<string, Vendor>(cachedVendors.map((v) => [v.id, v]));

  // Filter: power_rating >= totalKVA, is_active, vendor active
  const eligible = cachedProducts.filter((p) => {
    const vendor = vendorMap.get(p.vendor_id);
    return p.power_rating >= totalKVA && p.is_active && vendor?.status === 'active';
  });

  if (eligible.length === 0) {
    return { product: null, vendor: null, alternatives: [], fromCache: true };
  }

  // Sort: subscription priority DESC, then price ASC
  const PRIORITY: Record<string, number> = { premium: 2, basic: 1, free: 0 };
  const sorted = [...eligible].sort((a, b) => {
    const va = vendorMap.get(a.vendor_id);
    const vb = vendorMap.get(b.vendor_id);
    const pa = PRIORITY[va?.subscription_type ?? 'free'] ?? 0;
    const pb = PRIORITY[vb?.subscription_type ?? 'free'] ?? 0;
    if (pb !== pa) return pb - pa;
    return a.price - b.price;
  });

  const best = sorted[0];
  const bestVendor = vendorMap.get(best.vendor_id) ?? null;

  const alternatives = sorted.slice(1, 4).flatMap((p) => {
    const v = vendorMap.get(p.vendor_id);
    return v ? [{ product: p, vendor: v }] : [];
  });

  return {
    product: best,
    vendor: bestVendor,
    alternatives,
    fromCache: true,
  };
}

// ---------------------------------------------------------------------------
// Helper: build result from Supabase data
// ---------------------------------------------------------------------------

function buildResult(data: ProductWithVendor[], fromCache: boolean): RecommendationResult {
  if (!data || data.length === 0) {
    return { product: null, vendor: null, alternatives: [], fromCache };
  }

  const PRIORITY: Record<string, number> = { premium: 2, basic: 1, free: 0 };

  const sorted = [...data].sort((a, b) => {
    const pa = PRIORITY[a.vendors.subscription_type] ?? 0;
    const pb = PRIORITY[b.vendors.subscription_type] ?? 0;
    if (pb !== pa) return pb - pa;
    return a.price - b.price;
  });

  const best = sorted[0];
  const { vendors: bestVendor, ...bestProduct } = best;

  const alternatives = sorted.slice(1, 4).map((item) => {
    const { vendors: v, ...p } = item;
    return { product: p as Product, vendor: v as Vendor };
  });

  return {
    product: bestProduct as Product,
    vendor: bestVendor as Vendor,
    alternatives,
    fromCache,
  };
}

/**
 * Namespace export for ergonomic usage:
 * ```ts
 * import { RecommendationEngine } from './services/recommendationEngine';
 * const result = await RecommendationEngine.getRecommendation(totalKVA);
 * ```
 */
export const RecommendationEngine = { getRecommendation };
