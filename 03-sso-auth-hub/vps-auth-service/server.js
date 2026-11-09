/**
 * TF Unions — Self-Hosted VPS Auth, Unified SSO & Ecosystem API Engine
 * Eliminates reliance on Firebase by storing accounts, sessions, and profiles
 * directly in VPS PostgreSQL (`tf_sso_db`), while syncing with Baserow, Listmonk,
 * n8n, Telegram Bot (Zain), and WhatsApp Evolution API.
 */

const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 4000);
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'tfunions.com';
const JWT_SECRET = process.env.JWT_SECRET || 'tfunions_super_secret_jwt_key_2026';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://evolution:Tfunions.postgresql%402009@postgres:5432/tf_sso_db';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5414706226';
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://root-n8n-1:5678';

const pool = new Pool({ connectionString: DATABASE_URL });

const FOURTEEN_DAYS_SEC = 1209600;

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(pad, 'base64').toString('utf8');
}

function signHs256Jwt(payload, expiresInSec = FOURTEEN_DAYS_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = { ...payload, iss: `https://auth.${ROOT_DOMAIN}`, iat: now, exp: now + expiresInSec };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(fullPayload))}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(unsigned).digest();
  return `${unsigned}.${base64UrlEncode(sig)}`;
}

function verifyHs256Jwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expectedSig = base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest());
  if (s !== expectedSig) return null;
  const payload = JSON.parse(base64UrlDecode(p));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

function buildCorsHeaders(origin) {
  let allowOrigin = `https://auth.${ROOT_DOMAIN}`;
  if (origin) {
    try {
      const u = new URL(origin);
      if (
        u.hostname === ROOT_DOMAIN ||
        u.hostname.endsWith(`.${ROOT_DOMAIN}`) ||
        u.hostname.endsWith('.pages.dev') ||
        u.hostname.endsWith('.vercel.app') ||
        u.hostname === 'localhost'
      ) {
        allowOrigin = origin;
      }
    } catch {}
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-TF-Webhook-Secret',
    Vary: 'Origin',
  };
}

