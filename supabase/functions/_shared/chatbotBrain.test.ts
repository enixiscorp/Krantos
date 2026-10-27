import { describe, it, expect } from 'vitest';
import {
  CALCULATION_GUIDE,
  CALCULATION_QUESTION,
  CONTACT_GUIDE,
  answerFromRules,
  chatSuggestions,
  detectPlatformIntent,
  findProgrammedAnswer,
  normalizeText,
} from './chatbotBrain.ts';

const faq = [
  { question: 'Quels sont vos délais de livraison ?', answer: 'Livraison en 48h à Lomé.' },
  { question: 'Proposez-vous une garantie ?', answer: 'Garantie 12 mois pièces et main d’œuvre.' },
  { question: 'Acceptez-vous le paiement mobile money ?', answer: 'Oui, Flooz et T-Money.' },
];

describe('normalizeText', () => {
  it('retire accents, majuscules et ponctuation', () => {
    expect(normalizeText('  Quels DÉLAIS, de livraison ?! ')).toBe('quels delais de livraison');
  });
});

describe('findProgrammedAnswer', () => {
  it('reconnaît la question exacte', () => {
    expect(findProgrammedAnswer('Quels sont vos délais de livraison ?', faq)?.answer).toBe('Livraison en 48h à Lomé.');
  });

  it('reconnaît une formulation différente (sans accents, autres mots)', () => {
    expect(findProgrammedAnswer('delai livraison svp', faq)?.answer).toBe('Livraison en 48h à Lomé.');
    expect(findProgrammedAnswer('vous avez une garantie sur les produits ?', faq)?.answer)
      .toBe('Garantie 12 mois pièces et main d’œuvre.');
    expect(findProgrammedAnswer('je peux payer par mobile money ?', faq)?.answer).toBe('Oui, Flooz et T-Money.');
  });

  it('ne répond pas à côté quand rien ne correspond', () => {
    expect(findProgrammedAnswer('quelle est la couleur du groupe ?', faq)).toBeNull();
    expect(findProgrammedAnswer('bonjour', faq)).toBeNull();
  });

  it('ignore les réponses programmées vides', () => {
    expect(findProgrammedAnswer('livraison', [{ question: 'livraison', answer: '  ' }])).toBeNull();
  });
});

describe('detectPlatformIntent', () => {
  it('reconnaît les questions sur le calcul', () => {
    for (const q of [
      'Comment calculer ma puissance ?',
      'comment faire le calcul',
      'Quelle puissance me faut-il pour ma maison ?',
      'comment utiliser la plateforme',
      'je veux dimensionner mon installation',
    ]) {
      expect(detectPlatformIntent(q), q).toBe('calculation');
    }
  });

  it('reconnaît les questions pour contacter le vendeur', () => {
    expect(detectPlatformIntent('Comment contacter le vendeur ?')).toBe('contact');
    expect(detectPlatformIntent('comment commander ?')).toBe('contact');
  });

  it('ignore les autres questions', () => {
    expect(detectPlatformIntent('Quel est le prix ?')).toBeNull();
  });
});

describe('answerFromRules', () => {
  it('les réponses programmées de l’entreprise passent avant le guide', () => {
    const custom = [{ question: 'Comment calculer ma puissance ?', answer: 'Réponse maison.' }];
    expect(answerFromRules('comment calculer ma puissance', { suggestions: custom })?.response).toBe('Réponse maison.');
  });

  it('donne le guide de calcul et de contact', () => {
    expect(answerFromRules('comment faire le calcul ?', { suggestions: faq })?.response).toBe(CALCULATION_GUIDE);
    expect(answerFromRules('comment contacter le vendeur', { suggestions: faq })?.response).toBe(CONTACT_GUIDE);
  });

  it('utilise les infos de l’entreprise', () => {
    const res = answerFromRules('où se trouve votre boutique ?', { address: 'Bè, Lomé' });
    expect(res?.response).toContain('Bè, Lomé');
  });

  it('renvoie null quand aucune règle ne s’applique', () => {
    expect(answerFromRules('raconte une blague', { suggestions: faq })).toBeNull();
  });
});

describe('chatSuggestions', () => {
  it('ajoute toujours la question sur le calcul', () => {
    const s = chatSuggestions(faq);
    expect(s).toContain(CALCULATION_QUESTION);
    expect(s.length).toBeLessThanOrEqual(4);
  });
});

describe('guides', () => {
  it('ne contiennent pas de tiret cadratin', () => {
    expect(CALCULATION_GUIDE + CONTACT_GUIDE).not.toContain('\u2014');
  });
});
