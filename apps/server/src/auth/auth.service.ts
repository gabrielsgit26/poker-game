import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

const SESSION_PREFIX = 'poker:sess:';
const SESSION_TTL_SEC = 60 * 60 * 24 * 14; // 14 days
export const POKER_SESSION_COOKIE = 'poker_sid';

@Injectable()
export class AuthService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async resolveUserIdFromRequest(req: Request): Promise<string> {
    const sid = req.cookies?.[POKER_SESSION_COOKIE];
    if (typeof sid === 'string' && sid.length >= 16) {
      try {
        const uid = await this.redis.get(`${SESSION_PREFIX}${sid}`);
        if (uid) return uid;
      } catch {
        /* optional Redis */
      }
    }
    const raw = req.headers['x-dev-user-id'];
    const header =
      typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? raw[0]?.trim() : '';
    return header.length > 0 ? header : 'local-player';
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
}
