import {
  BookOpen,
  BrainCircuit,
  LayoutDashboard,
  Layers,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react';
import type { AccentType, AppTab, ThemeMode, UserProfile } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  dueCount: number;
  accent: AccentType;
  onAccentChange: (accent: AccentType) => void;
  speechRate: number;
  onRateChange: (rate: number) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  apiOnline: boolean | null;
  apiLatency: number | null;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onOpenSecurity: () => void;
  onLogout: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  dueCount,
  accent,
  onAccentChange,
  speechRate,
  onRateChange,
  theme,
  onToggleTheme,
  apiOnline,
  apiLatency,
  user,
  onOpenAuth,
  onOpenSecurity,
  onLogout,
}: HeaderProps) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand">
          <img
            src="/favicon.svg"
            alt="LexiFlow"
            className="brand-logo"
            width={36}
            height={36}
          />
          <div>
            <div className="brand-name">LexiFlow</div>
            <div className="brand-tag">Interactive English Studio</div>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Primary navigation">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
          >
            <LayoutDashboard size={15} />
            <span>今日概览</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => onTabChange('review')}
          >
            <Layers size={15} />
            <span>间隔复习</span>
            {dueCount > 0 && <span className="tab-badge">{dueCount}</span>}
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'reading' ? 'active' : ''}`}
            onClick={() => onTabChange('reading')}
          >
            <BookOpen size={15} />
            <span>双语精读</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => onTabChange('quiz')}
          >
            <BrainCircuit size={15} />
            <span>情境测验</span>
          </button>
        </nav>

        <div className="header-controls">
          <div className="pill-toggle" title="Pronunciation accent">
            <button
              type="button"
              className={accent === 'en-US' ? 'active' : ''}
              onClick={() => onAccentChange('en-US')}
            >
              US
            </button>
            <button
              type="button"
              className={accent === 'en-GB' ? 'active' : ''}
              onClick={() => onAccentChange('en-GB')}
            >
              UK
            </button>
          </div>

          <div className="pill-toggle" title="Speech speed">
            <button
              type="button"
              className={speechRate === 0.8 ? 'active' : ''}
              onClick={() => onRateChange(0.8)}
            >
              0.8x
            </button>
            <button
              type="button"
              className={speechRate === 1.0 ? 'active' : ''}
              onClick={() => onRateChange(1.0)}
            >
              1.0x
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="api-status" title="Express backend /api/health status">
            <span
              className={`status-dot ${
                apiOnline === true ? 'online' : apiOnline === false ? 'offline' : ''
              }`}
            />
            <span>
              {apiOnline === true
                ? `${apiLatency ? `${apiLatency}ms` : 'Online'}`
                : apiOnline === false
                  ? 'Offline'
                  : '...'}
            </span>
          </div>

          {user ? (
            <div className="user-chip">
              <User size={14} color="var(--brand-teal)" />
              <span>{user.displayName}</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ padding: 3 }}
                onClick={onOpenSecurity}
                title="账号安全中心"
                aria-label="Account security"
              >
                <ShieldCheck size={15} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ padding: 3 }}
                onClick={onLogout}
                title="退出登录"
                aria-label="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onOpenAuth}>
              <LogIn size={15} />
              <span>登录 / 注册</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
