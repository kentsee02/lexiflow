import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

describe('LexiFlow Learning Engine Integration (PostgreSQL)', () => {
  let server: http.Server;
  let baseUrl = '';
  const suffix = crypto.randomUUID().slice(0, 8);
  const emailA = `learner-a-${suffix}@example.com`;
  const emailB = `learner-b-${suffix}@example.com`;
  const password = 'LearningPassword123!';
  let cookieA = '';
  let cookieB = '';
  let createdCardId = '';
  let createdArticleId = '';

  before(async () => {
    process.env.NODE_ENV = 'test';
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });

    const regA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password, displayName: 'Learner A' }),
    });
    cookieA = (regA.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const regB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password, displayName: 'Learner B' }),
    });
    cookieB = (regB.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await prisma.$disconnect();
  });

  it('supports vocab CRUD, SRS review scheduling, and cross-user isolation', async () => {
    const unauth = await fetch(`${baseUrl}/api/vocab`);
    assert.equal(unauth.status, 401);

    const createRes = await fetch(`${baseUrl}/api/vocab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        word: 'ephemeral',
        phonetic: '/ɪˈfemərəl/',
        partOfSpeech: 'adj',
        meaningZh: '短暂的；瞬息的',
        example: 'Trendy frameworks are often ephemeral, while fundamentals endure.',
        level: 'C1',
        category: 'Academic',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as { id: string; status: string };
    createdCardId = created.id;
    assert.equal(created.status, 'new');

    // User B must not see or modify User A's card
    const crossPatch = await fetch(`${baseUrl}/api/vocab/${createdCardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({ meaningZh: 'hacked' }),
    });
    assert.equal(crossPatch.status, 404);

    // Fetch due queue for User A
    const dueRes = await fetch(`${baseUrl}/api/vocab/due?limit=5`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(dueRes.status, 200);
    const dueBody = (await dueRes.json()) as {
      items: Array<{ id: string; intervalPreviews: Record<string, string> }>;
      totalDue: number;
    };
    assert.ok(dueBody.totalDue >= 18);
    assert.ok(dueBody.items[0].intervalPreviews['3']);

    // Submit SM-2 review (quality=3 Good)
    const reviewRes = await fetch(`${baseUrl}/api/vocab/${createdCardId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ quality: 3 }),
    });
    assert.equal(reviewRes.status, 200);
    const reviewBody = (await reviewRes.json()) as {
      card: { intervalDays: number; repetitions: number; status: string };
      reviewLog: { actionType: string; quality: number };
    };
    assert.equal(reviewBody.card.intervalDays, 1);
    assert.equal(reviewBody.card.repetitions, 1);
    assert.equal(reviewBody.card.status, 'learning');
    assert.equal(reviewBody.reviewLog.actionType, 'srs_review');
  });

  it('looks up dictionary cache and rejects invalid words', async () => {
    const badRes = await fetch(`${baseUrl}/api/dictionary/12345`);
    assert.equal(badRes.status, 400);

    const hitRes = await fetch(`${baseUrl}/api/dictionary/articulate`);
    assert.equal(hitRes.status, 200);
    const hitBody = (await hitRes.json()) as { word: string; found: boolean; source: string };
    assert.equal(hitBody.word, 'articulate');
    assert.equal(hitBody.found, true);
    assert.equal(hitBody.source, 'cache');
  });

  it('imports custom articles and isolates article completion per user', async () => {
    const importRes = await fetch(`${baseUrl}/api/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        title: 'Custom Reading Passage',
        contentEn: 'First paragraph about English fluency.\n\nSecond paragraph about daily habits.',
        level: 'B2',
      }),
    });
    assert.equal(importRes.status, 201);
    const imported = (await importRes.json()) as {
      id: string;
      paragraphs: Array<{ en: string }>;
      isSystem: boolean;
    };
    createdArticleId = imported.id;
    assert.equal(imported.paragraphs.length, 2);
    assert.equal(imported.isSystem, false);

    // User A marks shared system article sys-art-01 complete
    const completeRes = await fetch(`${baseUrl}/api/articles/sys-art-01/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(completeRes.status, 200);
    const completeBody = (await completeRes.json()) as { article: { completed: boolean } };
    assert.equal(completeBody.article.completed, true);

    // User B must still see sys-art-01 as completed: false and must NOT see User A's custom article
    const listBRes = await fetch(`${baseUrl}/api/articles`, {
      headers: { Cookie: cookieB },
    });
    assert.equal(listBRes.status, 200);
    const listB = (await listBRes.json()) as {
      items: Array<{ id: string; completed: boolean }>;
    };
    const sys01ForB = listB.items.find((a) => a.id === 'sys-art-01');
    assert.equal(sys01ForB?.completed, false);
    assert.equal(listB.items.some((a) => a.id === createdArticleId), false);
  });

  it('records quiz scores and returns 90-day dashboard analytics', async () => {
    const quizRes = await fetch(`${baseUrl}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ score: 4, total: 5 }),
    });
    assert.equal(quizRes.status, 200);
    const quizBody = (await quizRes.json()) as { percent: number; bestScore: number };
    assert.equal(quizBody.percent, 80);
    assert.equal(quizBody.bestScore, 80);

    const dashRes = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(dashRes.status, 200);
    const dash = (await dashRes.json()) as {
      todayReviewed: number;
      streakDays: number;
      heatmap: Array<{ date: string; count: number }>;
      articles: { completed: number };
      quiz: { totalTaken: number; bestScore: number };
    };
    assert.equal(dash.heatmap.length, 90);
    assert.ok(dash.todayReviewed >= 3);
    assert.ok(dash.streakDays >= 1);
    assert.ok(dash.articles.completed >= 1);
    assert.equal(dash.quiz.totalTaken, 1);
    assert.equal(dash.quiz.bestScore, 80);
  });

  it('reports AI status disabled by default and returns 503 when unconfigured', async () => {
    const statusRes = await fetch(`${baseUrl}/api/ai/status`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as { enabled: boolean };
    assert.equal(statusBody.enabled, false);

    const analyzeRes = await fetch(`${baseUrl}/api/ai/analyze-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        title: 'Sample',
        paragraphs: [{ en: 'Testing AI fallback.' }],
      }),
    });
    assert.equal(analyzeRes.status, 503);
  });

  it('deletes user-owned card and custom article cleanly', async () => {
    const delCard = await fetch(`${baseUrl}/api/vocab/${createdCardId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieA },
    });
    assert.equal(delCard.status, 200);

    const delArticle = await fetch(`${baseUrl}/api/articles/${createdArticleId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieA },
    });
    assert.equal(delArticle.status, 200);
  });
});
