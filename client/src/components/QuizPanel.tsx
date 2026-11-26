import { useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, Trophy, Volume2 } from 'lucide-react';
import type { AccentType, VocabItem } from '../types';
import { speakEnglish } from '../utils/speech';

interface QuizPanelProps {
  vocab: VocabItem[];
  accent: AccentType;
  speechRate: number;
  onCompleteQuiz: (score: number, total: number) => Promise<void>;
  onSpeechUnsupported: () => void;
}

interface QuizQuestion {
  target: VocabItem;
  options: VocabItem[];
}

function buildQuestions(vocab: VocabItem[], count = 5): QuizQuestion[] {
  if (vocab.length < 4) return [];
  const shuffled = [...vocab].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, vocab.length));

  return selected.map((target) => {
    const distractors = vocab
      .filter((item) => item.id !== target.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const options = [target, ...distractors].sort(() => Math.random() - 0.5);
    return { target, options };
  });
}

export function QuizPanel({
  vocab,
  accent,
  speechRate,
  onCompleteQuiz,
  onSpeechUnsupported,
}: QuizPanelProps) {
  const [roundSeed, setRoundSeed] = useState(0);
  const questions = useMemo(() => buildQuestions(vocab, 5), [vocab, roundSeed]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="panel-card">
        <p style={{ margin: 0 }}>词库至少需要 4 个单词才能生成四选一情境测验。</p>
      </div>
    );
  }

  const active = questions[currentIndex];
  const answered = selectedId !== null;
  const isCorrect = selectedId === active.target.id;

  const handleSelect = (optionId: string) => {
    if (answered) return;
    setSelectedId(optionId);
    if (optionId === active.target.id) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = async () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedId(null);
      return;
    }

    setFinished(true);
    setSaving(true);
    try {
      await onCompleteQuiz(score, questions.length);
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = () => {
    setRoundSeed((s) => s + 1);
    setCurrentIndex(0);
    setSelectedId(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const percent = Math.round((score / questions.length) * 100);
    return (
      <section className="panel-card" aria-label="Quiz results">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="stat-icon amber" style={{ width: 48, height: 48 }}>
            <Trophy size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem' }}>本轮测验完成！</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--ink-secondary)' }}>
              正确 {score} / {questions.length} 题（得分率 {percent}%）
              {saving ? ' · 正在同步成绩到后端...' : ' · 成绩已记录到学习档案'}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <button type="button" className="btn btn-primary" onClick={handleRestart}>
            <RefreshCw size={16} />
            <span>再来一轮新题</span>
          </button>
        </div>
      </section>
    );
  }

  const progressPct = ((currentIndex + (answered ? 1 : 0)) / questions.length) * 100;

  return (
    <section className="panel-card" aria-label="Vocabulary context quiz">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className="badge level">
          第 {currentIndex + 1} / {questions.length} 题 · {active.target.level} · {active.target.category}
        </span>
        <span style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)', fontWeight: 600 }}>
          当前得分：{score}
        </span>
      </div>

      <div className="quiz-progress-track">
        <div className="quiz-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 400 }}>
          {active.target.word}
        </h2>
        <span className="phonetic">{active.target.phonetic}</span>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={() => {
            if (!speakEnglish(active.target.word, accent, speechRate)) onSpeechUnsupported();
          }}
          aria-label="Play word pronunciation"
        >
          <Volume2 size={16} />
        </button>
      </div>

      <p style={{ color: 'var(--ink-secondary)', margin: '8px 0 0' }}>
        请选择最符合该词汇语境的中文释义：
      </p>

      <div className="quiz-options">
        {active.options.map((opt) => {
          let stateClass = '';
          if (answered) {
            if (opt.id === active.target.id) stateClass = 'correct';
            else if (opt.id === selectedId) stateClass = 'wrong';
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={answered}
              className={`quiz-option ${stateClass}`}
              onClick={() => handleSelect(opt.id)}
            >
              {opt.meaningZh}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="quiz-feedback">
          <div>
            <strong style={{ color: isCorrect ? '#15803d' : 'var(--danger)' }}>
              {isCorrect ? '回答正确！' : `正确答案是：${active.target.meaningZh}`}
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              例句：{active.target.example}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleNext}>
            <span>{currentIndex + 1 < questions.length ? '下一题' : '查看成绩'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
