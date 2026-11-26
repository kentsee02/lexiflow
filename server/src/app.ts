import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '512kb' }));
  app.use('/api', apiRateLimiter);

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (env.NODE_ENV !== 'test') {
        const ms = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
      }
    });
    next();
  });

  app.use('/api', publicRouter);
  app.use('/api/auth', authRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
