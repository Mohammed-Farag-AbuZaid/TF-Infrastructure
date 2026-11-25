import type { Context, MiddlewareHandler } from 'hono';
import { Redis } from 'ioredis';

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<number>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, number[]>();

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const cutoff = now - windowMs;
    const list = (this.buckets.get(key) || []).filter((ts) => ts > cutoff);
    list.push(now);
    this.buckets.set(key, list);
    return list.length;
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const fullKey = `tfapi:rl:${key}`;
    const count = await this.redis.incr(fullKey);
    if (count === 1) {
      await this.redis.pexpire(fullKey, windowMs);
    }
    return count;
  }
}

function getClientIp(c: Context): string {
  const cfIp = c.req.header('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return 'unknown-ip';
}

export function rateLimit(opts: {
  maxRequests?: number;
  windowMs?: number;
  bucket?: string;
  store?: RateLimitStore;
}): MiddlewareHandler {
  const max = opts.maxRequests ?? 5;
  const windowMs = opts.windowMs ?? 60_000;
  const bucket = opts.bucket ?? 'default';
  const store = opts.store ?? new MemoryRateLimitStore();

  return async (c, next) => {
    const user = c.get('user') as { uid?: string } | undefined;
    const identity = user?.uid || getClientIp(c);
    const key = `${bucket}:${identity}`;
    const hits = await store.increment(key, windowMs);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - hits)));

    if (hits > max) {
      return c.json(
        {
          error: 'rate_limited',
          message: `Too many requests. Limit is ${max} per ${Math.round(windowMs / 1000)}s.`,
        },
        429,
      );
    }
    await next();
  };
}
