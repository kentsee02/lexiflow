import { z } from 'zod';
import { env, isAiEnabled } from '../config/env.js';
import { prisma } from '../db/prisma.js';

export class AiServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface AiRuntimeConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  dailyLimit: number;
}

export interface AiUsageOps {
  countToday: (userId: string, since: Date) => Promise<number>;
  recordUsage: (userId: string, feature: string) => Promise<void>;
}

export interface AiServiceDeps {
  fetchImpl?: typeof fetch;
  configOverride?: AiRuntimeConfig;
  usageOps?: AiUsageOps;
}

const defaultUsageOps: AiUsageOps = {
  async countToday(userId: string, since: Date): Promise<number> {
    return prisma.aiUsageLog.count({
      where: { userId, createdAt: { gte: since } },
    });
  },
  async recordUsage(userId: string, feature: string): Promise<void> {
    await prisma.aiUsageLog.create({
      data: { userId, feature },
    });
  },
};

function getConfig(override?: AiRuntimeConfig): AiRuntimeConfig {
  if (override) return override;
  return {
    enabled: isAiEnabled(),
    baseUrl: env.AI_BASE_URL.replace(/\/+$/, ''),
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL || 'gpt-4o-mini',
    dailyLimit: env.AI_DAILY_LIMIT,
  };
}

function getUtcDayStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getAiUsageStatus(
  userId?: string,
  deps: AiServiceDeps = {}
): Promise<{ enabled: boolean; dailyLimit: number; usedToday: number; remainingToday: number }> {
  const cfg = getConfig(deps.configOverride);
  if (!cfg.enabled) {
    return { enabled: false, dailyLimit: cfg.dailyLimit, usedToday: 0, remainingToday: 0 };
  }
  if (!userId) {
    return {
      enabled: true,
      dailyLimit: cfg.dailyLimit,
      usedToday: 0,
      remainingToday: cfg.dailyLimit,
    };
  }
  const usageOps = deps.usageOps ?? defaultUsageOps;
  const usedToday = await usageOps.countToday(userId, getUtcDayStart());
  return {
    enabled: true,
    dailyLimit: cfg.dailyLimit,
    usedToday,
    remainingToday: Math.max(0, cfg.dailyLimit - usedToday),
  };
}

async function callOpenAiJson<T>(
  cfg: AiRuntimeConfig,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  fetchFn: typeof fetch
): Promise<T> {
  const response = await fetchFn(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new AiServiceError(502, `AI upstream returned HTTP ${response.status}.`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiServiceError(502, 'AI upstream returned an empty response.');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new AiServiceError(502, 'AI upstream returned non-JSON content.');
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AiServiceError(502, 'AI response did not match expected schema.');
  }

  return validated.data;
}

const articleAnalysisSchema = z.object({
  titleZh: z.string().min(1),
  translations: z.array(z.string()),
  keyTerms: z
    .array(
      z.object({
        term: z.string().min(1),
        phonetic: z.string().optional().default(''),
        meaningZh: z.string().min(1),
      })
    )
    .max(8),
});

export async function analyzeArticleWithAi(
  input: { userId: string; title: string; paragraphs: Array<{ en: string }> },
  deps: AiServiceDeps = {}
) {
  const cfg = getConfig(deps.configOverride);
  if (!cfg.enabled) {
    throw new AiServiceError(503, 'AI enhancement is not configured on this server.');
  }

  const usageOps = deps.usageOps ?? defaultUsageOps;
  const usedToday = await usageOps.countToday(input.userId, getUtcDayStart());
  if (usedToday >= cfg.dailyLimit) {
    throw new AiServiceError(429, `Daily AI quota (${cfg.dailyLimit}) reached.`);
  }

  const fetchFn = deps.fetchImpl ?? fetch;
  const result = await callOpenAiJson(
    cfg,
    'You are an English-Chinese language coach. Return strict JSON with keys: titleZh (string), translations (array of Simplified Chinese strings matching input paragraphs in order), keyTerms (array of 3-5 objects with term, phonetic, meaningZh).',
    JSON.stringify({
      title: input.title,
      paragraphs: input.paragraphs.map((p) => p.en),
    }),
    articleAnalysisSchema,
    fetchFn
  );

  await usageOps.recordUsage(input.userId, 'analyze_article');

  return {
    ...result,
    remainingToday: Math.max(0, cfg.dailyLimit - (usedToday + 1)),
  };
}

const exampleSchema = z.object({
  example: z.string().min(1),
  exampleZh: z.string().min(1),
  tipZh: z.string().optional().default(''),
});

export async function generateExampleWithAi(
  input: { userId: string; word: string; meaningZh?: string; level?: string },
  deps: AiServiceDeps = {}
) {
  const cfg = getConfig(deps.configOverride);
  if (!cfg.enabled) {
    throw new AiServiceError(503, 'AI enhancement is not configured on this server.');
  }

  const usageOps = deps.usageOps ?? defaultUsageOps;
  const usedToday = await usageOps.countToday(input.userId, getUtcDayStart());
  if (usedToday >= cfg.dailyLimit) {
    throw new AiServiceError(429, `Daily AI quota (${cfg.dailyLimit}) reached.`);
  }

  const fetchFn = deps.fetchImpl ?? fetch;
  const result = await callOpenAiJson(
    cfg,
    'You are an English vocabulary coach. Return strict JSON with keys: example (natural English sentence using the target word), exampleZh (Simplified Chinese translation), tipZh (brief usage note in Simplified Chinese).',
    JSON.stringify({
      word: input.word,
      meaningZh: input.meaningZh ?? '',
      level: input.level ?? 'B2',
    }),
    exampleSchema,
    fetchFn
  );

  await usageOps.recordUsage(input.userId, 'generate_example');

  return {
    ...result,
    remainingToday: Math.max(0, cfg.dailyLimit - (usedToday + 1)),
  };
}
