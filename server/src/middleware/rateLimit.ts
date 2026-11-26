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
