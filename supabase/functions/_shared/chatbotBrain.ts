// ============================================================
// Krantos Platform - Chatbot brain (shared)
// ============================================================
// Pure TypeScript, no Deno/browser APIs: used by the `chatbot-message` Edge
// Function AND by the web app (local answers when the server is unreachable).
//
// 1. Programmed answers (per company): a question typed differently from the
//    programmed one (accents, plural, word order, extra words) still matches.
// 2. Platform guide: "how do I calculate my power?" gets a step-by-step answer.
// 3. Company info keywords: delivery, address, consumption, usage.

export interface ProgrammedAnswer {
  question: string;
  answer: string;
}

export interface ChatbotKnowledge {
  suggestions?: ProgrammedAnswer[] | null;
  address?: string | null;
  delivery_info?: string | null;
  consumption_info?: string | null;
  usage_info?: string | null;
}

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'et', 'ou', 'a', 'au', 'aux', 'en',
  'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'ce', 'cet', 'cette', 'ces', 'se', 'sa', 'son', 'ses',
  'je', 'j', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'm', 'te', 't', 'y',
  'mon', 'ma', 'mes', 'votre', 'vos', 'notre', 'nos', 'leur', 'leurs', 'qui', 'que', 'qu', 'quoi',
  'est', 'sont', 'etre', 'ai', 'as', 'avez', 'avons', 'ont', 'c', 's', 'n', 'ne', 'pas', 'plus',
  'tres', 'bien', 'svp', 'stp', 'merci', 'bonjour', 'salut', 'il', 'y', 'ca', 'cela', 'ceci',
  'est-ce', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'combien', 'pourquoi', 'quand', 'ou',
  'peux', 'peut', 'pouvez', 'puis', 'faut', 'dois', 'doit', 'voudrais', 'veux', 'aimerais', 'savoir',
  // Question verbs that carry no topic ("Proposez-vous une garantie ?")
  'proposez', 'proposer', 'propose', 'offrez', 'offrir', 'offre', 'disposez', 'disposer', 'faites',
  'faire', 'fait', 'avoir', 'existe', 'acceptez', 'accepter', 'accepte',
]);

/** Lowercase, no accents, no punctuation, single spaces. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Very small French stemmer: plural and a few common endings. */
function stem(word: string): string {
  let w = word;
  if (w.length > 4 && /(ments|ment)$/.test(w)) w = w.replace(/(ments|ment)$/, '');
  if (w.length > 3 && /[sx]$/.test(w)) w = w.slice(0, -1);
  if (w.length > 4 && /(er|ez|e)$/.test(w)) w = w.replace(/(er|ez|e)$/, '');
  return w;
}

/** Meaningful word stems of a text. */
export function keywordsOf(text: string): string[] {
  return [...new Set(
    normalizeText(text)
      .split(' ')
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
      .map(stem)
  )];
}

function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // "livr" ~ "livraison", "garanti" ~ "garantie"
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
}

// ---------------------------------------------------------------------------
// 1. Programmed answers
// ---------------------------------------------------------------------------

/** Similarity between the client's message and a programmed question (0..1). */
export function questionSimilarity(message: string, question: string): number {
  const nm = normalizeText(message);
  const nq = normalizeText(question);
  if (!nm || !nq) return 0;
  if (nm === nq) return 1;

  const m = keywordsOf(message);
  const q = keywordsOf(question);
  if (m.length === 0 || q.length === 0) return 0;

  const shared = q.filter((qw) => m.some((mw) => wordsMatch(qw, mw))).length;
  const coverage = shared / q.length; // how much of the programmed question is present
  const precision = shared / m.length; // how much of the message is about it
  return 0.7 * coverage + 0.3 * precision;
}

/** Best programmed answer for the message, or null when none is close enough. */
export function findProgrammedAnswer(
  message: string,
  answers: ProgrammedAnswer[] | null | undefined,
  threshold = 0.55
): (ProgrammedAnswer & { score: number }) | null {
  let best: (ProgrammedAnswer & { score: number }) | null = null;
  for (const a of answers ?? []) {
    if (!a?.question?.trim() || !a?.answer?.trim()) continue;
    const score = questionSimilarity(message, a.question);
    if (score >= threshold && (!best || score > best.score)) best = { ...a, score };
  }
  return best;
}

// ---------------------------------------------------------------------------
// 2. Platform guide (how to calculate / how to contact the vendor)
// ---------------------------------------------------------------------------

export const CALCULATION_QUESTION = 'Comment calculer ma puissance ?';
export const CONTACT_QUESTION = 'Comment contacter le vendeur ?';

