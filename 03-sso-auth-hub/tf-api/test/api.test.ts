import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { TokenVerifier } from '../src/middleware/auth.js';
import { MemoryRateLimitStore } from '../src/middleware/rateLimit.js';

function buildTestApp(overrides: { rateLimitMax?: number; tokenVerifier?: TokenVerifier } = {}) {
  const forwarder = vi.fn(async (_path: string, _method: 'GET' | 'POST', payload?: unknown) => ({
    ok: true,
    status: 200,
    data: { accepted: true, valid: true, serialCode: 'TF-2026-0142', echo: payload },
  }));

  const defaultVerifier: TokenVerifier = async (token) => {
    if (token === 'admin-token') return { uid: 'admin-1', role: 'admin' };
    if (token === 'student-token') return { uid: 'student-1', role: 'student' };
    return null;
  };

  const app = createApp({
    bypassTurnstile: true,
    rateLimitStore: new MemoryRateLimitStore(),
    rateLimitMax: overrides.rateLimitMax ?? 5,
    tokenVerifier: overrides.tokenVerifier ?? defaultVerifier,
    forwarder,
  });

  return { app, forwarder };
}

describe('tf-api gateway', () => {
  it('GET /v1/health returns ok status', async () => {
    const { app } = buildTestApp();
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('tf-api');
  });

  it('POST /v1/ideas rejects invalid payload with 400', async () => {
    const { app, forwarder } = buildTestApp();
    const res = await app.request('/v1/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'ab', description: 'short' }),
    });
    expect(res.status).toBe(400);
    expect(forwarder).not.toHaveBeenCalled();
  });

  it('POST /v1/ideas forwards valid payload to n8n webhook', async () => {
    const { app, forwarder } = buildTestApp();
    const res = await app.request('/v1/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-token' },
      body: JSON.stringify({
        title: 'Solar Desalination Lab Kit',
        description: 'Portable solar thermal bench unit for Ismailia regional school chapters.',
      }),
    });
    expect(res.status).toBe(201);
    expect(forwarder).toHaveBeenCalledWith(
      '/webhook/qa-submit',
      'POST',
      expect.objectContaining({ uid: 'student-1', title: 'Solar Desalination Lab Kit' }),
    );
  });

  it('GET /v1/certificates/:serial rejects malformed serial and accepts valid serial', async () => {
    const { app, forwarder } = buildTestApp();
    const bad = await app.request('/v1/certificates/NOT_VALID');
    expect(bad.status).toBe(400);
    expect(forwarder).not.toHaveBeenCalled();

    const good = await app.request('/v1/certificates/tf-2026-0142');
    expect(good.status).toBe(200);
    expect(forwarder).toHaveBeenCalledWith('/webhook/verify-certificate?code=TF-2026-0142', 'GET');
  });

  it('enforces sliding-window rate limits with 429', async () => {
    const { app } = buildTestApp({ rateLimitMax: 2 });
    const reqInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
      body: JSON.stringify({
        title: 'Clean Water Monitor',
        description: 'Open source sensor array calibrated by Alexandria STEM students.',
      }),
    };

    expect((await app.request('/v1/ideas', reqInit)).status).toBe(201);
    expect((await app.request('/v1/ideas', reqInit)).status).toBe(201);
    expect((await app.request('/v1/ideas', reqInit)).status).toBe(429);
  });

  it('POST /v1/roles/promote requires admin or founder role', async () => {
    const { app } = buildTestApp();
    const unauth = await app.request('/v1/roles/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: 'user_123456', role: 'volunteer' }),
    });
    expect(unauth.status).toBe(401);

    const studentForbidden = await app.request('/v1/roles/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-token' },
      body: JSON.stringify({ uid: 'user_123456', role: 'volunteer' }),
    });
    expect(studentForbidden.status).toBe(403);

    const adminOk = await app.request('/v1/roles/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
      body: JSON.stringify({ uid: 'user_123456', role: 'lead', reason: 'Cohort promotion' }),
    });
    expect(adminOk.status).toBe(200);
  });

  it('POST /v1/photos/submit rejects missing consentConfirmed and forwards valid photo submission', async () => {
    const { app, forwarder } = buildTestApp();
    const rejected = await app.request('/v1/photos/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Maadi Study Circle',
        captionEn: 'Weekly Olympiad problem solving session in Maadi.',
        altTextEn: 'Five STEM students reviewing physics derivation notebooks at a wooden table.',
        chapterOrEvent: 'STEM Maadi Research Collective',
        photographerName: 'Nour El-Din',
        imageUrl: 'https://r2.tfunions.com/uploads/maadi-01.jpg',
        consentConfirmed: false,
      }),
    });
    expect(rejected.status).toBe(400);
    expect(forwarder).not.toHaveBeenCalled();

    const accepted = await app.request('/v1/photos/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-token' },
      body: JSON.stringify({
        title: 'Maadi Study Circle',
        captionEn: 'Weekly Olympiad problem solving session in Maadi.',
        captionAr: 'جلسة أسبوعية لحل مسائل الأولمبياد في المعادي.',
        altTextEn: 'Five STEM students reviewing physics derivation notebooks at a wooden table.',
        altTextAr: 'خمسة طلاب يراجعون مسائل الفيزياء في جلسة دراسية.',
        chapterOrEvent: 'STEM Maadi Research Collective',
        photographerName: 'Nour El-Din',
        imageUrl: 'https://r2.tfunions.com/uploads/maadi-01.jpg',
        consentConfirmed: true,
      }),
    });
    expect(accepted.status).toBe(201);
    expect(forwarder).toHaveBeenCalledWith(
      '/webhook/photo-submit',
      'POST',
      expect.objectContaining({
        uid: 'student-1',
        reviewStatus: 'pending_baserow_review',
        consentConfirmed: true,
      }),
    );
  });
});
