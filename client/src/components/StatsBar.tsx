import { Award, BookCheck, CheckCircle2, Flame } from 'lucide-react';
import type { ProgressStats } from '../types';

interface StatsBarProps {
  progress: ProgressStats | null;
}

export function StatsBar({ progress }: StatsBarProps) {
  const mastered = progress?.masteredWords ?? 0;
  const totalWords = progress?.totalWords ?? 0;
  const articlesRead = progress?.articlesRead ?? 0;
  const totalArticles = progress?.totalArticles ?? 0;
  const bestQuiz = progress?.bestQuizScore ?? 0;
  const streakDays = progress?.streakDays ?? 0;

  return (
    <section className="stats-grid" aria-label="Learning progress summary">
      <div className="stat-card">
        <div className="stat-icon">
          <CheckCircle2 size={20} />
        </div>
        <div>
          <div className="stat-value">
            {mastered} / {totalWords}
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
            {articlesRead} / {totalArticles}
          </div>
          <div className="stat-label">精读完成 Articles</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon amber">
          <Award size={20} />
        </div>
        <div>
          <div className="stat-value">{bestQuiz}%</div>
          <div className="stat-label">测验最高分 Best Quiz</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon amber">
          <Flame size={20} />
        </div>
        <div>
          <div className="stat-value">{streakDays} 天</div>
          <div className="stat-label">连续学习 Streak</div>
        </div>
      </div>
    </section>
  );
}
