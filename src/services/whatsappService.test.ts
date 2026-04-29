// ============================================================
// Krantos Platform — WhatsAppService Tests (Unit + Property-Based)
// **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { buildWhatsAppMessage, sendWhatsAppMessage } from './whatsappService';
import type { WhatsAppUser } from './whatsappService';
import type { ApplianceInput, Product } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Fixtures partagées pour les tests unitaires
// ---------------------------------------------------------------------------

const sampleUser: WhatsAppUser = {
  fullName: 'Kofi Mensah',
  phone: '+22890123456',
  location: 'Lomé, Tokoin',
};

const sampleAppliances: ApplianceInput[] = [
  { name: 'Climatiseur', quantity: 2, power: 1500, unit: 'W' },
  { name: 'Réfrigérateur', quantity: 1, power: 200, unit: 'W' },
];

const sampleProduct: Product = {
  id: 'prod-001',
  vendor_id: 'vendor-001',
  name: 'Groupe électrogène 5kVA',
  category: 'Groupe électrogène',
  power_rating: 5000,
  price: 850000,
  description: 'Groupe électrogène fiable pour usage domestique',
  keywords: 'groupe,électrogène,5kva',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests unitaires — buildWhatsAppMessage
// **Validates: Requirements 7.1**
// ---------------------------------------------------------------------------

describe('buildWhatsAppMessage — Tests unitaires', () => {
  it('7.1 — Le message contient le nom complet de l\'utilisateur', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    expect(message).toContain('Kofi Mensah');
  });

  it('7.1 — Le message contient le numéro de téléphone de l\'utilisateur', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    expect(message).toContain('+22890123456');
  });

  it('7.1 — Le message contient la localisation de l\'utilisateur', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    expect(message).toContain('Lomé, Tokoin');
  });

  it('7.1 — Le message contient la puissance totale en W', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    expect(message).toContain('3200');
    expect(message).toContain('W');
  });

  it('7.1 — Le message contient la puissance totale en kVA', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    expect(message).toContain('3.2');
    expect(message).toContain('kVA');
  });

  it('7.1 — Le message contient la liste des appareils avec leurs quantités', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    expect(message).toContain('Climatiseur');
    expect(message).toContain('x2');
    expect(message).toContain('Réfrigérateur');
    expect(message).toContain('x1');
  });

  it('7.1 — Le message contient le nom du produit recommandé', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    expect(message).toContain('Groupe électrogène 5kVA');
  });

  it('7.1 — Le message contient le prix en FCFA', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    expect(message).toContain('FCFA');
    // Le prix 850000 doit apparaître (formaté ou non)
    expect(message).toMatch(/850[\s\u202f]?000/);
  });

  it('7.1 — Le message respecte le format défini dans le design', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    // Vérifie la structure générale du message
    expect(message).toMatch(/^Bonjour, je suis/);
    expect(message).toContain('📞');
    expect(message).toContain('📍');
    expect(message).toContain("J'ai calculé mes besoins");
    expect(message).toContain('Appareils :');
    expect(message).toContain('Produit recommandé :');
    expect(message).toContain('Je souhaite obtenir plus d\'informations');
  });

  it('7.1 — Le message gère correctement un seul appareil', () => {
    const singleAppliance: ApplianceInput[] = [
      { name: 'Ventilateur', quantity: 3, power: 75, unit: 'W' },
    ];
    const message = buildWhatsAppMessage(sampleUser, singleAppliance, 225, 0.225, sampleProduct);
    expect(message).toContain('Ventilateur x3');
  });

  it('7.1 — Le message gère correctement plusieurs appareils séparés par des virgules', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    // Les appareils doivent être séparés par ", "
    expect(message).toContain('Climatiseur x2, Réfrigérateur x1');
  });
});

// ---------------------------------------------------------------------------
// Tests unitaires — sendWhatsAppMessage : encodage URL et format wa.me
// **Validates: Requirements 7.2**
// ---------------------------------------------------------------------------

