import { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookCheck,
  CheckCircle2,
  Edit3,
  Flame,
  Sparkles,
} from 'lucide-react';
import type { AccentType, DailyPhrase as DailyPhraseType, DashboardData } from '../types';
import { DailyPhrase } from './DailyPhrase';

interface DashboardViewProps {
  dailyPhrase: DailyPhraseType | null;
  dashboard: DashboardData | null;
  accent: AccentType;
  speechRate: number;
  onShiftDaily: (delta: number) => void;
  onStartReview: () => void;
  onUpdateDailyGoal: (goal: number) => Promise<void>;
  onSpeechUnsupported: () => void;
}

function formatActivityLabel(item: DashboardData['recentActivity'][number]): string {
  if (item.actionType === 'srs_review') {
    const labels: Record<number, string> = { 1: '重来', 2: '困难', 3: '记得', 4: '秒懂' };
    return `间隔复习词汇 "${item.word ?? ''}" · ${labels[item.quality ?? 3] ?? ''}`;
  }
  if (item.actionType === 'quiz') {
    return `完成情境测验 ${item.score ?? 0}/${item.total ?? 0}`;
  }
  if (item.actionType === 'article_complete') {
    return '完成一篇双语精读打卡';
  }
  return '学习活动';
}

export function DashboardView({
  dailyPhrase,
  dashboard,
  accent,
  speechRate,
  onShiftDaily,
  onStartReview,
  onUpdateDailyGoal,
  onSpeechUnsupported,
}: DashboardViewProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(dashboard?.dailyGoal ?? 20));

  const vb = dashboard?.vocabBreakdown ?? {
    total: 0,
    newCount: 0,
    learning: 0,
    mastered: 0,
    dueCount: 0,
  };
  const dailyGoal = dashboard?.dailyGoal ?? 20;
  const todayReviewed = dashboard?.todayReviewed ?? 0;
  const goalPct = Math.min(100, Math.round((todayReviewed / Math.max(1, dailyGoal)) * 100));

  const totalSafe = Math.max(1, vb.total);
  const masteredPct = (vb.mastered / totalSafe) * 100;
  const learningPct = (vb.learning / totalSafe) * 100;
  const newPct = (vb.newCount / totalSafe) * 100;

  const saveGoal = async () => {
    const num = Number.parseInt(goalInput, 10);
    if (!Number.isNaN(num) && num >= 5 && num <= 200) {
      await onUpdateDailyGoal(num);
    }
    setEditingGoal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <DailyPhrase
        phrase={dailyPhrase}
        accent={accent}
        speechRate={speechRate}
        onShift={onShiftDaily}
        onSpeechUnsupported={onSpeechUnsupported}
      />

      <section className="stats-grid" aria-label="Learning progress summary">
        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="stat-value">
              {vb.mastered} / {vb.total}
            </div>
            <div className="stat-label">已掌握词汇 Mastered</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <BookCheck size={20} />
          </div>
          <div>
            <div className="stat-value">
              {dashboard?.articles.completed ?? 0} / {dashboard?.articles.total ?? 0}
            </div>
            <div className="stat-label">精读完成 Articles</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <Award size={20} />
          </div>
          <div>
            <div className="stat-value">{dashboard?.quiz.bestScore ?? 0}%</div>
            <div className="stat-label">测验最高分 Best Quiz</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <Flame size={20} />
          </div>
          <div>
            <div className="stat-value">{dashboard?.streakDays ?? 0} 天</div>
            <div className="stat-label">连续学习 Streak</div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div className="hero-eyebrow" style={{ marginBottom: 0 }}>
                <Sparkles size={14} />
                <span>Today&apos;s Review · 今日间隔复习</span>
              </div>
              <span className="badge level">待复习 {vb.dueCount} 词</span>
            </div>

            <h2 style={{ margin: '10px 0 4px', fontSize: '1.35rem' }}>
              {vb.dueCount > 0
                ? `有 ${vb.dueCount} 个词汇已到复习节点`
                : '今日到期词汇已全部复习完成！'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              基于 SM-2 记忆曲线调度复习间隔，答对次数越多间隔越长。
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span>
                今日学习进度：<strong>{todayReviewed}</strong> / {dailyGoal} 次
              </span>
              {editingGoal ? (
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    style={{ width: 64, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border-hairline)', background: 'var(--bg-surface)', color: 'var(--ink-primary)' }}
                  />
                  <button type="button" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => void saveGoal()}>
                    保存
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                  onClick={() => {
                    setGoalInput(String(dailyGoal));
                    setEditingGoal(true);
                  }}
                >
                  <Edit3 size={13} />
                  <span>修改目标</span>
                </button>
              )}
            </div>
            <div className="goal-track">
              <div className="goal-fill" style={{ width: `${goalPct}%` }} />
            </div>
          </div>

          <div>
            <button type="button" className="btn btn-primary" onClick={onStartReview}>
              <span>{vb.dueCount > 0 ? '开始今日复习' : '进入词汇复习与词库'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <strong style={{ fontSize: '0.96rem' }}>词汇掌握分布</strong>
            <div className="mastery-bar" aria-label="Vocabulary status distribution">
              <div className="mastery-seg mastered" style={{ width: `${masteredPct}%` }} title={`已掌握 ${vb.mastered}`} />
              <div className="mastery-seg learning" style={{ width: `${learningPct}%` }} title={`学习中 ${vb.learning}`} />
              <div className="mastery-seg new" style={{ width: `${newPct}%` }} title={`新词 ${vb.newCount}`} />
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: '0.78rem', color: 'var(--ink-secondary)', flexWrap: 'wrap' }}>
              <span>● 已掌握 {vb.mastered}</span>
              <span>● 学习中 {vb.learning}</span>
              <span>● 新词 {vb.newCount}</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: '0.96rem' }}>近 90 天学习热力图</strong>
              <div className="heatmap-legend">
                <span>少</span>
                <span className="heatmap-cell" />
                <span className="heatmap-cell l1" />
                <span className="heatmap-cell l2" />
                <span className="heatmap-cell l3" />
                <span className="heatmap-cell l4" />
                <span>多</span>
              </div>
            </div>
            <div className="heatmap-wrap">
              <div className="heatmap-grid">
                {(dashboard?.heatmap ?? []).map((cell) => (
                  <div
                    key={cell.date}
                    className={`heatmap-cell ${cell.level > 0 ? `l${cell.level}` : ''}`}
                    title={`${cell.date} · ${cell.count} 次学习活动`}
                  />
                ))}
              </div>
            </div>
          </div>

          {dashboard && dashboard.recentActivity.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 10 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 6 }}>
                最近动态
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                {dashboard.recentActivity.slice(0, 3).map((act) => (
                  <div key={act.id}>• {formatActivityLabel(act)}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
