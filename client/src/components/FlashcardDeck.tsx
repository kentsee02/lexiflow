import { useMemo, useState } from 'react';
import { Check, Plus, RotateCw, Search, Trash2, Volume2 } from 'lucide-react';
import type { AccentType, VocabItem } from '../types';
import { speakEnglish } from '../utils/speech';

interface FlashcardDeckProps {
  items: VocabItem[];
  accent: AccentType;
  speechRate: number;
  onToggleMastered: (item: VocabItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenAddModal: () => void;
  onSpeechUnsupported: () => void;
}

export function FlashcardDeck({
  items,
  accent,
  speechRate,
  onToggleMastered,
  onDelete,
  onOpenAddModal,
  onSpeechUnsupported,
}: FlashcardDeckProps) {
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learning' | 'mastered'>('all');
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (levelFilter !== 'ALL' && item.level !== levelFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (statusFilter === 'mastered' && !item.mastered) return false;
      if (statusFilter === 'learning' && item.mastered) return false;
      if (q) {
        const hay = `${item.word} ${item.meaningZh} ${item.definitionEn} ${item.example}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, levelFilter, categoryFilter, statusFilter]);

  const toggleFlip = (id: string) => {
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSpeak = (text: string) => {
    const ok = speakEnglish(text, accent, speechRate);
    if (!ok) onSpeechUnsupported();
  };

  const handleMaster = async (item: VocabItem) => {
    setBusyId(item.id);
    try {
      await onToggleMastered(item);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await onDelete(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Vocabulary flashcards">
      <div className="section-toolbar">
        <div className="filter-group">
          <div className="search-box">
            <Search size={15} />
            <input
              type="search"
              className="search-input"
              placeholder="搜索单词、释义或例句..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select
            className="select-pill"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            aria-label="Filter by CEFR level"
          >
            <option value="ALL">全部等级 Level</option>
            <option value="B1">B1 进阶</option>
            <option value="B2">B2 中高级</option>
            <option value="C1">C1 高级</option>
          </select>

          <select
            className="select-pill"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="ALL">全部场景 Category</option>
            <option value="Tech">Tech 工程</option>
            <option value="Business">Business 职场</option>
            <option value="Daily">Daily 日常</option>
            <option value="Academic">Academic 学术</option>
          </select>

          <select
            className="select-pill"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'learning' | 'mastered')}
            aria-label="Filter by mastery status"
          >
            <option value="all">全部状态 ({items.length})</option>
            <option value="learning">待巩固 ({items.filter((i) => !i.mastered).length})</option>
            <option value="mastered">已掌握 ({items.filter((i) => i.mastered).length})</option>
          </select>
        </div>

        <button type="button" className="btn btn-primary" onClick={onOpenAddModal}>
          <Plus size={16} />
          <span>添加新词</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 18 }}>
          <p>没有匹配当前筛选条件的单词。</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setQuery('');
              setLevelFilter('ALL');
              setCategoryFilter('ALL');
              setStatusFilter('all');
            }}
          >
            重置筛选条件
          </button>
        </div>
      ) : (
        <div className="cards-grid" style={{ marginTop: 18 }}>
          {filtered.map((item) => {
            const isFlipped = Boolean(flippedIds[item.id]);
            const isBusy = busyId === item.id;

            return (
              <div className="flashcard-scene" key={item.id}>
                <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
                  {/* Front */}
                  <div className="card-face front">
                    <div className="card-top">
                      <div className="badges">
                        <span className="badge level">{item.level}</span>
                        <span className="badge">{item.category}</span>
                        {item.mastered && <span className="badge mastered">已掌握</span>}
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleSpeak(item.word)}
                        aria-label={`Pronounce ${item.word}`}
                        title="点击发音"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>

                    <div
                      className="card-word-area"
                      onClick={() => toggleFlip(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleFlip(item.id);
                        }
                      }}
                    >
                      <h2 className="card-word">{item.word}</h2>
                      <div className="card-meta">
                        <span className="phonetic">{item.phonetic || '/.../'}</span>
                        <span>·</span>
                        <span>{item.partOfSpeech}</span>
                      </div>
                      <div className="flip-hint">点击卡片查看释义与例句 ↻</div>
                    </div>

                    <div className="card-actions">
                      <button
                        type="button"
                        className={`master-btn ${item.mastered ? 'active' : ''}`}
                        disabled={isBusy}
                        onClick={() => handleMaster(item)}
                      >
                        <Check size={14} />
                        <span>{item.mastered ? '已掌握' : '标为掌握'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => toggleFlip(item.id)}
                        aria-label="Flip card"
                        title="翻转卡片"
                      >
                        <RotateCw size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Back */}
                  <div className="card-face back">
                    <div className="card-top">
                      <div className="badges">
                        <span className="badge level">{item.word}</span>
                        <span className="badge">复习 {item.reviewCount} 次</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleSpeak(item.example)}
                        aria-label={`Read example for ${item.word}`}
                        title="朗读例句"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>

                    <div
                      className="card-back-body"
                      onClick={() => toggleFlip(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleFlip(item.id);
                        }
                      }}
                    >
                      <p className="card-meaning">{item.meaningZh}</p>
                      {item.definitionEn && <p className="card-def">{item.definitionEn}</p>}
                      <div className="card-example-box">
                        <p>{item.example}</p>
                        {item.exampleZh && <p className="zh">{item.exampleZh}</p>}
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        type="button"
                        className={`master-btn ${item.mastered ? 'active' : ''}`}
                        disabled={isBusy}
                        onClick={() => handleMaster(item)}
                      >
                        <Check size={14} />
                        <span>{item.mastered ? '已掌握' : '标为掌握'}</span>
                      </button>

                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => toggleFlip(item.id)}
                          aria-label="Flip back"
                          title="翻回正面"
                        >
                          <RotateCw size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          disabled={isBusy}
                          onClick={() => handleDelete(item.id)}
                          aria-label={`Delete ${item.word}`}
                          title="删除单词"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
