import type {
  ArticleItem,
  CefrLevel,
  CreateArticlePayload,
  CreateVocabPayload,
  DashboardData,
  ReviewQuality,
  VocabCard,
  VocabCategory,
} from '../types';
import {
  buildHeatmap,
  calculateSm2Review,
  computeStreakDays,
  formatUtcDate,
  previewReviewIntervals,
} from './srs';

const STORAGE_KEY = 'lexiflow_guest_v1';

interface GuestLogEntry {
  id: string;
  actionType: 'srs_review' | 'quiz' | 'article_complete';
  quality: number | null;
  score: number | null;
  total: number | null;
  word: string | null;
  createdAt: string;
}

export interface GuestState {
  dailyGoal: number;
  vocab: VocabCard[];
  customWordIds: string[];
  articles: ArticleItem[];
  customArticleIds: string[];
  logs: GuestLogEntry[];
}

export type SeedVocabInput = Array<{
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningZh: string;
  definitionEn: string;
  example: string;
  exampleZh: string;
  level: CefrLevel;
  category: VocabCategory;
}>;

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function saveGuestState(state: GuestState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadGuestState(): GuestState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestState;
    if (!Array.isArray(parsed.vocab) || !Array.isArray(parsed.articles)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function initGuestStore(seedVocab: SeedVocabInput, seedArticles: ArticleItem[]): GuestState {
  const existing = loadGuestState();
  if (existing) return existing;

  const nowIso = new Date().toISOString();
  const vocab: VocabCard[] = seedVocab.map((item) => ({
    id: item.id,
    word: item.word,
    phonetic: item.phonetic,
    audioUrl: '',
    partOfSpeech: item.partOfSpeech,
    meaningZh: item.meaningZh,
    definitionEn: item.definitionEn,
    example: item.example,
    exampleZh: item.exampleZh,
    level: item.level,
    category: item.category,
    status: 'new',
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: nowIso,
    lastReviewedAt: null,
    createdAt: nowIso,
  }));

  const articles: ArticleItem[] = seedArticles.map((a) => ({
    ...a,
    isSystem: a.isSystem ?? true,
    completed: false,
  }));

  const initial: GuestState = {
    dailyGoal: 20,
    vocab,
    customWordIds: [],
    articles,
    customArticleIds: [],
    logs: [],
  };
  saveGuestState(initial);
  return initial;
}

export function guestAddVocab(
  state: GuestState,
  payload: CreateVocabPayload
): { next: GuestState; created: VocabCard } {
  const nowIso = new Date().toISOString();
  const created: VocabCard = {
    id: randomId('gv'),
    word: payload.word.trim(),
    phonetic: payload.phonetic?.trim() ?? '',
    audioUrl: payload.audioUrl?.trim() ?? '',
    partOfSpeech: payload.partOfSpeech?.trim() || 'word',
    meaningZh: payload.meaningZh.trim(),
    definitionEn: payload.definitionEn?.trim() ?? '',
    example: payload.example.trim(),
    exampleZh: payload.exampleZh?.trim() ?? '',
    level: payload.level,
    category: payload.category,
    sourceArticleId: payload.sourceArticleId ?? null,
    status: 'new',
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: nowIso,
    lastReviewedAt: null,
    createdAt: nowIso,
  };

  const next: GuestState = {
    ...state,
    vocab: [created, ...state.vocab],
    customWordIds: [created.id, ...state.customWordIds],
  };
  saveGuestState(next);
  return { next, created };
}

export function guestPatchVocab(
  state: GuestState,
  id: string,
  patch: Partial<Pick<VocabCard, 'status' | 'meaningZh' | 'example' | 'exampleZh'>>
): { next: GuestState; updated: VocabCard | null } {
  let updated: VocabCard | null = null;
  const vocab = state.vocab.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, ...patch };
    return updated;
  });
  const next: GuestState = { ...state, vocab };
  saveGuestState(next);
  return { next, updated };
}

export function guestDeleteVocab(state: GuestState, id: string): GuestState {
  const next: GuestState = {
    ...state,
    vocab: state.vocab.filter((v) => v.id !== id),
    customWordIds: state.customWordIds.filter((cid) => cid !== id),
  };
  saveGuestState(next);
  return next;
}

export function guestReviewVocab(
  state: GuestState,
  id: string,
  quality: ReviewQuality
): { next: GuestState; updated: VocabCard | null } {
  let updated: VocabCard | null = null;
  const now = new Date();
  const vocab = state.vocab.map((card) => {
    if (card.id !== id) return card;
    const srs = calculateSm2Review(card, quality, now);
    updated = { ...card, ...srs };
    return updated;
  });

  const logs: GuestLogEntry[] = updated
    ? [
        {
          id: randomId('glog'),
          actionType: 'srs_review',
          quality,
          score: null,
          total: null,
          word: (updated as VocabCard).word,
          createdAt: now.toISOString(),
        },
        ...state.logs,
      ]
    : state.logs;

  const next: GuestState = { ...state, vocab, logs: logs.slice(0, 300) };
  saveGuestState(next);
  return { next, updated };
}

export function guestImportArticle(
  state: GuestState,
  payload: CreateArticlePayload
): { next: GuestState; created: ArticleItem } {
  const blocks = payload.contentEn
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 50);

  const paragraphs = blocks.map((en) => ({ en, zh: '' }));
  const words = blocks.join(' ').trim().split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.min(60, Math.ceil(words / 180)));

  const created: ArticleItem = {
    id: randomId('gart'),
    isSystem: false,
    title: payload.title.trim(),
    titleZh: payload.titleZh?.trim() ?? '',
    category: payload.category?.trim() || 'Custom',
    level: payload.level ?? 'B2',
    readMinutes,
    completed: false,
    paragraphs,
    keyTerms: [],
    createdAt: new Date().toISOString(),
  };

  const next: GuestState = {
    ...state,
    articles: [...state.articles, created],
    customArticleIds: [...state.customArticleIds, created.id],
  };
  saveGuestState(next);
  return { next, created };
}

