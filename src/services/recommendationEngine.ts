// ============================================================
// Krantos Platform — RecommendationEngine
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.3, 13.3
// ============================================================

import { supabase } from '../lib/supabase';
import type { Product, Vendor } from '../lib/supabase';

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
 * Query strategy (Requirements 4.1 – 4.5, 12.3, 13.3):
 * 1. Filter products whose `power_rating >= totalKVA` (never under-size).
 * 2. Only include active products (`is_active = true`) from active vendors (`status = 'active'`).
 * 3. Sort by vendor subscription priority (premium > basic > free) then by price ascending.
 * 4. Limit to `MAX_RESULTS` (10) candidates.
 * 5. Return the first result as the primary recommendation and subsequent ones as alternatives.
 *
 * @param totalKVA - The calculated power requirement in kVA.
 * @returns The `{ product, vendor, alternatives }` result.
 */
export async function getRecommendation(totalKVA: number): Promise<RecommendationResult> {
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

  if (error) {
    throw new Error(
      `[RecommendationEngine] Erreur lors de la récupération des recommandations : ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    return { product: null, vendor: null, alternatives: [] };
  }

  // Client-side sort: subscription priority DESC, then price ASC
  const PRIORITY: Record<string, number> = { premium: 2, basic: 1, free: 0 };

  const sorted = (data as ProductWithVendor[]).sort((a, b) => {
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
