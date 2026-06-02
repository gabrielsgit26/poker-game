import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Redis } from 'ioredis';
import { Connection } from 'mongoose';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getStatus(): Promise<{
    mongo: 'ok' | 'down';
    redis: 'ok' | 'down';
  }> {
    const mongo: 'ok' | 'down' =
      this.mongo.readyState === 1 ? 'ok' : 'down';

    let redis: 'ok' | 'down' = 'down';
    try {
      const pong = await this.redis.ping();
      redis = pong === 'PONG' ? 'ok' : 'down';
    } catch {
      redis = 'down';
    }

    return { mongo, redis };
  }
}
