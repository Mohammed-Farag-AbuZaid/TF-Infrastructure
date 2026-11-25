import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PORTALS = [
  { dir: '05-web-portals/foundation-portal', isPublic: true, hasAr: true },
  { dir: '05-web-portals/news-portal', isPublic: true, hasAr: true },
  { dir: '05-web-portals/verify-portal', isPublic: true, hasAr: false },
  { dir: '05-web-portals/docs-portal', isPublic: true, hasAr: false },
  { dir: '05-web-portals/connect-portal', isPublic: true, hasAr: false },
  { dir: '05-web-portals/guides-portal', isPublic: true, hasAr: false },
  { dir: '05-web-portals/dashboard-portal', isPublic: false, hasAr: false },
  { dir: '03-sso-auth-hub/web-portal', isPublic: false, hasAr: false },
];

const MOJIBAKE_RE = /\uFFFD|Ã[\u0080-\u00BF]|â€[\u0093\u0094\u0098\u0099\u009C\u009D\u00A2]|â†[\u0090-\u0093]/;

function collectSampleHtmlFiles(distDir, limit = 100) {
  const seen = new Set();
  const ordered = [];
  for (const rel of ['index.html', 'ar/index.html', 'privacy/index.html', 'open-ledger/index.html']) {
    const abs = path.join(distDir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      seen.add(abs);
      ordered.push(abs);
    }
  }

  const queue = [distDir];
  while (queue.length > 0 && ordered.length < limit) {
    const dir = queue.shift();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.html') && !seen.has(full)) {
        seen.add(full);
        ordered.push(full);
        if (ordered.length >= limit) break;
      }
    }
  }
  return ordered;
}

function checkPortal(portal) {
  const errors = [];
  const distDir = path.join(ROOT, portal.dir, 'dist');
  const fail = (msg) => errors.push(`${portal.dir}: ${msg}`);

  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    fail('missing dist/ directory (run npm run build first)');
    return errors;
  }

  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath) || fs.statSync(indexPath).size < 200) {
    fail('missing or empty dist/index.html');
  }

  const headersPath = path.join(distDir, '_headers');
  if (!fs.existsSync(headersPath)) {
    fail('missing dist/_headers');
  } else {
    const headers = fs.readFileSync(headersPath, 'utf8');
    for (const required of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy']) {
      if (!headers.includes(required)) {
        fail(`dist/_headers missing ${required}`);
      }
    }
  }

  if (portal.isPublic) {
    for (const seoFile of ['robots.txt', 'sitemap.xml']) {
      const abs = path.join(distDir, seoFile);
      if (!fs.existsSync(abs) || fs.statSync(abs).size === 0) {
        fail(`missing or empty dist/${seoFile}`);
      }
    }
    if (fs.existsSync(indexPath)) {
      const indexHtml = fs.readFileSync(indexPath, 'utf8');
      if (!indexHtml.includes('application/ld+json')) {
        fail('dist/index.html missing application/ld+json structured data');
      }
    }
  }

  if (portal.hasAr) {
    const arIndex = path.join(distDir, 'ar', 'index.html');
    if (!fs.existsSync(arIndex)) {
      fail('missing dist/ar/index.html for RTL locale');
    } else {
      const arHtml = fs.readFileSync(arIndex, 'utf8');
      if (!/dir=["']rtl["']/i.test(arHtml) || !/lang=["']ar["']/i.test(arHtml)) {
        fail('dist/ar/index.html must declare lang="ar" and dir="rtl"');
      }
    }
  }

  const htmlFiles = collectSampleHtmlFiles(distDir);
  if (htmlFiles.length === 0) {
    fail('no HTML files found in dist/');
    return errors;
  }

  for (const file of htmlFiles) {
    const rel = path.relative(distDir, file);
    const html = fs.readFileSync(file, 'utf8');
    if (/<header[\s>]/i.test(html)) {
      fail(`${rel} contains disallowed <header> element`);
    }
    if (!/<html[^>]*\blang=["'][a-z-]+["']/i.test(html)) {
      fail(`${rel} missing <html lang="..."> attribute`);
    }
    if (!/<title>[^<]+<\/title>/i.test(html)) {
      fail(`${rel} missing non-empty <title>`);
    }
    if (MOJIBAKE_RE.test(html)) {
      fail(`${rel} contains UTF-8 mojibake or replacement character`);
    }
  }

  return errors;
}

const targetArg = process.argv[2]?.replace(/\\/g, '/').replace(/\/+$/, '');
const targets = targetArg
  ? PORTALS.filter((p) => p.dir === targetArg)
  : PORTALS;

if (targetArg && targets.length === 0) {
  console.error(`Unknown portal directory: ${targetArg}`);
  process.exit(1);
}

const allErrors = [];
for (const portal of targets) {
  const errs = checkPortal(portal);
  if (errs.length === 0) {
    console.log(`PASS ${portal.dir}`);
  } else {
    allErrors.push(...errs);
    for (const err of errs) console.error(`FAIL ${err}`);
  }
}

if (allErrors.length > 0) {
  console.error(`\nSmoke check failed with ${allErrors.length} error(s).`);
  process.exit(1);
}

console.log(`\nSmoke check passed for ${targets.length} portal(s).`);
