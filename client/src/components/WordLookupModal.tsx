import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Plus, Volume2, X } from 'lucide-react';
import { lookupDictionary } from '../api/client';
import type {
  AccentType,
  CefrLevel,
  CreateVocabPayload,
  DictionaryLookup,
  VocabCategory,
} from '../types';
import { playAudioOrSpeak } from '../utils/speech';

interface WordLookupModalProps {
  word: string;
  sentence: string;
  sourceArticleId: string;
  alreadySaved: boolean;
  accent: AccentType;
  speechRate: number;
  onClose: () => void;
  onSaveWord: (payload: CreateVocabPayload) => Promise<void>;
  onSpeechUnsupported: () => void;
}

export function WordLookupModal({
  word,
  sentence,
  sourceArticleId,
  alreadySaved,
  accent,
  speechRate,
  onClose,
  onSaveWord,
  onSpeechUnsupported,
}: WordLookupModalProps) {
  const [loading, setLoading] = useState(true);
  const [lookup, setLookup] = useState<DictionaryLookup | null>(null);
  const [meaningZh, setMeaningZh] = useState('');
  const [example, setExample] = useState(sentence);
  const [level, setLevel] = useState<CefrLevel>('B2');
  const [category, setCategory] = useState<VocabCategory>('Daily');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    lookupDictionary(word)
      .then((data) => {
        if (!active) return;
        setLookup(data);
        if (data.meaningZh) setMeaningZh(data.meaningZh);
        if (!sentence && data.example) setExample(data.example);
      })
      .catch(() => {
        if (!active) return;
        setLookup(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [word, sentence]);

  const handlePlay = async () => {
    const ok = await playAudioOrSpeak(lookup?.audioUrl, lookup?.word ?? word, accent, speechRate);
    if (!ok) onSpeechUnsupported();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!meaningZh.trim()) {
      setError('请补充中文释义后再加入词库。');
      return;
    }
    if (!example.trim()) {
      setError('例句不能为空。');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await onSaveWord({
        word: lookup?.word ?? word,
        phonetic: lookup?.phonetic ?? '',
        audioUrl: lookup?.audioUrl ?? '',
        partOfSpeech: lookup?.partOfSpeech || 'word',
        meaningZh: meaningZh.trim(),
        definitionEn: lookup?.definitionEn ?? '',
        example: example.trim(),
        level,
        category,
        sourceArticleId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="lookup-title">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2
                id="lookup-title"
                style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 400 }}
              >
                {lookup?.word ?? word}
              </h2>
              {lookup?.phonetic && <span className="phonetic">{lookup.phonetic}</span>}
              {lookup?.partOfSpeech && <span className="badge">{lookup.partOfSpeech}</span>}
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => void handlePlay()}
                title="播放发音"
                aria-label="Play word audio"
              >
                <Volume2 size={16} />
              </button>
            </div>
            {lookup?.audioUrl && (
              <span style={{ fontSize: '0.74rem', color: 'var(--brand-teal)' }}>● 真人词典音频可用</span>
            )}
          </div>

          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--ink-secondary)', margin: '16px 0' }}>正在查询词典释义...</p>
        ) : (
          <>
            {lookup?.definitionEn ? (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-subtle)', fontSize: '0.88rem' }}>
                <strong>English Definition：</strong>
                <span>{lookup.definitionEn}</span>
              </div>
            ) : (
              <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', marginTop: 12 }}>
                公开词典未命中完整释义，你仍可填写中文释义后直接收藏。
              </p>
            )}

            {alreadySaved ? (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 600 }}>
                <CheckCircle2 size={18} />
                <span>该单词已在你的词库中</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="form-grid">
                <div className="form-field full">
                  <label htmlFor="lookup-meaning">中文释义 *</label>
                  <input
                    id="lookup-meaning"
                    value={meaningZh}
                    onChange={(e) => setMeaningZh(e.target.value)}
                    placeholder="填写你在当前语境下理解的中文释义"
                    required
                  />
                </div>

                <div className="form-field full">
                  <label htmlFor="lookup-example">语境例句（已自动截取原文句子）*</label>
                  <textarea
                    id="lookup-example"
                    rows={2}
                    value={example}
                    onChange={(e) => setExample(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="lookup-level">等级</label>
                  <select
                    id="lookup-level"
                    value={level}
                    onChange={(e) => setLevel(e.target.value as CefrLevel)}
                  >
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="lookup-cat">场景</label>
                  <select
                    id="lookup-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as VocabCategory)}
                  >
                    <option value="Daily">Daily</option>
                    <option value="Tech">Tech</option>
                    <option value="Business">Business</option>
                    <option value="Academic">Academic</option>
                  </select>
                </div>

                {error && (
                  <p className="form-field full" style={{ color: 'var(--danger)', fontSize: '0.84rem', margin: 0 }}>
                    {error}
                  </p>
                )}

                <div className="form-field full" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    关闭
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Plus size={15} />
                    <span>{saving ? '收藏中...' : '一键加入词库'}</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
