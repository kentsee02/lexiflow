import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, Search, Volume2 } from 'lucide-react';
import { browseDictionary, type DictionaryBrowseEntry } from '../api/client';
import type { AccentType, CreateVocabPayload } from '../types';
import { playAudioOrSpeak } from '../utils/speech';

interface WordBankBrowserProps {
  savedWordSet: Set<string>;
  accent: AccentType;
  speechRate: number;
  onAddWord: (payload: CreateVocabPayload) => Promise<void>;
  onSpeechUnsupported: () => void;
}

export function WordBankBrowser({
  savedWordSet,
  accent,
  speechRate,
  onAddWord,
  onSpeechUnsupported,
}: WordBankBrowserProps) {
  const [queryInput, setQueryInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DictionaryBrowseEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingWord, setAddingWord] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    browseDictionary({ q: debouncedQuery, page, limit: 18 })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, page]);

  const handleQuickAdd = async (entry: DictionaryBrowseEntry) => {
    setAddingWord(entry.word);
    try {
      await onAddWord({
        word: entry.word,
        phonetic: entry.phonetic,
        audioUrl: entry.audioUrl,
        partOfSpeech: entry.partOfSpeech || 'word',
        meaningZh: entry.meaningZh || entry.definitionEn || entry.word,
        definitionEn: entry.definitionEn,
        example: entry.example || `I am practicing how to use "${entry.word}" naturally in context.`,
        level: 'B2',
        category: 'Daily',
      });
    } finally {
      setAddingWord(null);
    }
  };

  return (
    <section aria-label="High-frequency word bank explorer">
      <div className="section-toolbar">
        <div className="filter-group">
          <div className="search-box" style={{ minWidth: 280 }}>
            <Search size={15} />
            <input
              type="search"
              className="search-input"
              placeholder="搜索高频词库（英文单词或中文释义）..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>
          <span className="badge level">词典库共 {total.toLocaleString()} 词</span>
        </div>

        <div className="pager-group">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="pager-count" style={{ minWidth: 72 }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state" style={{ marginTop: 18 }}>
          正在检索高频词库...
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 18 }}>
          <p>未找到匹配 “{debouncedQuery}” 的词条。</p>
        </div>
      ) : (
        <div className="cards-grid" style={{ marginTop: 18 }}>
          {items.map((entry) => {
            const isSaved = savedWordSet.has(entry.word.toLowerCase());
            const isBusy = addingWord === entry.word;

            return (
              <div
                key={entry.word}
                className="panel-card"
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div className="card-top">
                    <div className="badges">
                      <span className="badge">{entry.partOfSpeech || 'word'}</span>
                      {entry.phonetic && <span className="phonetic">{entry.phonetic}</span>}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => {
                        void playAudioOrSpeak(entry.audioUrl, entry.word, accent, speechRate).then(
                          (ok) => {
                            if (!ok) onSpeechUnsupported();
                          }
                        );
                      }}
                      aria-label={`Pronounce ${entry.word}`}
                      title="发音"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>

                  <h3
                    style={{
                      margin: '8px 0 6px',
                      fontFamily: 'var(--font-serif)',
                      fontSize: '1.75rem',
                      fontWeight: 400,
                      lineHeight: 1.15,
                    }}
                  >
                    {entry.word}
                  </h3>

                  <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>
                    {entry.meaningZh || '暂无中文释义'}
                  </p>
                  {entry.definitionEn && (
                    <p
                      style={{
                        margin: '5px 0 0',
                        fontSize: '0.8rem',
                        color: 'var(--ink-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {entry.definitionEn}
                    </p>
                  )}
                </div>

                <div className="card-actions">
                  {isSaved ? (
                    <span className="master-btn active" style={{ cursor: 'default' }}>
                      <Check size={14} />
                      <span>已在我的词库</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      disabled={isBusy}
                      onClick={() => void handleQuickAdd(entry)}
                    >
                      <Plus size={14} />
                      <span>{isBusy ? '加入中...' : '加入复习词库'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
