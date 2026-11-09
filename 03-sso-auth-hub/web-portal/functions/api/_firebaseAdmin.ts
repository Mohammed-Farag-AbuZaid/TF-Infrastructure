/**
 * WebCrypto Utilities for Firebase Admin Operations on Cloudflare Edge Workers
 * Zero Node.js dependencies â€” runs natively on Cloudflare Pages Functions Free Tier.
 */

export interface Env {
  ROOT_DOMAIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_WEB_API_KEY: string;
  N8N_ONBOARD_WEBHOOK_URL?: string;
  N8N_WEBHOOK_SECRET?: string;
}

const ALLOWED_ORIGINS = [
  'https://tfunions.com',
  'https://www.tfunions.com',
  'https://auth.tfunions.com',
  'https://docs.tfunions.com',
  'https://verify.tfunions.com',
  'https://news.tfunions.com',
  'https://connect.tfunions.com',
  'https://guide.tfunions.com',
];

export function isAllowedSubdomainOrigin(origin: string | null, rootDomain = 'tfunions.com'): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      (url.hostname === rootDomain || url.hostname.endsWith(`.${rootDomain}`))
    );
  } catch {
    return false;
  }
}

export function corsHeaders(origin: string | null, rootDomain = 'tfunions.com'): Record<string, string> {
  const safeOrigin = isAllowedSubdomainOrigin(origin, rootDomain)
    ? origin!
    : `https://auth.${rootDomain}`;
  return {
    'Access-Control-Allow-Origin': safeOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.replace(/\\n/g, '\n');
  const pemContents = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function signJwtRS256(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Mints a short-lived Google OAuth2 Access Token for Firebase Admin REST API calls
 */
export async function getGoogleAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwtRS256(
    {
      iss: env.FIREBASE_CLIENT_EMAIL,
      sub: env.FIREBASE_CLIENT_EMAIL,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/userinfo.email',
    },
    env.FIREBASE_PRIVATE_KEY
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to obtain Google OAuth2 access token: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Decodes JWT payload (used after Identity Toolkit accounts:lookup verification)
 */
export function decodeJwtPayload(jwt: string): Record<string, any> {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(padded);
  return JSON.parse(json);
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