function sendTelegramNotification(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  }).catch(() => {});
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload, extraHeaders = {}, cookies = []) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (cookies.length > 0) {
    headers['Set-Cookie'] = cookies;
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function makeRootCookies(user) {
  const sessionToken = signHs256Jwt({
    sub: user.uid,
    uid: user.uid,
    email: user.email,
    name: user.full_name,
    role: user.role || 'student',
    tracks: user.tracks || [],
  });
  const hint = encodeURIComponent(
    JSON.stringify({
      uid: user.uid,
      name: user.full_name,
      email: user.email,
      role: user.role || 'student',
    })
  );
  return {
    sessionToken,
    cookies: [
      `tf_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Domain=.${ROOT_DOMAIN}; Path=/; Max-Age=${FOURTEEN_DAYS_SEC}`,
      `tf_user_hint=${hint}; Secure; SameSite=Lax; Domain=.${ROOT_DOMAIN}; Path=/; Max-Age=${FOURTEEN_DAYS_SEC}`,
    ],
  };
}

// Initialize extra operational tables in tf_sso_db so all portals work 100% self-hosted on VPS
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificates_registry (
      serial_code TEXT PRIMARY KEY,
      uid TEXT,
      recipient_name TEXT NOT NULL,
      credential_type TEXT DEFAULT 'Volunteer_Service',
      role_or_program_title TEXT NOT NULL,
      hours_credited INTEGER DEFAULT 40,
      issue_date TEXT NOT NULL,
      pdf_download_url TEXT DEFAULT '',
      is_revoked BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS volunteer_applications (
      application_id SERIAL PRIMARY KEY,
      uid TEXT,
      full_name TEXT NOT NULL,
      applicant_email TEXT NOT NULL,
      season_cohort TEXT DEFAULT 'Winter_2026',
      target_track TEXT NOT NULL,
      portfolio_or_cv_url TEXT DEFAULT '',
      motivation_answer TEXT DEFAULT '',
      status TEXT DEFAULT '1_Applied',
      logged_hours INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS financial_ledger (
      tx_id SERIAL PRIMARY KEY,
      tx_type TEXT NOT NULL,
      payment_channel TEXT NOT NULL,
      amount_egp NUMERIC(12,2) DEFAULT 0,
      amount_usd NUMERIC(12,2) DEFAULT 0,
      donor_or_vendor_name TEXT NOT NULL,
      donor_email TEXT DEFAULT '',
      is_anonymous BOOLEAN DEFAULT false,
      category TEXT DEFAULT 'General_Support',
      proof_screenshot_url TEXT DEFAULT '',
      verification_status TEXT DEFAULT 'Pending_Review',
      tx_date TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS qa_and_ideas (
      item_id SERIAL PRIMARY KEY,
      submission_type TEXT NOT NULL,
      source_service TEXT DEFAULT 'Foundation_Portal',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      page_url TEXT DEFAULT '',
      uid TEXT DEFAULT '',
      voter_uids_json JSONB DEFAULT '[]'::jsonb,
      upvote_count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'New_Triage',
      is_public_on_board BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS firestore_mirror (
      collection_name TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (collection_name, doc_id)
    );
  `);

  // Seed sample verifiable certificate and initial ledger/ideas if empty
  await pool.query(`
    INSERT INTO certificates_registry (serial_code, recipient_name, credential_type, role_or_program_title, hours_credited, issue_date, pdf_download_url, is_revoked)
    VALUES
      ('TFU-2026-8F92A1', 'Sara Mahmoud', 'Volunteer_Service', 'STEM Opportunities Researcher — TF News', 45, '2026-09-15', 'https://verify.tfunions.com/?code=TFU-2026-8F92A1', false),
      ('TFU-2026-000001', 'Mohammed Farag', 'Core_Team_Recognition', 'Founder & Principal Systems Architect', 500, '2026-01-01', 'https://verify.tfunions.com/?code=TFU-2026-000001', false)
    ON CONFLICT (serial_code) DO NOTHING;
  `);
}

const BASEROW_INTERNAL_URL = process.env.BASEROW_INTERNAL_URL || 'http://tf_baserow:80';
const BASEROW_DB_TOKEN = process.env.BASEROW_DB_TOKEN || '67hOrB9z23KG6IjQhqROqvVDLz9YIDUP';
const BASEROW_TABLES = {
  Members_Passport: 579,
  Volunteer_HR_Pipeline: 580,
  Public_Team_Directory: 581,
  Certificates_Registry: 582,
  Financial_Ledger_And_Sponsors: 583,
  QA_Tickets_And_Idea_Incubator: 584,
};

function baserowInternalRequest(method, apiPath, payload = null) {
  return new Promise((resolve) => {
    const bodyStr = payload ? JSON.stringify(payload) : null;
    const req = http.request(
      {
        hostname: 'tf_baserow',
        port: 80,
        path: apiPath,
        method,
        headers: {
          Host: `ops.${ROOT_DOMAIN}`,
          Authorization: `Token ${BASEROW_DB_TOKEN}`,
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        });
      }
    );
    req.on('error', () => resolve({}));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function createBaserowRow(tableName, rowPayload) {
  const tableId = BASEROW_TABLES[tableName];
  if (!tableId || !BASEROW_DB_TOKEN) return null;
  return baserowInternalRequest('POST', `/api/database/rows/table/${tableId}/?user_field_names=true`, rowPayload);
}

const server = http.createServer(async (req, res) => {
  const cors = buildCorsHeaders(req.headers.origin);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    // Health check
    if (path === '/health' || path === '/api/health') {
      const dbRes = await pool.query('SELECT COUNT(*)::int AS users_count FROM users');
      return sendJson(res, 200, { ok: true, service: 'tf-vps-sso-api', usersCount: dbRes.rows[0].users_count }, cors);
    }

    // 1. Native VPS Registration (No Firebase Required)
    if (path === '/api/register' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';
      const fullName = (body.fullName || email.split('@')[0]).trim();
      if (!email || password.length < 6) {
        return sendJson(res, 400, { error: 'Valid email and password (min 6 chars) required' }, cors);
      }

      const existing = await pool.query('SELECT uid FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return sendJson(res, 409, { error: 'Email already registered. Please sign in.' }, cors);
      }

      const uid = 'tfu_' + crypto.randomBytes(10).toString('hex');
      const parts = fullName.split(' ');
      const firstName = parts[0] || fullName;
      const lastName = parts.slice(1).join(' ') || 'Student';
      const pwHash = hashPassword(password);

      const insertRes = await pool.query(
        `INSERT INTO users (uid, email, password_hash, full_name, first_name, last_name, governorate, education_system, grade_or_year, phone, interests, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'student')
         RETURNING uid, email, full_name, first_name, last_name, governorate, education_system, grade_or_year, role, tracks, badges`,
        [
          uid,
          email,
          pwHash,
          fullName,
          firstName,
          lastName,
          body.governorate || 'Cairo',
          body.educationSystem || 'STEM',
          body.gradeOrYear || 'G11',
          body.phone || '',
          JSON.stringify(body.interests || ['scholarships', 'research']),
        ]
      );
      const user = insertRes.rows[0];
      const { sessionToken, cookies } = makeRootCookies(user);

      // Notify Zain Telegram Bot, Baserow, & n8n
      sendTelegramNotification(
        `🆕 *New TF Unions Passport Registered (VPS Auth)*\n*Name:* ${user.full_name}\n*Email:* ${user.email}\n*Gov:* ${user.governorate} (${user.education_system} - ${user.grade_or_year})`
      );
      createBaserowRow('Members_Passport', {
        firebase_uid: user.uid,
        full_name: user.full_name,
        email: user.email,
        phone_whatsapp: body.phone || '',
        governorate: user.governorate,
        education_system: user.education_system,
        grade_level: user.grade_or_year,
        ecosystem_role: 'Student',
      });
      fetch(`${N8N_BASE_URL}/webhook/user-onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          fullName: user.full_name,
          email: user.email,
          governorate: user.governorate,
          educationSystem: user.education_system,
          gradeOrYear: user.grade_or_year,
          interests: body.interests || ['scholarships'],
        }),
      }).catch(() => {});

      return sendJson(res, 200, { ok: true, token: sessionToken, user }, cors, cookies);
    }

    // 2. Native VPS Login (No Firebase Required)
    if (path === '/api/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userRes.rows.length === 0) {
        return sendJson(res, 401, { error: 'Invalid email or password' }, cors);
      }
      const user = userRes.rows[0];
      if (!verifyPassword(password, user.password_hash)) {
        return sendJson(res, 401, { error: 'Invalid email or password' }, cors);
      }

      const { sessionToken, cookies } = makeRootCookies(user);
      return sendJson(
        res,
        200,
        {
          ok: true,
          token: sessionToken,
          user: {
            uid: user.uid,
            email: user.email,
            name: user.full_name,
            fullName: user.full_name,
            firstName: user.first_name,
            lastName: user.last_name,
            governorate: user.governorate,
            educationSystem: user.education_system,
            gradeOrYear: user.grade_or_year,
            role: user.role,
            badges: user.badges,
          },
        },
        cors,
        cookies
      );
    }

    // 3. Session Check / Custom Token Hydration across *.tfunions.com
    if ((path === '/api/me' || path === '/api/mintCustomToken') && req.method === 'GET') {
      const cookies = parseCookies(req.headers.cookie);
      const authHeader = req.headers.authorization || '';
      const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : cookies['tf_session'];
      const claims = verifyHs256Jwt(rawToken);
      if (!claims) {
        return sendJson(res, 401, { error: 'No active session' }, cors);
      }
      const userRes = await pool.query(
        'SELECT uid, email, full_name, first_name, last_name, governorate, education_system, grade_or_year, role, tracks, badges FROM users WHERE uid = $1',
        [claims.uid]
      );
      const user = userRes.rows[0] || claims;
      return sendJson(res, 200, { ok: true, uid: user.uid, customToken: rawToken, user, claims }, cors);
    }

    // 4. Logout across *.tfunions.com
    if (path === '/api/sessionLogout' && req.method === 'POST') {
      return sendJson(
        res,
        200,
        { ok: true },
        cors,
        [
          `tf_session=; HttpOnly; Secure; SameSite=Lax; Domain=.${ROOT_DOMAIN}; Path=/; Max-Age=0`,
          `tf_user_hint=; Secure; SameSite=Lax; Domain=.${ROOT_DOMAIN}; Path=/; Max-Age=0`,
        ]
      );
    }

    // 5. Public Certificate Verification API (`GET /api/verify-certificate?code=TFU-...`)
    if ((path === '/api/verify-certificate' || path === '/webhook/verify-certificate') && req.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!/^TFU-\d{4}-[A-Z0-9]{6}$/.test(code)) {
        return sendJson(res, 404, { valid: false, message: 'Invalid serial code format.' }, cors);
      }
      const certRes = await pool.query('SELECT * FROM certificates_registry WHERE serial_code = $1', [code]);
      if (certRes.rows.length === 0 || certRes.rows[0].is_revoked) {
        return sendJson(res, 404, { valid: false, message: 'Certificate not found or revoked.' }, cors);
      }
      const c = certRes.rows[0];
      return sendJson(
        res,
        200,
        {
          valid: true,
          serialCode: c.serial_code,
          recipientName: c.recipient_name,
          credentialType: (c.credential_type || '').replace(/_/g, ' '),
          roleTitle: c.role_or_program_title,
          hoursCredited: c.hours_credited,
          issueDate: c.issue_date,
          pdfUrl: c.pdf_download_url,
        },
        cors
      );
    }

    // 6. Volunteer Application Submission
    if ((path === '/api/volunteer-apply' || path === '/webhook/volunteer-status-webhook') && req.method === 'POST') {
      const body = await readJsonBody(req);
      const r = await pool.query(
        `INSERT INTO volunteer_applications (full_name, applicant_email, season_cohort, target_track, portfolio_or_cv_url, motivation_answer)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          body.full_name || 'Applicant',
          body.applicant_email || '',
          body.season_cohort || 'Winter_2026',
          body.target_track || 'TF_News_Researcher',
          body.portfolio_or_cv_url || '',
          body.motivation_answer || '',
        ]
      );
      sendTelegramNotification(
        `🚀 *New Volunteer Application (#${r.rows[0].application_id})*\n*Name:* ${body.full_name}\n*Email:* ${body.applicant_email}\n*Track:* ${body.target_track}\n*Portfolio:* ${body.portfolio_or_cv_url}`
      );
      createBaserowRow('Volunteer_HR_Pipeline', {
        season_cohort: body.season_cohort || 'Winter_2026',
        target_track: body.target_track || 'TF_News_Researcher',
        portfolio_or_cv_url: body.portfolio_or_cv_url || 'https://tfunions.com',
        motivation_answer: `[${body.full_name} <${body.applicant_email}>] ${body.motivation_answer || ''}`,
        status: 'Applied',
        logged_hours: 0,
      });
      return sendJson(res, 200, { ok: true, application: r.rows[0] }, cors);
    }

    // 7. Donation / Transfer Receipt Submission
    if ((path === '/api/submit-donation' || path === '/webhook/submit-donation') && req.method === 'POST') {
      const body = await readJsonBody(req);
      const donorName = body.isAnonymous ? 'Anonymous Supporter' : body.donorName || 'Community Supporter';
      const today = new Date().toISOString().split('T')[0];
      const r = await pool.query(
        `INSERT INTO financial_ledger (tx_type, payment_channel, amount_egp, amount_usd, donor_or_vendor_name, donor_email, is_anonymous, category, proof_screenshot_url, verification_status, tx_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending_Review', $10) RETURNING *`,
        [
          body.txType || 'Incoming_Donation',
          body.paymentChannel || 'InstaPay',
          Number(body.amountEgp || 0),
          Number(body.amountUsd || (Number(body.amountEgp || 0) / 50).toFixed(2)),
          donorName,
          body.donorEmail || '',
          Boolean(body.isAnonymous),
          body.category || 'General_Support',
          body.proofUrl || '',
          today,
        ]
      );
      sendTelegramNotification(
        `💛 *New Donation Receipt Submitted (#${r.rows[0].tx_id})*\n*Donor:* ${donorName}\n*Channel:* ${body.paymentChannel}\n*Amount:* ${body.amountEgp} EGP\n*Proof:* ${body.proofUrl || 'N/A'}`
      );
      createBaserowRow('Financial_Ledger_And_Sponsors', {
        tx_type: body.txType || 'Incoming_Donation',
        payment_channel: body.paymentChannel || 'InstaPay',
        amount_egp: Number(body.amountEgp || 0),
        amount_usd: Number(body.amountUsd || (Number(body.amountEgp || 0) / 50).toFixed(2)),
        donor_or_vendor_name: donorName,
        is_anonymous: Boolean(body.isAnonymous),
        category: body.category || 'General_Support',
        proof_screenshot_url: body.proofUrl || 'https://tfunions.com',
        verification_status: 'Pending_Review',
        tx_date: today,
      });
      return sendJson(res, 200, { ok: true, tx: r.rows[0] }, cors);
    }

    // 8. Global QA Report & Idea Incubator Submission
    if ((path === '/api/qa-submit' || path === '/webhook/qa-submit') && req.method === 'POST') {
      const body = await readJsonBody(req);
      const isPublicIdea = body.submissionType === 'Project_Idea';
      const r = await pool.query(
        `INSERT INTO qa_and_ideas (submission_type, source_service, title, description, page_url, uid, voter_uids_json, upvote_count, is_public_on_board)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8) RETURNING *`,
        [
          body.submissionType || 'Bug_Report',
          body.service || 'Foundation_Portal',
          body.title || 'Untitled',
          body.description || '',
          body.pageUrl || '',
          body.uid || '',
          JSON.stringify(body.uid ? [body.uid] : []),
          isPublicIdea,
        ]
      );
      sendTelegramNotification(
        `🛠️ *${body.submissionType || 'QA Report'} (${body.service || 'Foundation_Portal'})*\n*Title:* ${body.title}\n*Details:* ${body.description}\n*URL:* ${body.pageUrl}`
      );
      createBaserowRow('QA_Tickets_And_Idea_Incubator', {
        submission_type: body.submissionType || 'Bug_Report',
        source_service: body.service || 'Foundation_Portal',
        title: body.title || 'Untitled',
        description: body.description || '',
        page_url: body.pageUrl || 'https://tfunions.com',
        voter_uids_json: JSON.stringify(body.uid ? [body.uid] : []),
        upvote_count: 1,
        status: 'Open',
        is_public_on_board: isPublicIdea,
      });
      return sendJson(res, 200, { ok: true, item: r.rows[0] }, cors);
    }

    // 9. Idea Upvote
    if ((path === '/api/idea-upvote' || path === '/webhook/idea-upvote') && req.method === 'POST') {
      const body = await readJsonBody(req);
      const itemId = Number(body.itemId);
      const uid = body.uid || 'guest';
      const itemRes = await pool.query('SELECT * FROM qa_and_ideas WHERE item_id = $1', [itemId]);
      if (itemRes.rows.length === 0) {
        return sendJson(res, 404, { error: 'Idea not found' }, cors);
      }
      const row = itemRes.rows[0];
      const voters = Array.isArray(row.voter_uids_json) ? row.voter_uids_json : [];
      if (!voters.includes(uid)) {
        voters.push(uid);
        const newCount = Number(row.upvote_count || 1) + 1;
        await pool.query('UPDATE qa_and_ideas SET voter_uids_json = $1, upvote_count = $2 WHERE item_id = $3', [
          JSON.stringify(voters),
          newCount,
          itemId,
        ]);
        return sendJson(res, 200, { ok: true, itemId, upvoteCount: newCount }, cors);
      }
      return sendJson(res, 200, { ok: true, itemId, alreadyVoted: true, upvoteCount: row.upvote_count }, cors);
    }

    // 10. Public Ideas List (`GET /api/ideas`)
    if (path === '/api/ideas' && req.method === 'GET') {
      const r = await pool.query(
        'SELECT item_id, submission_type, source_service, title, description, upvote_count, status, created_at FROM qa_and_ideas WHERE is_public_on_board = TRUE ORDER BY upvote_count DESC, item_id DESC'
      );
      return sendJson(res, 200, { ok: true, ideas: r.rows }, cors);
    }

    // 11. Opportunities & Firestore Mirror Collections (`GET /api/opportunities` & `GET /api/collections/:name`)
    if (path === '/api/opportunities' && req.method === 'GET') {
      const r = await pool.query(
        "SELECT doc_id AS id, data FROM firestore_mirror WHERE collection_name = 'opportunities' ORDER BY updated_at DESC"
      );
      return sendJson(
        res,
        200,
        { ok: true, count: r.rows.length, opportunities: r.rows.map((x) => ({ id: x.id, ...x.data })) },
        cors
      );
    }

    if (path.startsWith('/api/collections/') && req.method === 'GET') {
      const colName = decodeURIComponent(path.replace('/api/collections/', '').split('/')[0]);
      const r = await pool.query(
        'SELECT doc_id AS id, data FROM firestore_mirror WHERE collection_name = $1 ORDER BY updated_at DESC',
        [colName]
      );
      return sendJson(
        res,
        200,
        { ok: true, collection: colName, count: r.rows.length, documents: r.rows.map((x) => ({ id: x.id, ...x.data })) },
        cors
      );
    }

    // 12. Team Directory (`GET /api/team-directory`)
    if (path === '/api/team-directory' && req.method === 'GET') {
      const brRes = await baserowInternalRequest(
        'GET',
        `/api/database/rows/table/${BASEROW_TABLES.Public_Team_Directory}/?user_field_names=true`
      );
      return sendJson(res, 200, { ok: true, members: brRes.results || [] }, cors);
    }

    return sendJson(res, 404, { error: 'Not found' }, cors);
  } catch (err) {
    console.error('[tf_sso_api]', err);
    return sendJson(res, 500, { error: err.message || 'Internal Server Error' }, cors);
  }
});

initTables()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ TF Unions Self-Hosted VPS Auth & API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to init DB tables:', err);
    process.exit(1);
  });
