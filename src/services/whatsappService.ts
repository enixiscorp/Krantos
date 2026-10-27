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
 * Builds the WhatsApp message sent by the client to the vendor.
 *
 * Plain text only: no emojis, because some WhatsApp apps (Windows desktop
 * in particular) turn them into "?" when they come from a wa.me link.
 * Structure: greeting, short introduction, then sections with bullets
 * (contact details, calculated power, appliances, chosen product).
 *
 * @param user        - User info (full name, phone, location)
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

  const applianceLines = appliances.map((a) => {
    const detail = a.unit === 'A'
      ? `${a.power} A (environ ${Math.round(a.power * 220)} W)`
      : `${a.power} W`;
    return `• ${a.name} x${a.quantity} : ${detail} par unité`;
  });

  const lines: string[] = [
    `Bonjour${vendorName ? ' ' + vendorName : ''},`,
    '',
    `Je suis ${user.fullName}. Je vous contacte via Krantos suite à mon calcul de consommation électrique.`,
    '',
    'Mes coordonnées :',
    `• Téléphone : ${user.phone}`,
    `• Localisation : ${user.location}`,
    '',
    `J'ai calculé mes besoins : ${totalWatts} W, soit ${totalKVA} kVA.`,
    '',
    'Appareils :',
    ...applianceLines,
  ];

  if (product) {
    lines.push(
      '',
      'Générateur choisi :',
      `• Modèle : ${product.name}`,
      `• Prix : ${formatAmount(product.price)} FCFA`
    );
  }

  lines.push(
    '',
    `Je souhaite obtenir plus d'informations sur la disponibilité, la livraison et l'installation.`,
    '',
    'Merci,',
    firstName
  );

  return lines.join('\n');
}

/** "850000" -> "850 000" with a regular space (narrow spaces can break in WhatsApp). */
function formatAmount(value: number): string {
  return Math.round(Number(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** "0.26" -> "0,26" (French decimal comma). */
function formatKva(value: number): string {
  return Number(value).toFixed(2).replace('.', ',');
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
  /** Kept for compatibility; not shown (the model name already states its power). */
  productPowerRating?: number | null;
  vendorName?: string | null;
}): string {
  const firstName = firstNameFromFullName(opts.clientName);
  const intro = opts.vendorName
    ? `Je suis ${opts.vendorName}, votre vendeur sur Krantos.`
    : 'Je suis votre vendeur sur Krantos.';

  const lines = [
    `Bonjour ${firstName},`,
    '',
    `${intro} Je vous contacte suite à votre simulation de consommation électrique.`,
  ];

  const summary: string[] = [];
  if (opts.totalKVA != null && Number.isFinite(Number(opts.totalKVA))) {
    const kva = Number(opts.totalKVA);
    summary.push(`• Consommation estimée : ${formatKva(kva)} kVA (environ ${Math.round(kva * 1000)} W)`);
  }
  if (opts.productName) summary.push(`• Modèle choisi : ${opts.productName}`);
  if (summary.length) lines.push('', 'Récapitulatif de votre demande :', ...summary);

  lines.push(
    '',
    'Je reste à votre disposition pour :',
    '• la disponibilité du produit',
    '• la livraison',
    "• l'installation",
    '',
    'Bien cordialement,',
    opts.vendorName || 'Votre vendeur Krantos'
  );
  return lines.join('\n');
}

/** Message du gestionnaire Krantos vers le vendeur, à propos d'une demande client. */
export function buildAdminToVendorMessage(opts: {
  vendorName?: string | null;
  clientName: string;
  clientPhone?: string | null;
  location?: string | null;
  totalKVA?: number | null;
  productName?: string | null;
}): string {
  const lines = [
    `Bonjour${opts.vendorName ? ' ' + opts.vendorName : ''},`,
    '',
    `L'équipe Krantos vous contacte au sujet de la demande de ${opts.clientName}.`,
    '',
    'Détails de la demande :',
    `• Client : ${opts.clientName}`,
  ];
  if (opts.clientPhone) lines.push(`• Téléphone : ${opts.clientPhone}`);
  if (opts.location) lines.push(`• Localisation : ${opts.location}`);
  if (opts.totalKVA != null && Number.isFinite(Number(opts.totalKVA))) {
    lines.push(`• Consommation estimée : ${formatKva(Number(opts.totalKVA))} kVA`);
  }
  if (opts.productName) lines.push(`• Modèle choisi : ${opts.productName}`);
  lines.push(
    '',
    'Merci de nous confirmer le suivi de ce client.',
    '',
    'Bien cordialement,',
    "L'équipe Krantos"
  );
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
 * Uses the `mark_lead_contacted` RPC (SECURITY DEFINER) because anonymous
 * visitors are not allowed to UPDATE leads directly (RLS).
 * See supabase/migrations/20240029_mark_lead_contacted.sql
 *
 * @param leadId - The UUID of the lead to update
 * @returns true if the lead went from 'new' to 'contacted', false if nothing
 *          was updated (lead not saved yet, or already past 'new')
 * @throws Error if the Supabase call fails
 */
export async function updateLeadStatus(
  leadId: string,
  _status: 'contacted' = 'contacted'
): Promise<boolean> {
  const { data, error } = await supabase.rpc('mark_lead_contacted', { p_lead_id: leadId });

  if (error) {
    throw new Error(
      `[WhatsAppService] Erreur lors de la mise à jour du statut du lead : ${error.message}`
    );
  }
  return data === true;
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
