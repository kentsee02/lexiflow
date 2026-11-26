import { useState } from 'react';
import { CheckCircle2, Languages, Volume2 } from 'lucide-react';
import type { AccentType, ArticleItem } from '../types';
import { speakEnglish } from '../utils/speech';

interface ReadingLabProps {
  articles: ArticleItem[];
  accent: AccentType;
  speechRate: number;
  onToggleComplete: (id: string, nextState: boolean) => Promise<void>;
  onSpeechUnsupported: () => void;
}

export function ReadingLab({
  articles,
  accent,
  speechRate,
  onToggleComplete,
  onSpeechUnsupported,
}: ReadingLabProps) {
  const [selectedId, setSelectedId] = useState<string>(articles[0]?.id ?? '');
  const [showZh, setShowZh] = useState(true);
  const [saving, setSaving] = useState(false);

  const current = articles.find((a) => a.id === selectedId) || articles[0];
  if (!current) {
    return (
      <div className="panel-card">
        <p style={{ margin: 0 }}>暂无精读文章。</p>
      </div>
    );
  }

  const speakText = (text: string) => {
    const ok = speakEnglish(text, accent, speechRate);
    if (!ok) onSpeechUnsupported();
  };

  const handleToggle = async () => {
    setSaving(true);
    try {
      await onToggleComplete(current.id, !current.completed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="reading-layout" aria-label="Bilingual reading lab">
      <aside className="article-list">
        {articles.map((article) => (
          <button
            key={article.id}
            type="button"
            className={`article-nav-item ${article.id === current.id ? 'active' : ''}`}
            onClick={() => setSelectedId(article.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span className="badge level">
                {article.level} · {article.category}
              </span>
              {article.completed && <span className="badge mastered">已读</span>}
            </div>
            <div className="article-nav-title">{article.title}</div>
            <div className="article-nav-zh">{article.titleZh}</div>
          </button>
        ))}
      </aside>

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
            </div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.85rem', fontWeight: 400 }}>
              {current.title}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--ink-secondary)' }}>{current.titleZh}</p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowZh((v) => !v)}
            >
              <Languages size={16} />
              <span>{showZh ? '隐藏中文译文' : '显示双语对照'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => speakText(current.paragraphs.map((p) => p.en).join(' '))}
            >
              <Volume2 size={16} />
              <span>朗读全文</span>
            </button>

            <button
              type="button"
              className={`btn ${current.completed ? 'btn-secondary' : 'btn-primary'}`}
              disabled={saving}
              onClick={handleToggle}
            >
              <CheckCircle2 size={16} />
              <span>{current.completed ? '已完成精读' : '标记为已读'}</span>
            </button>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          {current.paragraphs.map((p, idx) => (
            <div className="paragraph-block" key={idx}>
              <p className="paragraph-en">{p.en}</p>
              {showZh && <p className="paragraph-zh">{p.zh}</p>}
            </div>
          ))}
        </div>

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
                <span style={{ color: 'var(--ink-secondary)' }}>— {term.meaningZh}</span>
              </button>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
