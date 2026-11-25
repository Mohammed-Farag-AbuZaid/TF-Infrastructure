import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTALS = [
  { dir: '05-web-portals/foundation-portal', portal: 'foundation', portalLabel: 'TF Unions', origin: 'https://www.tfunions.com' },
  { dir: '05-web-portals/news-portal', portal: 'news', portalLabel: 'TF News', origin: 'https://news.tfunions.com' },
  { dir: '05-web-portals/guides-portal', portal: 'guides', portalLabel: 'TF Guides', origin: 'https://guides.tfunions.com' },
  { dir: '05-web-portals/connect-portal', portal: 'connect', portalLabel: 'TF Connect', origin: 'https://connect.tfunions.com' },
  { dir: '05-web-portals/verify-portal', portal: 'verify', portalLabel: 'TF Verify', origin: 'https://verify.tfunions.com' },
  { dir: '05-web-portals/docs-portal', portal: 'docs', portalLabel: 'TF Docs', origin: 'https://docs.tfunions.com' },
];

const ENTITY_MAP = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rarr: '→',
  larr: '←',
  ndash: '–',
  mdash: '—',
  middot: '·',
};

function decodeHtml(str) {
  return String(str || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITY_MAP[name] ?? m);
}

function walkHtml(dir, baseDir = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkHtml(full, baseDir));
    } else if (ent.isFile() && ent.name.endsWith('.html')) {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      if (rel === 'studio/index.html') continue;
      out.push({ full, rel });
    }
  }
  return out;
}

function toFieldLabel(fieldKey) {
  return fieldKey
    .replace(/^dest_(\d+)_/, (_, i) => `Card ${Number(i) + 1} `)
    .replace(/^item_(\d+)_/, (_, i) => `Item ${Number(i) + 1} `)
    .replace(/^card_(\d+)_/, (_, i) => `Card ${Number(i) + 1} `)
    .replace(/^track_(\d+)_/, (_, i) => `Track ${Number(i) + 1} `)
    .replace(/^art_(\d+)_/, (_, i) => `Article ${Number(i) + 1} `)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferKind(tag, fieldKey) {
  if (tag === 'input' || tag === 'textarea') return 'input';
  if (tag === 'h1') return 'h1';
  if (tag === 'h2' || tag === 'h3') return 'h2';
  if (tag === 'button') return 'btn';
  if (tag === 'a') return fieldKey.includes('cta') ? 'btn' : 'link';
  return 'p';
}

function findClosingIndex(html, startIdx, tag) {
  const openRe = new RegExp(`<${tag}(?:\\s|>)`, 'gi');
  const closeRe = new RegExp(`</${tag}>`, 'gi');
  let depth = 1;
  let pos = startIdx;
  while (depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      pos = nextOpen.index + tag.length + 1;
    } else {
      depth--;
      if (depth === 0) return nextClose.index;
      pos = nextClose.index + tag.length + 3;
    }
  }
  return -1;
}

function routeFromRel(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length);
  return '/' + rel;
}

const CUSTOM_PAGE_LABELS = {
  home: 'Foundation Home (EN)',
  home_ar: 'Foundation Home (AR)',
  footer: 'Global Ecosystem Footer',
  news_footer: 'TF News Footer (EN)',
  news_footer_ar: 'TF News Footer (AR)',
};

const pagesMap = new Map();

