import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const quizRouter = Router();

const submitQuizSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    total: z.number().int().min(1).max(100),
  })
  .refine((data) => data.score <= data.total, {
    message: 'score cannot exceed total.',
  });

quizRouter.post('/submit', requireAuth, validateBody(submitQuizSchema), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { score, total } = req.body as z.infer<typeof submitQuizSchema>;

    await prisma.reviewLog.create({
      data: {
        userId,
        actionType: 'quiz',
        score,
        total,
      },
    });

    const quizLogs = await prisma.reviewLog.findMany({
      where: { userId, actionType: 'quiz' },
      select: { score: true, total: true },
    });

    let bestScore = 0;
    for (const q of quizLogs) {
      if (q.score !== null && q.total && q.total > 0) {
        const pct = Math.round((q.score / q.total) * 100);
        if (pct > bestScore) bestScore = pct;
      }
    }

    res.json({
      score,
      total,
      percent: Math.round((score / total) * 100),
      totalTaken: quizLogs.length,
      bestScore,
    });
  } catch (err) {
    next(err);
  }
});
