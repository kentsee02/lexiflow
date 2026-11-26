import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { AUTH_COOKIE_NAME, clearAuthCookie, verifyAuthToken } from '../utils/jwt.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function resolveValidSession(token: string): Promise<AuthenticatedUser | null> {
  const payload = verifyAuthToken(token);
  if (!payload) return null;

  const session = await prisma.userSession.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      userId: true,
      revoked: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { tokenVersion: true } },
    },
  });

  const now = new Date();
  if (
    !session ||
    session.revoked ||
    session.expiresAt <= now ||
    session.userId !== payload.sub ||
    session.user.tokenVersion !== payload.ver
  ) {
    return null;
  }

  // Throttle lastUsedAt DB writes to once every 5 minutes per session
  if (now.getTime() - session.lastUsedAt.getTime() > 5 * 60_000) {
    void prisma.userSession
      .update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      })
      .catch(() => undefined);
  }

  return {
    id: payload.sub,
    email: payload.email,
    sessionId: payload.sid,
  };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (token) {
      const user = await resolveValidSession(token);
      if (user) {
        req.authUser = user;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const user = await resolveValidSession(token);
    if (!user) {
      clearAuthCookie(res);
      res.status(401).json({ error: 'Invalid or expired session.' });
      return;
    }

    req.authUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
