import type { AccentType } from '../types';

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakEnglish(text: string, accent: AccentType = 'en-US', rate = 1.0): boolean {
  if (!isSpeechSupported() || !text.trim()) {
    return false;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent;
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  const exactVoice = voices.find((v) => v.lang.toLowerCase().startsWith(accent.toLowerCase()));
  const fallbackVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  if (exactVoice || fallbackVoice) {
    utterance.voice = exactVoice || fallbackVoice || null;
  }

  window.speechSynthesis.speak(utterance);
  return true;
}
