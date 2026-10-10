import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

const SESSION_PREFIX = 'poker:sess:';
const SESSION_TTL_SEC = 60 * 60 * 24 * 14; // 14 days
export const POKER_SESSION_COOKIE = 'poker_sid';

/** Session token from `Authorization: Bearer <token>`, or null. */
export function sessionTokenFromRequest(req: Request): string | null {
  const h = req.headers.authorization;
  const m = typeof h === 'string' ? /^Bearer\s+(\S+)$/i.exec(h.trim()) : null;
  return m ? m[1]! : null;
}

@Injectable()
export class AuthService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async resolveUserIdFromRequest(req: Request): Promise<string> {
    // Bearer token first: the web app and API are on different sites (e.g. Vercel + ngrok),
    // where the cookie is never sent and Telegram webviews may block third-party cookies.
    for (const sid of [sessionTokenFromRequest(req), req.cookies?.[POKER_SESSION_COOKIE]]) {
      const uid = await this.userIdForSession(sid);
      if (uid) return uid;
    }
    const raw = req.headers['x-dev-user-id'];
    const header =
      typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? raw[0]?.trim() : '';
    return header.length > 0 ? header : 'local-player';
  }

  async userIdForSession(sid: unknown): Promise<string | null> {
    if (typeof sid !== 'string' || sid.length < 16) return null;
    try {
      return await this.redis.get(`${SESSION_PREFIX}${sid}`);
    } catch {
      return null; /* optional Redis */
    }
  }

  async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.setex(`${SESSION_PREFIX}${token}`, SESSION_TTL_SEC, userId);
    return token;
  }

  async revokeSession(token: string): Promise<void> {
    try {
      await this.redis.del(`${SESSION_PREFIX}${token}`);
    } catch {
      /* */
    }
  }

  /**
   * Comma-separated `PLATFORM_ADMIN_USER_IDS` in server env (e.g. `local-player,tg_123`).
   * Used for platform-wide chip grants and `/admin` overview (Phase 9–10 MVP).
   */
  isPlatformAdminUserId(userId: string): boolean {
    const raw = process.env.PLATFORM_ADMIN_USER_IDS?.trim();
    if (!raw) return false;
    const ids = new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    );
    return ids.has(userId);
  }
}
