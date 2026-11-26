import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const skipInTest = () => env.NODE_ENV === 'test';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: 'Too many requests. Please slow down.' },
});

export const dictionaryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: 'Too many dictionary lookups. Please try again shortly.' },
});

export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: 'Too many AI requests. Please slow down.' },
});
