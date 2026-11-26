import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Laptop, LogOut, ShieldAlert, Trash2, X } from 'lucide-react';
import {
  changePassword,
  deleteAccount,
  fetchSessions,
  logoutAllDevices,
  revokeSession,
} from '../api/client';
import type { SessionItem, UserProfile } from '../types';
import { evaluatePasswordChecks } from './AuthModal';

interface AccountSecurityModalProps {
  user: UserProfile;
  onClose: () => void;
  onLoggedOutAll: () => Promise<void>;
  onAccountDeleted: () => Promise<void>;
  onNotify: (msg: string) => void;
}

function summarizeUserAgent(ua: string): string {
  if (!ua) return '未知设备 / 浏览器';
  const browser = ua.includes('Edg/')
    ? 'Microsoft Edge'
    : ua.includes('Chrome/')
      ? 'Chrome'
      : ua.includes('Firefox/')
        ? 'Firefox'
        : ua.includes('Safari/')
          ? 'Safari'
          : 'Browser';
  const os = ua.includes('Windows')
    ? 'Windows'
    : ua.includes('Mac OS')
      ? 'macOS'
      : ua.includes('Android')
        ? 'Android'
        : ua.includes('iPhone') || ua.includes('iPad')
          ? 'iOS'
          : ua.includes('Linux')
            ? 'Linux'
            : 'Device';
  return `${browser} · ${os}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

export function AccountSecurityModal({
  user,
  onClose,
  onLoggedOutAll,
  onAccountDeleted,
  onNotify,
}: AccountSecurityModalProps) {
  const [tab, setTab] = useState<'password' | 'sessions' | 'danger'>('password');

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');

  // Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const pwdChecks = evaluatePasswordChecks(newPassword);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetchSessions();
      setSessions(res.items);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (tab === 'sessions') {
      void loadSessions();
    }
  }, [tab]);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (!pwdChecks.allValid) {
      setPwdError('新密码必须满足全部 4 项安全要求。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('两次输入的新密码不一致。');
      return;
    }

    setChangingPwd(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onNotify('密码已更新，其他已登录设备已自动失效');
      onClose();
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setChangingPwd(false);
    }
  };

  const handleRevokeSession = async (session: SessionItem) => {
    setSessionBusyId(session.id);
    try {
      await revokeSession(session.id);
      if (session.isCurrent) {
        onClose();
        await onLoggedOutAll();
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      onNotify('已踢出该设备会话');
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleLogoutAll = async () => {
    setSessionBusyId('ALL');
    try {
      await logoutAllDevices();
      onClose();
      await onLoggedOutAll();
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleDeleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteConfirm.trim() !== 'DELETE') {
      setDeleteError('请输入大写的 DELETE 以确认永久注销账号。');
      return;
    }

    setDeletingAccount(true);
    try {
      await deleteAccount({ password: deletePassword, confirmText: 'DELETE' });
      onClose();
      await onAccountDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '注销失败，请核对密码');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="security-title">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 id="security-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              账号安全中心
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
              {user.displayName} · {user.email}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="subtabs" style={{ marginTop: 14, width: '100%' }}>
          <button
            type="button"
            className={`subtab ${tab === 'password' ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setTab('password')}
          >
            修改密码
          </button>
          <button
            type="button"
            className={`subtab ${tab === 'sessions' ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setTab('sessions')}
          >
            设备管理
          </button>
          <button
            type="button"
            className={`subtab ${tab === 'danger' ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setTab('danger')}
          >
            注销账号
          </button>
        </div>

        {tab === 'password' && (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <div className="form-field">
              <label htmlFor="sec-cur-pwd">当前密码</label>
              <input
                id="sec-cur-pwd"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="sec-new-pwd">新密码</label>
              <input
                id="sec-new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              {newPassword.length > 0 && (
                <div>
                  <div className="pwd-meter-track">
                    <div
                      className={`pwd-meter-fill ${pwdChecks.levelClass}`}
                      style={{ width: `${(pwdChecks.score / 4) * 100}%` }}
                    />
                  </div>
                  <div className="pwd-checklist">
                    <span className={`pwd-check-item ${pwdChecks.hasMinLen ? 'ok' : ''}`}>
                      {pwdChecks.hasMinLen ? '✓' : '○'} 至少 8 位
                    </span>
                    <span className={`pwd-check-item ${pwdChecks.hasUpper ? 'ok' : ''}`}>
                      {pwdChecks.hasUpper ? '✓' : '○'} 含大写字母
                    </span>
                    <span className={`pwd-check-item ${pwdChecks.hasLower ? 'ok' : ''}`}>
                      {pwdChecks.hasLower ? '✓' : '○'} 含小写字母
                    </span>
                    <span className={`pwd-check-item ${pwdChecks.hasDigit ? 'ok' : ''}`}>
                      {pwdChecks.hasDigit ? '✓' : '○'} 含数字
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="sec-confirm-pwd">确认新密码</label>
              <input
                id="sec-confirm-pwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: 0 }}>
              修改成功后，除当前浏览器外的所有其他已登录设备将立刻失效。
            </p>

            {pwdError && <p style={{ color: 'var(--danger)', fontSize: '0.84rem', margin: 0 }}>{pwdError}</p>}

            <button type="submit" className="btn btn-primary" disabled={changingPwd}>
              <KeyRound size={15} />
              <span>{changingPwd ? '更新中...' : '确认修改密码'}</span>
            </button>
          </form>
        )}

        {tab === 'sessions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                当前共有 {sessions.length} 个活跃登录会话
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 11px' }}
                disabled={sessionBusyId === 'ALL' || sessions.length === 0}
                onClick={() => void handleLogoutAll()}
              >
                <LogOut size={14} />
                <span>退出全部设备</span>
              </button>
            </div>

            {loadingSessions ? (
              <p style={{ fontSize: '0.86rem', color: 'var(--ink-muted)' }}>正在加载活跃设备...</p>
            ) : sessions.length === 0 ? (
              <p style={{ fontSize: '0.86rem', color: 'var(--ink-muted)' }}>暂无活跃会话。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.map((s) => (
                  <div className="session-item" key={s.id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Laptop size={18} style={{ marginTop: 2, color: 'var(--brand-teal)' }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.86rem' }}>{summarizeUserAgent(s.userAgent)}</strong>
                          {s.isCurrent && <span className="badge level">当前设备</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                          最近活跃：{formatDateTime(s.lastUsedAt)}
                          {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                      disabled={sessionBusyId === s.id}
                      onClick={() => void handleRevokeSession(s)}
                    >
                      {s.isCurrent ? '退出此设备' : '踢出设备'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'danger' && (
          <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <div className="danger-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--danger)' }}>
                <ShieldAlert size={17} />
                <span>危险操作：永久注销账号</span>
              </div>
              <p style={{ margin: '6px 0 0', color: 'var(--ink-primary)' }}>
                注销后将永久删除你的账号、个人词库、SRS 复习记录、自定义导入文章与学习热力图数据，且无法恢复。
              </p>
            </div>

            <div className="form-field">
              <label htmlFor="del-pwd">验证当前密码</label>
              <input
                id="del-pwd"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="del-confirm">请输入 DELETE 确认</label>
              <input
                id="del-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                required
              />
            </div>

            {deleteError && <p style={{ color: 'var(--danger)', fontSize: '0.84rem', margin: 0 }}>{deleteError}</p>}

            <button
              type="submit"
              className="btn btn-secondary"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              disabled={deletingAccount}
            >
              <Trash2 size={15} />
              <span>{deletingAccount ? '正在注销...' : '永久删除我的账号'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
