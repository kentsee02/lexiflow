import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { dictionaryRateLimiter } from '../middleware/rateLimit.js';
import { lookupWord, normalizeLookupWord } from '../services/dictionary.js';

export const dictionaryRouter = Router();

dictionaryRouter.get('/', dictionaryRateLimiter, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const pageRaw = Number.parseInt(String(req.query.page ?? '1'), 10);
    const limitRaw = Number.parseInt(String(req.query.limit ?? '24'), 10);

    const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
    const limit = Number.isNaN(limitRaw) ? 24 : Math.min(60, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const where: Prisma.DictionaryCacheWhereInput = q
      ? {
          OR: [
            { word: { contains: q.toLowerCase(), mode: 'insensitive' } },
            { meaningZh: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.dictionaryCache.findMany({
        where,
        orderBy: { word: 'asc' },
        skip,
        take: limit,
      }),
      prisma.dictionaryCache.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      items,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
});

dictionaryRouter.get('/:word', dictionaryRateLimiter, async (req, res, next) => {
  try {
    const rawWord = Array.isArray(req.params.word) ? req.params.word[0] : req.params.word;
    const normalized = normalizeLookupWord(rawWord ?? '');
    if (!normalized) {
      res.status(400).json({ error: 'Invalid word parameter.' });
      return;
    }

    const result = await lookupWord(normalized);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