describe('sendWhatsAppMessage — Tests unitaires : encodage URL et format wa.me', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('7.2 — L\'URL générée commence par https://wa.me/', () => {
    sendWhatsAppMessage('22890123456', 'Bonjour test');
    const calledUrl = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^https:\/\/wa\.me\//);
  });

  it('7.2 — L\'URL contient le numéro de téléphone du vendeur', () => {
    sendWhatsAppMessage('22890123456', 'Bonjour test');
    const calledUrl = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('22890123456');
  });

  it('7.2 — L\'URL contient le message encodé avec encodeURIComponent', () => {
    const message = 'Bonjour, je suis Kofi Mensah (📞 +229, 📍 Lomé).';
    sendWhatsAppMessage('22890123456', message);
    const calledUrl = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const expectedEncoded = encodeURIComponent(message);
    expect(calledUrl).toContain(`?text=${expectedEncoded}`);
  });

  it('7.2 — Le format exact de l\'URL est https://wa.me/{phone}?text={encodedMessage}', () => {
    const phone = '22890123456';
    const message = 'Message de test';
    sendWhatsAppMessage(phone, message);
    const expectedUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    expect(window.open).toHaveBeenCalledWith(expectedUrl, '_blank');
  });

  it('7.2 — window.open est appelé avec "_blank" comme second argument', () => {
    sendWhatsAppMessage('22890123456', 'Test');
    expect(window.open).toHaveBeenCalledWith(expect.any(String), '_blank');
  });

  it('7.2 — Les caractères spéciaux du message sont correctement encodés', () => {
    const message = 'Bonjour & test = 100% / "ok"';
    sendWhatsAppMessage('22890123456', message);
    const calledUrl = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // Les caractères &, =, %, /, " doivent être encodés
    expect(calledUrl).not.toContain('Bonjour & test');
    expect(calledUrl).toContain(encodeURIComponent(message));
  });

  it('7.2 — Un message complet buildWhatsAppMessage est correctement encodé dans l\'URL', () => {
    const message = buildWhatsAppMessage(sampleUser, sampleAppliances, 3200, 3.2, sampleProduct);
    const phone = '22890123456';
    sendWhatsAppMessage(phone, message);
    const expectedUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    expect(window.open).toHaveBeenCalledWith(expectedUrl, '_blank');
  });
});

// ---------------------------------------------------------------------------
// Tests unitaires — sendWhatsAppMessage : numéro de téléphone null/vide
// **Validates: Requirements 7.4**
// ---------------------------------------------------------------------------

