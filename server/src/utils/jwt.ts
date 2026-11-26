import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'lexiflow_token';
const TOKEN_EXPIRES_IN = '7d';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthTokenPayload {
  sub: string;
  email: string;
  sid: string;
  ver: number;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.sub === 'string' &&
      typeof decoded.email === 'string' &&
      typeof decoded.sid === 'string' &&
      typeof decoded.ver === 'number'
    ) {
      return {
        sub: decoded.sub,
        email: decoded.email,
        sid: decoded.sid,
        ver: decoded.ver,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    path: '/',
  });
}
