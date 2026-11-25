import type { MiddlewareHandler } from 'hono';

export type TurnstileVerifier = (token: string, ip?: string) => Promise<boolean>;

export async function defaultTurnstileVerifier(
  secretKey: string,
  token: string,
  ip?: string,
): Promise<boolean> {
  const form = new URLSearchParams();
  form.set('secret', secretKey);
  form.set('response', token);
  if (ip && ip !== 'unknown-ip') form.set('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

export function requireTurnstile(opts: {
  secretKey?: string;
  bypass?: boolean;
  verifier?: TurnstileVerifier;
}): MiddlewareHandler {
  return async (c, next) => {
    if (opts.bypass || process.env.TURNSTILE_BYPASS_DEV === 'true') {
      await next();
      return;
    }

    const secret = opts.secretKey ?? process.env.TURNSTILE_SECRET_KEY ?? '';
    if (!secret) {
      return c.json({ error: 'server_misconfigured', message: 'Turnstile secret key not set' }, 500);
    }

    const token =
      c.req.header('cf-turnstile-response') ||
      (c.req.header('x-turnstile-token') ?? '');

    if (!token) {
      return c.json(
        { error: 'turnstile_required', message: 'Human verification token (cf-turnstile-response) required' },
        400,
      );
    }

    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for');
    const ok = opts.verifier
      ? await opts.verifier(token, ip)
      : await defaultTurnstileVerifier(secret, token, ip);

    if (!ok) {
      return c.json({ error: 'turnstile_failed', message: 'Human verification failed' }, 403);
    }
    await next();
  };
}
