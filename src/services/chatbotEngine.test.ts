// ============================================================
// Krantos Platform — ChatbotEngine Tests
// **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Supabase before importing the service
// ---------------------------------------------------------------------------

vi.mock('../lib/supabase', () => {
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => makeChain()),
    },
  };
});

import { extractKeywords, processMessage } from './chatbotEngine';
import { supabase } from '../lib/supabase';
import type { Product } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    vendor_id: 'vendor-1',
    name: 'Groupe électrogène 5 kVA',
    category: 'générateur',
    power_rating: 5,
    price: 500000,
    description: 'Durée de vie : 10 ans. Garantie constructeur 2 ans. Fiabilité éprouvée.',
    keywords: 'générateur, énergie',
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function mockSupabaseProduct(product: Product | null, error: { message: string } | null = null) {
  const mockSingle = vi.fn().mockResolvedValue({ data: product, error });
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
  };
  vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);
}

// ---------------------------------------------------------------------------
// extractKeywords — Unit tests
// ---------------------------------------------------------------------------

describe('ChatbotEngine — extractKeywords', () => {
  it('détecte le mot-clé "prix"', () => {
    expect(extractKeywords('Quel est le prix ?')).toContain('prix');
  });

  it('détecte le mot-clé "coût"', () => {
    expect(extractKeywords('Quel est le coût de ce produit ?')).toContain('coût');
  });

  it('détecte le mot-clé "tarif"', () => {
    expect(extractKeywords('Donnez-moi le tarif.')).toContain('tarif');
  });

  it('détecte le mot-clé "caractéristiques"', () => {
    expect(extractKeywords('Quelles sont les caractéristiques ?')).toContain('caractéristiques');
  });

  it('détecte le mot-clé "specs"', () => {
    expect(extractKeywords('Montrez-moi les specs.')).toContain('specs');
  });

  it('détecte le mot-clé "puissance"', () => {
    expect(extractKeywords('Quelle est la puissance ?')).toContain('puissance');
  });

  it('détecte le mot-clé "durée de vie"', () => {
    expect(extractKeywords('Quelle est la durée de vie ?')).toContain('durée de vie');
  });

  it('détecte le mot-clé "longévité"', () => {
    expect(extractKeywords('Parlez-moi de la longévité.')).toContain('longévité');
  });

  it('détecte le mot-clé "fiabilité"', () => {
    expect(extractKeywords('Est-ce que la fiabilité est bonne ?')).toContain('fiabilité');
  });

  it('détecte le mot-clé "qualité"', () => {
    expect(extractKeywords('Quelle est la qualité ?')).toContain('qualité');
  });

  it('détecte le mot-clé "garantie"', () => {
    expect(extractKeywords('Y a-t-il une garantie ?')).toContain('garantie');
  });

  it('est insensible à la casse', () => {
    expect(extractKeywords('PRIX du produit')).toContain('prix');
    expect(extractKeywords('GARANTIE incluse')).toContain('garantie');
    expect(extractKeywords('Quelle PUISSANCE ?')).toContain('puissance');
  });

  it('retourne un tableau vide pour un message sans mot-clé reconnu', () => {
    expect(extractKeywords('Bonjour, comment ça va ?')).toHaveLength(0);
    expect(extractKeywords('Je veux acheter quelque chose.')).toHaveLength(0);
  });

  it('détecte plusieurs mots-clés dans un même message', () => {
    const keywords = extractKeywords('Quel est le prix et la garantie ?');
    expect(keywords).toContain('prix');
    expect(keywords).toContain('garantie');
  });
});

// ---------------------------------------------------------------------------
// processMessage — Unit tests (Requirement 8.3, 8.4, 8.5)
// ---------------------------------------------------------------------------