describe('sendWhatsAppMessage — Tests unitaires : numéro de téléphone null/vide', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('7.4 — Lève une erreur si vendorPhone est null', () => {
    expect(() => sendWhatsAppMessage(null, 'Message test')).toThrow();
  });

  it('7.4 — Lève une erreur si vendorPhone est undefined', () => {
    expect(() => sendWhatsAppMessage(undefined, 'Message test')).toThrow();
  });

  it('7.4 — Lève une erreur si vendorPhone est une chaîne vide', () => {
    expect(() => sendWhatsAppMessage('', 'Message test')).toThrow();
  });

  it('7.4 — Lève une erreur si vendorPhone est composé uniquement d\'espaces', () => {
    expect(() => sendWhatsAppMessage('   ', 'Message test')).toThrow();
  });

  it('7.4 — window.open n\'est PAS appelé si vendorPhone est null', () => {
    try { sendWhatsAppMessage(null, 'Message test'); } catch { /* attendu */ }
    expect(window.open).not.toHaveBeenCalled();
  });

  it('7.4 — window.open n\'est PAS appelé si vendorPhone est vide', () => {
    try { sendWhatsAppMessage('', 'Message test'); } catch { /* attendu */ }
    expect(window.open).not.toHaveBeenCalled();
  });

  it('7.4 — Un numéro de téléphone valide ne lève pas d\'erreur', () => {
    expect(() => sendWhatsAppMessage('22890123456', 'Message test')).not.toThrow();
    expect(window.open).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Arbitraries (pour les tests property-based)
// ---------------------------------------------------------------------------

/** Generates a non-empty string (no control characters) suitable for names, phone, location. */
const nonEmptyString = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generates a valid WhatsAppUser. */
const whatsAppUserArb: fc.Arbitrary<WhatsAppUser> = fc.record({
  fullName: nonEmptyString,
  phone: nonEmptyString,
  location: nonEmptyString,
});

/** Generates a valid ApplianceInput. */
const applianceArb: fc.Arbitrary<ApplianceInput> = fc.record({
  name: nonEmptyString,
  quantity: fc.integer({ min: 1, max: 100 }),
  power: fc.double({ min: 0.01, max: 100_000, noNaN: true, noDefaultInfinity: true }),
  unit: fc.constantFrom('W' as const, 'A' as const, 'V' as const),
});

/** Generates a non-empty list of appliances. */
const appliancesArb: fc.Arbitrary<ApplianceInput[]> = fc.array(applianceArb, { minLength: 1, maxLength: 20 });

/** Generates a strictly positive totalWatts value. */
const totalWattsArb = fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

/** Generates a strictly positive totalKVA value. */
const totalKVAArb = fc.double({ min: 0.01, max: 1_000, noNaN: true, noDefaultInfinity: true });

/** Generates a valid Product (only fields used by buildWhatsAppMessage are required). */
const productArb: fc.Arbitrary<Product> = fc.record({
  id: fc.uuid(),
  vendor_id: fc.uuid(),
  name: nonEmptyString,
  category: nonEmptyString,
  power_rating: fc.double({ min: 0, max: 100_000, noNaN: true, noDefaultInfinity: true }),
  price: fc.integer({ min: 1, max: 10_000_000 }),
  description: fc.option(nonEmptyString, { nil: null }),
  keywords: fc.option(nonEmptyString, { nil: null }),
  is_active: fc.boolean(),
  created_at: fc.constant(new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Propriété 7 — Contenu du message WhatsApp
// **Validates: Requirements 7.1**
// ---------------------------------------------------------------------------

describe('WhatsAppService — Propriété 7 : Contenu du message WhatsApp', () => {
  /**
   * Propriété 7 : Pour tout utilisateur et produit valides, le message généré par
   * `buildWhatsAppMessage` doit contenir :
   *   - prénom de l'utilisateur
   *   - nom de l'utilisateur
   *   - numéro de téléphone
   *   - localisation
   *   - puissance totale en W
   *   - puissance totale en kVA
   *   - nom du produit recommandé
   *   - prix en FCFA
   *   - au moins un nom d'appareil de la liste
   *
   * **Validates: Requirements 7.1**
   */
  it('Propriété 7 — Le message contient toutes les informations requises', () => {
    fc.assert(
      fc.property(
        whatsAppUserArb,
        appliancesArb,
        totalWattsArb,
        totalKVAArb,
        productArb,
        (user, appliances, totalWatts, totalKVA, product) => {
          const message = buildWhatsAppMessage(user, appliances, totalWatts, totalKVA, product);

          // 1. Nom complet de l'utilisateur
          expect(message).toContain(user.fullName);

          // 3. Numéro de téléphone
          expect(message).toContain(user.phone);

          // 4. Localisation
          expect(message).toContain(user.location);

          // 5. Puissance totale en W (the number appears in the message)
          expect(message).toContain(String(totalWatts));

          // 6. Puissance totale en kVA (the number appears in the message)
          expect(message).toContain(String(totalKVA));

          // 7. Nom du produit recommandé
          expect(message).toContain(product.name);

          // 8. "FCFA" présent dans le message (prix en FCFA)
          expect(message).toContain('FCFA');

          // 9. Au moins un nom d'appareil de la liste
          const atLeastOneAppliance = appliances.some((a) => message.includes(a.name));
          expect(atLeastOneAppliance).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Propriété 8 — Format de l'URL WhatsApp
// **Validates: Requirements 7.2**
// ---------------------------------------------------------------------------

describe("WhatsAppService — Propriété 8 : Format de l'URL WhatsApp", () => {
  /** Stub window.open before each test so we can capture the URL without opening a browser tab. */
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  /** Restore the original window.open after each test. */
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Propriété 8 : Pour tout numéro de téléphone vendeur valide et tout message,
   * l'URL passée à `window.open` doit être exactement :
   *   `https://wa.me/{vendorPhone}?text={encodeURIComponent(message)}`
   * et le second argument doit être `'_blank'`.
   *
   * **Validates: Requirements 7.2**
   */
  it("Propriété 8 — L'URL produite est de la forme https://wa.me/{vendor_phone}?text={encodeURIComponent(message)}", () => {
    /** Arbitrary: a non-empty string of digits (8–15 digits) simulating a phone number. */
    const vendorPhoneArb = fc.stringMatching(/^[0-9]{8,15}$/);

    /** Arbitrary: any non-empty string as the message body. */
    const messageArb = fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(vendorPhoneArb, messageArb, (vendorPhone, message) => {
        // Reset call history between each generated example.
        vi.clearAllMocks();

        sendWhatsAppMessage(vendorPhone, message);

        const expectedUrl = `https://wa.me/${vendorPhone}?text=${encodeURIComponent(message)}`;

        expect(window.open).toHaveBeenCalledOnce();
        expect(window.open).toHaveBeenCalledWith(expectedUrl, '_blank');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Propriété 8 — Cas d'erreur : `sendWhatsAppMessage` doit lever une erreur
   * (et ne jamais appeler `window.open`) lorsque `vendorPhone` est null,
   * undefined ou une chaîne vide / composée uniquement d'espaces.
   *
   * **Validates: Requirements 7.2, 7.4**
   */
  it('Propriété 8 — sendWhatsAppMessage lève une erreur si vendorPhone est null, undefined ou vide', () => {
    /** Arbitrary: null, undefined, empty string, or whitespace-only string. */
    const invalidPhoneArb = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant(''),
      fc
        .string({ maxLength: 20 })
        .map((s) => s.replace(/\S/g, ' '))
        .filter((s) => s.trim() === '')
    );

    /** Arbitrary: any non-empty string as the message body. */
    const messageArb = fc
      .string({ minLength: 1, maxLength: 200 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(invalidPhoneArb, messageArb, (invalidPhone, message) => {
        vi.clearAllMocks();

        expect(() => sendWhatsAppMessage(invalidPhone, message)).toThrow();

        // window.open must NOT have been called when the phone is invalid.
        expect(window.open).not.toHaveBeenCalled();
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Propriété 17 — Restriction des redirections WhatsApp aux vendeurs validés
// **Validates: Requirements 14.5**
// ---------------------------------------------------------------------------

describe('WhatsAppService — Propriété 17 : Restriction aux vendeurs validés', () => {
  /** Stub window.open before each test so we can capture the URL without opening a browser tab. */
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  /** Restore the original window.open after each test. */
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Propriété 17 — Pour tout vendeur avec le statut `pending` ou `suspended`,
   * `sendWhatsAppMessage` doit lever une erreur et ne jamais appeler `window.open`.
   * Aucune redirection vers un vendeur non validé ne doit être possible.
   *
   * **Validates: Requirements 14.5**
   */
  it('Propriété 17 — sendWhatsAppMessage lève une erreur pour tout vendeur pending ou suspended', () => {
    /** Arbitrary: a non-empty string of digits (8–15 digits) simulating a phone number. */
    const vendorPhoneArb = fc.stringMatching(/^[0-9]{8,15}$/);

    /** Arbitrary: any non-empty string as the message body. */
    const messageArb = fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0);

    /** Arbitrary: non-active vendor statuses. */
    const nonActiveStatusArb = fc.constantFrom('pending', 'suspended');

    fc.assert(
      fc.property(vendorPhoneArb, messageArb, nonActiveStatusArb, (vendorPhone, message, status) => {
        vi.clearAllMocks();

        // Must throw for any non-active vendor status.
        expect(() => sendWhatsAppMessage(vendorPhone, message, status)).toThrow();

        // window.open must NEVER be called for a non-active vendor.
        expect(window.open).not.toHaveBeenCalled();
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Propriété 17 — Pour tout vendeur avec le statut `active`,
   * `sendWhatsAppMessage` doit générer le lien `wa.me` et appeler `window.open`.
   * Les vendeurs validés par l'administrateur peuvent recevoir des redirections.
   *
   * **Validates: Requirements 14.5**
   */
  it('Propriété 17 — sendWhatsAppMessage génère le lien wa.me pour tout vendeur active', () => {
    /** Arbitrary: a non-empty string of digits (8–15 digits) simulating a phone number. */
    const vendorPhoneArb = fc.stringMatching(/^[0-9]{8,15}$/);

    /** Arbitrary: any non-empty string as the message body. */
    const messageArb = fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(vendorPhoneArb, messageArb, (vendorPhone, message) => {
        vi.clearAllMocks();

        // Must NOT throw for an active vendor.
        expect(() => sendWhatsAppMessage(vendorPhone, message, 'active')).not.toThrow();

        // window.open must have been called exactly once with the correct wa.me URL.
        const expectedUrl = `https://wa.me/${vendorPhone}?text=${encodeURIComponent(message)}`;
        expect(window.open).toHaveBeenCalledOnce();
        expect(window.open).toHaveBeenCalledWith(expectedUrl, '_blank');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Propriété 17 — Cas limite : lorsque `vendorStatus` est omis (undefined),
   * `sendWhatsAppMessage` ne doit PAS lever d'erreur liée au statut
   * (rétrocompatibilité — la vérification du statut est optionnelle).
   *
   * **Validates: Requirements 14.5**
   */
  it('Propriété 17 — sendWhatsAppMessage ne lève pas d\'erreur de statut si vendorStatus est omis', () => {
    /** Arbitrary: a non-empty string of digits (8–15 digits) simulating a phone number. */
    const vendorPhoneArb = fc.stringMatching(/^[0-9]{8,15}$/);

    /** Arbitrary: any non-empty string as the message body. */
    const messageArb = fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(vendorPhoneArb, messageArb, (vendorPhone, message) => {
        vi.clearAllMocks();

        // When vendorStatus is omitted, no status-related error should be thrown.
        expect(() => sendWhatsAppMessage(vendorPhone, message)).not.toThrow();

        // window.open must have been called.
        expect(window.open).toHaveBeenCalledOnce();
      }),
      { numRuns: 100 }
    );
  });
});
