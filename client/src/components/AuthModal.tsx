import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { loginAccount, registerAccount } from '../api/client';
import type { UserProfile } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => Promise<void>;
}

export function evaluatePasswordChecks(password: string) {
  const hasMinLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const score = [hasMinLen, hasUpper, hasLower, hasDigit].filter(Boolean).length;
  return {
    hasMinLen,
    hasUpper,
    hasLower,
    hasDigit,
    score,
    allValid: score === 4,
    label: score <= 1 ? '弱' : score <= 3 ? '中' : '强',
    levelClass: score <= 1 ? 'weak' : score <= 3 ? 'fair' : 'strong',
  };
}

export function AuthModal({ onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pwdChecks = evaluatePasswordChecks(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && !pwdChecks.allValid) {
      setError('请确保密码满足全部 4 项安全要求。');
      return;
    }

    setSubmitting(true);
    try {
      const res =
        mode === 'login'
          ? await loginAccount({ email: email.trim(), password })
          : await registerAccount({
              email: email.trim(),
              password,
              displayName: displayName.trim() || email.split('@')[0] || 'Learner',
            });
      await onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="modal-card" style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="auth-modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
            {mode === 'login' ? '登录 LexiFlow 账号' : '创建 LexiFlow 学习账号'}
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="subtabs" style={{ marginTop: 14, width: '100%' }}>
          <button
            type="button"
            className={`subtab ${mode === 'login' ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={`subtab ${mode === 'register' ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            注册新账号
          </button>
        </div>

        <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)', margin: '12px 0 0' }}>
          登录后，你的生词库、SM-2 复习计划、导入文章与热力图数据将持久化保存在云端。
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {mode === 'register' && (
            <div className="form-field">
              <label htmlFor="auth-name">昵称 Display Name</label>
              <input
                id="auth-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如：Alex"
                required
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="auth-email">邮箱 Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="auth-password">密码 Password</label>
            <div className="pwd-input-wrap">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="pwd-eye-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {mode === 'register' && password.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: 4 }}>
                  <span style={{ color: 'var(--ink-secondary)' }}>密码强度：{pwdChecks.label}</span>
                </div>
                <div className="pwd-meter-track">
                  <div
                    className={`pwd-meter-fill ${pwdChecks.levelClass}`}
                    style={{ width: `${(pwdChecks.score / 4) * 100}%` }}
                  />
                </div>
                <div className="pwd-checklist">
                  <span className={`pwd-check-item ${pwdChecks.hasMinLen ? 'ok' : ''}`}>
                    {pwdChecks.hasMinLen ? '✓' : '○'} 至少 8 位字符
                  </span>
                  <span className={`pwd-check-item ${pwdChecks.hasUpper ? 'ok' : ''}`}>
                    {pwdChecks.hasUpper ? '✓' : '○'} 包含大写字母 (A-Z)
                  </span>
                  <span className={`pwd-check-item ${pwdChecks.hasLower ? 'ok' : ''}`}>
                    {pwdChecks.hasLower ? '✓' : '○'} 包含小写字母 (a-z)
                  </span>
                  <span className={`pwd-check-item ${pwdChecks.hasDigit ? 'ok' : ''}`}>
                    {pwdChecks.hasDigit ? '✓' : '○'} 包含数字 (0-9)
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.84rem', margin: 0 }}>{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || (mode === 'register' && !pwdChecks.allValid)}
            style={{ marginTop: 4 }}
          >
            {submitting ? '处理中...' : mode === 'login' ? '立即登录' : '注册并初始化词库'}
          </button>
        </form>
      </div>
    </div>
  );
}
