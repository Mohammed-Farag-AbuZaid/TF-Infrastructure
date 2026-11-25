import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { MemoryRateLimitStore, RedisRateLimitStore } from './middleware/rateLimit.js';

const port = Number(process.env.PORT || 4000);
const redisUrl = process.env.REDIS_URL;

const rateLimitStore = redisUrl ? new RedisRateLimitStore(redisUrl) : new MemoryRateLimitStore();

const app = createApp({
  rateLimitStore,
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`tf-api listening on http://0.0.0.0:${info.port}`);
});
