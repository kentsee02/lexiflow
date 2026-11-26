import { useMemo, useState } from 'react';
import { CheckCircle2, Languages, Plus, Sparkles, Trash2, Volume2 } from 'lucide-react';
import type {
  AccentType,
  ArticleItem,
  CreateArticlePayload,
  CreateVocabPayload,
  VocabCard,
} from '../types';
import { speakEnglish } from '../utils/speech';
import { ImportArticleModal } from './ImportArticleModal';
import { WordLookupModal } from './WordLookupModal';

interface ReadingLabProps {
  articles: ArticleItem[];
  vocab: VocabCard[];
  accent: AccentType;
  speechRate: number;
  aiAvailable: boolean;
  onToggleComplete: (id: string, nextState: boolean) => Promise<void>;
  onImportArticle: (payload: CreateArticlePayload) => Promise<void>;
  onDeleteArticle: (id: string) => Promise<void>;
  onSaveWord: (payload: CreateVocabPayload) => Promise<void>;
  onAiAnalyzeArticle: (article: ArticleItem) => Promise<void>;
  onSpeechUnsupported: () => void;
}

function extractSentenceForOffset(paragraph: string, matchStart: number): string {
  const sentences = paragraph.match(/[^.!?]+[.!?]*/g) ?? [paragraph];
  let cursor = 0;
  for (const s of sentences) {
    const end = cursor + s.length;
    if (matchStart >= cursor && matchStart <= end) {
      return s.trim();
    }
    cursor = end;
  }
  return paragraph.trim();
}

