import type {
  AiStatus,
  ArticleItem,
  ArticleKeyTerm,
  CreateArticlePayload,
  CreateVocabPayload,
  DailyPhrase,
  DashboardData,
  DictionaryLookup,
  HealthResponse,
  ReviewQuality,
  UserProfile,
  VocabCard,
} from '../types';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as {
        error?: string;
        details?: Array<{ message?: string }>;
      };
      if (errBody.details?.[0]?.message) {
        message = errBody.details[0].message;
      } else if (errBody.error) {
        message = errBody.error;
      }
    } catch {
      // Ignore malformed JSON error body
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

export async function fetchHealth(): Promise<{ health: HealthResponse; latencyMs: number }> {
  const start = performance.now();
  const health = await request<HealthResponse>('/api/health');
  const latencyMs = Math.max(1, Math.round(performance.now() - start));
  return { health, latencyMs };
}

export function fetchDailyPhrase(offset = 0): Promise<DailyPhrase> {
  return request<DailyPhrase>(`/api/daily?offset=${offset}`);
}

export function fetchGuestSeed(): Promise<{
  vocab: Array<{
    id: string;
    word: string;
    phonetic: string;
    partOfSpeech: string;
    meaningZh: string;
    definitionEn: string;
    example: string;
    exampleZh: string;
    level: 'B1' | 'B2' | 'C1';
    category: 'Tech' | 'Business' | 'Daily' | 'Academic';
  }>;
  articles: ArticleItem[];
}> {
  return request('/api/seed/guest');
}

export function lookupDictionary(word: string): Promise<DictionaryLookup> {
  return request<DictionaryLookup>(`/api/dictionary/${encodeURIComponent(word)}`);
}

export interface DictionaryBrowseEntry {
  word: string;
  phonetic: string;
  audioUrl: string;
  partOfSpeech: string;
  definitionEn: string;
  meaningZh: string;
  example: string;
}

export function browseDictionary(params: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{
  items: DictionaryBrowseEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  return request(`/api/dictionary?${search.toString()}`);
}

// Auth
export function fetchMe(): Promise<{ user: UserProfile | null }> {
  return request('/api/auth/me');
}

export function registerAccount(payload: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: UserProfile }> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<{ user: UserProfile }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutAccount(): Promise<{ ok: boolean }> {
  return request('/api/auth/logout', { method: 'POST' });
}

export function updateProfile(payload: {
  displayName?: string;
  dailyGoal?: number;
}): Promise<{ user: UserProfile }> {
  return request('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function migrateGuestData(payload: {
  vocab: CreateVocabPayload[];
  articles: Array<{
    title: string;
    titleZh?: string;
    category?: string;
    level?: 'B1' | 'B2' | 'C1';
    readMinutes?: number;
    paragraphs: Array<{ en: string; zh?: string }>;
    keyTerms?: ArticleKeyTerm[];
    completed?: boolean;
  }>;
}): Promise<{ importedWords: number; importedArticles: number }> {
  return request('/api/auth/migrate-guest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Dashboard
export function fetchDashboard(): Promise<DashboardData> {
  return request('/api/dashboard');
}

// Vocab & SRS
export function fetchVocab(): Promise<{
  items: VocabCard[];
  summary: { total: number; newCount: number; learning: number; mastered: number; dueCount: number };
}> {
  return request('/api/vocab');
}

export function fetchDueVocab(limit = 30): Promise<{ items: VocabCard[]; totalDue: number }> {
  return request(`/api/vocab/due?limit=${limit}`);
}

export function createVocab(payload: CreateVocabPayload): Promise<VocabCard> {
  return request('/api/vocab', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function patchVocab(
  id: string,
  payload: Partial<Pick<VocabCard, 'status' | 'meaningZh' | 'example' | 'exampleZh'>>
): Promise<VocabCard> {
  return request(`/api/vocab/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteVocab(id: string): Promise<{ deleted: boolean; id: string }> {
  return request(`/api/vocab/${id}`, { method: 'DELETE' });
}

export function submitVocabReview(
  id: string,
  quality: ReviewQuality
): Promise<{ card: VocabCard }> {
  return request(`/api/vocab/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  });
}

// Articles
export function fetchArticles(): Promise<{ items: ArticleItem[] }> {
  return request('/api/articles');
}

export function createArticle(payload: CreateArticlePayload): Promise<ArticleItem> {
  return request('/api/articles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteArticle(id: string): Promise<{ deleted: boolean; id: string }> {
  return request(`/api/articles/${id}`, { method: 'DELETE' });
}

export function toggleArticleComplete(
  id: string,
  completed?: boolean
): Promise<{ article: ArticleItem }> {
  return request(`/api/articles/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(typeof completed === 'boolean' ? { completed } : {}),
  });
}

// Quiz
export function submitQuizScore(
  score: number,
  total: number
): Promise<{ score: number; total: number; percent: number; totalTaken: number; bestScore: number }> {
  return request('/api/quiz/submit', {
    method: 'POST',
    body: JSON.stringify({ score, total }),
  });
}

// Optional AI
export function fetchAiStatus(): Promise<AiStatus> {
  return request('/api/ai/status');
}

export function analyzeArticleAi(payload: {
  articleId?: string;
  title: string;
  paragraphs: Array<{ en: string }>;
}): Promise<{
  titleZh: string;
  translations: string[];
  keyTerms: ArticleKeyTerm[];
  remainingToday: number;
}> {
  return request('/api/ai/analyze-article', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function generateExampleAi(payload: {
  word: string;
  meaningZh?: string;
  level?: 'B1' | 'B2' | 'C1';
}): Promise<{
  example: string;
  exampleZh: string;
  tipZh: string;
  remainingToday: number;
}> {
  return request('/api/ai/generate-example', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
