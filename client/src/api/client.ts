import type {
  ArticleItem,
  CreateVocabPayload,
  DailyPhrase,
  HealthResponse,
  ProgressStats,
  VocabItem,
} from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) message = errBody.error;
    } catch {
      // Ignore invalid JSON error bodies
    }
    throw new Error(message);
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

export function fetchVocab(): Promise<{
  items: VocabItem[];
  summary: { total: number; mastered: number; learning: number };
}> {
  return request('/api/vocab');
}

export function createVocab(payload: CreateVocabPayload): Promise<VocabItem> {
  return request<VocabItem>('/api/vocab', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function patchVocab(
  id: string,
  payload: Partial<Pick<VocabItem, 'mastered' | 'meaningZh' | 'example' | 'exampleZh'>>
): Promise<VocabItem> {
  return request<VocabItem>(`/api/vocab/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteVocab(id: string): Promise<{ deleted: boolean; id: string }> {
  return request(`/api/vocab/${id}`, { method: 'DELETE' });
}

export function fetchArticles(): Promise<{ items: ArticleItem[] }> {
  return request('/api/articles');
}

export function toggleArticleComplete(
  id: string,
  completed?: boolean
): Promise<{ article: ArticleItem; progress: ProgressStats }> {
  return request(`/api/articles/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(typeof completed === 'boolean' ? { completed } : {}),
  });
}

export function fetchProgress(): Promise<ProgressStats> {
  return request('/api/progress');
}

export function submitQuizScore(score: number, total: number): Promise<ProgressStats> {
  return request('/api/progress/quiz', {
    method: 'POST',
    body: JSON.stringify({ score, total }),
  });
}
