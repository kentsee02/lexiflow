import { useCallback, useEffect, useState } from 'react';
import {
  analyzeArticleAi,
  createArticle,
  createVocab,
  deleteArticle,
  deleteVocab,
  fetchAiStatus,
  fetchArticles,
  fetchDailyPhrase,
  fetchDashboard,
  fetchDueVocab,
  fetchGuestSeed,
  fetchHealth,
  fetchMe,
  fetchVocab,
  logoutAccount,
  migrateGuestData,
  patchVocab,
  submitQuizScore,
  submitVocabReview,
  toggleArticleComplete,
  updateProfile,
} from './api/client';
import { AccountSecurityModal } from './components/AccountSecurityModal';
import { AddWordModal } from './components/AddWordModal';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { Header } from './components/Header';
import { QuizPanel } from './components/QuizPanel';
import { ReadingLab } from './components/ReadingLab';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import type {
  AccentType,
  AiStatus,
  AppTab,
  ArticleItem,
  CreateArticlePayload,
  CreateVocabPayload,
  DailyPhrase,
  DashboardData,
  ReviewQuality,
  ThemeMode,
  UserProfile,
  VocabCard,
} from './types';
import {
  clearGuestCustomDrafts,
  getPendingGuestMigrationPayload,
  guestAddVocab,
  guestBuildDashboard,
  guestDeleteArticle,
  guestDeleteVocab,
  guestGetDueCards,
  guestImportArticle,
  guestPatchVocab,
  guestReviewVocab,
  guestSubmitQuiz,
  guestToggleArticle,
  guestUpdateDailyGoal,
  initGuestStore,
  type GuestState,
} from './utils/guestStore';
import { applyTheme, getInitialTheme } from './utils/theme';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [accent, setAccent] = useState<AccentType>('en-US');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  const [user, setUser] = useState<UserProfile | null>(null);
  const [guestState, setGuestState] = useState<GuestState | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<{ words: number; articles: number } | null>(
    null
  );

  const [dailyOffset, setDailyOffset] = useState(0);
  const [dailyPhrase, setDailyPhrase] = useState<DailyPhrase | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [vocab, setVocab] = useState<VocabCard[]>([]);
  const [dueCards, setDueCards] = useState<VocabCard[]>([]);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus>({
    enabled: false,
    dailyLimit: 20,
    usedToday: 0,
    remainingToday: 0,
  });

  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const applyGuestSnapshot = useCallback((nextGuest: GuestState) => {
    setGuestState(nextGuest);
    setVocab(nextGuest.vocab);
    setArticles(nextGuest.articles);
    setDueCards(guestGetDueCards(nextGuest, 30).items);
    setDashboard(guestBuildDashboard(nextGuest));
  }, []);

  const loadAuthenticatedWorkspace = useCallback(async () => {
    const [dashRes, vocabRes, dueRes, articlesRes, aiRes] = await Promise.all([
      fetchDashboard(),
      fetchVocab(),
      fetchDueVocab(30),
      fetchArticles(),
      fetchAiStatus(),
    ]);
    setDashboard(dashRes);
    setVocab(vocabRes.items);
    setDueCards(dueRes.items);
    setArticles(articlesRes.items);
    setAiStatus(aiRes);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [healthRes, dailyRes, meRes, aiRes] = await Promise.all([
        fetchHealth(),
        fetchDailyPhrase(0),
        fetchMe(),
        fetchAiStatus(),
      ]);

      setApiOnline(healthRes.health.status === 'ok');
      setApiLatency(healthRes.latencyMs);
      setDailyPhrase(dailyRes);
      setAiStatus(aiRes);

      if (meRes.user) {
        setUser(meRes.user);
        await loadAuthenticatedWorkspace();
      } else {
        setUser(null);
        const seed = await fetchGuestSeed();
        const initialized = initGuestStore(seed.vocab, seed.articles);
        applyGuestSnapshot(initialized);
      }
    } catch (err) {
      setApiOnline(false);
      setErrorMsg(
        err instanceof Error
          ? `${err.message} — 请确认后端服务与 PostgreSQL 已启动。`
          : '无法连接后端 API。'
      );
    } finally {
      setLoading(false);
    }
  }, [applyGuestSnapshot, loadAuthenticatedWorkspace]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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

  const handleAuthenticated = async (authedUser: UserProfile) => {
    setUser(authedUser);
    const pending = getPendingGuestMigrationPayload(guestState);
    if (pending) {
      setPendingSyncCount({
        words: pending.vocab.length,
        articles: pending.articles.length,
      });
    }
    await loadAuthenticatedWorkspace();
    showToast(`欢迎回来，${authedUser.displayName}`);
  };

  const handleMigrateGuest = async () => {
    const pending = getPendingGuestMigrationPayload(guestState);
    if (!pending) {
      setPendingSyncCount(null);
      return;
    }
    const res = await migrateGuestData(pending);
    if (guestState) {
      setGuestState(clearGuestCustomDrafts(guestState));
    }
    setPendingSyncCount(null);
    await loadAuthenticatedWorkspace();
    showToast(`已同步 ${res.importedWords} 个生词、${res.importedArticles} 篇文章到云端`);
  };

  const resetToGuestMode = useCallback(
    async (message: string) => {
      setUser(null);
      setPendingSyncCount(null);
      const seed = await fetchGuestSeed();
      const initialized = initGuestStore(seed.vocab, seed.articles);
      applyGuestSnapshot(initialized);
      showToast(message);
    },
    [applyGuestSnapshot, showToast]
  );

  const handleLogout = async () => {
    await logoutAccount();
    await resetToGuestMode('已退出登录，当前为游客体验模式');
  };

  const handleUpdateDailyGoal = async (dailyGoal: number) => {
    if (user) {
      const res = await updateProfile({ dailyGoal });
      setUser(res.user);
      const dashRes = await fetchDashboard();
      setDashboard(dashRes);
    } else if (guestState) {
      applyGuestSnapshot(guestUpdateDailyGoal(guestState, dailyGoal));
    }
    showToast(`每日学习目标已更新为 ${dailyGoal} 次`);
  };

  const handleReviewCard = async (id: string, quality: ReviewQuality) => {
    if (user) {
      await submitVocabReview(id, quality);
      const [dashRes, vocabRes, dueRes] = await Promise.all([
        fetchDashboard(),
        fetchVocab(),
        fetchDueVocab(30),
      ]);
      setDashboard(dashRes);
      setVocab(vocabRes.items);
      setDueCards(dueRes.items);
    } else if (guestState) {
      const { next } = guestReviewVocab(guestState, id, quality);
      applyGuestSnapshot(next);
    }
  };

  const handleToggleVocabStatus = async (card: VocabCard) => {
    const nextStatus = card.status === 'mastered' ? 'learning' : 'mastered';
    if (user) {
      await patchVocab(card.id, { status: nextStatus });
      const [dashRes, vocabRes, dueRes] = await Promise.all([
        fetchDashboard(),
        fetchVocab(),
        fetchDueVocab(30),
      ]);
      setDashboard(dashRes);
      setVocab(vocabRes.items);
      setDueCards(dueRes.items);
    } else if (guestState) {
      const { next } = guestPatchVocab(guestState, card.id, { status: nextStatus });
      applyGuestSnapshot(next);
    }
    showToast(nextStatus === 'mastered' ? `已掌握 "${card.word}"` : `已将 "${card.word}" 移回学习中`);
  };

  const handleCreateVocab = async (payload: CreateVocabPayload) => {
    if (user) {
      const created = await createVocab(payload);
      const [dashRes, vocabRes, dueRes] = await Promise.all([
        fetchDashboard(),
        fetchVocab(),
        fetchDueVocab(30),
      ]);
      setDashboard(dashRes);
      setVocab(vocabRes.items);
      setDueCards(dueRes.items);
      showToast(`已添加 "${created.word}"`);
    } else if (guestState) {
      const { next, created } = guestAddVocab(guestState, payload);
      applyGuestSnapshot(next);
      showToast(`已添加 "${created.word}"（本地暂存）`);
    }
  };

  const handleDeleteVocab = async (id: string) => {
    if (user) {
      await deleteVocab(id);
      const [dashRes, vocabRes, dueRes] = await Promise.all([
        fetchDashboard(),
        fetchVocab(),
        fetchDueVocab(30),
      ]);
      setDashboard(dashRes);
      setVocab(vocabRes.items);
      setDueCards(dueRes.items);
    } else if (guestState) {
      applyGuestSnapshot(guestDeleteVocab(guestState, id));
    }
    showToast('已从词库移除');
  };

  const handleToggleArticle = async (id: string, nextState: boolean) => {
    if (user) {
      const result = await toggleArticleComplete(id, nextState);
      setArticles((prev) => prev.map((a) => (a.id === result.article.id ? result.article : a)));
      setDashboard(await fetchDashboard());
      showToast(result.article.completed ? '已完成精读打卡' : '已取消完成标记');
    } else if (guestState) {
      const { next, article } = guestToggleArticle(guestState, id, nextState);
      applyGuestSnapshot(next);
      if (article) showToast(article.completed ? '已完成精读打卡' : '已取消完成标记');
    }
  };

  const handleImportArticle = async (payload: CreateArticlePayload) => {
    if (user) {
      const created = await createArticle(payload);
      setArticles((prev) => [...prev, created]);
      setDashboard(await fetchDashboard());
      showToast(`已导入文章《${created.title}》`);
    } else if (guestState) {
      const { next, created } = guestImportArticle(guestState, payload);
      applyGuestSnapshot(next);
      showToast(`已导入文章《${created.title}》（本地暂存）`);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (user) {
      await deleteArticle(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      setDashboard(await fetchDashboard());
    } else if (guestState) {
      applyGuestSnapshot(guestDeleteArticle(guestState, id));
    }
    showToast('已删除自定义文章');
  };

  const handleAiAnalyzeArticle = async (article: ArticleItem) => {
    try {
      const res = await analyzeArticleAi({
        articleId: article.id,
        title: article.title,
        paragraphs: article.paragraphs.map((p) => ({ en: p.en })),
      });
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id
            ? {
                ...a,
                titleZh: res.titleZh,
                paragraphs: a.paragraphs.map((p, idx) => ({
                  en: p.en,
                  zh: res.translations[idx] ?? p.zh,
                })),
                keyTerms: res.keyTerms,
              }
            : a
        )
      );
      showToast(`AI 双语解析完成（今日剩余 ${res.remainingToday} 次）`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI 解析失败');
    }
  };

  const handleCompleteQuiz = async (score: number, total: number) => {
    if (user) {
      await submitQuizScore(score, total);
      setDashboard(await fetchDashboard());
    } else if (guestState) {
      applyGuestSnapshot(guestSubmitQuiz(guestState, score, total));
    }
    showToast(`测验成绩 ${score}/${total} 已记录`);
  };

  const dueCount = dashboard?.vocabBreakdown.dueCount ?? dueCards.length;
  const aiAvailableForUser = Boolean(user && aiStatus.enabled);

  return (
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        dueCount={dueCount}
        accent={accent}
        onAccentChange={setAccent}
        speechRate={speechRate}
        onRateChange={setSpeechRate}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        apiOnline={apiOnline}
        apiLatency={apiLatency}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenSecurity={() => setShowSecurityModal(true)}
        onLogout={() => void handleLogout()}
      />

      <main className="container main-content">
        {errorMsg && (
          <div className="alert-banner" role="alert">
            <strong>连接提示：</strong> {errorMsg}
          </div>
        )}

        {!loading && !user && !errorMsg && (
          <div className="guest-banner">
            <span>
              当前为 <strong>游客体验模式</strong>（学习进度保存在本地浏览器），登录后即可云端保存并跨设备同步。
            </span>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAuthModal(true)}>
              登录 / 注册云端同步
            </button>
          </div>
        )}

        {user && pendingSyncCount && (
          <div className="guest-banner">
            <span>
              检测到你在游客模式下新增了{' '}
              <strong>
                {pendingSyncCount.words} 个生词、{pendingSyncCount.articles} 篇文章
              </strong>
              ，是否一键导入到当前账号？
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingSyncCount(null)}>
                忽略
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void handleMigrateGuest()}>
                一键同步到云端
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="empty-state">正在加载 LexiFlow 学习工作室...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                dailyPhrase={dailyPhrase}
                dashboard={dashboard}
                accent={accent}
                speechRate={speechRate}
                onShiftDaily={handleShiftDaily}
                onStartReview={() => setActiveTab('review')}
                onUpdateDailyGoal={handleUpdateDailyGoal}
                onSpeechUnsupported={() => showToast('当前浏览器不支持语音合成')}
              />
            )}

            {activeTab === 'review' && (
              <ReviewWorkspace
                vocab={vocab}
                dueCards={dueCards}
                accent={accent}
                speechRate={speechRate}
                onReviewCard={handleReviewCard}
                onToggleStatus={handleToggleVocabStatus}
                onDelete={handleDeleteVocab}
                onQuickAddWord={handleCreateVocab}
                onOpenAddModal={() => setShowAddModal(true)}
                onGoReading={() => setActiveTab('reading')}
                onSpeechUnsupported={() => showToast('当前浏览器不支持语音合成')}
              />
            )}

            {activeTab === 'reading' && (
              <ReadingLab
                articles={articles}
                vocab={vocab}
                accent={accent}
                speechRate={speechRate}
                aiAvailable={aiAvailableForUser}
                onToggleComplete={handleToggleArticle}
                onImportArticle={handleImportArticle}
                onDeleteArticle={handleDeleteArticle}
                onSaveWord={handleCreateVocab}
                onAiAnalyzeArticle={handleAiAnalyzeArticle}
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
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>LexiFlow · Interactive English Learning Studio</span>
          <span>React + TypeScript + Express + PostgreSQL</span>
        </div>
      </footer>

      {showAddModal && (
        <AddWordModal
          aiAvailable={aiAvailableForUser}
          onClose={() => setShowAddModal(false)}
          onCreate={handleCreateVocab}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {user && showSecurityModal && (
        <AccountSecurityModal
          user={user}
          onClose={() => setShowSecurityModal(false)}
          onLoggedOutAll={() => resetToGuestMode('已退出全部设备登录')}
          onAccountDeleted={() => resetToGuestMode('账号及云端数据已永久注销')}
          onNotify={showToast}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
