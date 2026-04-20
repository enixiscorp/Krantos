// ============================================================
// Krantos Platform — FraudDetectionService
// Requirements: C4.1, C4.2, C4.3, C4.4, C4.5
// ============================================================

import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result returned by reportFraud.
 * - newFraudCount: the updated fraud_count after incrementing
 * - terminated: true if the vendor was terminated as a result of this report
 */
export interface FraudResult {
  newFraudCount: number;
  terminated: boolean;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Reports a fraud for a vendor, atomically incrementing their fraud_count.
 * If fraud_count reaches 3 or more, terminateVendor is called automatically.
 *
 * Requirements: C4.1, C4.2
 */
export async function reportFraud(vendorId: string, _leadId: string): Promise<FraudResult> {
  // Read current fraud_count
  const { data: vendor, error: readError } = await supabase
    .from('vendors')
    .select('fraud_count')
    .eq('id', vendorId)
    .single();

  if (readError || !vendor) {
    throw new Error(
      `Erreur lors de la lecture du vendeur : ${readError?.message ?? 'Vendeur introuvable'}`
    );
  }

  const currentCount: number = vendor.fraud_count ?? 0;
  const newFraudCount = currentCount + 1;

  // Atomically increment fraud_count (optimistic: only update if value hasn't changed)
  const { error: updateError } = await supabase
    .from('vendors')
    .update({ fraud_count: newFraudCount })
    .eq('id', vendorId)
    .eq('fraud_count', currentCount); // optimistic concurrency check

  if (updateError) {
    throw new Error(
      `Erreur lors de l'incrémentation du compteur de fraude : ${updateError.message}`
    );
  }

  // Terminate vendor if threshold reached
  let terminated = false;
  if (newFraudCount >= 3) {
    await terminateVendor(vendorId);
    terminated = true;
  }

  return { newFraudCount, terminated };
}

/**
 * Terminates a vendor: sets status to 'terminated' and deactivates all their products.
 * Client data (leads, users, appliances_input) is NEVER deleted.
 *
 * Requirements: C4.2, C4.4
 */
export async function terminateVendor(vendorId: string): Promise<void> {
  // Update vendor status to 'terminated'
  const { error: vendorError } = await supabase
    .from('vendors')
    .update({ status: 'terminated' })
    .eq('id', vendorId);

  if (vendorError) {
    throw new Error(
      `Erreur lors de la résiliation du vendeur : ${vendorError.message}`
    );
  }

  // Deactivate all products for this vendor
  const { error: productsError } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('vendor_id', vendorId);

  if (productsError) {
    throw new Error(
      `Erreur lors de la désactivation des produits du vendeur : ${productsError.message}`
    );
  }
}

/**
 * Returns the current fraud_count for a vendor.
 *
 * Requirements: C4.1
 */
export async function getFraudCount(vendorId: string): Promise<number> {
  const { data, error } = await supabase
    .from('vendors')
    .select('fraud_count')
    .eq('id', vendorId)
    .single();

  if (error || !data) {
    throw new Error(
      `Erreur lors de la lecture du compteur de fraude : ${error?.message ?? 'Vendeur introuvable'}`
    );
  }

  return data.fraud_count ?? 0;
}

/**
 * Returns true if the vendor has the status 'terminated'.
 *
 * Requirements: C4.2, C4.5
 */
export async function isTerminated(vendorId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('vendors')
    .select('status')
    .eq('id', vendorId)
    .single();

  if (error || !data) {
    throw new Error(
      `Erreur lors de la vérification du statut du vendeur : ${error?.message ?? 'Vendeur introuvable'}`
    );
  }

  return data.status === 'terminated';
}
