// ============================================================
// Krantos Platform - useSpeech: read chatbot answers aloud
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { isKnownFemaleVoice, pickFemaleFrenchVoice, speechChunks } from '../lib/speech';

const STORAGE_KEY = 'krantos:chatAudio';

function readPref(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch { return false; }
}

export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const [autoRead, setAutoReadState] = useState<boolean>(() => supported && readPref());
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const runRef = useRef(0);

  // Voices load asynchronously in most browsers
  useEffect(() => {
    if (!supported) return;
    const load = () => { voiceRef.current = pickFemaleFrenchVoice(window.speechSynthesis.getVoices()); };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    runRef.current++;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback((id: string, text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const run = ++runRef.current;
    const chunks = speechChunks(text);
    if (chunks.length === 0) return;

    const voice = voiceRef.current ?? pickFemaleFrenchVoice(window.speechSynthesis.getVoices());
    setSpeakingId(id);
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = voice?.lang ?? 'fr-FR';
      if (voice) u.voice = voice;
      // Warm, clear and confident: natural pace, slightly brighter tone
      u.rate = 1;
      u.pitch = isKnownFemaleVoice(voice) ? 1.05 : 1.2;
      u.volume = 1;
      if (i === chunks.length - 1) {
        u.onend = () => { if (runRef.current === run) setSpeakingId(null); };
      }
      u.onerror = () => { if (runRef.current === run) setSpeakingId(null); };
      window.speechSynthesis.speak(u);
    });
  }, [supported]);

  const setAutoRead = useCallback((on: boolean) => {
    setAutoReadState(on);
    try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
    if (!on) stop();
  }, [stop]);

  return { supported, autoRead, setAutoRead, speak, stop, speakingId };
}
