import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { createStore } from './store/jsonStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_FILE = path.resolve(__dirname, '../data/store.json');

const VALID_LEVELS = new Set(['B1', 'B2', 'C1']);
const VALID_CATEGORIES = new Set(['Tech', 'Business', 'Daily', 'Academic']);

function computeProgress(data) {
  const totalWords = data.vocab.length;
  const masteredWords = data.vocab.filter((item) => item.mastered).length;
  const totalArticles = data.articles.length;
  const articlesRead = data.articles.filter((article) => article.completed).length;

  return {
    totalWords,
    masteredWords,
    learningWords: totalWords - masteredWords,
    articlesRead,
    totalArticles,
    quizzesTaken: data.progress.quizzesTaken,
    bestQuizScore: data.progress.bestQuizScore,
    streakDays: data.progress.streakDays,
    recentActivity: data.progress.recentActivity.slice(0, 8),
  };
}

function recordActivity(data, type, label) {
  data.progress.recentActivity.unshift({
    id: `act-${crypto.randomUUID().slice(0, 8)}`,
    type,
    label,
    timestamp: new Date().toISOString(),
  });
  data.progress.recentActivity = data.progress.recentActivity.slice(0, 12);
}

export function createApp({ dataFile = process.env.DATA_FILE || DEFAULT_DATA_FILE } = {}) {
  const app = express();
  const store = createStore(dataFile);

  const corsOrigin = process.env.CORS_ORIGIN;
  app.use(
    cors(
      corsOrigin
        ? {
            origin: corsOrigin.split(',').map((s) => s.trim()),
          }
        : undefined
    )
  );
  app.use(express.json({ limit: '256kb' }));

  // Lightweight request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (process.env.NODE_ENV !== 'test') {
        const ms = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
      }
    });
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'lexiflow-api',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/daily', (req, res) => {
    const data = store.readData();
    const phrases = data.dailyPhrases || [];
    if (phrases.length === 0) {
      return res.status(404).json({ error: 'No daily phrases configured' });
    }

    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const offsetRaw = Number.parseInt(String(req.query.offset ?? '0'), 10);
    const offset = Number.isNaN(offsetRaw) ? 0 : offsetRaw;
    const idx = (((dayIndex + offset) % phrases.length) + phrases.length) % phrases.length;

    return res.json({
      ...phrases[idx],
      index: idx,
      total: phrases.length,
    });
  });

  app.get('/api/vocab', (req, res) => {
    const data = store.readData();
    const level = typeof req.query.level === 'string' ? req.query.level.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const items = data.vocab.filter((item) => {
      if (level && level !== 'ALL' && item.level !== level) return false;
      if (category && category !== 'ALL' && item.category !== category) return false;
      if (status === 'mastered' && !item.mastered) return false;
      if (status === 'learning' && item.mastered) return false;
      if (q) {
        const haystack = `${item.word} ${item.meaningZh} ${item.definitionEn} ${item.example}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const total = data.vocab.length;
    const mastered = data.vocab.filter((item) => item.mastered).length;

    res.json({
      items,
      summary: {
        total,
        mastered,
        learning: total - mastered,
      },
    });
  });

  app.post('/api/vocab', (req, res) => {
    const {
      word,
      phonetic = '',
      partOfSpeech = 'word',
      meaningZh,
      definitionEn = '',
      example,
      exampleZh = '',
      level = 'B2',
      category = 'Daily',
    } = req.body ?? {};

    if (!word || typeof word !== 'string' || !word.trim()) {
      return res.status(400).json({ error: 'Field "word" is required.' });
    }
    if (!meaningZh || typeof meaningZh !== 'string' || !meaningZh.trim()) {
      return res.status(400).json({ error: 'Field "meaningZh" is required.' });
    }
    if (!example || typeof example !== 'string' || !example.trim()) {
      return res.status(400).json({ error: 'Field "example" is required.' });
    }

    const safeLevel = VALID_LEVELS.has(level) ? level : 'B2';
    const safeCategory = VALID_CATEGORIES.has(category) ? category : 'Daily';

    const newItem = {
      id: `v-${crypto.randomUUID().slice(0, 8)}`,
      word: word.trim(),
      phonetic: typeof phonetic === 'string' ? phonetic.trim() : '',
      partOfSpeech: typeof partOfSpeech === 'string' && partOfSpeech.trim() ? partOfSpeech.trim() : 'word',
      meaningZh: meaningZh.trim(),
      definitionEn: typeof definitionEn === 'string' ? definitionEn.trim() : '',
      example: example.trim(),
      exampleZh: typeof exampleZh === 'string' ? exampleZh.trim() : '',
      level: safeLevel,
      category: safeCategory,
      mastered: false,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    };

    store.update((data) => {
      data.vocab.unshift(newItem);
      recordActivity(data, 'vocab', `Added new word "${newItem.word}" (${newItem.level})`);
      return data;
    });

    return res.status(201).json(newItem);
  });

  app.patch('/api/vocab/:id', (req, res) => {
    const { id } = req.params;
    const payload = req.body ?? {};
    let updatedItem = null;

    store.update((data) => {
      const target = data.vocab.find((item) => item.id === id);
      if (!target) return data;

      if (typeof payload.mastered === 'boolean') {
        target.mastered = payload.mastered;
        target.reviewCount = (target.reviewCount || 0) + 1;
        recordActivity(
          data,
          'vocab',
          payload.mastered ? `Mastered "${target.word}"` : `Moved "${target.word}" back to review`
        );
      }
      if (typeof payload.reviewCount === 'number' && payload.reviewCount >= 0) {
        target.reviewCount = Math.floor(payload.reviewCount);
      }
      if (typeof payload.meaningZh === 'string' && payload.meaningZh.trim()) {
        target.meaningZh = payload.meaningZh.trim();
      }
      if (typeof payload.example === 'string' && payload.example.trim()) {
        target.example = payload.example.trim();
      }
      if (typeof payload.exampleZh === 'string') {
        target.exampleZh = payload.exampleZh.trim();
      }
      if (typeof payload.level === 'string' && VALID_LEVELS.has(payload.level)) {
        target.level = payload.level;
      }
      if (typeof payload.category === 'string' && VALID_CATEGORIES.has(payload.category)) {
        target.category = payload.category;
      }

      updatedItem = { ...target };
      return data;
    });

    if (!updatedItem) {
      return res.status(404).json({ error: `Vocab item "${id}" not found.` });
    }

    return res.json(updatedItem);
  });

  app.delete('/api/vocab/:id', (req, res) => {
    const { id } = req.params;
    let deleted = false;

    store.update((data) => {
      const index = data.vocab.findIndex((item) => item.id === id);
      if (index === -1) return data;
      const [removed] = data.vocab.splice(index, 1);
      deleted = true;
      recordActivity(data, 'vocab', `Removed word "${removed.word}"`);
      return data;
    });

    if (!deleted) {
      return res.status(404).json({ error: `Vocab item "${id}" not found.` });
    }

    return res.json({ deleted: true, id });
  });

  app.get('/api/articles', (_req, res) => {
    const data = store.readData();
    res.json({ items: data.articles });
  });

  app.post('/api/articles/:id/complete', (req, res) => {
    const { id } = req.params;
    const requestedState = req.body?.completed;
    let updatedArticle = null;
    let nextProgress = null;

    store.update((data) => {
      const article = data.articles.find((item) => item.id === id);
      if (!article) return data;
      article.completed = typeof requestedState === 'boolean' ? requestedState : !article.completed;
      updatedArticle = { ...article };
      if (article.completed) {
        recordActivity(data, 'article', `Completed reading: ${article.title}`);
      }
      nextProgress = computeProgress(data);
      return data;
    });

    if (!updatedArticle) {
      return res.status(404).json({ error: `Article "${id}" not found.` });
    }

    return res.json({ article: updatedArticle, progress: nextProgress });
  });

  app.get('/api/progress', (_req, res) => {
    const data = store.readData();
    res.json(computeProgress(data));
  });

  app.post('/api/progress/quiz', (req, res) => {
    const score = Number(req.body?.score);
    const total = Number(req.body?.total);

    if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || score < 0 || score > total) {
      return res.status(400).json({ error: 'Valid "score" and "total" numbers are required.' });
    }

    const percent = Math.round((score / total) * 100);
    let nextProgress = null;

    store.update((data) => {
      data.progress.quizzesTaken += 1;
      if (percent > data.progress.bestQuizScore) {
        data.progress.bestQuizScore = percent;
      }
      data.progress.streakDays = Math.max(1, data.progress.streakDays);
      recordActivity(data, 'quiz', `Scored ${score}/${total} (${percent}%) in Vocabulary Context Quiz`);
      nextProgress = computeProgress(data);
      return data;
    });

    return res.json(nextProgress);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