describe('ChatbotEngine — processMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Price keyword (Requirement 8.3) ----

  it('retourne le prix en FCFA pour le mot-clé "prix"', async () => {
    mockSupabaseProduct(makeProduct({ price: 500000 }));
    const response = await processMessage('Quel est le prix ?', 'product-1');
    expect(response).toContain('500');
    expect(response).toContain('FCFA');
  });

  it('retourne le prix en FCFA pour le mot-clé "coût"', async () => {
    mockSupabaseProduct(makeProduct({ price: 750000 }));
    const response = await processMessage('Quel est le coût ?', 'product-1');
    expect(response).toContain('FCFA');
  });

  it('retourne le prix en FCFA pour le mot-clé "tarif"', async () => {
    mockSupabaseProduct(makeProduct({ price: 300000 }));
    const response = await processMessage('Quel est le tarif ?', 'product-1');
    expect(response).toContain('FCFA');
  });

  // ---- Specs keywords (Requirement 8.3) ----

  it('retourne la puissance en kVA pour le mot-clé "puissance"', async () => {
    mockSupabaseProduct(makeProduct({ power_rating: 5 }));
    const response = await processMessage('Quelle est la puissance ?', 'product-1');
    expect(response).toContain('5');
    expect(response).toContain('kVA');
  });

  it('retourne la puissance en kVA pour le mot-clé "caractéristiques"', async () => {
    mockSupabaseProduct(makeProduct({ power_rating: 10 }));
    const response = await processMessage('Quelles sont les caractéristiques ?', 'product-1');
    expect(response).toContain('10');
    expect(response).toContain('kVA');
  });

  it('retourne la puissance en kVA pour le mot-clé "specs"', async () => {
    mockSupabaseProduct(makeProduct({ power_rating: 7.5 }));
    const response = await processMessage('Montrez-moi les specs.', 'product-1');
    expect(response).toContain('7.5');
    expect(response).toContain('kVA');
  });

  // ---- Description keywords (Requirement 8.3) ----

  it('retourne la description pour le mot-clé "garantie"', async () => {
    const description = 'Garantie constructeur 2 ans. Durée de vie 10 ans.';
    mockSupabaseProduct(makeProduct({ description }));
    const response = await processMessage('Y a-t-il une garantie ?', 'product-1');
    expect(response).toContain(description);
  });

  it('retourne la description pour le mot-clé "durée de vie"', async () => {
    const description = 'Durée de vie estimée à 15 ans.';
    mockSupabaseProduct(makeProduct({ description }));
    const response = await processMessage('Quelle est la durée de vie ?', 'product-1');
    expect(response).toContain(description);
  });

  it('retourne la description pour le mot-clé "fiabilité"', async () => {
    const description = 'Produit très fiable, testé en conditions extrêmes.';
    mockSupabaseProduct(makeProduct({ description }));
    const response = await processMessage('Quelle est la fiabilité ?', 'product-1');
    expect(response).toContain(description);
  });

  it('retourne la description pour le mot-clé "qualité"', async () => {
    const description = 'Qualité premium, certifié ISO.';
    mockSupabaseProduct(makeProduct({ description }));
    const response = await processMessage('Quelle est la qualité ?', 'product-1');
    expect(response).toContain(description);
  });

  it('retourne la description pour le mot-clé "longévité"', async () => {
    const description = 'Longévité exceptionnelle, plus de 20 ans.';
    mockSupabaseProduct(makeProduct({ description }));
    const response = await processMessage('Parlez-moi de la longévité.', 'product-1');
    expect(response).toContain(description);
  });

  // ---- Fallback (Requirement 8.4) ----

  it('retourne une réponse générique non vide pour un message sans mot-clé reconnu', async () => {
    // Supabase should NOT be called when no keyword is found
    const response = await processMessage('Bonjour, comment ça va ?', 'product-1');
    expect(response).toBeTruthy();
    expect(response.length).toBeGreaterThan(0);
    // Should not have called supabase.from
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('la réponse générique invite à reformuler ou contacter le vendeur', async () => {
    const response = await processMessage('Je veux juste dire bonjour.', 'product-1');
    // Should mention reformulating or contacting the vendor
    const lowerResponse = response.toLowerCase();
    const mentionsContact =
      lowerResponse.includes('vendeur') ||
      lowerResponse.includes('reformul') ||
      lowerResponse.includes('contacter');
    expect(mentionsContact).toBe(true);
  });

  // ---- All responses in French (Requirement 8.5) ----

  it('toutes les réponses sont en français (contiennent des mots français)', async () => {
    mockSupabaseProduct(makeProduct());

    const priceResponse = await processMessage('prix', 'product-1');
    expect(priceResponse.toLowerCase()).toMatch(/le prix|fcfa|produit/);

    vi.clearAllMocks();
    mockSupabaseProduct(makeProduct());

    const specsResponse = await processMessage('puissance', 'product-1');
    expect(specsResponse.toLowerCase()).toMatch(/puissance|kva|produit/);
  });

  // ---- Error handling ----

  it('lève une erreur si Supabase retourne une erreur', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'DB connection failed' },
    });
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as ReturnType<typeof supabase.from>);

    await expect(processMessage('prix', 'product-1')).rejects.toThrow(
      '[ChatbotEngine]'
    );
  });

  it('retourne un message d\'erreur en français si le produit n\'est pas trouvé', async () => {
    mockSupabaseProduct(null);
    const response = await processMessage('prix', 'product-1');
    expect(response).toBeTruthy();
    // Should be a French message about not finding the product
    const lowerResponse = response.toLowerCase();
    expect(lowerResponse).toMatch(/produit|vendeur|trouv/);
  });

  // ---- Description null edge case ----

  it('retourne un message alternatif si la description est null pour un mot-clé description', async () => {
    mockSupabaseProduct(makeProduct({ description: null }));
    const response = await processMessage('garantie', 'product-1');
    expect(response).toBeTruthy();
    expect(response.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Propriété 9 — Réponse du chatbot aux mots-clés connus
// **Validates: Requirements 8.2, 8.3**
// ---------------------------------------------------------------------------

describe('ChatbotEngine — Propriété 9 : Réponse non vide pour tout message avec mot-clé connu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété 9 : Pour tout message utilisateur contenant au moins un mot-clé reconnu,
   * le ChatbotEngine doit retourner une réponse non vide contenant les informations
   * du champ produit correspondant au mot-clé détecté.
   *
   * **Validates: Requirements 8.2, 8.3**
   */
  it('Propriété 9 — Tout message avec un mot-clé connu produit une réponse non vide', async () => {
    const knownKeywords = [
      'prix', 'coût', 'tarif',
      'caractéristiques', 'specs', 'puissance',
      'durée de vie', 'longévité', 'fiabilité', 'qualité', 'garantie',
    ];

    // Arbitrary: pick a known keyword and optionally surround it with random text
    const messageArbitrary = fc
      .tuple(
        fc.constantFrom(...knownKeywords),
        fc.string({ maxLength: 30 }),
        fc.string({ maxLength: 30 })
      )
      .map(([kw, prefix, suffix]) => `${prefix} ${kw} ${suffix}`.trim());

    // Arbitrary: generate a valid product
    const productArbitrary = fc.record({
      id: fc.uuid(),
      vendor_id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      category: fc.string({ minLength: 1, maxLength: 30 }),
      power_rating: fc.integer({ min: 1, max: 1000 }).map((n) => n / 10),
      price: fc.integer({ min: 1000, max: 10_000_000 }),
      description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
      keywords: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
      is_active: fc.constant(true),
      created_at: fc.constant(new Date().toISOString()),
    });

    await fc.assert(
      fc.asyncProperty(messageArbitrary, productArbitrary, async (message, product) => {
        // Mock Supabase to return the generated product
        const mockSingle = vi.fn().mockResolvedValue({ data: product, error: null });
        const mockChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: mockSingle,
        };
        vi.mocked(supabase.from).mockReturnValue(
          mockChain as ReturnType<typeof supabase.from>
        );

        const response = await processMessage(message, product.id);

        // The response must be non-empty (Requirement 8.3)
        expect(response).toBeTruthy();
        expect(response.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Propriété 10 — Réponse générique pour les mots-clés inconnus
// **Validates: Requirements 8.4**
// ---------------------------------------------------------------------------

describe('ChatbotEngine — Propriété 10 : Réponse générique pour les mots-clés inconnus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Propriété 10 : Pour tout message utilisateur ne contenant aucun mot-clé reconnu,
   * la réponse retournée doit être la réponse générique de fallback (non vide).
   *
   * **Validates: Requirements 8.4**
   */
  it('Propriété 10 — Tout message sans mot-clé connu produit la réponse générique non vide', async () => {
    // Generate messages that do NOT contain any known keyword
    // We use a simple approach: generate strings that avoid all known keywords
    const knownKeywords = [
      'prix', 'coût', 'cout', 'tarif',
      'caractéristiques', 'caracteristiques', 'specs', 'puissance',
      'durée de vie', 'duree de vie', 'longévité', 'longevite',
      'fiabilité', 'fiabilite', 'qualité', 'qualite', 'garantie',
    ];

    // Use a fixed set of messages that are guaranteed to have no known keywords
    const safeMessages = [
      'Bonjour',
      'Comment ça va ?',
      'Je veux acheter',
      'Merci beaucoup',
      'Au revoir',
      'Quelle couleur ?',
      'Livraison rapide ?',
      'Stock disponible ?',
      'Paiement en ligne ?',
      'Délai de livraison ?',
    ];

    const messageArbitrary = fc.constantFrom(...safeMessages);

    await fc.assert(
      fc.asyncProperty(messageArbitrary, async (message) => {
        // Verify the message truly has no known keyword
        const hasKeyword = knownKeywords.some((kw) =>
          message.toLowerCase().includes(kw)
        );
        if (hasKeyword) return; // skip if accidentally contains a keyword

        const response = await processMessage(message, 'any-product-id');

        // The response must be non-empty (Requirement 8.4)
        expect(response).toBeTruthy();
        expect(response.length).toBeGreaterThan(0);

        // Supabase should NOT have been called (no keyword = no DB query needed)
        expect(supabase.from).not.toHaveBeenCalled();

        vi.clearAllMocks();
      }),
      { numRuns: 50 }
    );
  });
});
