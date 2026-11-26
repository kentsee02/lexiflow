import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Eye, Sparkles, Volume2 } from 'lucide-react';
import type { AccentType, ReviewQuality, VocabCard } from '../types';
import { playAudioOrSpeak } from '../utils/speech';
import { previewReviewIntervals } from '../utils/srs';
import { FlashcardDeck } from './FlashcardDeck';

interface ReviewWorkspaceProps {
  vocab: VocabCard[];
  dueCards: VocabCard[];
  accent: AccentType;
  speechRate: number;
  onReviewCard: (id: string, quality: ReviewQuality) => Promise<void>;
  onToggleStatus: (card: VocabCard) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenAddModal: () => void;
  onGoReading: () => void;
  onSpeechUnsupported: () => void;
}

export function ReviewWorkspace({
  vocab,
  dueCards,
  accent,
  speechRate,
  onReviewCard,
  onToggleStatus,
  onDelete,
  onOpenAddModal,
  onGoReading,
  onSpeechUnsupported,
}: ReviewWorkspaceProps) {
  const [subTab, setSubTab] = useState<'srs' | 'library'>(dueCards.length > 0 ? 'srs' : 'library');
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeCard = dueCards[0] ?? null;

  useEffect(() => {
    setRevealed(false);
  }, [activeCard?.id]);

  const handleRate = async (quality: ReviewQuality) => {
    if (!activeCard || submitting) return;
    setSubmitting(true);
    try {
      await onReviewCard(activeCard.id, quality);
      setRevealed(false);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (subTab !== 'srs' || !activeCard) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.code === 'Space' && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        if (e.key === '1') void handleRate(1);
        if (e.key === '2') void handleRate(2);
        if (e.key === '3') void handleRate(3);
        if (e.key === '4') void handleRate(4);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subTab, activeCard, revealed, submitting]);

  const previews = activeCard
    ? activeCard.intervalPreviews ?? previewReviewIntervals(activeCard)
    : null;

  const speak = async (audioUrl: string | undefined, text: string) => {
    const ok = await playAudioOrSpeak(audioUrl, text, accent, speechRate);
    if (!ok) onSpeechUnsupported();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="section-toolbar">
        <div className="subtabs">
          <button
            type="button"
            className={`subtab ${subTab === 'srs' ? 'active' : ''}`}
            onClick={() => setSubTab('srs')}
          >
            SRS 专注复习（待复习 {dueCards.length}）
          </button>
          <button
            type="button"
            className={`subtab ${subTab === 'library' ? 'active' : ''}`}
            onClick={() => setSubTab('library')}
          >
            全部词库（{vocab.length}）
          </button>
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
          {subTab === 'srs' ? '快捷键：空格翻面 · 1-4 评分' : '点击卡片即可翻转查看双语例句'}
        </span>
      </div>

      {subTab === 'srs' ? (
        activeCard && previews ? (
          <div className="srs-stage">
            <div className="srs-card">
              <div className="card-top">
                <div className="badges">
                  <span className="badge level">{activeCard.level}</span>
                  <span className="badge">{activeCard.category}</span>
                  <span className="badge">
                    {activeCard.status === 'mastered'
                      ? '已掌握'
                      : activeCard.status === 'learning'
                        ? '学习中'
                        : '新词'}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                  剩余 {dueCards.length} 词
                </span>
              </div>

              <div style={{ textAlign: 'center', padding: '14px 0' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '2.7rem', fontWeight: 400 }}>
                    {activeCard.word}
                  </h2>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    onClick={() => void speak(activeCard.audioUrl, activeCard.word)}
                    aria-label="Pronounce word"
                  >
                    <Volume2 size={18} />
                  </button>
                </div>

                <div style={{ marginTop: 6, color: 'var(--ink-muted)', fontSize: '0.92rem' }}>
                  <span className="phonetic">{activeCard.phonetic || '/.../'}</span>
                  <span> · {activeCard.partOfSpeech}</span>
                </div>

                {revealed && (
                  <div
                    style={{
                      marginTop: 22,
                      paddingTop: 18,
                      borderTop: '1px solid var(--border-hairline)',
                      textAlign: 'left',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                      {activeCard.meaningZh}
                    </p>
                    {activeCard.definitionEn && (
                      <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
                        {activeCard.definitionEn}
                      </p>
                    )}
                    <div className="card-example-box" style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: '0.92rem' }}>{activeCard.example}</p>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => void speak(undefined, activeCard.example)}
                          aria-label="Read example"
                        >
                          <Volume2 size={15} />
                        </button>
                      </div>
                      {activeCard.exampleZh && (
                        <p className="zh" style={{ fontSize: '0.86rem' }}>
                          {activeCard.exampleZh}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!revealed ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px 16px' }}
                  onClick={() => setRevealed(true)}
                >
                  <Eye size={17} />
                  <span>显示释义与例句（Space）</span>
                </button>
              ) : (
                <div className="srs-rating-grid">
                  <button
                    type="button"
                    className="srs-rate-btn again"
                    disabled={submitting}
                    onClick={() => void handleRate(1)}
                  >
                    <span>1 · 重来 Again</span>
                    <span className="srs-rate-interval">{previews[1]}</span>
                  </button>
                  <button
                    type="button"
                    className="srs-rate-btn hard"
                    disabled={submitting}
                    onClick={() => void handleRate(2)}
                  >
                    <span>2 · 困难 Hard</span>
                    <span className="srs-rate-interval">{previews[2]}</span>
                  </button>
                  <button
                    type="button"
                    className="srs-rate-btn good"
                    disabled={submitting}
                    onClick={() => void handleRate(3)}
                  >
                    <span>3 · 记得 Good</span>
                    <span className="srs-rate-interval">{previews[3]}</span>
                  </button>
                  <button
                    type="button"
                    className="srs-rate-btn easy"
                    disabled={submitting}
                    onClick={() => void handleRate(4)}
                  >
                    <span>4 · 秒懂 Easy</span>
                    <span className="srs-rate-interval">{previews[4]}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="panel-card" style={{ textAlign: 'center', padding: '42px 24px' }}>
            <div className="stat-icon" style={{ width: 52, height: 52, margin: '0 auto 12px' }}>
              <CheckCircle2 size={26} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.35rem' }}>太棒了，当前没有待复习单词！</h2>
            <p style={{ color: 'var(--ink-secondary)', maxWidth: 460, margin: '8px auto 20px' }}>
              你可以前往双语精读页面划词收集新表达，或到全部词库里自由翻阅巩固。
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={onGoReading}>
                <BookOpen size={16} />
                <span>去精读收词</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSubTab('library')}>
                <Sparkles size={16} />
                <span>浏览全部词库</span>
              </button>
            </div>
          </div>
        )
      ) : (
        <FlashcardDeck
          items={vocab}
          accent={accent}
          speechRate={speechRate}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          onOpenAddModal={onOpenAddModal}
          onSpeechUnsupported={onSpeechUnsupported}
        />
      )}
    </div>
  );
}