export const CALCULATION_GUIDE = [
  'Voici comment calculer votre puissance sur Krantos, en 5 étapes :',
  '1. Cliquez sur « Calculer ma puissance » en haut de la page.',
  '2. Indiquez votre prénom, votre nom, votre téléphone et votre ville.',
  "3. Ajoutez vos appareils un par un : choisissez-les dans la liste (réfrigérateur, télévision, climatiseur...) ou saisissez le nom, la quantité et la puissance écrite sur l'étiquette, en watts (W) ou en ampères (A).",
  '4. Cliquez à nouveau sur « Calculer ma puissance » : le total en watts et en kVA s’affiche aussitôt, avec une marge de sécurité de 30 % déjà incluse.',
  '5. Choisissez le générateur proposé qui vous convient, puis contactez le vendeur sur WhatsApp en un clic.',
  'Astuce : si l’étiquette indique des ampères, Krantos les convertit automatiquement (1 A = 220 W).',
].join('\n');

export const CONTACT_GUIDE = [
  'Pour contacter le vendeur :',
  '1. Faites votre calcul de puissance, puis cliquez sur « Choisir » sous le générateur qui vous intéresse.',
  '2. Sur la page de résultat, cliquez sur « Contacter sur WhatsApp ».',
  '3. Un message déjà rempli avec votre prénom, vos appareils et le modèle choisi s’ouvre : il vous suffit de l’envoyer.',
  'Vous pouvez aussi appeler directement le vendeur avec le bouton « Appeler ».',
].join('\n');

export type PlatformIntent = 'calculation' | 'contact' | null;

/** Detects questions about using the platform itself. */
export function detectPlatformIntent(message: string): PlatformIntent {
  const t = ` ${normalizeText(message)} `;
  const howTo = /\b(comment|etape|etapes|proceder|marche|fonctionne|utiliser|aide|guide|expliqu)/.test(t);

  const calculation =
    /\b(calcul|calcule|calculer|calculez|dimension|dimensionner|simulation|simuler)/.test(t) ||
    /\bquelle puissance\b|\bpuissance (qu il|necessaire|il me faut|me faut|adaptee|pour ma|pour mon|de mon installation)/.test(t) ||
    (howTo && /\b(plateforme|krantos|site|application|appli)\b/.test(t));
  if (calculation) return 'calculation';

  const contact =
    /\b(contacter|joindre|appeler|whatsapp|commander|commande|acheter|achat)\b/.test(t) &&
    (howTo || /\bvendeur\b/.test(t));
  if (contact) return 'contact';

  return null;
}

export function platformGuide(intent: Exclude<PlatformIntent, null>): string {
  return intent === 'calculation' ? CALCULATION_GUIDE : CONTACT_GUIDE;
}

// ---------------------------------------------------------------------------
// 3. Company info keywords
// ---------------------------------------------------------------------------

export function findCompanyInfo(message: string, k: ChatbotKnowledge, vendorPhone?: string | null): string | null {
  const t = ` ${normalizeText(message)} `;
  const has = (re: RegExp) => re.test(t);

  if (has(/\b(consommation|energie|recharge|batterie|autonomie)/)) return k.consumption_info?.trim() || null;
  if (has(/\b(usage|appareil|connecter|alimenter|brancher|supporter|supporte)/)) return k.usage_info?.trim() || null;
  if (has(/\b(boutique|adresse|situe|situee|livraison|livrer|livrez|ou etes|trouver|magasin)/)) {
    const parts = [
      k.address?.trim() ? `Notre boutique est située ici : ${k.address.trim()}.` : '',
      k.delivery_info?.trim() ? `Pour la livraison : ${k.delivery_info.trim()}` : '',
    ].filter(Boolean);
    if (parts.length) return parts.join('\n');
    return vendorPhone
      ? `Contactez-nous au ${vendorPhone} pour connaître notre adresse et nos conditions de livraison.`
      : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Suggestions shown under the chat
// ---------------------------------------------------------------------------

export function chatSuggestions(answers: ProgrammedAnswer[] | null | undefined, max = 4): string[] {
  const programmed = (answers ?? []).map((a) => a?.question?.trim()).filter(Boolean) as string[];
  const list = [...programmed.slice(0, max - 1)];
  if (!list.some((q) => detectPlatformIntent(q) === 'calculation')) list.push(CALCULATION_QUESTION);
  return list.slice(0, max);
}

// ---------------------------------------------------------------------------
// Rule-based answer (everything except the AI)
// ---------------------------------------------------------------------------

export type RuleSource = 'programmed' | 'guide' | 'company';

/** Answer from programmed answers, platform guide or company info; null if none applies. */
export function answerFromRules(
  message: string,
  knowledge: ChatbotKnowledge,
  vendorPhone?: string | null
): { response: string; source: RuleSource } | null {
  // The company's own programmed answers always win
  const programmed = findProgrammedAnswer(message, knowledge.suggestions);
  if (programmed) return { response: programmed.answer, source: 'programmed' };

  const intent = detectPlatformIntent(message);
  if (intent) return { response: platformGuide(intent), source: 'guide' };

  const info = findCompanyInfo(message, knowledge, vendorPhone);
  if (info) return { response: info, source: 'company' };

  return null;
}
