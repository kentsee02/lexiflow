import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const articlesRouter = Router();

const paragraphSchema = z.object({
  en: z.string().trim().min(1).max(4000),
  zh: z.string().trim().max(4000).optional().default(''),
});

const keyTermSchema = z.object({
  term: z.string().trim().min(1).max(120),
  phonetic: z.string().trim().max(120).optional().default(''),
  meaningZh: z.string().trim().max(240).optional().default(''),
});

const createArticleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    titleZh: z.string().trim().max(200).optional().default(''),
    category: z.string().trim().min(1).max(50).optional().default('Custom'),
    level: z.enum(['B1', 'B2', 'C1']).optional().default('B2'),
    contentEn: z.string().trim().max(25000).optional(),
    paragraphs: z.array(paragraphSchema).max(50).optional(),
    keyTerms: z.array(keyTermSchema).max(30).optional().default([]),
  })
  .refine(
    (data) =>
      (typeof data.contentEn === 'string' && data.contentEn.trim().length > 0) ||
      (Array.isArray(data.paragraphs) && data.paragraphs.length > 0),
    { message: 'Either "contentEn" or non-empty "paragraphs" is required.' }
  );

const patchArticleSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  titleZh: z.string().trim().max(200).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  level: z.enum(['B1', 'B2', 'C1']).optional(),
  paragraphs: z.array(paragraphSchema).min(1).max(50).optional(),
  keyTerms: z.array(keyTermSchema).max(30).optional(),
});

const completeSchema = z.object({
  completed: z.boolean().optional(),
});

function splitIntoParagraphs(raw: string): Array<{ en: string; zh: string }> {
  const blocks = raw
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 50);

  return blocks.map((en) => ({ en, zh: '' }));
}

function estimateReadMinutes(paragraphs: Array<{ en: string }>): number {
  const words = paragraphs
    .map((p) => p.en)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.min(60, Math.ceil(words / 180)));
}

articlesRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.authUser?.id;

    const articles = await prisma.article.findMany({
      where: userId ? { OR: [{ userId: null }, { userId }] } : { userId: null },
      orderBy: { createdAt: 'asc' },
    });

    const completedSet = new Set<string>();
    if (userId) {
      const completions = await prisma.userArticleCompletion.findMany({
        where: { userId },
        select: { articleId: true },
      });
      for (const c of completions) {
        completedSet.add(c.articleId);
      }
    }

    res.json({
      items: articles.map((article) => ({
        ...article,
        isSystem: article.userId === null,
        completed: userId ? completedSet.has(article.id) : false,
      })),
    });
  } catch (err) {
    next(err);
  }
});

articlesRouter.post('/', requireAuth, validateBody(createArticleSchema), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const body = req.body as z.infer<typeof createArticleSchema>;

    const paragraphs =
      body.paragraphs && body.paragraphs.length > 0
        ? body.paragraphs
        : splitIntoParagraphs(body.contentEn ?? '');

    if (paragraphs.length === 0) {
      res.status(400).json({ error: 'Article content could not be parsed into paragraphs.' });
      return;
    }

    const created = await prisma.article.create({
      data: {
        userId,
        title: body.title,
        titleZh: body.titleZh,
        category: body.category,
        level: body.level,
        readMinutes: estimateReadMinutes(paragraphs),
        paragraphs,
        keyTerms: body.keyTerms,
        completed: false,
      },
    });

    res.status(201).json({
      ...created,
      isSystem: false,
      completed: false,
    });
  } catch (err) {
    next(err);
  }
});

articlesRouter.patch('/:id', requireAuth, validateBody(patchArticleSchema), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const id = String(req.params.id);
    const body = req.body as z.infer<typeof patchArticleSchema>;

    const existing = await prisma.article.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: `Editable article "${id}" not found.` });
      return;
    }

    const updated = await prisma.article.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.titleZh !== undefined ? { titleZh: body.titleZh } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.level !== undefined ? { level: body.level } : {}),
        ...(body.paragraphs !== undefined
          ? { paragraphs: body.paragraphs, readMinutes: estimateReadMinutes(body.paragraphs) }
          : {}),
        ...(body.keyTerms !== undefined ? { keyTerms: body.keyTerms } : {}),
      },
    });

    const completion = await prisma.userArticleCompletion.findUnique({
      where: { userId_articleId: { userId, articleId: id } },
    });

    res.json({
      ...updated,
      isSystem: false,
      completed: Boolean(completion),
    });
  } catch (err) {
    next(err);
  }
});

articlesRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const id = String(req.params.id);

    const deleted = await prisma.article.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: `Deletable article "${id}" not found.` });
      return;
    }

    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
});

articlesRouter.post('/:id/complete', requireAuth, validateBody(completeSchema), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const id = String(req.params.id);
    const requested = (req.body as z.infer<typeof completeSchema>).completed;

    const article = await prisma.article.findFirst({
      where: {
        id,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!article) {
      res.status(404).json({ error: `Article "${id}" not found.` });
      return;
    }

    const existingCompletion = await prisma.userArticleCompletion.findUnique({
      where: { userId_articleId: { userId, articleId: id } },
    });

    const nextCompleted = typeof requested === 'boolean' ? requested : !existingCompletion;

    if (nextCompleted && !existingCompletion) {
      await prisma.$transaction([
        prisma.userArticleCompletion.create({
          data: { userId, articleId: id },
        }),
        prisma.reviewLog.create({
          data: { userId, actionType: 'article_complete' },
        }),
      ]);
    } else if (!nextCompleted && existingCompletion) {
      await prisma.userArticleCompletion.delete({
        where: { userId_articleId: { userId, articleId: id } },
      });
    }

    res.json({
      article: {
        ...article,
        isSystem: article.userId === null,
        completed: nextCompleted,
      },
    });
  } catch (err) {
    next(err);
  }
});
