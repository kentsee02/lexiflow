import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

describe('LexiFlow Auth & Public API Integration (PostgreSQL)', () => {
  let server: http.Server;
  let baseUrl = '';
  const testEmail = `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const testPassword = 'TestPassword123!';
  let authCookie = '';

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
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await prisma.$disconnect();
  });

  it('GET /api/health confirms PostgreSQL connectivity', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; database: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'connected');
  });

  it('GET /api/daily and /api/seed/guest return starter content', async () => {
    const dailyRes = await fetch(`${baseUrl}/api/daily`);
    assert.equal(dailyRes.status, 200);
    const daily = (await dailyRes.json()) as { phrase: string; total: number };
    assert.ok(daily.phrase);
    assert.ok(daily.total >= 1);

    const seedRes = await fetch(`${baseUrl}/api/seed/guest`);
    assert.equal(seedRes.status, 200);
    const seed = (await seedRes.json()) as { vocab: unknown[]; articles: unknown[] };
    assert.ok(seed.vocab.length >= 18);
    assert.ok(seed.articles.length >= 3);
  });

  it('registers a user, seeds starter vocab cards, and sets HttpOnly cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        displayName: 'Test Learner',
        dailyGoal: 25,
      }),
    });

    assert.equal(res.status, 201);
    const setCookie = res.headers.get('set-cookie') ?? '';
    assert.ok(setCookie.includes('lexiflow_token='));
    assert.ok(setCookie.toLowerCase().includes('httponly'));
    authCookie = setCookie.split(';')[0] ?? '';

    const body = (await res.json()) as {
      user: { id: string; email: string; displayName: string; dailyGoal: number };
    };
    assert.equal(body.user.email, testEmail);
    assert.equal(body.user.dailyGoal, 25);

    const cardCount = await prisma.vocabCard.count({ where: { userId: body.user.id } });
    assert.equal(cardCount, 18);

    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        displayName: 'Duplicate',
      }),
    });
    assert.equal(dupRes.status, 409);
  });

  it('returns current user on /api/auth/me and updates profile', async () => {
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(unauthRes.status, 200);
    const unauthBody = (await unauthRes.json()) as { user: unknown };
    assert.equal(unauthBody.user, null);

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(meRes.status, 200);
    const meBody = (await meRes.json()) as { user: { email: string } };
    assert.equal(meBody.user.email, testEmail);

    const patchRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({ displayName: 'Updated Learner', dailyGoal: 30 }),
    });
    assert.equal(patchRes.status, 200);
    const patchBody = (await patchRes.json()) as {
      user: { displayName: string; dailyGoal: number };
    };
    assert.equal(patchBody.user.displayName, 'Updated Learner');
    assert.equal(patchBody.user.dailyGoal, 30);
  });

  it('migrates guest vocab and articles without duplicating starter words', async () => {
    const res = await fetch(`${baseUrl}/api/auth/migrate-guest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        vocab: [
          {
            word: 'articulate',
            meaningZh: '重复词应跳过',
            example: 'Should be deduplicated.',
            level: 'B2',
            category: 'Business',
          },
          {
            word: 'ubiquitous',
            meaningZh: '无处不在的',
            example: 'Cloud APIs are ubiquitous in modern software.',
            level: 'C1',
            category: 'Tech',
          },
        ],
        articles: [
          {
            title: 'Guest Imported Note',
            paragraphs: [{ en: 'Learning in context accelerates retention.' }],
          },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { importedWords: number; importedArticles: number };
    assert.equal(body.importedWords, 1);
    assert.equal(body.importedArticles, 1);
  });

  it('logs out and logs back in with valid credentials', async () => {
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    assert.equal(logoutRes.status, 200);

    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword123' }),
    });
    assert.equal(badLogin.status, 401);

    const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.equal(goodLogin.status, 200);
    const cookie = goodLogin.headers.get('set-cookie') ?? '';
    assert.ok(cookie.includes('lexiflow_token='));
  });
});
