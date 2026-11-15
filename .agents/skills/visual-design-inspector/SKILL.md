---
name: visual-design-inspector
description: "Inspect, browse, screenshot, and analyze diverse real-world website and app designs before building or redesigning UI. Connects live browser inspection, UI/UX style & palette databases, Hallmark genre references, and automated AI-slop audits to extract structural layout patterns, typography systems, and spacing proportions without cloning third-party brand identity."
---

# Visual Design Inspector

Use this skill whenever the user asks to explore different design directions, match or surpass real-world editorial/product UI references, inspect a live site visually, or verify whether an implementation escapes generic AI templates.

## 1. Visual Inspiration & Live Reference Workflow
1. **Browse Live References (`browser` subagent)**
   - Delegate live web inspection to the built-in `browser` subagent to open reference sites, design galleries, Mobbin/Dribbble/awwwards/editorial exemplars, or live local dev servers (`localhost:<port>`).
   - Capture desktop (`1440px`) and mobile (`390px`) screenshots and inspect DOM computed styles (`font-family`, `font-size`, `line-height`, background/border contrast, grid columns, spacing rhythm).
   - Compare staged reference images placed in `<Artifact Directory Path>/browser_sandbox/references/<filename>` against the rendered page.
2. **Explore 80+ Curated UI Styles & 192 Palettes (`ui-ux-pro-max`)**
   - Query the installed `ui-ux-pro-max` dataset (`scripts/search.py`) and `hallmark/references/genres/` + `hallmark/references/macrostructures/` to explore genuinely different visual directions (Editorial Newspaper, Swiss Architectural Grid, Technical Terminal, Museum Monograph, Sovereign Ledger) rather than converging on SaaS defaults.
3. **Inspect Computed Live DOM (`impeccable/scripts/live-browser.js`)**
   - When Playwright / Chromium is available, run computed visual checks using `webapp-testing` and `impeccable/scripts/live-browser.js` to detect clipping, text overlap, horizontal overflow, low contrast, and broken hierarchy.
4. **Enforce Anti-AI-Slop Finish Gate (`antislop-design` + `hallmark/scripts/sloplint.mjs`)**
   - Run `antislop-design` and `hallmark/scripts/sloplint.mjs` across built HTML/CSS/Astro/React/Flutter UI outputs to strip purple/cyan gradients, tracked `ALL-CAPS` eyebrows, dot-pill badges, uniform `rounded-2xl` multi-card clones, and AI-cliché copy (`avoid-ai-writing`).

## 2. Structural Extraction Rules (Never Copy Brand Literally)
When studying a reference screenshot or live URL, extract **only structural mechanics**:
- **Canvas vs Surface Contrast**: Exact figure/ground delta (`>= 6–10%` luminance separation between canvas and card/panel surfaces).
- **Grid Asymmetry**: Column proportions (`7/5` split stage, `4/8` index-to-document layout, horizontal index ledger rows instead of 2x2 grids).
- **Typographic Pairing & Scale**: Serif display vs geometric sans vs tabular mono ratios, tight letter-spacing on H1/H2 (`-0.02em` to `-0.03em`), clear body leading (`1.5–1.65`).
- **Functional Restraint**: Every badge, border rule, or status dot must carry real data or interaction; strip purely decorative filler.
