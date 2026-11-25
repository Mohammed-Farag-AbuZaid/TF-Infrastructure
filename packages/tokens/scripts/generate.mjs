#!/usr/bin/env node
/**
 * TF Unions Token & Shared Web Asset Generator
 * Reads `tokens.json` and emits CSS custom properties, Tailwind preset,
 * and Dart token constants, then syncs them to all active portals & apps.
 *
 * Usage:
 *   node generate.mjs          # generate & sync files
 *   node generate.mjs --check  # exit 1 if any tracked generated file drifted
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_PKG_DIR = path.resolve(__dirname, '..');
const INFRA_ROOT = path.resolve(TOKENS_PKG_DIR, '..', '..');
const WORKSPACE_ROOT = path.resolve(INFRA_ROOT, '..');
const UI_WEB_DIR = path.join(INFRA_ROOT, 'packages', 'ui-web');
const DIST_DIR = path.join(TOKENS_PKG_DIR, 'dist');

const CHECK_ONLY = process.argv.includes('--check');
const tokens = JSON.parse(fs.readFileSync(path.join(TOKENS_PKG_DIR, 'tokens.json'), 'utf8'));

function toKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function hexToDartColor(hex) {
  const clean = hex.replace('#', '').toUpperCase();
  return `Color(0xFF${clean})`;
}

function buildTokensCss() {
  const lines = [
    `/* GENERATED FILE — DO NOT EDIT DIRECTLY. Source: packages/tokens/tokens.json (${tokens.meta.version}) */`,
    `:root {`,
    `  color-scheme: light dark;`,
  ];

  for (const [k, v] of Object.entries(tokens.color.light)) {
    lines.push(`  --tf-${toKebab(k)}: ${v};`);
  }
  lines.push(`  /* Backward-compatible semantic aliases */`);
  lines.push(`  --tf-well: var(--tf-surface-sunken);`);
  lines.push(`  --tf-ink: var(--tf-text);`);
  lines.push(`  --tf-slate: var(--tf-text-muted);`);
  lines.push(`  --tf-navy: var(--tf-brand);`);
  lines.push(`  --tf-navy-alt: var(--tf-brand-hover);`);
  lines.push(`  --tf-teal: var(--tf-accent);`);
  lines.push(`  --tf-ochre: var(--tf-signal);`);

  lines.push(`  /* Typography */`);
  for (const [k, v] of Object.entries(tokens.typography.fonts)) {
    lines.push(`  --tf-font-${toKebab(k)}: ${v};`);
  }
  for (const [k, v] of Object.entries(tokens.typography.scale)) {
    lines.push(`  --tf-text-${toKebab(k)}: ${v};`);
  }

  lines.push(`  /* Radius & Motion */`);
  lines.push(`  --tf-radius-input: ${tokens.radius.input}px;`);
  lines.push(`  --tf-radius-card: ${tokens.radius.card}px;`);
  lines.push(`  --tf-radius-pill: ${tokens.radius.pill}px;`);
  lines.push(`  --tf-motion-fast: ${tokens.motion.fast};`);
  lines.push(`  --tf-motion-base: ${tokens.motion.base};`);
  lines.push(`  --tf-motion-page: ${tokens.motion.page};`);
  lines.push(`  --tf-ease: ${tokens.motion.easing};`);
  lines.push(`  --tf-shadow-float: 0 1px 2px rgb(22 26 34 / 0.06);`);
  lines.push(`}`);

  lines.push(``);
  lines.push(`[data-theme='dark'] {`);
  for (const [k, v] of Object.entries(tokens.color.dark)) {
    lines.push(`  --tf-${toKebab(k)}: ${v};`);
  }
  lines.push(`}`);

  lines.push(``);
  lines.push(`@media (prefers-color-scheme: dark) {`);
  lines.push(`  :root:not([data-theme='light']) {`);
  for (const [k, v] of Object.entries(tokens.color.dark)) {
    lines.push(`    --tf-${toKebab(k)}: ${v};`);
  }
  lines.push(`  }`);
  lines.push(`}`);

  lines.push(``);
  lines.push(`[dir='rtl'] {`);
  lines.push(`  --tf-font-display: var(--tf-font-arabic-display);`);
  lines.push(`  --tf-font-body: var(--tf-font-arabic-body);`);
  lines.push(`}`);

  lines.push(``);
  lines.push(`@media (prefers-reduced-motion: reduce) {`);
  lines.push(`  :root {`);
  lines.push(`    --tf-motion-fast: 0ms;`);
  lines.push(`    --tf-motion-base: 0ms;`);
  lines.push(`    --tf-motion-page: 0ms;`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);
  return lines.join('\n');
}

function buildTailwindPreset() {
  return `// GENERATED FILE — DO NOT EDIT DIRECTLY. Source: packages/tokens/tokens.json (${tokens.meta.version})
module.exports = {
  theme: {
    extend: {
      colors: {
        tf: {
          canvas: 'var(--tf-canvas)',
          surface: 'var(--tf-surface)',
          sunken: 'var(--tf-surface-sunken)',
          border: 'var(--tf-border)',
          'border-strong': 'var(--tf-border-strong)',
          ink: 'var(--tf-text)',
          muted: 'var(--tf-text-muted)',
          subtle: 'var(--tf-text-subtle)',
          brand: 'var(--tf-brand)',
          'brand-hover': 'var(--tf-brand-hover)',
          'brand-soft': 'var(--tf-brand-soft)',
          accent: 'var(--tf-accent)',
          'accent-text': 'var(--tf-accent-text)',
          'accent-soft': 'var(--tf-accent-soft)',
          'accent-border': 'var(--tf-accent-border)',
          signal: 'var(--tf-signal)',
          'signal-soft': 'var(--tf-signal-soft)',
          danger: 'var(--tf-danger)',
          'danger-soft': 'var(--tf-danger-soft)',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        arabic: ['"IBM Plex Sans Arabic"', '"Plus Jakarta Sans"', 'sans-serif'],
        'arabic-display': ['"Readex Pro"', '"IBM Plex Sans Arabic"', 'sans-serif'],
      },
      borderRadius: {
        'tf-input': '${tokens.radius.input}px',
        'tf-card': '${tokens.radius.card}px',
        'tf-pill': '${tokens.radius.pill}px',
      },
      transitionTimingFunction: {
        tf: '${tokens.motion.easing}',
      },
      transitionDuration: {
        'tf-fast': '${tokens.motion.fast}',
        'tf-base': '${tokens.motion.base}',
        'tf-page': '${tokens.motion.page}',
      },
    },
  },
};
`;
}

function buildDartTokens() {
  const lines = [
    `// GENERATED FILE — DO NOT EDIT DIRECTLY.`,
    `// Source: TF-Infrastructure/packages/tokens/tokens.json (${tokens.meta.version})`,
    `import 'package:flutter/material.dart';`,
    ``,
    `abstract final class TfTokens {`,
    `  // Light palette`,
  ];
  for (const [k, v] of Object.entries(tokens.color.light)) {
    lines.push(`  static const Color ${k} = ${hexToDartColor(v)};`);
  }
  lines.push(``);
  lines.push(`  // Dark palette`);
  for (const [k, v] of Object.entries(tokens.color.dark)) {
    const cap = k.charAt(0).toUpperCase() + k.slice(1);
    lines.push(`  static const Color dark${cap} = ${hexToDartColor(v)};`);
  }
  lines.push(``);
  lines.push(`  // Spacing scale (px)`);
  for (const [k, v] of Object.entries(tokens.space)) {
    lines.push(`  static const double space${k} = ${Number(v).toFixed(1)};`);
  }
  lines.push(``);
  lines.push(`  // Radii (px)`);
  for (const [k, v] of Object.entries(tokens.radius)) {
    const cap = k.charAt(0).toUpperCase() + k.slice(1);
    lines.push(`  static const double radius${cap} = ${Number(v).toFixed(1)};`);
  }
  lines.push(``);
  lines.push(`  // Motion`);
  lines.push(`  static const Duration motionFast = Duration(milliseconds: 120);`);
  lines.push(`  static const Duration motionBase = Duration(milliseconds: 200);`);
  lines.push(`  static const Duration motionPage = Duration(milliseconds: 320);`);
  lines.push(`  static const Curve ease = Cubic(0.2, 0.7, 0.2, 1.0);`);
  lines.push(``);
  lines.push(`  // Font family names`);
  lines.push(`  static const String fontDisplay = 'Bricolage Grotesque';`);
  lines.push(`  static const String fontBody = 'Plus Jakarta Sans';`);
  lines.push(`  static const String fontMono = 'JetBrains Mono';`);
  lines.push(`  static const String fontArabicDisplay = 'Readex Pro';`);
  lines.push(`  static const String fontArabicBody = 'IBM Plex Sans Arabic';`);
  lines.push(`}`);
  lines.push(``);
  return lines.join('\n');
}

const cssContent = buildTokensCss();
const presetContent = buildTailwindPreset();
const dartContent = buildDartTokens();

const targets = [
  { file: path.join(DIST_DIR, 'tokens.css'), content: cssContent, required: true },
  { file: path.join(DIST_DIR, 'tailwind-preset.cjs'), content: presetContent, required: true },
  { file: path.join(DIST_DIR, 'tf_tokens.dart'), content: dartContent, required: true },
];

const uiCssPath = path.join(UI_WEB_DIR, 'tf-ui.css');
const uiJsPath = path.join(UI_WEB_DIR, 'tf-chrome.js');
const uiCssContent = fs.existsSync(uiCssPath) ? fs.readFileSync(uiCssPath, 'utf8') : null;
const uiJsContent = fs.existsSync(uiJsPath) ? fs.readFileSync(uiJsPath, 'utf8') : null;

const astroPortals = [
  path.join(INFRA_ROOT, '05-web-portals', 'foundation-portal'),
  path.join(INFRA_ROOT, '05-web-portals', 'verify-portal'),
  path.join(INFRA_ROOT, '05-web-portals', 'docs-portal'),
  path.join(INFRA_ROOT, '05-web-portals', 'connect-portal'),
  path.join(INFRA_ROOT, '05-web-portals', 'guides-portal'),
  path.join(INFRA_ROOT, '05-web-portals', 'news-portal'),
  path.join(INFRA_ROOT, '03-sso-auth-hub', 'web-portal'),
];

for (const portalDir of astroPortals) {
  if (fs.existsSync(portalDir)) {
    targets.push({ file: path.join(portalDir, 'src', 'styles', 'tf-tokens.css'), content: cssContent, required: true });
    if (uiCssContent !== null) {
      targets.push({ file: path.join(portalDir, 'src', 'styles', 'tf-ui.css'), content: uiCssContent, required: true });
    }
    if (uiJsContent !== null) {
      targets.push({ file: path.join(portalDir, 'public', 'js', 'tf-chrome.js'), content: uiJsContent, required: true });
    }
  }
}

const flutterTargets = [
  path.join(WORKSPACE_ROOT, 'TF-Preset', 'lib', 'src', 'tokens', 'tf_tokens.dart'),
  path.join(WORKSPACE_ROOT, 'tf_news', 'lib', 'utils', 'constants', 'tf_tokens.dart'),
  path.join(WORKSPACE_ROOT, 'TF-Union', 'tf_union', 'lib', 'constants', 'tf_tokens.dart'),
];

for (const dartPath of flutterTargets) {
  const repoRoot = path.dirname(path.dirname(path.dirname(path.dirname(dartPath))));
  if (fs.existsSync(repoRoot)) {
    targets.push({ file: dartPath, content: dartContent, required: false });
  }
}

let drifted = false;
for (const t of targets) {
  const normalizedWanted = t.content.replace(/\r\n/g, '\n');
  const existing = fs.existsSync(t.file) ? fs.readFileSync(t.file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (CHECK_ONLY) {
    if (existing !== normalizedWanted) {
      console.error(`DRIFT: ${path.relative(INFRA_ROOT, t.file)}`);
      if (t.required) drifted = true;
    }
  } else {
    fs.mkdirSync(path.dirname(t.file), { recursive: true });
    fs.writeFileSync(t.file, normalizedWanted, 'utf8');
    console.log(`Synced ${path.relative(WORKSPACE_ROOT, t.file)}`);
  }
}

if (CHECK_ONLY) {
  if (drifted) {
    console.error('Token drift detected. Run: node packages/tokens/scripts/generate.mjs');
    process.exit(1);
  }
  console.log(`All ${targets.length} generated token targets are up to date.`);
}
