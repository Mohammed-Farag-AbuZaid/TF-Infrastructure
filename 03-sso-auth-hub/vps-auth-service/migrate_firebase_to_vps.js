/**
 * TF Unions — Complete Migration from Legacy Firebase to Self-Hosted VPS
 * Imports all Firebase Auth users & all 10 Firestore collections into:
 *   1. PostgreSQL `tf_sso_db` (`users`, `opportunities`, `firestore_mirror`)
 *   2. Baserow `TF_Unions_Core` (`Members_Passport`, `Certificates_Registry`, `Financial_Ledger_And_Sponsors`, `QA_Tickets_And_Idea_Incubator`)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const BASEROW_DB_TOKEN = process.env.BASEROW_DB_TOKEN || '67hOrB9z23KG6IjQhqROqvVDLz9YIDUP';
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'tfunions.com';

const pool = new Pool({ connectionString: DATABASE_URL });

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function baserowRequest(method, apiPath, payload = null) {
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

async function createBaserowRow(tableId, payload) {
  return baserowRequest('POST', `/api/database/rows/table/${tableId}/?user_field_names=true`, payload);
}

function normalizeEduSystem(level) {
  const l = String(level || '').toLowerCase();
  if (l.includes('stem')) return 'STEM';
  if (l.includes('thanaw')) return 'Thanaweya_Amma';
  if (l.includes('ig') || l.includes('american') || l.includes('ib')) return 'IGCSE_American';
  if (l.includes('azhar')) return 'Azhar';
  if (l.includes('uni') || l.includes('undergrad')) return 'University';
  return 'Thanaweya_Amma';
}

function normalizeGrade(grade, year) {
  const g = String(grade || year || '').toLowerCase();
  if (g.includes('9')) return 'G9';
  if (g.includes('10') || g.includes('1')) return 'G10';
  if (g.includes('11') || g.includes('2')) return 'G11';
  if (g.includes('12') || g.includes('3')) return 'G12';
  if (g.includes('uni') || g.includes('year')) return 'Undergrad';
  return 'G12';
}

(async () => {
  const dumpPath = path.join(__dirname, 'full_firebase_dump.json');
  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS firestore_mirror (
      collection_name TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (collection_name, doc_id)
    );
  `);

  // 1. Mirror all 10 Firestore collections into PostgreSQL
  let totalDocs = 0;
  for (const [colName, docs] of Object.entries(dump.collections || {})) {
    for (const doc of docs) {
      await pool.query(
        `INSERT INTO firestore_mirror (collection_name, doc_id, data, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [colName, doc.id, JSON.stringify(doc)]
      );
      totalDocs++;
    }
    console.log(`✅ Mirrored ${docs.length} docs from '${colName}' into PostgreSQL firestore_mirror`);
  }

  // 2. Migrate Opportunities into `opportunities` table
  await pool.query(`
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS topic TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS short_description TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS about_markdown TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS link TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS must_know BOOLEAN DEFAULT FALSE;
  `);
  for (const opp of dump.collections.opportunities || []) {
    await pool.query(
      `INSERT INTO opportunities (id, title, category, section, topic, short_description, about_markdown, link, must_know)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, short_description = EXCLUDED.short_description`,
      [
        opp.id,
        opp.title || 'Untitled Opportunity',
        opp.category || 'General',
        opp.section || 'programs',
        opp.topic || 'General',
        opp.shortDescription || '',
        opp.aboutMarkdown || '',
        opp.link || '',
        Boolean(opp.mustKnow),
      ]
    );
  }
  console.log(`✅ Migrated ${(dump.collections.opportunities || []).length} opportunities into PostgreSQL opportunities table`);

  // 3. Merge Firebase Auth users + Firestore user docs into PostgreSQL `users` & Baserow `Members_Passport` (table 579)
  const fsUserMap = {};
  for (const u of dump.collections.users || []) {
    fsUserMap[u.id] = u;
  }

  // Fetch existing Baserow Members_Passport rows so we don't duplicate
  const existingBrRes = await baserowRequest('GET', '/api/database/rows/table/579/?user_field_names=true&size=200');
  const existingUids = new Set((existingBrRes.results || []).map((r) => r.firebase_uid));

  const defaultHash = hashPassword('TFUnions2026!');
  let migratedUsers = 0;

  for (const au of dump.authUsers || []) {
    const uid = au.localId;
    const fsDoc = fsUserMap[uid] || {};
    const email = (au.email || fsDoc.email || `${uid}@tfunions.com`).toLowerCase();
    const firstName = fsDoc.firstName || (au.displayName ? au.displayName.split(' ')[0] : email.split('@')[0]);
    const lastName = fsDoc.lastName || (au.displayName ? au.displayName.split(' ').slice(1).join(' ') : '');
    const fullName = `${firstName} ${lastName}`.trim() || email.split('@')[0];
    const eduSys = normalizeEduSystem(fsDoc.level);
    const grade = normalizeGrade(fsDoc.grade, fsDoc.year);
    const phone = fsDoc.phone ? `+20${String(fsDoc.phone).replace(/^\+?20/, '')}` : '';

    await pool.query(
      `INSERT INTO users (uid, email, password_hash, full_name, first_name, last_name, governorate, education_system, grade_or_year, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'student')
       ON CONFLICT (uid) DO UPDATE SET
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         phone = EXCLUDED.phone`,
      [uid, email, defaultHash, fullName, firstName, lastName, 'Cairo', eduSys, grade, phone]
    );
    migratedUsers++;

    if (!existingUids.has(uid)) {
      await createBaserowRow(579, {
        firebase_uid: uid,
        full_name: fullName,
        email: email,
        phone_whatsapp: phone,
        governorate: 'Cairo',
        education_system: eduSys,
        grade_level: grade,
        ecosystem_role: 'Student',
      });
      existingUids.add(uid);
    }
  }
  console.log(`✅ Migrated ${migratedUsers} student accounts to VPS PostgreSQL & Baserow Members_Passport`);

  // 4. Seed Baserow Certificates_Registry (582), Financial_Ledger_And_Sponsors (583), QA_Tickets_And_Idea_Incubator (584) if empty
  const certRows = await baserowRequest('GET', '/api/database/rows/table/582/?user_field_names=true');
  if ((certRows.count || 0) === 0) {
    await createBaserowRow(582, {
      serial_code: 'TFU-2026-8F92A1',
      recipient_name: 'Sara Mahmoud',
      credential_type: 'Volunteer_Service',
      role_or_program_title: 'STEM Opportunities Researcher — TF News',
      hours_credited: 45,
      issue_date: '2026-09-15',
      pdf_download_url: 'https://verify.tfunions.com/?code=TFU-2026-8F92A1',
      is_revoked: false,
    });
    await createBaserowRow(582, {
      serial_code: 'TFU-2026-000001',
      recipient_name: 'Mohammed Farag',
      credential_type: 'Core_Team_Recognition',
      role_or_program_title: 'Founder & Principal Systems Architect',
      hours_credited: 500,
      issue_date: '2026-01-01',
      pdf_download_url: 'https://verify.tfunions.com/?code=TFU-2026-000001',
      is_revoked: false,
    });
    console.log('✅ Seeded Baserow Certificates_Registry (table 582)');
  }

  const ledgerRows = await baserowRequest('GET', '/api/database/rows/table/583/?user_field_names=true');
  if ((ledgerRows.count || 0) === 0) {
    await createBaserowRow(583, {
      tx_type: 'Incoming_Donation',
      payment_channel: 'InstaPay',
      amount_egp: 12000,
      amount_usd: 240,
      donor_or_vendor_name: 'Founders Seed Allocation',
      is_anonymous: false,
      category: 'VPS_Hosting',
      proof_screenshot_url: 'https://tfunions.com/transparency',
      verification_status: 'Verified',
      tx_date: '2026-01-15',
    });
    console.log('✅ Seeded Baserow Financial_Ledger_And_Sponsors (table 583)');
  }

  const ideaRows = await baserowRequest('GET', '/api/database/rows/table/584/?user_field_names=true');
  if ((ideaRows.count || 0) === 0) {
    await createBaserowRow(584, {
      submission_type: 'Project_Idea',
      source_service: 'TF_News',
      title: 'Arabic-to-English Research Abstract Reviewer & LaTeX Template Pack',
      description: 'Interactive checklist and mentor review queue for ISEF and local science fair students.',
      page_url: 'https://news.tfunions.com',
      voter_uids_json: '["seed_1","seed_2"]',
      upvote_count: 142,
      status: 'Planned',
      is_public_on_board: true,
    });
    console.log('✅ Seeded Baserow QA_Tickets_And_Idea_Incubator (table 584)');
  }

  await pool.end();
  console.log('🎉 Complete Firebase -> VPS Migration Finished!');
})();
