import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://lexiflow:lexiflow_dev_password@127.0.0.1:5432/lexiflow?schema=public'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().default('dev-insecure-jwt-secret-change-in-production'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  AI_BASE_URL: z.string().optional().default(''),
  AI_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().optional().default('gpt-4o-mini'),
  AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
});

const parsed = envSchema.parse(process.env);

if (
  parsed.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET || parsed.JWT_SECRET.includes('change-in-production') || parsed.JWT_SECRET.length < 32)
) {
  throw new Error('JWT_SECRET must be set to a strong secret (>= 32 chars) in production.');
}

export const env = {
  ...parsed,
  corsOrigins: parsed.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export function isAiEnabled(): boolean {
  return Boolean(env.AI_BASE_URL.trim() && env.AI_API_KEY.trim());
}
