import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { CefrLevel, CreateVocabPayload, VocabCategory } from '../types';

interface AddWordModalProps {
  onClose: () => void;
  onCreate: (payload: CreateVocabPayload) => Promise<void>;
}

export function AddWordModal({ onClose, onCreate }: AddWordModalProps) {
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
  const [error, setError] = useState('');

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
              <label htmlFor="word-input">单词 Word *</label>
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
              <label htmlFor="example-input">英文例句 Example *</label>
              <textarea
                id="example-input"
                rows={2}
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder="We deploy the updated bundle automatically after tests pass."
                required
              />
            </div>

            <div className="form-field full">
              <label htmlFor="example-zh-input">例句中文翻译</label>
              <input
                id="example-zh-input"
                value={exampleZh}
                onChange={(e) => setExampleZh(e.target.value)}
                placeholder="测试通过后，我们会自动部署更新后的构建包。"
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
