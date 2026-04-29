// ============================================================
// Krantos Platform — WhatsAppService
// Requirements: 7.1, 7.2, 7.3, 7.4, 14.5
// ============================================================
//
// IMPORTANT — Security constraint (Requirement 14.5 / Propriété 17):
// `sendWhatsAppMessage` enforces vendor status validation internally.
// Passing a `vendorStatus` other than 'active' will throw an error,
// preventing any WhatsApp redirect to a pending or suspended vendor.
// ============================================================

import { supabase } from '../lib/supabase';
import type { ApplianceInput, Product } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal user data required to build the WhatsApp message.
 */
export interface WhatsAppUser {
  fullName: string;
  phone: string;
  location: string;
}

// ---------------------------------------------------------------------------
// buildWhatsAppMessage
// ---------------------------------------------------------------------------

/**
 * Builds the structured WhatsApp message to be sent to the vendor.
 *
 * Format (Requirement 7.1 / Propriété 7):
 * ```
 * Bonjour, je suis [Prénom Nom] (📞 [téléphone], 📍 [localisation]).
 * J'ai calculé mes besoins : [totalWatts] W / [totalKVA] kVA.
 * Appareils : [liste appareils].
 * Produit recommandé : [nom produit] — [prix] FCFA.
 * Je souhaite obtenir plus d'informations.
 * ```
 *
 * @param user        - User info (first_name, last_name, phone, location)
 * @param appliances  - List of appliances entered by the user
 * @param totalWatts  - Total power in Watts (with safety margin)
 * @param totalKVA    - Total power in kVA (with safety margin)
 * @param product     - Recommended product
 * @returns The formatted message string
 */
export function buildWhatsAppMessage(
  user: WhatsAppUser,
  appliances: ApplianceInput[],
  totalWatts: number,
  totalKVA: number,
  product: Product
): string {

  // Build appliance list: "Climatiseur x2, Réfrigérateur x1, ..."
  const applianceList = appliances
    .map((a) => `${a.name} x${a.quantity}`)
    .join(', ');

  // Format price with thousands separator (FCFA convention)
  const formattedPrice = Number(product.price).toLocaleString('fr-FR');

  const message =
    `Bonjour, je suis ${user.fullName} (📞 ${user.phone}, 📍 ${user.location}).\n` +
    `J'ai calculé mes besoins : ${totalWatts} W / ${totalKVA} kVA.\n` +
    `Appareils : ${applianceList}.\n` +
    `Produit recommandé : ${product.name} — ${formattedPrice} FCFA.\n` +
    `Je souhaite obtenir plus d'informations.`;

  return message;
}

// ---------------------------------------------------------------------------
// sendWhatsAppMessage
// ---------------------------------------------------------------------------

/**
 * Encodes the message and opens the WhatsApp redirect URL in a new tab.
 *
 * Requirements 7.2 / Propriété 8:
 * - URL format: `https://wa.me/{vendorPhone}?text={encodedMessage}`
 * - Message is encoded with `encodeURIComponent`
 *
 * Requirement 7.4 / Scénario 4:
 * - Throws an error if `vendorPhone` is null, undefined, or empty string.
 *   The caller should catch this error and display a toast + show the vendor
 *   email as an alternative contact method.
 *
 * Security (Requirement 14.5 / Propriété 17):
 * - Throws an error if `vendorStatus` is provided and is not `'active'`.
 *   Only vendors validated by the admin (status = 'active') may receive
 *   WhatsApp redirects. Redirecting to a `pending` or `suspended` vendor
 *   is strictly forbidden.
 *
 * @param vendorPhone  - The vendor's WhatsApp phone number
 * @param message      - The pre-built message string (from buildWhatsAppMessage)
 * @param vendorStatus - Optional vendor status; if provided, must be 'active'
 * @throws Error if vendorPhone is null, undefined, or empty
 * @throws Error if vendorStatus is provided and is not 'active'
 */
export function sendWhatsAppMessage(
  vendorPhone: string | null | undefined,
  message: string,
  vendorStatus?: string | null
): void {
  // Propriété 17 / Requirement 14.5: reject non-active vendors
  if (vendorStatus !== undefined && vendorStatus !== null && vendorStatus !== 'active') {
    throw new Error(
      `[WhatsAppService] Redirection WhatsApp refusée : le vendeur a le statut "${vendorStatus}". ` +
      'Seuls les vendeurs avec le statut "active" peuvent recevoir des redirections WhatsApp.'
    );
  }

  if (!vendorPhone || vendorPhone.trim() === '') {
    throw new Error(
      '[WhatsAppService] Le numéro de téléphone du vendeur est manquant ou vide. ' +
      'Impossible de générer le lien WhatsApp.'
    );
  }

  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${vendorPhone}?text=${encodedMessage}`;

  window.open(url, '_blank');
}

// ---------------------------------------------------------------------------
// updateLeadStatus
// ---------------------------------------------------------------------------

/**
 * Updates the lead status to 'contacted' in the Supabase `leads` table.
 *
 * Called after the WhatsApp link is opened (Requirement 7.3).
 *
 * @param leadId - The UUID of the lead to update
 * @throws Error if the Supabase update fails
 */
export async function updateLeadStatus(
  leadId: string,
  status: 'contacted'
): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId);

  if (error) {
    throw new Error(
      `[WhatsAppService] Erreur lors de la mise à jour du statut du lead : ${error.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// Namespace export (ergonomic usage)
// ---------------------------------------------------------------------------

/**
 * Namespace export for ergonomic usage:
 * ```ts
 * import { WhatsAppService } from './services/whatsappService';
 * const msg = WhatsAppService.buildWhatsAppMessage(user, appliances, watts, kva, product);
 * WhatsAppService.sendWhatsAppMessage(vendor.phone, msg);
 * await WhatsAppService.updateLeadStatus(leadId, 'contacted');
 * ```
 */
export const WhatsAppService = {
  buildWhatsAppMessage,
  sendWhatsAppMessage,
  updateLeadStatus,
};
