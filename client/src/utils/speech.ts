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

export async function playAudioOrSpeak(
  audioUrl: string | undefined,
  fallbackText: string,
  accent: AccentType = 'en-US',
  rate = 1.0
): Promise<boolean> {
  if (audioUrl && audioUrl.trim()) {
    try {
      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      await audio.play();
      return true;
    } catch {
      // Fallback to Web Speech API below
    }
  }
  return speakEnglish(fallbackText, accent, rate);
}
