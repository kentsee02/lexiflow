export type CefrLevel = 'B1' | 'B2' | 'C1';
export type VocabCategory = 'Tech' | 'Business' | 'Daily' | 'Academic';
export type AccentType = 'en-US' | 'en-GB';
export type AppTab = 'flashcards' | 'quiz' | 'reading';

export interface VocabItem {
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
  mastered: boolean;
  reviewCount: number;
  createdAt: string;
}

export interface CreateVocabPayload {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  meaningZh: string;
  definitionEn?: string;
  example: string;
  exampleZh?: string;
  level: CefrLevel;
  category: VocabCategory;
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
  title: string;
  titleZh: string;
  category: string;
  level: CefrLevel;
  readMinutes: number;
  completed: boolean;
  paragraphs: ArticleParagraph[];
  keyTerms: ArticleKeyTerm[];
}

export interface ActivityEntry {
  id: string;
  type: string;
  label: string;
  timestamp: string;
}

export interface ProgressStats {
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  articlesRead: number;
  totalArticles: number;
  quizzesTaken: number;
  bestQuizScore: number;
  streakDays: number;
  recentActivity: ActivityEntry[];
}

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}
