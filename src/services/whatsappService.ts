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
 * Multi-line message: client identity, calculated power, one line per
 * appliance, the chosen generator (name, power, price), signed with the
 * client's first name.
 *
 * @param user        - User info (first_name, last_name, phone, location)
 * @param appliances  - List of appliances entered by the user
 * @param totalWatts  - Total power in Watts (with safety margin)
 * @param totalKVA    - Total power in kVA (with safety margin)
 * @param product     - Chosen product (optional)
 * @param vendorName  - Vendor name used in the greeting (optional)
 * @returns The formatted message string
 */
export function buildWhatsAppMessage(
  user: WhatsAppUser,
  appliances: ApplianceInput[],
  totalWatts: number,
  totalKVA: number,
  product?: Product | null,
  vendorName?: string | null
): string {
  const firstName = firstNameFromFullName(user.fullName);

  // One line per appliance: "• Climatiseur x2 — 1500 W/unité"
  const applianceLines = appliances
    .map((a) => {
      const detail = a.unit === 'A' ? `${a.power} A (≈ ${Math.round(a.power * 220)} W)` : `${a.power} W`;
      return `• ${a.name} x${a.quantity} — ${detail}/unité`;
    })
    .join('\n');

  const lines: string[] = [
    `Bonjour${vendorName ? ' ' + vendorName : ''}, je suis ${user.fullName} 👋`,
    `📞 ${user.phone} | 📍 ${user.location}`,
    `Je vous contacte via Krantos suite à mon calcul énergétique.`,
    '',
    `⚡ J'ai calculé mes besoins : ${totalWatts} W / ${totalKVA} kVA`,
    '',
    `🔌 Appareils :`,
    applianceLines,
  ];

  if (product) {
    lines.push('', `🛒 Générateur choisi : ${product.name}`);
    if (product.power_rating != null) lines.push(`• Puissance : ${product.power_rating} kVA`);
    lines.push(`• Prix : ${Number(product.price).toLocaleString('fr-FR')} FCFA`);
  }

  lines.push(
    '',
    `Je souhaite obtenir plus d'informations (disponibilité, livraison, installation).`,
    `Merci, ${firstName}.`
  );

  return lines.join('\n');
}

export function firstNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

/** Normalise un numéro Togo (8 chiffres) vers le format international WhatsApp. */
export function normalizeWhatsAppPhone(phone: string): string {
  let num = phone.replace(/\D/g, '');
  if (num.length === 8) num = `228${num}`;
  return num;
}

/** Message du vendeur / gestionnaire vers le client : modèle choisi + consommation. */
export function buildVendorToClientMessage(opts: {
  clientName: string;
  totalKVA?: number | null;
  productName?: string | null;
  productPowerRating?: number | null;
  vendorName?: string | null;
}): string {
  const firstName = firstNameFromFullName(opts.clientName);
  const lines = [
    `Bonjour ${firstName} 👋`,
    `${opts.vendorName ? opts.vendorName : 'Votre vendeur'} vous contacte suite à votre simulation sur Krantos.`,
  ];
  if (opts.totalKVA != null && Number.isFinite(Number(opts.totalKVA))) {
    const kva = Number(opts.totalKVA);
    lines.push(`⚡ Consommation estimée : ${kva.toFixed(2)} kVA (≈ ${Math.round(kva * 1000)} W)`);
  }
  if (opts.productName) {
    const rating = opts.productPowerRating != null ? ` (${opts.productPowerRating} kVA)` : '';
    lines.push(`🛒 Modèle choisi : ${opts.productName}${rating}`);
  }
  lines.push('Je suis disponible pour vous accompagner (disponibilité, livraison, installation).');
  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${normalizeWhatsAppPhone(phone)}?text=${encodeURIComponent(message)}`;
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

  const url = `https://wa.me/${vendorPhone}?text=${encodeURIComponent(message)}`;

  // Must run synchronously inside the click handler, otherwise mobile
  // browsers block the popup. Fall back to same-tab navigation if blocked.
  const opened = window.open(url, '_blank');
  if (!opened) {
    window.location.href = url;
  }
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
  normalizeWhatsAppPhone,
  buildVendorToClientMessage,
  buildWhatsAppUrl,
};
