// ============================================================
// Krantos Platform - Spoken answers (Web Speech API)
// ============================================================
// Uses the voices built into the device/browser: free, no server, works on
// phones. We pick the best FEMALE French voice available.

const FEMALE_VOICE_NAMES = [
  'denise', 'eloise', 'vivienne', 'hortense', 'julie', 'sylvie', 'caroline', 'ariane', 'charline',
  'amelie', 'audrey', 'aurelie', 'marie', 'celine', 'lea', 'virginie', 'chantal', 'brigitte',
  'coralie', 'josephine', 'yvette', 'jacqueline', 'google francais', 'google français',
];
const MALE_VOICE_NAMES = [
  'paul', 'henri', 'remy', 'antoine', 'jean', 'thomas', 'daniel', 'jacques', 'gerard', 'claude',
  'alain', 'fabrice', 'nicolas', 'guillaume', 'mathieu', 'maurice', 'yves', 'louis',
];

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Score of a voice: French + female + natural sounding wins. -1 = not usable. */
export function scoreVoice(voice: Pick<SpeechSynthesisVoice, 'name' | 'lang'>): number {
  const lang = voice.lang.toLowerCase();
  if (!lang.startsWith('fr')) return -1;
  const name = plain(voice.name);
  if (MALE_VOICE_NAMES.some((n) => new RegExp(`\\b${n}\\b`).test(name))) return -1;

  let score = 1;
  if (FEMALE_VOICE_NAMES.some((n) => name.includes(plain(n)))) score += 10;
  if (/natural|neural|online|premium|enhanced/.test(name)) score += 5;
  if (lang === 'fr-fr' || lang === 'fr_fr') score += 2;
  return score;
}

export function pickFemaleFrenchVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = scoreVoice(v);
    if (s > bestScore) { best = v; bestScore = s; }
  }
  return bestScore >= 0 ? best : null;
}

/** True when the chosen voice is known to be female (else we raise the pitch a little). */
export function isKnownFemaleVoice(voice: SpeechSynthesisVoice | null): boolean {
  return !!voice && FEMALE_VOICE_NAMES.some((n) => plain(voice.name).includes(plain(n)));
}

/** Text adapted for reading aloud (units, symbols, steps, emojis). */
export function speakableText(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[«»"]/g, '')
    .replace(/^\s*[•*-]\s*/gm, '')
    .replace(/^\s*(\d+)\.\s+/gm, 'Étape $1 : ')
    .replace(/\bkVA\b/g, 'kilovoltampères')
    .replace(/\bFCFA\b/g, 'francs CFA')
    .replace(/(\d)\s?kW\b/g, '$1 kilowatts')
    .replace(/(\d)\s?W\b/g, '$1 watts')
    .replace(/(\d)\s?A\b/g, '$1 ampères')
    .replace(/\(W\)/g, '').replace(/\(A\)/g, '')
    .replace(/\s=\s/g, ' égale ')
    .replace(/(\d)\s?%/g, '$1 pour cent')
    .replace(/https?:\/\/\S+/g, 'le lien affiché')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Splits a long answer into short chunks (some browsers cut long utterances). */
export function speechChunks(text: string, maxLength = 220): string[] {
  const chunks: string[] = [];
  for (const line of speakableText(text).split(/\n+/)) {
    const sentences = line.match(/[^.!?;:]+[.!?;:]*/g) ?? [line];
    let current = '';
    for (const s of sentences) {
      if ((current + s).length > maxLength && current) {
        chunks.push(current.trim());
        current = '';
      }
      current += s;
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks.filter(Boolean);
}