export function guestDeleteArticle(state: GuestState, id: string): GuestState {
  const next: GuestState = {
    ...state,
    articles: state.articles.filter((a) => a.id !== id || a.isSystem),
    customArticleIds: state.customArticleIds.filter((cid) => cid !== id),
  };
  saveGuestState(next);
  return next;
}

export function guestToggleArticle(
  state: GuestState,
  id: string,
  completed?: boolean
): { next: GuestState; article: ArticleItem | null } {
  let updated: ArticleItem | null = null;
  let becameCompleted = false;

  const articles = state.articles.map((a) => {
    if (a.id !== id) return a;
    const nextCompleted = typeof completed === 'boolean' ? completed : !a.completed;
    becameCompleted = !a.completed && nextCompleted;
    updated = { ...a, completed: nextCompleted };
    return updated;
  });

  const logs = becameCompleted
    ? [
        {
          id: randomId('glog'),
          actionType: 'article_complete' as const,
          quality: null,
          score: null,
          total: null,
          word: null,
          createdAt: new Date().toISOString(),
        },
        ...state.logs,
      ]
    : state.logs;

  const next: GuestState = { ...state, articles, logs: logs.slice(0, 300) };
  saveGuestState(next);
  return { next, article: updated };
}

export function guestSubmitQuiz(state: GuestState, score: number, total: number): GuestState {
  const next: GuestState = {
    ...state,
    logs: [
      {
        id: randomId('glog'),
        actionType: 'quiz' as const,
        quality: null,
        score,
        total,
        word: null,
        createdAt: new Date().toISOString(),
      },
      ...state.logs,
    ].slice(0, 300),
  };
  saveGuestState(next);
  return next;
}

export function guestUpdateDailyGoal(state: GuestState, dailyGoal: number): GuestState {
  const next: GuestState = { ...state, dailyGoal };
  saveGuestState(next);
  return next;
}

export function guestGetDueCards(state: GuestState, limit = 30): { items: VocabCard[]; totalDue: number } {
  const nowMs = Date.now();
  const due = state.vocab
    .filter((card) => new Date(card.nextReviewAt).getTime() <= nowMs)
    .sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime());

  return {
    items: due.slice(0, limit).map((card) => ({
      ...card,
      intervalPreviews: previewReviewIntervals(card),
    })),
    totalDue: due.length,
  };
}

export function guestBuildDashboard(state: GuestState): DashboardData {
  const now = new Date();
  const nowMs = now.getTime();
  const todayKey = formatUtcDate(now);

  let newCount = 0;
  let learning = 0;
  let mastered = 0;
  let dueCount = 0;

  for (const card of state.vocab) {
    if (card.status === 'mastered') mastered += 1;
    else if (card.status === 'learning') learning += 1;
    else newCount += 1;
    if (new Date(card.nextReviewAt).getTime() <= nowMs) dueCount += 1;
  }

  const logDates = state.logs.map((l) => new Date(l.createdAt));
  const heatmap = buildHeatmap(logDates, 90, now);
  const todayReviewed = heatmap.find((c) => c.date === todayKey)?.count ?? 0;
  const streakDays = computeStreakDays(logDates, now);

  const quizLogs = state.logs.filter((l) => l.actionType === 'quiz');
  let bestScore = 0;
  for (const q of quizLogs) {
    if (q.score !== null && q.total && q.total > 0) {
      bestScore = Math.max(bestScore, Math.round((q.score / q.total) * 100));
    }
  }

  return {
    dailyGoal: state.dailyGoal,
    todayReviewed,
    streakDays,
    vocabBreakdown: {
      total: state.vocab.length,
      newCount,
      learning,
      mastered,
      dueCount,
    },
    articles: {
      completed: state.articles.filter((a) => a.completed).length,
      total: state.articles.length,
    },
    quiz: {
      totalTaken: quizLogs.length,
      bestScore,
    },
    heatmap,
    recentActivity: state.logs.slice(0, 10),
  };
}

export function getPendingGuestMigrationPayload(state: GuestState | null) {
  if (!state) return null;
  const customWordSet = new Set(state.customWordIds);
  const customArticleSet = new Set(state.customArticleIds);

  const vocab = state.vocab
    .filter((v) => customWordSet.has(v.id))
    .map((v) => ({
      word: v.word,
      phonetic: v.phonetic,
      partOfSpeech: v.partOfSpeech,
      meaningZh: v.meaningZh,
      definitionEn: v.definitionEn,
      example: v.example,
      exampleZh: v.exampleZh,
      level: v.level,
      category: v.category,
    }));

  const articles = state.articles
    .filter((a) => customArticleSet.has(a.id))
    .map((a) => ({
      title: a.title,
      titleZh: a.titleZh,
      category: a.category,
      level: a.level,
      readMinutes: a.readMinutes,
      paragraphs: a.paragraphs,
      keyTerms: a.keyTerms,
      completed: a.completed,
    }));

  if (vocab.length === 0 && articles.length === 0) return null;
  return { vocab, articles };
}

export function clearGuestCustomDrafts(state: GuestState): GuestState {
  const next: GuestState = {
    ...state,
    customWordIds: [],
    customArticleIds: [],
  };
  saveGuestState(next);
  return next;
}
