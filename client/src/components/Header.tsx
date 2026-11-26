import { BookOpen, BrainCircuit, Layers } from 'lucide-react';
import type { AccentType, AppTab } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  accent: AccentType;
  onAccentChange: (accent: AccentType) => void;
  speechRate: number;
  onRateChange: (rate: number) => void;
  apiOnline: boolean | null;
  apiLatency: number | null;
}

export function Header({
  activeTab,
  onTabChange,
  accent,
  onAccentChange,
  speechRate,
  onRateChange,
  apiOnline,
  apiLatency,
}: HeaderProps) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            L
          </div>
          <div>
            <div className="brand-name">LexiFlow</div>
            <div className="brand-tag">Interactive English Studio</div>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Primary navigation">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'flashcards' ? 'active' : ''}`}
            onClick={() => onTabChange('flashcards')}
          >
            <Layers size={16} />
            <span>词汇卡片 Flashcards</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => onTabChange('quiz')}
          >
            <BrainCircuit size={16} />
            <span>情境测验 Quiz</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'reading' ? 'active' : ''}`}
            onClick={() => onTabChange('reading')}
          >
            <BookOpen size={16} />
            <span>双语精读 Reading</span>
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

          <div className="api-status" title="Express backend /api/health status">
            <span
              className={`status-dot ${
                apiOnline === true ? 'online' : apiOnline === false ? 'offline' : ''
              }`}
            />
            <span>
              {apiOnline === true
                ? `API Online${apiLatency ? ` · ${apiLatency}ms` : ''}`
                : apiOnline === false
                  ? 'API Offline'
                  : 'Checking...'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
