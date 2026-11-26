import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { CefrLevel, CreateArticlePayload } from '../types';

interface ImportArticleModalProps {
  onClose: () => void;
  onImport: (payload: CreateArticlePayload) => Promise<void>;
}

export function ImportArticleModal({ onClose, onImport }: ImportArticleModalProps) {
  const [title, setTitle] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [category, setCategory] = useState('Custom');
  const [level, setLevel] = useState<CefrLevel>('B2');
  const [contentEn, setContentEn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !contentEn.trim()) {
      setError('请填写文章标题与英文正文。');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onImport({
        title: title.trim(),
        titleZh: titleZh.trim(),
        category: category.trim() || 'Custom',
        level,
        contentEn: contentEn.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-article-title">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="import-article-title" style={{ margin: 0, fontSize: '1.15rem' }}>
            导入自定义英文文章
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-field full">
            <label htmlFor="art-title">英文标题 *</label>
            <input
              id="art-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Building Habits That Stick"
              required
            />
          </div>

          <div className="form-field full">
            <label htmlFor="art-title-zh">中文标题（可选）</label>
            <input
              id="art-title-zh"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              placeholder="例如：打造能够长期坚持的习惯"
            />
          </div>

          <div className="form-field">
            <label htmlFor="art-level">难度 Level</label>
            <select
              id="art-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as CefrLevel)}
            >
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="art-cat">分类 Category</label>
            <input
              id="art-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Tech / News / Essay"
            />
          </div>

          <div className="form-field full">
            <label htmlFor="art-body">英文正文（空行或换行自动分段）*</label>
            <textarea
              id="art-body"
              rows={7}
              value={contentEn}
              onChange={(e) => setContentEn(e.target.value)}
              placeholder="Paste any English article paragraphs here..."
              required
            />
          </div>

          {error && (
            <p className="form-field full" style={{ color: 'var(--danger)', fontSize: '0.84rem', margin: 0 }}>
              {error}
            </p>
          )}

          <div className="form-field full" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '导入中...' : '确认导入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
