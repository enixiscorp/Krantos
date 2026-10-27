import { describe, it, expect } from 'vitest';
import { pickFemaleFrenchVoice, scoreVoice, speakableText, speechChunks } from './speech';

const voice = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

describe('choix de la voix', () => {
  it('préfère une voix féminine française naturelle', () => {
    const voices = [
      voice('Microsoft Paul - French (France)', 'fr-FR'),
      voice('Microsoft Hortense - French (France)', 'fr-FR'),
      voice('Microsoft Denise Online (Natural) - French (France)', 'fr-FR'),
      voice('Google US English', 'en-US'),
    ];
    expect(pickFemaleFrenchVoice(voices)?.name).toContain('Denise');
  });

  it('écarte les voix masculines et non françaises', () => {
    expect(scoreVoice(voice('Microsoft Paul - French (France)', 'fr-FR'))).toBe(-1);
    expect(scoreVoice(voice('Thomas', 'fr-FR'))).toBe(-1);
    expect(scoreVoice(voice('Samantha', 'en-US'))).toBe(-1);
    expect(pickFemaleFrenchVoice([voice('Thomas', 'fr-FR')])).toBeNull();
  });

  it('reconnaît la voix Google française (féminine)', () => {
    expect(scoreVoice(voice('Google français', 'fr-FR'))).toBeGreaterThan(10);
  });
});

describe('texte lu à voix haute', () => {
  it('lit les unités et les étapes clairement', () => {
    const t = speakableText('1. Total : 3200 W, soit 3,2 kVA.\n• Prix : 850 000 FCFA (1 A = 220 W)');
    expect(t).toContain('Étape 1 :');
    expect(t).toContain('3200 watts');
    expect(t).toContain('kilovoltampères');
    expect(t).toContain('francs CFA');
    expect(t).toContain('1 ampères égale 220 watts');
    expect(t).not.toContain('•');
  });

  it('découpe les longues réponses en morceaux courts', () => {
    const long = 'Phrase courte. '.repeat(40);
    const chunks = speechChunks(long, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
  });
});
