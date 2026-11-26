import { useCallback, useEffect, useState } from 'react';
import {
  createVocab,
  deleteVocab,
  fetchArticles,
  fetchDailyPhrase,
  fetchHealth,
  fetchProgress,
  fetchVocab,
  patchVocab,
  submitQuizScore,
  toggleArticleComplete,
} from './api/client';
import { AddWordModal } from './components/AddWordModal';
import { DailyPhrase } from './components/DailyPhrase';
import { FlashcardDeck } from './components/FlashcardDeck';
import { Header } from './components/Header';
import { QuizPanel } from './components/QuizPanel';
import { ReadingLab } from './components/ReadingLab';
import { StatsBar } from './components/StatsBar';
import type {
  AccentType,
  AppTab,
  ArticleItem,
  CreateVocabPayload,
  DailyPhrase as DailyPhraseType,
  ProgressStats,
  VocabItem,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('flashcards');
  const [accent, setAccent] = useState<AccentType>('en-US');
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  const [dailyOffset, setDailyOffset] = useState(0);
  const [dailyPhrase, setDailyPhrase] = useState<DailyPhraseType | null>(null);
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [progress, setProgress] = useState<ProgressStats | null>(null);

  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [healthRes, dailyRes, vocabRes, articlesRes, progressRes] = await Promise.all([
        fetchHealth(),
        fetchDailyPhrase(0),
        fetchVocab(),
        fetchArticles(),
        fetchProgress(),
      ]);
      setApiOnline(healthRes.health.status === 'ok');
      setApiLatency(healthRes.latencyMs);
      setDailyPhrase(dailyRes);
      setVocab(vocabRes.items);
      setArticles(articlesRes.items);
      setProgress(progressRes);
    } catch (err) {
      setApiOnline(false);
      setErrorMsg(
        err instanceof Error
          ? `${err.message} — 请确认后端 Express 服务已启动 (npm run dev:server)。`
          : '无法连接后端 API，请确认服务已启动。'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handleShiftDaily = async (delta: number) => {
    const nextOffset = dailyOffset + delta;
    setDailyOffset(nextOffset);
    try {
      const next = await fetchDailyPhrase(nextOffset);
      setDailyPhrase(next);
    } catch {
      showToast('切换每日表达失败');
    }
  };

  const handleToggleMastered = async (item: VocabItem) => {
    const updated = await patchVocab(item.id, { mastered: !item.mastered });
    setVocab((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    const nextProgress = await fetchProgress();
    setProgress(nextProgress);
    showToast(updated.mastered ? `已掌握 "${updated.word}"` : `已将 "${updated.word}" 移回待巩固`);
  };

  const handleCreateVocab = async (payload: CreateVocabPayload) => {
    const created = await createVocab(payload);
    setVocab((prev) => [created, ...prev]);
    const nextProgress = await fetchProgress();
    setProgress(nextProgress);
    showToast(`已添加新词 "${created.word}"`);
  };

  const handleDeleteVocab = async (id: string) => {
    await deleteVocab(id);
    setVocab((prev) => prev.filter((item) => item.id !== id));
    const nextProgress = await fetchProgress();
    setProgress(nextProgress);
    showToast('已从词库移除');
  };

  const handleCompleteQuiz = async (score: number, total: number) => {
    const nextProgress = await submitQuizScore(score, total);
    setProgress(nextProgress);
    showToast(`测验成绩 ${score}/${total} 已保存`);
  };

  const handleToggleArticle = async (id: string, nextState: boolean) => {
    const result = await toggleArticleComplete(id, nextState);
    setArticles((prev) => prev.map((a) => (a.id === result.article.id ? result.article : a)));
    setProgress(result.progress);
    showToast(result.article.completed ? '已标记为完成精读' : '已取消完成标记');
  };

  return (
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        accent={accent}
        onAccentChange={setAccent}
        speechRate={speechRate}
        onRateChange={setSpeechRate}
        apiOnline={apiOnline}
        apiLatency={apiLatency}
      />

      <main className="container main-content">
        {errorMsg && (
          <div className="alert-banner" role="alert">
            <strong>连接提示：</strong> {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="empty-state">正在加载 LexiFlow 学习数据...</div>
        ) : (
          <>
            <DailyPhrase
              phrase={dailyPhrase}
              accent={accent}
              speechRate={speechRate}
              onShift={handleShiftDaily}
              onSpeechUnsupported={() => showToast('当前浏览器不支持语音合成')}
            />

            <StatsBar progress={progress} />

            {activeTab === 'flashcards' && (
              <FlashcardDeck
                items={vocab}
                accent={accent}
                speechRate={speechRate}
                onToggleMastered={handleToggleMastered}
                onDelete={handleDeleteVocab}
                onOpenAddModal={() => setShowAddModal(true)}
                onSpeechUnsupported={() => showToast('当前浏览器不支持语音合成')}
              />
            )}

            {activeTab === 'quiz' && (
              <QuizPanel
                vocab={vocab}
                accent={accent}
                speechRate={speechRate}
                onCompleteQuiz={handleCompleteQuiz}
                onSpeechUnsupported={() => showToast('当前浏览器不支持语音合成')}
              />
            )}

            {activeTab === 'reading' && (
              <ReadingLab
                articles={articles}
                accent={accent}
                speechRate={speechRate}
                onToggleComplete={handleToggleArticle}
                onSpeechUnsupported={() => showToast('当前浏览器不支持语音合成')}
              />
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>LexiFlow · Interactive English Learning Studio</span>
          <span>React + TypeScript + Express · Active Development</span>
        </div>
      </footer>

      {showAddModal && (
        <AddWordModal onClose={() => setShowAddModal(false)} onCreate={handleCreateVocab} />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
