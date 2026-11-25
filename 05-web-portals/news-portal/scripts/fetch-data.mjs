#!/usr/bin/env node
/**
 * Build-time data snapshot for TF News.
 * Pulls opportunities, universities and every scholarship "way" from the live
 * TF API / n8n webhooks and writes normalised JSON to src/data/generated/.
 *
 *   node scripts/fetch-data.mjs          reuse snapshot if younger than 6 h
 *   node scripts/fetch-data.mjs --force  always refetch
 *
 * A failed refresh never destroys an existing snapshot: new data is written to
 * a temp dir and swapped in only when the fetch is healthy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data', 'generated');
const TMP = path.join(ROOT, 'src', 'data', '.generated-tmp');
const FORCE = process.argv.includes('--force');
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_FAIL_RATIO = 0.03;
const CONCURRENCY = 12;

const API = 'https://n8n.tfunions.com/tf-api';
const WEBHOOK = 'https://n8n.tfunions.com/webhook/tf';

function snapshotAge() {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'));
    return Date.now() - new Date(meta.fetchedAt).getTime();
  } catch {
    return Infinity;
  }
}

async function getJson(url, { tries = 4, timeoutMs = 40000 } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return text.trim() ? JSON.parse(text) : null;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * i));
    }
  }
  throw new Error(`${url}: ${lastErr?.message || lastErr}`);
}

const toInt = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number.parseInt(String(v).trim(), 10);
  return Number.isNaN(n) ? null : n;
};
const str = (v) => (v === null || v === undefined ? '' : String(v));

function normOpportunity(d) {
  return {
    id: str(d.id),
    section: str(d.section),
    title: str(d.title),
    shortDescription: str(d.shortDescription),
    aboutMarkdown: str(d.aboutMarkdown),
    requirementsMarkdown: str(d.requirementsMarkdown),
    benefitsMarkdown: str(d.benefitsMarkdown),
    guidelinesMarkdown: str(d.guidelinesMarkdown),
    startDate: d.startDate ? str(d.startDate) : null,
    deadline: d.deadline ? str(d.deadline) : null,
    category: str(d.category),
    topic: str(d.topic),
    link: str(d.link),
    ratingCount: Number(d.ratingCount) || 0,
    mustKnow: d.mustKnow === true,
  };
}

function normUniversity(u) {
  return {
    uniId: toInt(u.uni_id) ?? 0,
    name: str(u.name),
    country: str(u.country),
    region: str(u.region),
    qsRank: toInt(u.qs_rank),
    qsRankText: str(u.qs_rank_text),
    website: str(u.website),
    researched: str(u.researched) === 'yes',
    waysFound: toInt(u.ways_found) ?? 0,
  };
}

function normWay(w) {
  return {
    uniId: toInt(w.uni_id) ?? 0,
    wayNo: toInt(w.way_no) ?? 0,
    title: str(w.title),
    provider: str(w.provider),
    scope: str(w.scope),
    coverage: str(w.coverage),
    markdown: str(w.markdown),
    sourceUrls: str(w.source_urls)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

async function pool(items, worker, size) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return out;
}

async function main() {
  const age = snapshotAge();
  if (!FORCE && age < MAX_AGE_MS) {
    console.log(`[data] snapshot is ${Math.round(age / 60000)} min old - reusing (use --force to refetch)`);
    return;
  }

  console.log('[data] fetching opportunities...');
  const oppBody = await getJson(`${API}/api/collections/opportunities`);
  const oppRaw = oppBody?.documents ?? oppBody?.items ?? [];
  const opportunities = oppRaw.filter((d) => d && typeof d === 'object').map(normOpportunity);

  console.log('[data] fetching universities...');
  const uniBody = await getJson(`${WEBHOOK}/universities`);
  const uniRaw = (Array.isArray(uniBody) ? uniBody : uniBody?.universities) ?? [];
  const universities = uniRaw.map(normUniversity).sort((a, b) => a.uniId - b.uniId);

  const withWays = universities.filter((u) => u.waysFound > 0);
  console.log(`[data] fetching ways for ${withWays.length} universities (concurrency ${CONCURRENCY})...`);
  let done = 0;
  const failed = [];
  const waysPer = await pool(
    withWays,
    async (u) => {
      try {
        const body = await getJson(`${WEBHOOK}/university-ways?uni_id=${u.uniId}`);
        const raw = (Array.isArray(body) ? body : body?.ways) ?? [];
        return raw.map(normWay);
      } catch (e) {
        failed.push(`${u.uniId}: ${e.message}`);
        return [];
      } finally {
        done++;
        if (done % 200 === 0) console.log(`[data]   ${done}/${withWays.length}`);
      }
    },
    CONCURRENCY,
  );
  // The universities list says how many ways each university has. The upstream webhook sometimes answers
  // 200 with an empty list anyway, so re-ask for those once, gently, before accepting the gap.
  const emptyIdx = withWays.map((u, i) => (waysPer[i].length === 0 ? i : -1)).filter((i) => i >= 0);
  if (emptyIdx.length) {
    console.log(`[data] ${emptyIdx.length} universities returned no ways despite ways_found>0; retrying gently...`);
    await pool(
      emptyIdx,
      async (i) => {
        await new Promise((r) => setTimeout(r, 400));
        try {
          const body = await getJson(`${WEBHOOK}/university-ways?uni_id=${withWays[i].uniId}`);
          const raw = (Array.isArray(body) ? body : body?.ways) ?? [];
          if (raw.length) waysPer[i] = raw.map(normWay);
        } catch {
          /* keep empty */
        }
      },
      2,
    );
  }
  const ways = waysPer.flat().sort((a, b) => a.uniId - b.uniId || a.wayNo - b.wayNo);
  const missing = withWays.filter((u, i) => waysPer[i].length === 0);
  if (missing.length) {
    console.warn(
      `[data] WARNING: upstream returned no ways for ${missing.length}/${withWays.length} universities that report ways_found>0 ` +
        `(e.g. ${missing.slice(0, 5).map((u) => `${u.uniId} ${u.name}`).join('; ')}). Pages for them will show a notice.`,
    );
  }

  const ratio = withWays.length ? failed.length / withWays.length : 0;
  if (opportunities.length === 0 || universities.length === 0 || ratio > MAX_FAIL_RATIO) {
    console.error(
      `[data] unhealthy fetch: opps=${opportunities.length} unis=${universities.length} failedUnis=${failed.length} (${(ratio * 100).toFixed(1)}%)`,
    );
    failed.slice(0, 10).forEach((f) => console.error('  ' + f));
    if (fs.existsSync(path.join(OUT, 'meta.json'))) {
      console.error('[data] keeping previous snapshot.');
      return;
    }
    process.exit(1);
  }
  if (failed.length) console.warn(`[data] ${failed.length} universities failed and were skipped.`);

  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const write = (name, data) => fs.writeFileSync(path.join(TMP, name), JSON.stringify(data));
  write('opportunities.json', opportunities);
  write('universities.json', universities);
  write('ways.json', ways);
  write('meta.json', {
    fetchedAt: new Date().toISOString(),
    opportunities: opportunities.length,
    universities: universities.length,
    ways: ways.length,
    failedUniversities: failed.length,
    universitiesMissingWays: missing.length,
  });
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.renameSync(TMP, OUT);
  console.log(`[data] ok: ${opportunities.length} opportunities, ${universities.length} universities, ${ways.length} ways`);
}

main().catch((e) => {
  console.error('[data] fatal:', e.message);
  if (fs.existsSync(path.join(OUT, 'meta.json'))) {
    console.error('[data] using existing snapshot.');
    return;
  }
  process.exit(1);
});
