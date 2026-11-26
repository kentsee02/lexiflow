import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';

describe('LexiFlow REST API', () => {
  let server;
  let baseUrl;
  let tempDir;

  before(async () => {
    process.env.NODE_ENV = 'test';
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexiflow-test-'));
    const dataFile = path.join(tempDir, 'store.json');
    const app = createApp({ dataFile });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('GET /api/health returns service status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'lexiflow-api');
  });

  it('GET /api/daily returns a valid daily phrase', async () => {
    const res = await fetch(`${baseUrl}/api/daily`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.phrase);
    assert.ok(body.meaningZh);
    assert.ok(body.total >= 1);
  });

  it('GET /api/vocab returns seeded vocabulary and supports filters', async () => {
    const res = await fetch(`${baseUrl}/api/vocab?level=C1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.length > 0);
    assert.ok(body.items.every((item) => item.level === 'C1'));
    assert.ok(body.summary.total >= body.items.length);
  });

  it('POST, PATCH, and DELETE /api/vocab persist changes', async () => {
    const badRes = await fetch(`${baseUrl}/api/vocab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'incomplete' }),
    });
    assert.equal(badRes.status, 400);

    const createRes = await fetch(`${baseUrl}/api/vocab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: 'ubiquitous',
        phonetic: '/juːˈbɪkwɪtəs/',
        partOfSpeech: 'adj',
        meaningZh: '无处不在的',
        example: 'HTTPS has become ubiquitous across modern web applications.',
        level: 'C1',
        category: 'Tech',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.word, 'ubiquitous');
    assert.equal(created.mastered, false);

    const patchRes = await fetch(`${baseUrl}/api/vocab/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mastered: true }),
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.mastered, true);
    assert.equal(patched.reviewCount, 1);

    const delRes = await fetch(`${baseUrl}/api/vocab/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);

    const missingRes = await fetch(`${baseUrl}/api/vocab/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(missingRes.status, 404);
  });

  it('GET /api/articles and POST /api/articles/:id/complete persist completion', async () => {
    const listRes = await fetch(`${baseUrl}/api/articles`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(listBody.items.length >= 2);

    const target = listBody.items.find((a) => !a.completed) || listBody.items[0];
    const toggleRes = await fetch(`${baseUrl}/api/articles/${target.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(toggleRes.status, 200);
    const toggleBody = await toggleRes.json();
    assert.equal(toggleBody.article.completed, true);
    assert.ok(toggleBody.progress.articlesRead >= 1);
  });

  it('POST /api/progress/quiz updates progress statistics', async () => {
    const res = await fetch(`${baseUrl}/api/progress/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: 5, total: 5 }),
    });
    assert.equal(res.status, 200);
    const progress = await res.json();
    assert.equal(progress.bestQuizScore, 100);
    assert.ok(progress.quizzesTaken >= 3);
  });
});
