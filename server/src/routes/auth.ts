import { Router } from 'express';
import { z } from 'zod';
import { STARTER_VOCAB } from '../data/starterData.js';
import { prisma } from '../db/prisma.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { clearAuthCookie, setAuthCookie, signAuthToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().trim().min(1).max(50),
  dailyGoal: z.number().int().min(5).max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(128),
});

const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    dailyGoal: z.number().int().min(5).max(200).optional(),
  })
  .refine((data) => data.displayName !== undefined || data.dailyGoal !== undefined, {
    message: 'At least one field (displayName or dailyGoal) is required.',
  });

const guestVocabSchema = z.object({
  word: z.string().trim().min(1).max(100),
  phonetic: z.string().trim().max(100).optional().default(''),
  partOfSpeech: z.string().trim().max(40).optional().default('word'),
  meaningZh: z.string().trim().min(1).max(300),
  definitionEn: z.string().trim().max(500).optional().default(''),
  example: z.string().trim().min(1).max(600),
  exampleZh: z.string().trim().max(600).optional().default(''),
  level: z.enum(['B1', 'B2', 'C1']).optional().default('B2'),
  category: z.enum(['Tech', 'Business', 'Daily', 'Academic']).optional().default('Daily'),
});

const guestArticleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  titleZh: z.string().trim().max(200).optional().default(''),
  category: z.string().trim().max(50).optional().default('Custom'),
  level: z.enum(['B1', 'B2', 'C1']).optional().default('B2'),
  readMinutes: z.number().int().min(1).max(120).optional().default(3),
  paragraphs: z
    .array(
      z.object({
        en: z.string().trim().min(1).max(4000),
        zh: z.string().trim().max(4000).optional().default(''),
      })
    )
    .min(1)
    .max(50),
  keyTerms: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(120),
        phonetic: z.string().trim().max(120).optional().default(''),
        meaningZh: z.string().trim().max(240).optional().default(''),
      })
    )
    .max(30)
    .optional()
    .default([]),
  completed: z.boolean().optional().default(false),
});

const migrateGuestSchema = z.object({
  vocab: z.array(guestVocabSchema).max(200).optional().default([]),
  articles: z.array(guestArticleSchema).max(30).optional().default([]),
});

function serializeUser(user: {
  id: string;
  email: string;
  displayName: string;
  dailyGoal: number;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    dailyGoal: user.dailyGoal,
    createdAt: user.createdAt,
  };
}

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(req.body.password);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName: req.body.displayName,
          dailyGoal: req.body.dailyGoal ?? 20,
        },
      });

      await tx.vocabCard.createMany({
        data: STARTER_VOCAB.map((item) => ({
          userId: createdUser.id,
          word: item.word,
          phonetic: item.phonetic,
          partOfSpeech: item.partOfSpeech,
          meaningZh: item.meaningZh,
          definitionEn: item.definitionEn,
          example: item.example,
          exampleZh: item.exampleZh,
          level: item.level,
          category: item.category,
          status: 'new',
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions: 0,
        })),
      });

      return createdUser;
    });

    const token = signAuthToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);

    res.status(201).json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authRateLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await verifyPassword(req.body.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signAuthToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);

    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', optionalAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.json({ user: null });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.authUser.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        dailyGoal: true,
        createdAt: true,
      },
    });

    if (!user) {
      clearAuthCookie(res);
      res.json({ user: null });
      return;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.patch('/profile', requireAuth, validateBody(profileSchema), async (req, res, next) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.authUser!.id },
      data: {
        ...(req.body.displayName !== undefined ? { displayName: req.body.displayName } : {}),
        ...(req.body.dailyGoal !== undefined ? { dailyGoal: req.body.dailyGoal } : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        dailyGoal: true,
        createdAt: true,
      },
    });

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/migrate-guest', requireAuth, validateBody(migrateGuestSchema), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { vocab, articles } = req.body as z.infer<typeof migrateGuestSchema>;

    const result = await prisma.$transaction(async (tx) => {
      const existingCards = await tx.vocabCard.findMany({
        where: { userId },
        select: { word: true },
      });
      const existingWordSet = new Set(existingCards.map((c) => c.word.toLowerCase()));

      const wordsToCreate = [];
      for (const item of vocab) {
        const lower = item.word.toLowerCase();
        if (!existingWordSet.has(lower)) {
          existingWordSet.add(lower);
          wordsToCreate.push({
            userId,
            word: item.word,
            phonetic: item.phonetic,
            partOfSpeech: item.partOfSpeech,
            meaningZh: item.meaningZh,
            definitionEn: item.definitionEn,
            example: item.example,
            exampleZh: item.exampleZh,
            level: item.level,
            category: item.category,
            status: 'new',
          });
        }
      }

      if (wordsToCreate.length > 0) {
        await tx.vocabCard.createMany({ data: wordsToCreate });
      }

      const existingArticles = await tx.article.findMany({
        where: { userId },
        select: { title: true },
      });
      const existingTitleSet = new Set(existingArticles.map((a) => a.title.toLowerCase()));

      let importedArticles = 0;
      for (const article of articles) {
        const lowerTitle = article.title.toLowerCase();
        if (!existingTitleSet.has(lowerTitle)) {
          existingTitleSet.add(lowerTitle);
          await tx.article.create({
            data: {
              userId,
              title: article.title,
              titleZh: article.titleZh,
              category: article.category,
              level: article.level,
              readMinutes: article.readMinutes,
              paragraphs: article.paragraphs,
              keyTerms: article.keyTerms,
              completed: article.completed,
            },
          });
          importedArticles += 1;
        }
      }

      return {
        importedWords: wordsToCreate.length,
        importedArticles,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
