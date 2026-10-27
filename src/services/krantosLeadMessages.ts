// ============================================================
// Krantos Platform - Messages sent by the Krantos team to a client
// ============================================================
// Used by admins / collaborators (connected to the back-office) when they
// contact a lead on WhatsApp ON BEHALF OF KRANTOS. One template per lead
// status, signed with the first name of the connected team member.
// Plain text only: emojis turn into "?" in some WhatsApp apps.

import type { LeadStatus } from '../lib/supabase';
import { firstNameFromFullName } from './whatsappService';

export interface KrantosLeadMessageInput {
  status: LeadStatus;
  /** Client full name (lead.user_name) */
  clientName: string;
  /** First name of the connected Krantos team member */
  agentFirstName: string;
  vendorName?: string | null;
  productName?: string | null;
}

export const KRANTOS_MESSAGE_LABELS: Record<LeadStatus, string> = {
  new: 'Prise de nouvelles après la mise en relation',
  contacted: 'Remerciement pour l’achat via Krantos',
  converted: 'Remerciement et fidélisation',
  lost: 'Relance énergie de secours',
};

export function buildKrantosLeadMessage(input: KrantosLeadMessageInput): string {
  const client = firstNameFromFullName(input.clientName || '') || 'Madame, Monsieur';
  const agent = input.agentFirstName.trim() || 'L’équipe';
  const vendor = input.vendorName?.trim() || '';
  const product = input.productName?.trim() || '';

  const atVendor = vendor ? ` chez ${vendor}` : '';
  const withVendor = vendor ? ` avec ${vendor}` : ' avec le vendeur';
  const theProduct = product || 'votre équipement';

  const greeting = [`Bonjour ${client},`, ''];
  const signature = ['', 'Bien cordialement,', `${agent}, équipe Krantos`];

  switch (input.status) {
    case 'new':
      return [
        ...greeting,
        `Je suis ${agent}, de l'équipe Krantos. Vous avez récemment utilisé notre plateforme pour calculer vos besoins en énergie${product ? ` et choisir ${product}` : ''}${atVendor}.`,
        '',
        'Nous aimerions avoir de vos nouvelles :',
        `• La mise en relation${withVendor} a-t-elle bien eu lieu ?`,
        '• Votre achat s’est-il bien passé ?',
        '',
        'Votre retour nous aide à améliorer Krantos.',
        ...signature,
      ].join('\n');

    case 'contacted':
      return [
        ...greeting,
        `Nous sommes ravis que vous ayez utilisé Krantos pour votre achat de ${theProduct}${atVendor}.`,
        '',
        'Si vous avez besoin d’aide pour finaliser votre achat, la livraison ou l’installation, répondez simplement à ce message.',
        ...signature,
      ].join('\n');

    case 'converted':
      return [
        ...greeting,
        `Nous sommes ravis que vous ayez acheté ${theProduct}${atVendor} grâce à la plateforme Krantos.`,
        '',
        'Merci pour votre confiance. Nous espérons vous revoir très prochainement sur Krantos.',
        ...signature,
      ].join('\n');

    case 'lost':
    default:
      return [
        ...greeting,
        `Vous aviez commencé votre projet d'achat${product ? ` de ${product}` : ''} via Krantos${atVendor ? `, ${atVendor.trim()}` : ''}.`,
        '',
        'Nous espérons que vous pourrez bientôt vous équiper d’un générateur ou d’un groupe électrogène, pour profiter d’une énergie de secours en cas de délestage.',
        '',
        'Nous restons disponibles pour vous aider à trouver la solution adaptée à votre budget.',
        ...signature,
      ].join('\n');
  }
}
