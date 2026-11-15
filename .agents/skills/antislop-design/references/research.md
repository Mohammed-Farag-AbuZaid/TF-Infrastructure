# Research — CSV design-system generator

Companion to `../SKILL.md`. Use this file only when you need industry-specific
evidence (styles, palettes, font pairings, chart types, stack guidance). The
generator is a *proposal engine*: its output is filtered by `../SKILL.md` before
it reaches code.

## Contents

- Path and prerequisites
- Workflow
- Search reference
- Persist and hierarchical retrieval
- Post-filter (mandatory)
- Determinism
- When there is no shell

## Path and prerequisites

Python 3.8+ is required. The script resolves its data directory relative to
itself, so only the path you type matters.

```bash
# A. From a clone of this skill (repository root):
cd /path/to/AntiSlopUI
python3 ui-ux-pro-max/scripts/search.py "<query>" --design-system

# B. Installed anywhere:
python3 "<skill-dir>/ui-ux-pro-max/scripts/search.py" "<query>" --design-system
```

Commands below assume option A.

## Workflow

1. **Analyze the request** — product type, style keywords, industry, stack
   (default `html-tailwind`).
2. **Generate** a design system:
   ```bash
   python3 ui-ux-pro-max/scripts/search.py "<product> <industry> <keywords>" --design-system [-p "Project"]
   ```
   It searches product, style, color, landing and typography rows in one pass.
   Colour and typography are top BM25 matches from the CSV and are then
   overridden by the deterministic tables in `../SKILL.md`; every override is
   recorded in the ledger.
3. **Supplement** with domain searches when you need detail:
   ```bash
   python3 ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max>]
   ```
4. **Stack guidance** — `--stack` (default `html-tailwind`).
5. **Post-filter** the result before writing code (below), then run the
   delivery gate in `../SKILL.md`.

Flags: `--design-system` (`-ds`), `-p/--project-name`, `-f {ascii,markdown}`,
`--persist`, `--page`, `-o/--output-dir`, `-d/--domain`, `-s/--stack`,
`-n/--max-results`, `--json` (ignored when `--design-system` is set).

## Search reference

### Available Domains

| Domain | Use for | Example keywords |
|---|---|---|
| `product` | Product-type recommendations | SaaS, e-commerce, portfolio, healthcare, beauty, service |
| `style` | UI styles, colours, effects | glassmorphism, minimalism, dark mode, brutalism |
| `typography` | Font pairings, Google Fonts | elegant, playful, professional, modern |
| `color` | Colour palettes by product type | saas, ecommerce, healthcare, beauty, fintech, service |
| `landing` | Page structure, CTA strategy | hero, testimonial, pricing, social-proof |
| `chart` | Chart types, libraries | trend, comparison, timeline, funnel, pie |
| `ux` | Best practices, anti-patterns | animation, accessibility, z-index, loading |
| `react` | React/Next.js performance | waterfall, bundle, suspense, memo, rerender, cache |
| `web` | Interface guidelines | aria, focus, keyboard, semantic, virtualize |
| `icons` | Icon names and usage | search, settings, chart, navigation |

### Available Stacks

The vendored database ships native-framework guides as well. This skill's rules target web UI; use the native guides as reference material only — the ban filter, patterns and audit here do not govern native mobile design.

| Stack | Focus |
|---|---|
| `astro` | Islands, content collections, zero-JS defaults |
| `flutter` | Widgets, state, layout, theming |
| `html-tailwind` | Tailwind utilities, responsive, a11y (default) |
| `jetpack-compose` | Composables, modifiers, state hoisting |
| `nextjs` | SSR, routing, images, server actions |
| `nuxt-ui` | Nuxt UI components and theming |
| `nuxtjs` | Vue 3, routing, data fetching |
| `react` | State, hooks, performance, patterns |
| `react-native` | Components, navigation, lists |
| `shadcn` | shadcn/ui components, forms, theming |
| `svelte` | Runes, stores, SvelteKit |
| `swiftui` | Views, state, navigation, animation |
| `vue` | Composition API, Pinia, Router |

## Persist and hierarchical retrieval

```bash
python3 ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project"
python3 ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project" --page "dashboard"
```

Writes `design-system/<project-slug>/MASTER.md` and, with `--page`,
`design-system/<project-slug>/pages/<page-name>.md`. Base directory is the
current working directory unless `-o/--output-dir` is given. Read the page file
first; it overrides MASTER; otherwise MASTER alone governs.

## Post-filter (mandatory)

Treat generator output as a proposal. Apply these substitutions before code.
The cited gate or catalog row in `../SKILL.md` stays authoritative.

| Vendor output | Substitute | Authority |
|---|---|---|
| SaaS `Glassmorphism + Flat Design` | Evidence-supported allowed style; record the override | catalog K4 |
| Glass/transparent cards | Solid surface; at most ONE image-overlay surface at `bg-white/80` or stronger with an `@supports` fallback | catalog K4 |
| Violet/indigo background tint | Neutral surface, or a supported brand/domain tint | C1 |
| `indigo-950` text | High-contrast neutral; verify contrast | C7 |
| `Playfair Display + Inter` | Non-banned display/body pairing | catalog T11 |
| Mono/technical display face | Reserve for code; use the category face from `../SKILL.md` | display table |
| Prose effect strings | Descriptions, not instructions; use a concrete supported effect | styles catalog |
| Vendor prose motion duration | Apply the motion table; do not infer permission from prose | `../SKILL.md` |
| Any proof/metric/proof-adjacent instruction | Use evidence the user supplied; otherwise omit and record `NO-PROOF` | C1 / proof rules |

Record each substitution exactly: `OVERRIDE: <from> → <to> [<reason>]`.

## Determinism

Recommendations are deterministic for a given query. The hue comes from the
product domain in the query, never from `-p`; `-p` names the output folder and the document header.
A banned secondary collapses to the primary and a second banned accent takes the next hue in
the fixed list. Non-banned vendor secondary and CTA values pass through unchanged, so the
palette is not uniformly derived from the primary.
Persisted artifacts additionally embed a generation timestamp.

## When there is no shell

Do not read the CSVs by hand, and do not invent values. Build from the authored
defaults and the gate table in `../SKILL.md`, then say in your output that the
research step was unavailable.
