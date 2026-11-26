import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { STARTER_VOCAB } from '../data/starterData.js';
import { prisma } from '../db/prisma.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import {
  clearAuthCookie,
  SESSION_TTL_MS,
  setAuthCookie,
  signAuthToken,
} from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { validatePasswordStrength } from '../utils/passwordPolicy.js';

export const authRouter = Router();

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  'scrypt$00000000000000000000000000000000$000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

const registerSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmText: z.literal('DELETE'),
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

function getClientMeta(req: Request): { userAgent: string; ipAddress: string } {
  const userAgent = String(req.get('user-agent') ?? '').slice(0, 200);
  const ipAddress = String(req.ip ?? '').slice(0, 64);
  return { userAgent, ipAddress };
}

async function issueSessionCookie(
  res: Response,
  req: Request,
  user: { id: string; email: string; tokenVersion: number }
): Promise<string> {
  const { userAgent, ipAddress } = getClientMeta(req);
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  const token = signAuthToken({
    sub: user.id,
    email: user.email,
    sid: session.id,
    ver: user.tokenVersion,
  });
  setAuthCookie(res, token);
  return session.id;
}

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const strength = validatePasswordStrength(req.body.password, email);
    if (!strength.valid) {
      res.status(400).json({ error: strength.reason });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(req.body.password);
    const { userAgent, ipAddress } = getClientMeta(req);
    const now = new Date();

    const { user, sessionId } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName: req.body.displayName,
          dailyGoal: req.body.dailyGoal ?? 20,
          lastLoginAt: now,
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

      const createdSession = await tx.userSession.create({
        data: {
          userId: createdUser.id,
          userAgent,
          ipAddress,
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        },
      });

      return { user: createdUser, sessionId: createdSession.id };
    });

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      sid: sessionId,
      ver: user.tokenVersion,
    });
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
      // Mitigate email enumeration via timing difference
      await verifyPassword(req.body.password, DUMMY_PASSWORD_HASH);
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
      res.status(429).json({
        error: 'Account temporarily locked due to too many failed attempts. Please try again later.',
        retryAfterSeconds,
      });
      return;
    }

    const isValid = await verifyPassword(req.body.password, user.passwordHash);
    if (!isValid) {
      const nextFailures = user.failedLoginAttempts + 1;
      const shouldLock = nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextFailures,
          lockedUntil: shouldLock ? new Date(now.getTime() + LOCKOUT_MS) : null,
        },
      });

      if (shouldLock) {
        res.status(429).json({
          error: 'Account temporarily locked for 15 minutes due to too many failed login attempts.',
          retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
        });
        return;
      }

      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    await issueSessionCookie(res, req, updatedUser);

    res.json({ user: serializeUser(updatedUser) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', optionalAuth, async (req, res, next) => {
  try {
    if (req.authUser?.sessionId) {
      await prisma.userSession
        .updateMany({
          where: { id: req.authUser.sessionId, userId: req.authUser.id },
          data: { revoked: true },
        })
        .catch(() => undefined);
    }
    clearAuthCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
      prisma.userSession.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    clearAuthCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
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

authRouter.post(
  '/change-password',
  requireAuth,
  authRateLimiter,
  validateBody(changePasswordSchema),
  async (req, res, next) => {
    try {
      const userId = req.authUser!.id;
      const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

      if (currentPassword === newPassword) {
        res.status(400).json({ error: 'New password must be different from your current password.' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        clearAuthCookie(res);
        res.status(401).json({ error: 'Account not found.' });
        return;
      }

      const currentValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!currentValid) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }

      const strength = validatePasswordStrength(newPassword, user.email);
      if (!strength.valid) {
        res.status(400).json({ error: strength.reason });
        return;
      }

      const newHash = await hashPassword(newPassword);
      const { userAgent, ipAddress } = getClientMeta(req);
      const now = new Date();

      const { updatedUser, newSessionId } = await prisma.$transaction(async (tx) => {
        await tx.userSession.updateMany({
          where: { userId, revoked: false },
          data: { revoked: true },
        });

        const nextUser = await tx.user.update({
          where: { id: userId },
          data: {
            passwordHash: newHash,
            tokenVersion: { increment: 1 },
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        const freshSession = await tx.userSession.create({
          data: {
            userId,
            userAgent,
            ipAddress,
            expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
          },
        });

        return { updatedUser: nextUser, newSessionId: freshSession.id };
      });

      const token = signAuthToken({
        sub: updatedUser.id,
        email: updatedUser.email,
        sid: newSessionId,
        ver: updatedUser.tokenVersion,
      });
      setAuthCookie(res, token);

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const currentSid = req.authUser!.sessionId;
    const now = new Date();

    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: now },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });

    res.json({
      items: sessions.map((s) => ({
        ...s,
        isCurrent: s.id === currentSid,
      })),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.delete('/sessions/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const sessionId = String(req.params.sessionId);

    const updated = await prisma.userSession.updateMany({
      where: { id: sessionId, userId, revoked: false },
      data: { revoked: true },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: 'Active session not found.' });
      return;
    }

    if (sessionId === req.authUser!.sessionId) {
      clearAuthCookie(res);
    }

    res.json({ revoked: true, id: sessionId });
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/delete-account',
  requireAuth,
  authRateLimiter,
  validateBody(deleteAccountSchema),
  async (req, res, next) => {
    try {
      const userId = req.authUser!.id;
      const { password } = req.body as z.infer<typeof deleteAccountSchema>;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        clearAuthCookie(res);
        res.status(401).json({ error: 'Account not found.' });
        return;
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Password is incorrect.' });
        return;
      }

      await prisma.user.delete({ where: { id: userId } });
      clearAuthCookie(res);

      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  }
);

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
