import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

describe('LexiFlow Auth, Security & Session Integration (PostgreSQL)', () => {
  let server: http.Server;
  let baseUrl = '';
  const suffix = crypto.randomUUID().slice(0, 8);
  const testEmail = `test-${suffix}@example.com`;
  const lockEmail = `lock-${suffix}@example.com`;
  const testPassword = 'TestPassword123!';
  const newPassword = 'RotatedPassword456!';
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
    await prisma.user.deleteMany({ where: { email: { in: [testEmail, lockEmail] } } });
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

  it('rejects weak passwords on register and seeds starter vocab cards on strong register', async () => {
    const weakRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'weakpassword',
        displayName: 'Weak User',
      }),
    });
    assert.equal(weakRes.status, 400);

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

  it('blocks cross-origin mutating requests with 403', async () => {
    const csrfRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example',
        Cookie: authCookie,
      },
    });
    assert.equal(csrfRes.status, 403);
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

  it('revokes session cookie immediately on logout and supports multi-device password change', async () => {
    const oldCookie = authCookie;
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: oldCookie },
    });
    assert.equal(logoutRes.status, 200);

    // Replaying revoked cookie must be rejected
    const replayMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: oldCookie },
    });
    assert.equal(((await replayMe.json()) as { user: unknown }).user, null);

    const replayVocab = await fetch(`${baseUrl}/api/vocab`, {
      headers: { Cookie: oldCookie },
    });
    assert.equal(replayVocab.status, 401);

    // Log in two separate devices
    const loginA = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Device-A' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.equal(loginA.status, 200);
    const cookieA = (loginA.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const loginB = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Device-B' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.equal(loginB.status, 200);
    const cookieB = (loginB.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const sessionsRes = await fetch(`${baseUrl}/api/auth/sessions`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(sessionsRes.status, 200);
    const sessionsBody = (await sessionsRes.json()) as {
      items: Array<{ id: string; isCurrent: boolean }>;
    };
    assert.equal(sessionsBody.items.length, 2);

    // Device A changes password -> Device B must immediately lose access
    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword,
      }),
    });
    assert.equal(changeRes.status, 200);
    authCookie = (changeRes.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const deviceBCheck = await fetch(`${baseUrl}/api/vocab`, {
      headers: { Cookie: cookieB },
    });
    assert.equal(deviceBCheck.status, 401);

    const deviceACheck = await fetch(`${baseUrl}/api/vocab`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(deviceACheck.status, 200);

    // Logout all invalidates current session as well
    const logoutAllRes = await fetch(`${baseUrl}/api/auth/logout-all`, {
      method: 'POST',
      headers: { Cookie: authCookie },
    });
    assert.equal(logoutAllRes.status, 200);

    const afterLogoutAll = await fetch(`${baseUrl}/api/vocab`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(afterLogoutAll.status, 401);
  });

  it('locks account after 5 failed login attempts and allows account deletion with password', async () => {
    const regLock = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: lockEmail,
        password: testPassword,
        displayName: 'Lock Tester',
      }),
    });
    assert.equal(regLock.status, 201);
    const lockCookie = (regLock.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    for (let i = 1; i <= 4; i += 1) {
      const failRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lockEmail, password: 'WrongPassword123' }),
      });
      assert.equal(failRes.status, 401);
    }

    const fifthFail = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lockEmail, password: 'WrongPassword123' }),
    });
    assert.equal(fifthFail.status, 429);

    // Even the correct password must be blocked while locked
    const lockedCorrect = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lockEmail, password: testPassword }),
    });
    assert.equal(lockedCorrect.status, 429);

    // Wrong password cannot delete account
    const badDel = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: lockCookie },
      body: JSON.stringify({ password: 'WrongPassword123', confirmText: 'DELETE' }),
    });
    assert.equal(badDel.status, 401);

    // Correct password + DELETE deletes account permanently
    const goodDel = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: lockCookie },
      body: JSON.stringify({ password: testPassword, confirmText: 'DELETE' }),
    });
    assert.equal(goodDel.status, 200);

    const row = await prisma.user.findUnique({ where: { email: lockEmail } });
    assert.equal(row, null);
  });
});
