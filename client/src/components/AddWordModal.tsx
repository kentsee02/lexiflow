import { useState, type FormEvent } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { generateExampleAi, lookupDictionary } from '../api/client';
import type { CefrLevel, CreateVocabPayload, VocabCategory } from '../types';

interface AddWordModalProps {
  aiAvailable: boolean;
  onClose: () => void;
  onCreate: (payload: CreateVocabPayload) => Promise<void>;
}

export function AddWordModal({ aiAvailable, onClose, onCreate }: AddWordModalProps) {
  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('verb');
  const [meaningZh, setMeaningZh] = useState('');
  const [definitionEn, setDefinitionEn] = useState('');
  const [example, setExample] = useState('');
  const [exampleZh, setExampleZh] = useState('');
  const [level, setLevel] = useState<CefrLevel>('B2');
  const [category, setCategory] = useState<VocabCategory>('Tech');
  const [submitting, setSubmitting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [error, setError] = useState('');

  const handleAutoFill = async () => {
    if (!word.trim()) {
      setError('请先输入英文单词再自动填充。');
      return;
    }
    setError('');
    setLookingUp(true);
    try {
      const res = await lookupDictionary(word.trim());
      if (res.phonetic) setPhonetic(res.phonetic);
      if (res.partOfSpeech) setPartOfSpeech(res.partOfSpeech);
      if (res.meaningZh && !meaningZh.trim()) setMeaningZh(res.meaningZh);
      if (res.definitionEn && !definitionEn.trim()) setDefinitionEn(res.definitionEn);
      if (res.example && !example.trim()) setExample(res.example);
      if (!res.found) {
        setError('词典未找到该词，你可以继续手动填写。');
      }
    } catch {
      setError('自动查词失败，请手动填写。');
    } finally {
      setLookingUp(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!word.trim()) {
      setError('请先填写单词再调用 AI 生成例句。');
      return;
    }
    setError('');
    setGeneratingAi(true);
    try {
      const res = await generateExampleAi({
        word: word.trim(),
        meaningZh: meaningZh.trim() || undefined,
        level,
      });
      setExample(res.example);
      setExampleZh(res.exampleZh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 生成失败');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaningZh.trim() || !example.trim()) {
      setError('请填写单词、中文释义和英文例句。');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onCreate({
        word: word.trim(),
        phonetic: phonetic.trim(),
        partOfSpeech: partOfSpeech.trim(),
        meaningZh: meaningZh.trim(),
        definitionEn: definitionEn.trim(),
        example: example.trim(),
        exampleZh: exampleZh.trim(),
        level,
        category,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-word-title">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="add-word-title" style={{ margin: 0, fontSize: '1.15rem' }}>
            添加自定义词汇
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="word-input">单词 Word *</label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '1px 6px', fontSize: '0.74rem', color: 'var(--brand-teal)' }}
                  disabled={lookingUp}
                  onClick={() => void handleAutoFill()}
                >
                  <Search size={12} />
                  <span>{lookingUp ? '查询中...' : '自动填充'}</span>
                </button>
              </div>
              <input
                id="word-input"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="e.g. deploy"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="phonetic-input">音标 Phonetic</label>
              <input
                id="phonetic-input"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="/dɪˈplɔɪ/"
              />
            </div>

            <div className="form-field">
              <label htmlFor="pos-input">词性 Part of Speech</label>
              <input
                id="pos-input"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                placeholder="verb / noun / adj"
              />
            </div>

            <div className="form-field">
              <label htmlFor="level-select">等级 CEFR Level</label>
              <select
                id="level-select"
                value={level}
                onChange={(e) => setLevel(e.target.value as CefrLevel)}
              >
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="cat-select">场景 Category</label>
              <select
                id="cat-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as VocabCategory)}
              >
                <option value="Tech">Tech</option>
                <option value="Business">Business</option>
                <option value="Daily">Daily</option>
                <option value="Academic">Academic</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="meaning-input">中文释义 *</label>
              <input
                id="meaning-input"
                value={meaningZh}
                onChange={(e) => setMeaningZh(e.target.value)}
                placeholder="部署；配置上线"
                required
              />
            </div>

            <div className="form-field full">
              <label htmlFor="def-input">英文释义 English Definition</label>
              <input
                id="def-input"
                value={definitionEn}
                onChange={(e) => setDefinitionEn(e.target.value)}
                placeholder="To move software into a live production environment."
              />
            </div>

            <div className="form-field full">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="example-input">英文例句 Example *</label>
                {aiAvailable && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '2px 8px', fontSize: '0.76rem', color: 'var(--brand-teal)' }}
                    disabled={generatingAi}
                    onClick={() => void handleAiGenerate()}
                  >
                    <Sparkles size={13} />
                    <span>{generatingAi ? '生成中...' : 'AI 生成例句'}</span>
                  </button>
                )}
              </div>
              <textarea
                id="example-input"
                rows={2}
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder="We ship reliable software with automated checks."
                required
              />
            </div>

            <div className="form-field full">
              <label htmlFor="example-zh-input">例句中文翻译</label>
              <input
                id="example-zh-input"
                value={exampleZh}
                onChange={(e) => setExampleZh(e.target.value)}
                placeholder="我们借助自动化检查来稳定交付软件。"
              />
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: '10px 0 0' }}>{error}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '保存中...' : '保存到词库'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
