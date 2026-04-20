// ============================================================
// Krantos Platform — ChatbotEngine
// Requirements: 8.2, 8.3, 8.4, 8.5
// ============================================================
//
// Moteur de réponse automatique basé sur des mots-clés, alimenté
// par les données produit du CRM Supabase.
//
// Mots-clés supportés :
//   prix / coût / tarif          → price
//   caractéristiques / specs /
//   puissance                    → power_rating + description
//   durée de vie / longévité /
//   fiabilité / qualité /
//   garantie                     → description
// ============================================================

import { supabase } from '../lib/supabase';
import type { Product } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Keyword map
// ---------------------------------------------------------------------------

/**
 * Maps each recognised keyword (lowercase) to one or more product fields.
 * The order of entries matters: the first matching keyword wins.
 */
const KEYWORD_MAP: Array<{ keywords: string[]; fields: Array<keyof Product> }> = [
  {
    keywords: ['prix', 'coût', 'cout', 'tarif'],
    fields: ['price'],
  },
  {
    keywords: ['caractéristiques', 'caracteristiques', 'specs', 'puissance'],
    fields: ['power_rating', 'description'],
  },
  {
    keywords: ['durée de vie', 'duree de vie', 'longévité', 'longevite', 'fiabilité', 'fiabilite', 'qualité', 'qualite', 'garantie'],
    fields: ['description'],
  },
];

// ---------------------------------------------------------------------------
// extractKeywords
// ---------------------------------------------------------------------------

/**
 * Extracts recognised keywords from a user message.
 *
 * The message is normalised to lowercase before matching so that the
 * comparison is case-insensitive (Requirement 8.2).
 *
 * @param message - Raw user message
 * @returns Array of matched keywords (may be empty)
 */
export function extractKeywords(message: string): string[] {
  const normalised = message.toLowerCase();
  const matched: string[] = [];

  for (const entry of KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (normalised.includes(kw)) {
        matched.push(kw);
      }
    }
  }

  return matched;
}

// ---------------------------------------------------------------------------
// buildResponse (internal helper)
// ---------------------------------------------------------------------------

/**
 * Builds a natural-language French response from the product data and the
 * matched keywords.
 *
 * @param product  - Product fetched from Supabase
 * @param keywords - Keywords extracted from the user message
 * @returns French response string
 */
function buildResponse(product: Product, keywords: string[]): string {
  const parts: string[] = [];

  // Determine which field groups are needed based on matched keywords
  const needsPrice = keywords.some((kw) =>
    ['prix', 'coût', 'cout', 'tarif'].includes(kw)
  );
  const needsSpecs = keywords.some((kw) =>
    ['caractéristiques', 'caracteristiques', 'specs', 'puissance'].includes(kw)
  );
  const needsDescription = keywords.some((kw) =>
    [
      'durée de vie', 'duree de vie',
      'longévité', 'longevite',
      'fiabilité', 'fiabilite',
      'qualité', 'qualite',
      'garantie',
    ].includes(kw)
  );

  if (needsPrice) {
    const formattedPrice = Number(product.price).toLocaleString('fr-FR');
    parts.push(`Le prix de ce produit est ${formattedPrice} FCFA.`);
  }

  if (needsSpecs) {
    parts.push(`Ce produit a une puissance de ${product.power_rating} kVA.`);
    if (product.description) {
      parts.push(`Description : ${product.description}`);
    }
  }

  if (needsDescription && !needsSpecs) {
    // Only description-related keywords (durée de vie, garantie, etc.)
    if (product.description) {
      parts.push(`Voici les informations disponibles sur ce produit : ${product.description}`);
    } else {
      parts.push(
        "Aucune information détaillée n'est disponible pour ce produit. " +
        'Nous vous recommandons de contacter le vendeur directement pour plus de détails.'
      );
    }
  }

  if (parts.length === 0) {
    return buildFallbackResponse();
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// buildFallbackResponse (internal helper)
// ---------------------------------------------------------------------------

/**
 * Returns the generic fallback response in French (Requirement 8.4).
 */
function buildFallbackResponse(): string {
  return (
    "Je n'ai pas compris votre question. " +
    'Vous pouvez me poser des questions sur le prix, les caractéristiques, la puissance, ' +
    "la durée de vie, la fiabilité ou la garantie de ce produit. " +
    'Si vous avez besoin d\'une assistance personnalisée, n\'hésitez pas à contacter le vendeur directement.'
  );
}

// ---------------------------------------------------------------------------
// processMessage
// ---------------------------------------------------------------------------

/**
 * Processes a user message in the context of a specific product and returns
 * a French response.
 *
 * Steps (Requirement 8.2):
 * 1. Extract keywords from the message
 * 2. Fetch the product from Supabase
 * 3. Build and return the response
 *
 * If no keyword is recognised, returns the generic fallback response
 * (Requirement 8.4).
 *
 * @param message   - Raw user message
 * @param productId - UUID of the product to query
 * @returns French response string
 * @throws Error if the Supabase query fails
 */
export async function processMessage(
  message: string,
  productId: string
): Promise<string> {
  // Step 1 — Extract keywords (Requirement 8.2)
  const keywords = extractKeywords(message);

  // Step 2 — Fallback early if no keyword recognised (Requirement 8.4)
  if (keywords.length === 0) {
    return buildFallbackResponse();
  }

  // Step 3 — Fetch product from Supabase
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error) {
    throw new Error(
      `[ChatbotEngine] Erreur lors de la récupération du produit : ${error.message}`
    );
  }

  if (!data) {
    return (
      "Désolé, je n'ai pas pu trouver les informations sur ce produit. " +
      'Veuillez contacter le vendeur directement pour obtenir de l\'aide.'
    );
  }

  // Step 4 — Build and return the French response (Requirement 8.3, 8.5)
  return buildResponse(data as Product, keywords);
}

// ---------------------------------------------------------------------------
// Namespace export (ergonomic usage)
// ---------------------------------------------------------------------------

/**
 * Namespace export for ergonomic usage:
 * ```ts
 * import { ChatbotEngine } from './services/chatbotEngine';
 * const keywords = ChatbotEngine.extractKeywords(message);
 * const response = await ChatbotEngine.processMessage(message, productId);
 * ```
 */
export const ChatbotEngine = {
  extractKeywords,
  processMessage,
};
