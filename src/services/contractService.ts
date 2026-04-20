// ============================================================
// Krantos Platform — ContractService
// Requirements: C5.1, C5.2, C5.4, C5.5, C6.2, C6.3
// ============================================================

import { supabase } from '../lib/supabase';
import { terminateVendor } from './fraudDetectionService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VendorContract {
  vendorId: string;
  name: string;
  contractEndDate: Date;
  status: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Checks for vendors whose contract has expired (contract_end_date <= now() AND status = 'active').
 * For each expired vendor: updates status to 'expired' and deactivates all their products.
 * Returns the array of expired vendor IDs.
 *
 * Requirements: C5.1, C5.5
 */
export async function checkExpiredContracts(): Promise<string[]> {
  const now = new Date().toISOString();

  // Query vendors that are active but whose contract has expired
  const { data: expiredVendors, error: queryError } = await supabase
    .from('vendors')
    .select('id')
    .lte('contract_end_date', now)
    .eq('status', 'active');

  if (queryError) {
    throw new Error(
      `Erreur lors de la vérification des contrats expirés : ${queryError.message}`
    );
  }

  const vendors = (expiredVendors ?? []) as { id: string }[];
  const expiredIds: string[] = [];

  for (const vendor of vendors) {
    // Update vendor status to 'expired'
    const { error: vendorError } = await supabase
      .from('vendors')
      .update({ status: 'expired' })
      .eq('id', vendor.id);

    if (vendorError) {
      throw new Error(
        `Erreur lors de la mise à jour du statut du vendeur ${vendor.id} : ${vendorError.message}`
      );
    }

    // Deactivate all products for this vendor
    const { error: productsError } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('vendor_id', vendor.id);

    if (productsError) {
      throw new Error(
        `Erreur lors de la désactivation des produits du vendeur ${vendor.id} : ${productsError.message}`
      );
    }

    expiredIds.push(vendor.id);
  }

  return expiredIds;
}

/**
 * Renews a vendor contract. Only super_admin or admin_principal roles are allowed.
 * Updates vendor status to 'active', sets the new contract_end_date, and reactivates products.
 * Throws an error if the admin is an admin_collaborateur.
 *
 * Requirements: C6.2, C6.3
 */
export async function renewContract(
  vendorId: string,
  newEndDate: Date,
  adminId: string
): Promise<void> {
  // Verify admin role via Supabase query on admin_users table
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('role')
    .eq('id', adminId)
    .single();

  if (adminError || !adminUser) {
    throw new Error(
      `Erreur lors de la vérification du rôle admin : ${adminError?.message ?? 'Admin introuvable'}`
    );
  }

  const role: string = adminUser.role;

  if (role === 'admin_collaborateur') {
    throw new Error("Vous n'avez pas les droits pour effectuer cette action.");
  }

  if (role !== 'super_admin' && role !== 'admin_principal') {
    throw new Error("Vous n'avez pas les droits pour effectuer cette action.");
  }

  // Update vendor status to 'active' and set new contract_end_date
  const { error: vendorError } = await supabase
    .from('vendors')
    .update({
      status: 'active',
      contract_end_date: newEndDate.toISOString().split('T')[0], // date only (YYYY-MM-DD)
    })
    .eq('id', vendorId);

  if (vendorError) {
    throw new Error(
      `Erreur lors du renouvellement du contrat : ${vendorError.message}`
    );
  }

  // Reactivate all products for this vendor
  const { error: productsError } = await supabase
    .from('products')
    .update({ is_active: true })
    .eq('vendor_id', vendorId);

  if (productsError) {
    throw new Error(
      `Erreur lors de la réactivation des produits du vendeur : ${productsError.message}`
    );
  }
}

/**
 * Returns vendors whose contract_end_date falls within the next `daysAhead` days.
 *
 * Requirements: C5.5, C6.2
 */
export async function getExpiringContracts(daysAhead: number): Promise<VendorContract[]> {
  const now = new Date();
  const future = new Date(now);
  future.setDate(now.getDate() + daysAhead);

  const { data, error } = await supabase
    .from('vendors')
    .select('id, name, contract_end_date, status')
    .eq('status', 'active')
    .gte('contract_end_date', now.toISOString().split('T')[0])
    .lte('contract_end_date', future.toISOString().split('T')[0]);

  if (error) {
    throw new Error(
      `Erreur lors de la récupération des contrats expirant bientôt : ${error.message}`
    );
  }

  const rows = (data ?? []) as {
    id: string;
    name: string;
    contract_end_date: string;
    status: string;
  }[];

  return rows.map((row) => ({
    vendorId: row.id,
    name: row.name,
    contractEndDate: new Date(row.contract_end_date),
    status: row.status,
  }));
}

/**
 * Terminates a vendor contract by delegating to FraudDetectionService.terminateVendor.
 * Logs the reason for termination.
 *
 * Requirements: C5.2, C5.4
 */
export async function terminateContract(vendorId: string, reason: string): Promise<void> {
  // Log the reason before terminating
  console.info(
    `[ContractService] Résiliation du contrat du vendeur ${vendorId}. Raison : ${reason}`
  );

  await terminateVendor(vendorId);
}