for (const cfg of PORTALS) {
  const distDir = path.join(ROOT, cfg.dir, 'dist');
  const files = walkHtml(distDir);
  for (const file of files) {
    const html = fs.readFileSync(file.full, 'utf8');
    // Only scan outside inline <script> blocks so JS template strings aren't mistakenly matched
    const cleanedHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const titleMatch = cleanedHtml.match(/<title>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch ? decodeHtml(titleMatch[1]).replace(/\s*[—-]\s*(TF Unions|TF News|TF Guides|TF Connect|TF Docs)\s*$/i, '').trim() : file.rel;
    const route = routeFromRel(file.rel);
    const pageUrl = cfg.origin + (route === '/' ? '/' : route);
    const isRtl = /<html[^>]*\bdir=["']rtl["']/i.test(cleanedHtml) || file.rel.startsWith('ar/');

    const tagRe = /<([a-zA-Z0-9]+)([^>]*?\bdata-tf-copy=["']([a-zA-Z0-9_.-]+)["'][^>]*)>/gi;
    let m;
    while ((m = tagRe.exec(cleanedHtml))) {
      const tag = m[1].toLowerCase();
      const attrs = m[2];
      const fullKey = m[3];
      const dot = fullKey.indexOf('.');
      if (dot <= 0) continue;
      const pageKey = fullKey.slice(0, dot);
      const fieldKey = fullKey.slice(dot + 1);

      let defText = '';
      if (tag === 'input' || tag === 'textarea') {
        const ph = attrs.match(/\bplaceholder=["']([^"']*)["']/i);
        defText = ph ? decodeHtml(ph[1]).trim() : '';
      } else {
        const endIdx = findClosingIndex(cleanedHtml, tagRe.lastIndex, tag);
        if (endIdx > tagRe.lastIndex) {
          const inner = cleanedHtml.slice(tagRe.lastIndex, endIdx).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          defText = decodeHtml(inner);
        }
      }

      if (!defText) continue;

      if (!pagesMap.has(pageKey)) {
        const isAr = pageKey.endsWith('_ar') || isRtl;
        pagesMap.set(pageKey, {
          portal: cfg.portal,
          portalLabel: cfg.portalLabel,
          pageKey,
          label: CUSTOM_PAGE_LABELS[pageKey] || (isAr && !rawTitle.includes('(AR)') ? `${rawTitle} (AR)` : rawTitle || pageKey),
          url: pageUrl,
          rtl: isAr,
          fields: [],
          _seen: new Set(),
        });
      }
      const entry = pagesMap.get(pageKey);
      if (!entry._seen.has(fieldKey)) {
        entry._seen.add(fieldKey);
        entry.fields.push({
          key: fieldKey,
          label: toFieldLabel(fieldKey),
          kind: inferKind(tag, fieldKey),
          def: defText,
        });
      }
    }
  }
}

const EXTRA_FIELDS = {
  ledger: [{ key: 'empty_state', label: 'Empty State Message', kind: 'p', def: 'No verified financial entries recorded yet.' }],
  connect: [{ key: 'empty_state', label: 'Empty State Message', kind: 'p', def: 'No chapters published yet. Add chapters from TF Dashboard.' }],
  guides: [{ key: 'empty_state', label: 'Empty State Message', kind: 'p', def: 'No study guides published yet. Add guides from TF Dashboard.' }],
  ideas: [{ key: 'empty_state', label: 'Empty State Message', kind: 'p', def: 'No proposals submitted yet.' }],
};

for (const [pk, extras] of Object.entries(EXTRA_FIELDS)) {
  const entry = pagesMap.get(pk);
  if (!entry) continue;
  for (const ex of extras) {
    if (!entry._seen.has(ex.key)) {
      entry._seen.add(ex.key);
      entry.fields.push(ex);
    }
  }
}

const catalog = Array.from(pagesMap.values()).map(({ _seen, ...rest }) => rest);
const outPath = path.join(ROOT, '05-web-portals/dashboard-portal/src/data/copy-catalog.json');
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

const byPortal = {};
let totalFields = 0;
for (const p of catalog) {
  byPortal[p.portalLabel] = (byPortal[p.portalLabel] || 0) + 1;
  totalFields += p.fields.length;
}
console.log(`Extracted ${catalog.length} editable pages (${totalFields} fields) across ${Object.keys(byPortal).length} portals:`);
for (const [k, v] of Object.entries(byPortal)) console.log(`  - ${k}: ${v} page group(s)`);
if (Object.keys(byPortal).length < 6) {
  console.error('Expected at least 6 portals in copy catalog!');
  process.exit(1);
}
