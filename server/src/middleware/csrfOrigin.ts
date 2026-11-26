import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function parseOriginHeader(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Defense-in-depth CSRF guard: for state-changing requests coming from browsers
 * (which carry Origin or Referer), require the origin to match configured CORS
 * origins or the current request host.
 */
export function verifyOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const rawOrigin = req.get('origin');
  const rawReferer = req.get('referer');
  const requestOrigin = parseOriginHeader(rawOrigin) ?? parseOriginHeader(rawReferer);

  // Non-browser clients / direct API tests without Origin/Referer pass through
  if (!rawOrigin && !rawReferer) {
    next();
    return;
  }

  if (!requestOrigin) {
    res.status(403).json({ error: 'Cross-origin request blocked.' });
    return;
  }

  const allowed = new Set(env.corsOrigins);
  const host = req.get('host');
  if (host) {
    allowed.add(`${req.protocol}://${host}`);
  }

  if (!allowed.has(requestOrigin)) {
    res.status(403).json({ error: 'Cross-origin request blocked.' });
    return;
  }

  next();
}
