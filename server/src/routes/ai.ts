import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import {
  AiServiceError,
  analyzeArticleWithAi,
  generateExampleWithAi,
  getAiUsageStatus,
} from '../services/ai.js';

export const aiRouter = Router();

const analyzeArticleSchema = z.object({
  articleId: z.string().trim().max(80).optional(),
  title: z.string().trim().min(1).max(200),
  paragraphs: z
    .array(z.object({ en: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(20),
});

const generateExampleSchema = z.object({
  word: z.string().trim().min(1).max(100),
  meaningZh: z.string().trim().max(300).optional(),
  level: z.enum(['B1', 'B2', 'C1']).optional(),
});

aiRouter.get('/status', optionalAuth, async (req, res, next) => {
  try {
    const status = await getAiUsageStatus(req.authUser?.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

aiRouter.post(
  '/analyze-article',
  requireAuth,
  aiRateLimiter,
  validateBody(analyzeArticleSchema),
  async (req, res, next) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as z.infer<typeof analyzeArticleSchema>;
      const analysis = await analyzeArticleWithAi({
        userId,
        title: body.title,
        paragraphs: body.paragraphs,
      });

      if (body.articleId) {
        const existing = await prisma.article.findFirst({
          where: { id: body.articleId, userId },
        });
        if (existing) {
          const mergedParagraphs = body.paragraphs.map((p, idx) => ({
            en: p.en,
            zh: analysis.translations[idx] ?? '',
          }));
          await prisma.article.update({
            where: { id: existing.id },
            data: {
              titleZh: analysis.titleZh,
              paragraphs: mergedParagraphs,
              keyTerms: analysis.keyTerms,
            },
          });
        }
      }

      res.json(analysis);
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

aiRouter.post(
  '/generate-example',
  requireAuth,
  aiRateLimiter,
  validateBody(generateExampleSchema),
  async (req, res, next) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body as z.infer<typeof generateExampleSchema>;
      const generated = await generateExampleWithAi({
        userId,
        word: body.word,
        meaningZh: body.meaningZh,
        level: body.level,
      });
      res.json(generated);
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);
