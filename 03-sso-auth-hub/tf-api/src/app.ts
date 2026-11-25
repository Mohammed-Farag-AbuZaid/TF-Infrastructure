import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  createFirebaseTokenVerifier,
  optionalAuth,
  requireRole,
  type AuthUser,
  type TokenVerifier,
} from './middleware/auth.js';
import { MemoryRateLimitStore, rateLimit, type RateLimitStore } from './middleware/rateLimit.js';
import { requireTurnstile, type TurnstileVerifier } from './middleware/turnstile.js';
import {
  CertificateSerialSchema,
  DonationSchema,
  IdeaSchema,
  RolePromoteSchema,
  VolunteerSchema,
} from './schemas.js';

export type ForwardFn = (path: string, method: 'GET' | 'POST', payload?: unknown) => Promise<{
  ok: boolean;
  status: number;
  data: unknown;
}>;

export interface AppConfig {
  firebaseProjectId?: string;
  n8nBaseUrl?: string;
  n8nWebhookSecret?: string;
  turnstileSecretKey?: string;
  bypassTurnstile?: boolean;
  tokenVerifier?: TokenVerifier;
  turnstileVerifier?: TurnstileVerifier;
  rateLimitStore?: RateLimitStore;
  rateLimitMax?: number;
  forwarder?: ForwardFn;
}

export function createDefaultForwarder(baseUrl: string, webhookSecret: string): ForwardFn {
  const trimmed = baseUrl.replace(/\/$/, '');
  return async (path, method, payload) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (webhookSecret) headers['X-TF-Webhook-Secret'] = webhookSecret;

    const res = await fetch(`${trimmed}${path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(payload ?? {}) : undefined,
    });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  };
}

export function createApp(config: AppConfig = {}) {
  const projectId = config.firebaseProjectId ?? process.env.FIREBASE_PROJECT_ID ?? 'tf-unions';
  const n8nBaseUrl = config.n8nBaseUrl ?? process.env.N8N_BASE_URL ?? 'http://n8n:5678';
  const n8nWebhookSecret = config.n8nWebhookSecret ?? process.env.N8N_WEBHOOK_SECRET ?? '';
  const verifier = config.tokenVerifier ?? createFirebaseTokenVerifier(projectId);
  const store = config.rateLimitStore ?? new MemoryRateLimitStore();
  const forward = config.forwarder ?? createDefaultForwarder(n8nBaseUrl, n8nWebhookSecret);

  const app = new Hono<{ Variables: { user?: AuthUser } }>();

  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return 'https://www.tfunions.com';
        if (/^https:\/\/([a-z0-9-]+\.)?tfunions\.com$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
          return origin;
        }
        return 'https://www.tfunions.com';
      },
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'cf-turnstile-response', 'x-turnstile-token'],
      maxAge: 86400,
    }),
  );

  app.get('/v1/health', (c) =>
    c.json({
      status: 'ok',
      service: 'tf-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }),
  );

  const publicWriteMiddlewares = [
    optionalAuth(verifier),
    rateLimit({ maxRequests: config.rateLimitMax ?? 5, windowMs: 60_000, bucket: 'write', store }),
    requireTurnstile({
      secretKey: config.turnstileSecretKey,
      bypass: config.bypassTurnstile,
      verifier: config.turnstileVerifier,
    }),
  ] as const;

  app.post('/v1/ideas', ...publicWriteMiddlewares, async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = IdeaSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
    }
    const user = c.get('user');
    const result = await forward('/webhook/qa-submit', 'POST', {
      ...parsed.data,
      uid: user?.uid ?? parsed.data.uid ?? 'anonymous',
    });
    return c.json(result.data, result.ok ? 201 : (result.status as 400 | 502));
  });

  app.post('/v1/volunteers', ...publicWriteMiddlewares, async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = VolunteerSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
    }
    const user = c.get('user');
    const result = await forward('/webhook/volunteer-apply', 'POST', {
      ...parsed.data,
      uid: user?.uid ?? null,
    });
    return c.json(result.data, result.ok ? 201 : (result.status as 400 | 502));
  });

  app.post('/v1/donations', ...publicWriteMiddlewares, async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = DonationSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
    }
    const user = c.get('user');
    const result = await forward('/webhook/submit-donation', 'POST', {
      ...parsed.data,
      uid: user?.uid ?? null,
    });
    return c.json(result.data, result.ok ? 201 : (result.status as 400 | 502));
  });

  app.get(
    '/v1/certificates/:serial',
    rateLimit({ maxRequests: config.rateLimitMax ?? 20, windowMs: 60_000, bucket: 'cert', store }),
    async (c) => {
      const parsed = CertificateSerialSchema.safeParse(c.req.param('serial'));
      if (!parsed.success) {
        return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
      }
      const serial = parsed.data;
      const result = await forward(`/webhook/verify-certificate?code=${encodeURIComponent(serial)}`, 'GET');
      return c.json(result.data, result.ok ? 200 : (result.status as 404 | 502));
    },
  );

  app.post('/v1/roles/promote', requireRole(['admin', 'founder'], verifier), async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = RolePromoteSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'validation_error', issues: parsed.error.flatten() }, 400);
    }
    const actor = c.get('user')!;
    const auditEvent = {
      action: 'role_promote',
      targetUid: parsed.data.uid,
      newRole: parsed.data.role,
      reason: parsed.data.reason ?? null,
      promotedByUid: actor.uid,
      timestamp: new Date().toISOString(),
    };
    const result = await forward('/webhook/role-promote', 'POST', auditEvent);
    return c.json({ ...auditEvent, forwarded: result.ok }, result.ok ? 200 : (result.status as 502));
  });

  return app;
}