export function ReadingLab({
  articles,
  vocab,
  accent,
  speechRate,
  aiAvailable,
  onToggleComplete,
  onImportArticle,
  onDeleteArticle,
  onSaveWord,
  onAiAnalyzeArticle,
  onSpeechUnsupported,
}: ReadingLabProps) {
  const [selectedId, setSelectedId] = useState<string>(articles[0]?.id ?? '');
  const [showZh, setShowZh] = useState(true);
  const [highlightSaved, setHighlightSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [lookupTarget, setLookupTarget] = useState<{ word: string; sentence: string } | null>(null);

  const savedWordSet = useMemo(() => new Set(vocab.map((v) => v.word.toLowerCase())), [vocab]);

  const current = articles.find((a) => a.id === selectedId) || articles[0];
  const systemArticles = articles.filter((a) => a.isSystem !== false);
  const customArticles = articles.filter((a) => a.isSystem === false);

  const speakText = (text: string) => {
    const ok = speakEnglish(text, accent, speechRate);
    if (!ok) onSpeechUnsupported();
  };

  const handleToggle = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await onToggleComplete(current.id, !current.completed);
    } finally {
      setSaving(false);
    }
  };

  const handleAiAnalyze = async () => {
    if (!current) return;
    setAnalyzingAi(true);
    try {
      await onAiAnalyzeArticle(current);
    } finally {
      setAnalyzingAi(false);
    }
  };

  const renderInteractiveParagraph = (text: string) => {
    const regex = /([A-Za-z]+(?:['-][A-Za-z]+)*)/g;
    const nodes: Array<string | { key: string; token: string; offset: number }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }
      nodes.push({
        key: `${match.index}-${match[0]}`,
        token: match[0],
        offset: match.index,
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes.map((part) => {
      if (typeof part === 'string') return part;
      const isSaved = highlightSaved && savedWordSet.has(part.token.toLowerCase());
      return (
        <span
          key={part.key}
          role="button"
          tabIndex={0}
          className={`reader-word ${isSaved ? 'saved' : ''}`}
          title="点击查词并收藏"
          onClick={() =>
            setLookupTarget({
              word: part.token,
              sentence: extractSentenceForOffset(text, part.offset),
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setLookupTarget({
                word: part.token,
                sentence: extractSentenceForOffset(text, part.offset),
              });
            }
          }}
        >
          {part.token}
        </span>
      );
    });
  };

  return (
    <section className="reading-layout" aria-label="Bilingual reading lab">
      <aside className="article-list">
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => setShowImportModal(true)}
        >
          <Plus size={16} />
          <span>导入英文文章</span>
        </button>

        {systemArticles.length > 0 && <div className="sidebar-section-label">系统精选 Featured</div>}
        {systemArticles.map((article) => (
          <button
            key={article.id}
            type="button"
            className={`article-nav-item ${article.id === current?.id ? 'active' : ''}`}
            onClick={() => setSelectedId(article.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span className="badge level">
                {article.level} · {article.category}
              </span>
              {article.completed && <span className="badge mastered">已读</span>}
            </div>
            <div className="article-nav-title">{article.title}</div>
            {article.titleZh && <div className="article-nav-zh">{article.titleZh}</div>}
          </button>
        ))}

        {customArticles.length > 0 && <div className="sidebar-section-label">我的导入 Imported</div>}
        {customArticles.map((article) => (
          <div key={article.id} style={{ position: 'relative' }}>
            <button
              type="button"
              className={`article-nav-item ${article.id === current?.id ? 'active' : ''}`}
              onClick={() => setSelectedId(article.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, paddingRight: 26 }}>
                <span className="badge level">
                  {article.level} · {article.category}
                </span>
                {article.completed && <span className="badge mastered">已读</span>}
              </div>
              <div className="article-nav-title">{article.title}</div>
              {article.titleZh && <div className="article-nav-zh">{article.titleZh}</div>}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ position: 'absolute', top: 8, right: 8 }}
              aria-label={`Delete ${article.title}`}
              title="删除文章"
              onClick={() => void onDeleteArticle(article.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </aside>

      {!current ? (
        <div className="panel-card">
          <p style={{ margin: 0 }}>暂无精读文章，点击左侧「导入英文文章」开始。</p>
        </div>
      ) : (
        <article className="panel-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--border-hairline)',
              paddingBottom: 16,
            }}
          >
            <div>
              <div className="badges" style={{ marginBottom: 8 }}>
                <span className="badge level">{current.level}</span>
                <span className="badge">{current.category}</span>
                <span className="badge">{current.readMinutes} min read</span>
                <span className="badge">点击正文任意单词即可查词入库</span>
              </div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.85rem', fontWeight: 400 }}>
                {current.title}
              </h2>
              {current.titleZh && (
                <p style={{ margin: '4px 0 0', color: 'var(--ink-secondary)' }}>{current.titleZh}</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setHighlightSaved((v) => !v)}
              >
                <span>{highlightSaved ? '已高亮生词' : '高亮词库单词'}</span>
              </button>

              <button type="button" className="btn btn-secondary" onClick={() => setShowZh((v) => !v)}>
                <Languages size={16} />
                <span>{showZh ? '隐藏中文' : '显示双语'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => speakText(current.paragraphs.map((p) => p.en).join(' '))}
              >
                <Volume2 size={16} />
                <span>朗读全文</span>
              </button>

              {aiAvailable && current.isSystem === false && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={analyzingAi}
                  onClick={() => void handleAiAnalyze()}
                >
                  <Sparkles size={16} color="var(--brand-teal)" />
                  <span>{analyzingAi ? 'AI 解析中...' : 'AI 双语解析'}</span>
                </button>
              )}

              <button
                type="button"
                className={`btn ${current.completed ? 'btn-secondary' : 'btn-primary'}`}
                disabled={saving}
                onClick={() => void handleToggle()}
              >
                <CheckCircle2 size={16} />
                <span>{current.completed ? '已完成精读' : '标记为已读'}</span>
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            {current.paragraphs.map((p, idx) => (
              <div className="paragraph-block" key={idx}>
                <p className="paragraph-en">{renderInteractiveParagraph(p.en)}</p>
                {showZh && p.zh && <p className="paragraph-zh">{p.zh}</p>}
              </div>
            ))}
          </div>

          {current.keyTerms.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
              <strong style={{ fontSize: '0.9rem' }}>核心表达 Key Expressions（点击发音）</strong>
              <div className="terms-row">
                {current.keyTerms.map((term) => (
                  <button
                    key={term.term}
                    type="button"
                    className="term-chip"
                    onClick={() => speakText(term.term)}
                  >
                    <Volume2 size={14} color="var(--brand-teal)" />
                    <strong>{term.term}</strong>
                    {term.meaningZh && (
                      <span style={{ color: 'var(--ink-secondary)' }}>— {term.meaningZh}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </article>
      )}

      {showImportModal && (
        <ImportArticleModal
          onClose={() => setShowImportModal(false)}
          onImport={onImportArticle}
        />
      )}

      {lookupTarget && current && (
        <WordLookupModal
          word={lookupTarget.word}
          sentence={lookupTarget.sentence}
          sourceArticleId={current.id}
          alreadySaved={savedWordSet.has(lookupTarget.word.toLowerCase())}
          accent={accent}
          speechRate={speechRate}
          onClose={() => setLookupTarget(null)}
          onSaveWord={onSaveWord}
          onSpeechUnsupported={onSpeechUnsupported}
        />
      )}
    </section>
  );
}
