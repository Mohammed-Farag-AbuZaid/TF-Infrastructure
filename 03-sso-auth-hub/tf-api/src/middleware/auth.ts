import type { Context, MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthUser {
  uid: string;
  email?: string;
  role?: string;
  tracks?: string[];
}

export type TokenVerifier = (token: string) => Promise<AuthUser | null>;

const GOOGLE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
);

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks() {
  const key = GOOGLE_JWKS_URL.toString();
  let set = jwksCache.get(key);
  if (!set) {
    set = createRemoteJWKSet(GOOGLE_JWKS_URL);
    jwksCache.set(key, set);
  }
  return set;
}

export function createFirebaseTokenVerifier(projectId: string): TokenVerifier {
  const issuer = `https://securetoken.google.com/${projectId}`;
  return async (token: string): Promise<AuthUser | null> => {
    try {
      const { payload } = await jwtVerify(token, getJwks(), {
        issuer,
        audience: projectId,
      });
      if (!payload.sub || typeof payload.sub !== 'string') return null;
      return {
        uid: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        role: typeof payload.role === 'string' ? payload.role : 'student',
        tracks: Array.isArray(payload.tracks)
          ? payload.tracks.filter((t): t is string => typeof t === 'string')
          : [],
      };
    } catch {
      return null;
    }
  };
}

function extractBearer(c: Context): string | null {
  const header = c.req.header('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export function optionalAuth(verifier: TokenVerifier): MiddlewareHandler {
  return async (c, next) => {
    const token = extractBearer(c);
    if (token) {
      const user = await verifier(token);
      if (user) c.set('user', user);
    }
    await next();
  };
}

export function requireRole(allowedRoles: string[], verifier: TokenVerifier): MiddlewareHandler {
  return async (c, next) => {
    const token = extractBearer(c);
    if (!token) {
      return c.json({ error: 'unauthorized', message: 'Bearer Firebase ID token is required' }, 401);
    }
    const user = await verifier(token);
    if (!user) {
      return c.json({ error: 'unauthorized', message: 'Invalid or expired Firebase ID token' }, 401);
    }
    c.set('user', user);
    if (!user.role || !allowedRoles.includes(user.role)) {
      return c.json({ error: 'forbidden', message: `Requires role: ${allowedRoles.join(', ')}` }, 403);
    }
    await next();
  };
}
