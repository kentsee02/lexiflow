import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { signAuthToken, verifyAuthToken } from '../src/utils/jwt.js';
import { calculateSm2Review, previewReviewIntervals } from '../src/services/srs.js';
import { buildHeatmap, computeStreakDays } from '../src/services/dashboard.js';
import { normalizeLookupWord } from '../src/services/dictionary.js';
import {
  AiServiceError,
  analyzeArticleWithAi,
  generateExampleWithAi,
} from '../src/services/ai.js';

describe('Password utilities', () => {
  it('hashes passwords with unique salts and verifies correctly', async () => {
    const hashA = await hashPassword('SuperSecret123!');
    const hashB = await hashPassword('SuperSecret123!');

    assert.notEqual(hashA, hashB);
    assert.ok(hashA.startsWith('scrypt$'));
    assert.equal(await verifyPassword('SuperSecret123!', hashA), true);
    assert.equal(await verifyPassword('WrongPassword', hashA), false);
    assert.equal(await verifyPassword('SuperSecret123!', 'malformed-hash'), false);
  });
});

describe('JWT utilities', () => {
  it('signs and verifies valid tokens and rejects tampered tokens', () => {
    const token = signAuthToken({ sub: 'user-123', email: 'learner@example.com' });
    const verified = verifyAuthToken(token);

    assert.deepEqual(verified, { sub: 'user-123', email: 'learner@example.com' });
    assert.equal(verifyAuthToken(`${token}tampered`), null);
    assert.equal(verifyAuthToken('not.a.jwt'), null);
  });
});

describe('SM-2 spaced repetition engine', () => {
  const fixedNow = new Date('2026-11-27T10:00:00.000Z');

  it('progresses Good reviews 1d -> 6d -> scaled and reaches mastered >= 21d', () => {
    let state = { status: 'new', easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

    const r1 = calculateSm2Review(state, 3, fixedNow);
    assert.equal(r1.intervalDays, 1);
    assert.equal(r1.repetitions, 1);
    assert.equal(r1.status, 'learning');

    const r2 = calculateSm2Review(r1, 3, fixedNow);
    assert.equal(r2.intervalDays, 6);
    assert.equal(r2.repetitions, 2);
    assert.equal(r2.status, 'learning');

    const r3 = calculateSm2Review(r2, 3, fixedNow);
    assert.equal(r3.intervalDays, 15);
    assert.equal(r3.status, 'learning');

    const r4 = calculateSm2Review(r3, 3, fixedNow);
    assert.equal(r4.intervalDays, 38);
    assert.equal(r4.status, 'mastered');
  });

  it('resets repetitions on Again and floors easeFactor at 1.3', () => {
    const state = { status: 'learning', easeFactor: 1.35, intervalDays: 10, repetitions: 3 };
    const r = calculateSm2Review(state, 1, fixedNow);

    assert.equal(r.repetitions, 0);
    assert.equal(r.intervalDays, 0);
    assert.equal(r.easeFactor, 1.3);
    assert.equal(r.status, 'learning');
    assert.equal(r.nextReviewAt.getTime() - fixedNow.getTime(), 10 * 60_000);
  });

  it('previews readable labels for all 4 review qualities', () => {
    const previews = previewReviewIntervals({
      status: 'new',
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
    });
    assert.equal(previews[1], '10m');
    assert.equal(previews[2], '1d');
    assert.equal(previews[3], '1d');
    assert.equal(previews[4], '4d');
  });
});

describe('Dashboard heatmap and streak helpers', () => {
  const now = new Date('2026-11-27T12:00:00.000Z');

  it('builds a 90-day heatmap with correct intensity levels', () => {
    const logs = [
      new Date('2026-11-27T01:00:00.000Z'),
      new Date('2026-11-27T02:00:00.000Z'),
      new Date('2026-11-27T03:00:00.000Z'),
      new Date('2026-11-26T08:00:00.000Z'),
    ];
    const heatmap = buildHeatmap(logs, 90, now);

    assert.equal(heatmap.length, 90);
    assert.equal(heatmap[0].date, '2026-08-30');
    assert.equal(heatmap[89].date, '2026-11-27');
    assert.equal(heatmap[89].count, 3);
    assert.equal(heatmap[89].level, 2);
    assert.equal(heatmap[88].count, 1);
    assert.equal(heatmap[88].level, 1);
    assert.equal(heatmap[0].level, 0);
  });

  it('computes consecutive streak days from today or yesterday', () => {
    const activeToday = [
      new Date('2026-11-27T01:00:00.000Z'),
      new Date('2026-11-26T05:00:00.000Z'),
      new Date('2026-11-25T09:00:00.000Z'),
      new Date('2026-11-23T09:00:00.000Z'),
    ];
    assert.equal(computeStreakDays(activeToday, now), 3);

    const activeYesterdayOnly = [
      new Date('2026-11-26T05:00:00.000Z'),
      new Date('2026-11-25T09:00:00.000Z'),
    ];
    assert.equal(computeStreakDays(activeYesterdayOnly, now), 2);
    assert.equal(computeStreakDays([], now), 0);
  });
});

describe('Dictionary word normalization', () => {
  it('strips outer punctuation and rejects invalid inputs', () => {
    assert.equal(normalizeLookupWord('  "Resilient," '), 'resilient');
    assert.equal(normalizeLookupWord('trade-off.'), 'trade-off');
    assert.equal(normalizeLookupWord('12345'), null);
    assert.equal(normalizeLookupWord(''), null);
  });
});

describe('Optional AI enhancement service', () => {
  const enabledCfg = {
    enabled: true,
    baseUrl: 'https://ai.example.test/v1',
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
    dailyLimit: 2,
  };

  it('throws 503 when AI is not configured', async () => {
    await assert.rejects(
      () =>
        analyzeArticleWithAi(
          { userId: 'u1', title: 'Test', paragraphs: [{ en: 'Hello world.' }] },
          { configOverride: { ...enabledCfg, enabled: false } }
        ),
      (err: unknown) => err instanceof AiServiceError && err.statusCode === 503
    );
  });

  it('throws 429 when daily user quota is exceeded', async () => {
    await assert.rejects(
      () =>
        generateExampleWithAi(
          { userId: 'u1', word: 'resilient' },
          {
            configOverride: enabledCfg,
            usageOps: {
              countToday: async () => 2,
              recordUsage: async () => undefined,
            },
          }
        ),
      (err: unknown) => err instanceof AiServiceError && err.statusCode === 429
    );
  });

  it('parses valid OpenAI-compatible JSON responses and records usage', async () => {
    let recordedFeature = '';
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  titleZh: '测试标题',
                  translations: ['第一段中文。'],
                  keyTerms: [{ term: 'resilient', phonetic: '/rɪˈzɪliənt/', meaningZh: '有韧性的' }],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const result = await analyzeArticleWithAi(
      { userId: 'u1', title: 'Test', paragraphs: [{ en: 'First paragraph.' }] },
      {
        configOverride: enabledCfg,
        fetchImpl: mockFetch,
        usageOps: {
          countToday: async () => 0,
          recordUsage: async (_u, feature) => {
            recordedFeature = feature;
          },
        },
      }
    );

    assert.equal(result.titleZh, '测试标题');
    assert.equal(result.translations.length, 1);
    assert.equal(result.remainingToday, 1);
    assert.equal(recordedFeature, 'analyze_article');
  });
});
