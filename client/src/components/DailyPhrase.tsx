import { ChevronLeft, ChevronRight, Sparkles, Volume2 } from 'lucide-react';
import type { AccentType, DailyPhrase as DailyPhraseType } from '../types';
import { speakEnglish } from '../utils/speech';

interface DailyPhraseProps {
  phrase: DailyPhraseType | null;
  accent: AccentType;
  speechRate: number;
  onShift: (delta: number) => void;
  onSpeechUnsupported: () => void;
}

export function DailyPhrase({
  phrase,
  accent,
  speechRate,
  onShift,
  onSpeechUnsupported,
}: DailyPhraseProps) {
  if (!phrase) return null;

  const handleSpeak = () => {
    const ok = speakEnglish(`${phrase.phrase}. ${phrase.example}`, accent, speechRate);
    if (!ok) onSpeechUnsupported();
  };

  return (
    <section className="hero-card" aria-label="Daily expression">
      <div>
        <div className="hero-eyebrow">
          <Sparkles size={14} />
          <span>Daily Expression · 每日地道表达</span>
        </div>
        <div className="hero-phrase-row">
          <h1 className="hero-phrase">{phrase.phrase}</h1>
          <span className="phonetic">{phrase.phonetic}</span>
        </div>
        <p className="hero-meaning">{phrase.meaningZh}</p>
        <p className="hero-context">{phrase.context}</p>
        <div className="hero-example">
          <p>{phrase.example}</p>
          <p className="zh">{phrase.exampleZh}</p>
        </div>
      </div>

      <div className="hero-actions">
        <button type="button" className="btn btn-primary" onClick={handleSpeak}>
          <Volume2 size={17} />
          <span>朗读句子</span>
        </button>

        <div className="pager-group">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => onShift(-1)}
            aria-label="Previous daily phrase"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="pager-count">
            {phrase.index + 1} / {phrase.total}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => onShift(1)}
            aria-label="Next daily phrase"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
