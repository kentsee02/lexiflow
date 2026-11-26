import { Router } from 'express';
import { env, isAiEnabled } from '../config/env.js';
import { DAILY_PHRASES, STARTER_VOCAB, SYSTEM_ARTICLES } from '../data/starterData.js';
import { prisma } from '../db/prisma.js';

export const publicRouter = Router();

publicRouter.get('/health', async (_req, res) => {
  let database: 'connected' | 'disconnected' = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'connected';
  } catch {
    database = 'disconnected';
  }

  res.json({
    status: 'ok',
    service: 'lexiflow-api',
    database,
    aiEnabled: isAiEnabled(),
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

publicRouter.get('/daily', (req, res) => {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const offsetRaw = Number.parseInt(String(req.query.offset ?? '0'), 10);
  const offset = Number.isNaN(offsetRaw) ? 0 : offsetRaw;
  const total = DAILY_PHRASES.length;
  const idx = (((dayIndex + offset) % total) + total) % total;

  res.json({
    ...DAILY_PHRASES[idx],
    index: idx,
    total,
  });
});

publicRouter.get('/seed/guest', async (_req, res) => {
  try {
    const dbArticles = await prisma.article.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      vocab: STARTER_VOCAB,
      articles: dbArticles.length > 0 ? dbArticles : SYSTEM_ARTICLES,
    });
  } catch {
    res.json({
      vocab: STARTER_VOCAB,
      articles: SYSTEM_ARTICLES,
    });
  }
});
