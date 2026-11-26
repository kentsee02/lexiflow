export type CefrLevel = 'B1' | 'B2' | 'C1';
export type VocabCategory = 'Tech' | 'Business' | 'Daily' | 'Academic';
export type VocabStatus = 'new' | 'learning' | 'mastered';
export type ReviewQuality = 1 | 2 | 3 | 4;
export type AccentType = 'en-US' | 'en-GB';
export type ThemeMode = 'light' | 'dark';
export type AppTab = 'dashboard' | 'review' | 'reading' | 'quiz';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  dailyGoal: number;
  createdAt: string;
}

export interface SessionItem {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface VocabCard {
  id: string;
  word: string;
  phonetic: string;
  audioUrl: string;
  partOfSpeech: string;
  meaningZh: string;
  definitionEn: string;
  example: string;
  exampleZh: string;
  level: CefrLevel;
  category: VocabCategory;
  sourceArticleId?: string | null;
  status: VocabStatus;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt?: string | null;
  createdAt: string;
  intervalPreviews?: Record<ReviewQuality, string>;
}

export interface CreateVocabPayload {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  partOfSpeech?: string;
  meaningZh: string;
  definitionEn?: string;
  example: string;
  exampleZh?: string;
  level: CefrLevel;
  category: VocabCategory;
  sourceArticleId?: string;
}

export interface DailyPhrase {
  id: string;
  phrase: string;
  phonetic: string;
  meaningZh: string;
  context: string;
  example: string;
  exampleZh: string;
  index: number;
  total: number;
}

export interface ArticleParagraph {
  en: string;
  zh: string;
}

export interface ArticleKeyTerm {
  term: string;
  phonetic: string;
  meaningZh: string;
}

export interface ArticleItem {
  id: string;
  isSystem?: boolean;
  title: string;
  titleZh: string;
  category: string;
  level: CefrLevel;
  readMinutes: number;
  completed: boolean;
  paragraphs: ArticleParagraph[];
  keyTerms: ArticleKeyTerm[];
  createdAt?: string;
}

export interface CreateArticlePayload {
  title: string;
  titleZh?: string;
  category?: string;
  level?: CefrLevel;
  contentEn: string;
}

export interface HeatmapCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface DashboardData {
  dailyGoal: number;
  todayReviewed: number;
  streakDays: number;
  vocabBreakdown: {
    total: number;
    newCount: number;
    learning: number;
    mastered: number;
    dueCount: number;
  };
  articles: {
    completed: number;
    total: number;
  };
  quiz: {
    totalTaken: number;
    bestScore: number;
  };
  heatmap: HeatmapCell[];
  recentActivity: Array<{
    id: string;
    actionType: string;
    quality: number | null;
    score: number | null;
    total: number | null;
    word: string | null;
    createdAt: string;
  }>;
}

export interface DictionaryLookup {
  word: string;
  phonetic: string;
  audioUrl: string;
  partOfSpeech: string;
  definitionEn: string;
  meaningZh: string;
  example: string;
  found: boolean;
  source: 'cache' | 'external' | 'fallback';
}

export interface AiStatus {
  enabled: boolean;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  database: 'connected' | 'disconnected';
  aiEnabled: boolean;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}
