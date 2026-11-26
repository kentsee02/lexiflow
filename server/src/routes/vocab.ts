import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  calculateSm2Review,
  previewReviewIntervals,
  type ReviewQuality,
} from '../services/srs.js';

export const vocabRouter = Router();
vocabRouter.use(requireAuth);

const createVocabSchema = z.object({
  word: z.string().trim().min(1).max(100),
  phonetic: z.string().trim().max(100).optional().default(''),
  audioUrl: z.string().trim().max(400).optional().default(''),
  partOfSpeech: z.string().trim().max(40).optional().default('word'),
  meaningZh: z.string().trim().min(1).max(300),
  definitionEn: z.string().trim().max(500).optional().default(''),
  example: z.string().trim().min(1).max(600),
  exampleZh: z.string().trim().max(600).optional().default(''),
  level: z.enum(['B1', 'B2', 'C1']).optional().default('B2'),
  category: z.enum(['Tech', 'Business', 'Daily', 'Academic']).optional().default('Daily'),
  sourceArticleId: z.string().trim().max(80).optional(),
});

const patchVocabSchema = z.object({
  meaningZh: z.string().trim().min(1).max(300).optional(),
  definitionEn: z.string().trim().max(500).optional(),
  example: z.string().trim().min(1).max(600).optional(),
  exampleZh: z.string().trim().max(600).optional(),
  phonetic: z.string().trim().max(100).optional(),
  partOfSpeech: z.string().trim().max(40).optional(),
  level: z.enum(['B1', 'B2', 'C1']).optional(),
  category: z.enum(['Tech', 'Business', 'Daily', 'Academic']).optional(),
  status: z.enum(['new', 'learning', 'mastered']).optional(),
});

const reviewSchema = z.object({
  quality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

vocabRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const level = typeof req.query.level === 'string' ? req.query.level.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const allCards = await prisma.vocabCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    let newCount = 0;
    let learning = 0;
    let mastered = 0;
    let dueCount = 0;

    for (const card of allCards) {
      if (card.status === 'mastered') mastered += 1;
      else if (card.status === 'learning') learning += 1;
      else newCount += 1;

      if (card.nextReviewAt <= now) {
        dueCount += 1;
      }
    }

    const items = allCards.filter((item) => {
      if (level && level !== 'ALL' && item.level !== level) return false;
      if (category && category !== 'ALL' && item.category !== category) return false;
      if (status !== 'all' && item.status !== status) return false;
      if (q) {
        const hay = `${item.word} ${item.meaningZh} ${item.definitionEn} ${item.example}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res.json({
      items,
      summary: {
        total: allCards.length,
        newCount,
        learning,
        mastered,
        dueCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

vocabRouter.get('/due', async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const limitRaw = Number.parseInt(String(req.query.limit ?? '20'), 10);
    const limit = Number.isNaN(limitRaw) ? 20 : Math.min(100, Math.max(1, limitRaw));
    const now = new Date();

    const [dueCards, totalDue] = await Promise.all([
      prisma.vocabCard.findMany({
        where: { userId, nextReviewAt: { lte: now } },
        orderBy: [{ nextReviewAt: 'asc' }, { createdAt: 'asc' }],
        take: limit,
      }),
      prisma.vocabCard.count({
        where: { userId, nextReviewAt: { lte: now } },
      }),
    ]);

    res.json({
      items: dueCards.map((card) => ({
        ...card,
        intervalPreviews: previewReviewIntervals(card),
      })),
      totalDue,
    });
  } catch (err) {
    next(err);
  }
});

vocabRouter.post('/', validateBody(createVocabSchema), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const body = req.body as z.infer<typeof createVocabSchema>;

    const created = await prisma.vocabCard.create({
      data: {
        userId,
        word: body.word,
        phonetic: body.phonetic,
        audioUrl: body.audioUrl,
        partOfSpeech: body.partOfSpeech,
        meaningZh: body.meaningZh,
        definitionEn: body.definitionEn,
        example: body.example,
        exampleZh: body.exampleZh,
        level: body.level,
        category: body.category,
        sourceArticleId: body.sourceArticleId,
        status: 'new',
      },
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

vocabRouter.patch('/:id', validateBody(patchVocabSchema), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const id = String(req.params.id);
    const body = req.body as z.infer<typeof patchVocabSchema>;

    const existing = await prisma.vocabCard.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: `Vocab card "${id}" not found.` });
      return;
    }

    const updated = await prisma.vocabCard.update({
      where: { id },
      data: {
        ...(body.meaningZh !== undefined ? { meaningZh: body.meaningZh } : {}),
        ...(body.definitionEn !== undefined ? { definitionEn: body.definitionEn } : {}),
        ...(body.example !== undefined ? { example: body.example } : {}),
        ...(body.exampleZh !== undefined ? { exampleZh: body.exampleZh } : {}),
        ...(body.phonetic !== undefined ? { phonetic: body.phonetic } : {}),
        ...(body.partOfSpeech !== undefined ? { partOfSpeech: body.partOfSpeech } : {}),
        ...(body.level !== undefined ? { level: body.level } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

vocabRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const id = String(req.params.id);

    const deleted = await prisma.vocabCard.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: `Vocab card "${id}" not found.` });
      return;
    }

    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
});

vocabRouter.post('/:id/review', validateBody(reviewSchema), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const id = String(req.params.id);
    const quality = (req.body as z.infer<typeof reviewSchema>).quality as ReviewQuality;

    const existing = await prisma.vocabCard.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: `Vocab card "${id}" not found.` });
      return;
    }

    const nextSrs = calculateSm2Review(existing, quality);

    const [card, reviewLog] = await prisma.$transaction([
      prisma.vocabCard.update({
        where: { id },
        data: {
          status: nextSrs.status,
          easeFactor: nextSrs.easeFactor,
          intervalDays: nextSrs.intervalDays,
          repetitions: nextSrs.repetitions,
          nextReviewAt: nextSrs.nextReviewAt,
          lastReviewedAt: nextSrs.lastReviewedAt,
        },
      }),
      prisma.reviewLog.create({
        data: {
          userId,
          cardId: id,
          actionType: 'srs_review',
          quality,
        },
      }),
    ]);

    res.json({ card, reviewLog });
  } catch (err) {
    next(err);
  }
});
