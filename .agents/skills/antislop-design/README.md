# AntiSlopUI

![Suite](https://img.shields.io/badge/suite%203.0.0-blue?style=for-the-badge)
![1 Skill](https://img.shields.io/badge/skills-1-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
[![validate](https://github.com/Vanszs/AntiSlopUI/actions/workflows/validate.yml/badge.svg)](https://github.com/Vanszs/AntiSlopUI/actions/workflows/validate.yml)

**One skill** that makes AI-generated UI stop looking machine-generated: a deterministic
ban filter, a positive pattern library, a CSV design-system generator, and an opt-in
award-grade craft tier. Everything ships in this repository — `SKILL.md` is the skill,
`references/` is the library, `ui-ux-pro-max/` is the research tool.

> If you could swap the logo with a competitor and nobody would notice — it's slop.

## Install

```bash
npx skills add Vanszs/AntiSlopUI
```

That installs one skill (`antislop-design`) with all references and the research tool.
Manual installs copy the whole repository, because the references and the tool live
beside `SKILL.md`:

```bash
git clone https://github.com/Vanszs/AntiSlopUI.git
mkdir -p ~/.claude/skills
cp -r AntiSlopUI ~/.claude/skills/antislop-design
```

Same shape for Codex (`~/.agents/skills`), opencode (`~/.config/opencode/skills`), and
Kiro (`your-project/.kiro/skills`). Do **not** put this under `.kiro/steering/` —
steering files default to always-included and inject the entire catalog into every
request.

For agents without a skills mechanism, point them at the file:

```markdown
## UI work
Read `<skill-dir>/SKILL.md` before writing or reviewing any UI code. It is a hard filter
that owns the ban list, not advice. Open the tell catalogue plus, at most, two sections of one library file per task — never a whole reference file. Run the Pre-Delivery Audit and report PASS/FAIL/N-A/UNVERIFIED per item with
evidence. Never invent social proof; omit it and record `NO-PROOF: user supplied none`.
```

Requirement: Python 3.8+ for the research tool and for the repository checks in `scripts/`.
The skill content itself — `SKILL.md` and `references/` — is pure Markdown.

## What problem this solves

LLMs generate UI by averaging training data dominated by Tailwind docs, shadcn/ui
examples, abandoned repos with unchanged defaults, and 2020–2024 Dribbble SaaS shots.
Output collapses toward the visual mean: purple gradients, Inter everywhere, centered
dual-CTA heroes, 3-card grids, glass navbars, "Supercharge your workflow" copy.

That is structural. Every decision left unspecified gets the most probable token. The cure
is deliberate, content-specific variation — enforced here, not suggested.

## One skill, one contract

Version 3 merges what used to be three skills. There is no routing between packages and
no precedence ladder, because everything is in one file:

| Layer | Lives in | What it does |
|---|---|---|
| Ban filter | `SKILL.md` | 12 hard gates, closed severity vocabulary, motion table, text measure, palette and type tables, the PASS/FAIL audit |
| Pattern library | `references/` | 25 layouts, typography systems, 17 card variants, forms, nav, tables, charts, dashboards |
| Craft tier (opt-in) | `references/awards-craft.md` | Awwwards-weighted rubric (Design 40 · Usability 30 · Creativity 20 · Content 10) plus hard performance and accessibility gates that deny the tier |
| Research tool | `ui-ux-pro-max/` | CSV-driven design-system generator, post-filtered before use |

Rules that used to be defensive now hold by construction: a single ban list, a single
motion table, a single budget, and no dangling cross-skill steps.

## The decision rule

**Any P0 tell blocks delivery, as does 3+ P0/HIGH tells. MEDIUM and LOW are recorded.**
A tell is one catalogue row, or one of the code-level findings in the audit (five a11y/form HIGH
items (focus, labels, alt, colour-only, validation) and seven code P0 items), counted **per element** — overlapping rows on one element collapse to the highest
severity, and page-scope rows count once for the page.

`WARN-BRAND-SWAP` is a warning, never a block; an `UNVERIFIED` P0 blocks like a FAIL. `N-A` means the component or capability is
absent; `UNVERIFIED` means you could not measure it — never mark an unmeasured item PASS.

## Context budget

- **Always:** `SKILL.md`.
- **On demand:** this file, the tell catalogue (needed for counting) and **sections** of one
  library file — never whole reference files. Ceiling: 70 KB of skill text (≈20k real tokens;
  3.5 bytes ≈ 1 token).
- **Never:** read a whole reference file. Grep the headings — the `## Contents` block is only
  a summary, grep also gives line numbers — then read that range:
  `cd <skill-dir> && grep -nE '^#{1,2} ' references/layouts.md`.
- **Never:** read the CSVs by hand. Query them through the research tool (2–3 targeted
  queries).

## Usage

1. **Filter** — read the gates, the deterministic terms and the audit in `SKILL.md`.
2. **Palette** — pick a pattern from `references/` by its when-to-use note; vary anatomy,
   widths and padding.
3. **Research** — generate an industry design system, then post-filter it.
4. **Audit** — run the Pre-Delivery Audit; then `scripts/audit.py` on the artifact in CI.

```bash
# Full design system
python3 ui-ux-pro-max/scripts/search.py "beauty spa wellness service" --design-system -p "Serenity Spa"

# Persist MASTER + page overrides into design-system/<slug>/ (gitignored)
python3 ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system --persist -p "Ledger"

# Domain and stack searches
python3 ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style
python3 ui-ux-pro-max/scripts/search.py "form validation" --stack react
```

Commands are repository-relative. When the skill is installed elsewhere, use
`python3 "<skill-dir>/ui-ux-pro-max/scripts/search.py" …` — the script resolves its data
directory relative to itself. Full workflow, domains, stacks and the post-filter table:
[`references/research.md`](references/research.md).

## What's inside

```
AntiSlopUI/
├── SKILL.md                     # the skill: gates, tables, terms, audit
├── references/
│   ├── slop-uiux-patterns.md    # 126 tell rows: TELL → WHY-SLOP → FIX → SEVERITY
│   ├── slop-code-patterns.md    # React/TSX/a11y code-level tells
│   ├── layouts.md               # 25 numbered layout patterns
│   ├── typography.md            # pairings, modular scales, clamp() recipes
│   ├── components.md            # cards, buttons, forms, nav, data display
│   ├── animation.md             # overlays, feedback, motion recipes
│   ├── design-systems.md        # library index, tokens, decision matrix
│   ├── charts.md                # chart patterns, chrome, anti-slop scan
│   ├── dashboards.md            # admin shell, tables, filters, states
│   ├── awards-craft.md          # opt-in craft tier, scored rubric, hard gates
│   └── research.md              # CSV generator workflow + post-filter
├── ui-ux-pro-max/
│   ├── scripts/                 # search.py, core.py, design_system.py
│   ├── data/                    # CSV databases (query via search.py)
│   └── LICENSE                  # upstream MIT notice + local modifications
├── scripts/                     # contributor tooling; not needed to use the skill
│   ├── validate.py              # 23 repository checks
│   ├── audit.py                 # artifact gate (bans, glass, motion, layout)
│   ├── stats.py                 # recompute/splice the stats block below
│   ├── toc.py                   # regenerate every ## Contents index
│   ├── golden.py                # semantic snapshot test over five generator fixtures
│   └── conflict-allowlist.txt   # reviewed exemptions for audit/validate scans
├── tests/golden/                # committed fixtures (ASCII, markdown, MASTER, page)
└── .github/workflows/validate.yml
```

## Verification

Claims here are checked, not asserted:

```bash
python3 scripts/validate.py       # 23 structural + semantic checks, non-zero exit on failure
python3 scripts/audit.py .        # artifact gate across docs and code
python3 scripts/golden.py         # semantic snapshot: filtered generator output must not drift
python3 scripts/stats.py          # recompute the stats block from the CSVs
python3 scripts/toc.py --write    # regenerate reference indexes (non-destructive)
```

What is enforced: single-skill contract and frontmatter; reference/link integrity; no
stale paths; stats matching the CSVs; stack coverage; documented CLI values matching
argparse; the brand-hue table matching the generator and `-p` invariance; the persist
contract named in `references/research.md`; CSV structure (width, IDs, severity);
`## Contents` correctness; a single motion canon; README claim sync; and an audit of a
freshly generated `MASTER.md`. `golden.py` locks behaviour rather than structure: five
fixtures (ASCII, markdown, persisted `MASTER.md`, and a page override) are regenerated and
compared byte-for-byte with the timestamp normalised, so a change to the post-filter, the
ledger, the button contrast pair, or the CSVs fails CI until the fixtures are refreshed
with `python3 scripts/golden.py --write`.

## Stats

<!-- stats:begin -->
| Metric | Value |
| --- | ---: |
| Skills | 1 |
| Markdown files | 13 |
| Reference files | 11 |
| Reasoning rules | 100 |
| UI styles | 66 |
| Color palettes | 96 |
| Font pairings | 57 |
| UX guidelines | 99 |
| Chart types | 25 |
| Tech stacks | 13 |
<!-- stats:end -->

## Migration from v2 (three skills)

v3.0.0 merged `anti-ai-slop-ui-ux`, `component-reference-design` and `ui-ux-pro-max` into
this single skill. The old directories and skill ids are gone; the rule content is now
`SKILL.md` plus `references/`. If you have the old skills installed, remove them
(`npx skills remove anti-ai-slop-ui-ux component-reference-design ui-ux-pro-max`) so two
ban lists cannot drift apart.

## Contributing

```bash
git clone https://github.com/Vanszs/AntiSlopUI.git
cd AntiSlopUI
git checkout -b feat/your-feature
# edit
python3 scripts/validate.py && python3 scripts/audit.py .
git commit -m "feat: description"
git push -u origin feat/your-feature
gh pr create
```

Rules of the house: no claim without a validated number, no ban without a compliant
default, no reference file without `## Contents`, no motion duration outside the canonical
table, and never invent proof.

## Acknowledgments

- **[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)** by
  [NextLevelBuilder](https://github.com/nextlevelbuilder) — the `ui-ux-pro-max/` directory
  is their design intelligence system, vendored under MIT with local fixes (paths, CSV
  quoting, docstrings, a compliance post-filter in the generator). Local notice:
  [`ui-ux-pro-max/LICENSE`](ui-ux-pro-max/LICENSE).
- Inspired by MUI, shadcn/ui, Radix, Headless UI, Material Design 3, Apple HIG, IBM
  Carbon, NNG, Refactoring UI, Every-Layout, Tailwind UI, Ant Design, Chakra UI, Josh
  Comeau, Emil Kowalski, and [Adrian Krebs](https://slop-detect.com/).
- The opt-in craft tier's weights follow the Awwwards evaluation system
  (Design 40 · Usability 30 · Creativity 20 · Content 10).

## License

MIT — see [LICENSE](LICENSE). UI/UX Pro Max is MIT licensed; see
[`ui-ux-pro-max/LICENSE`](ui-ux-pro-max/LICENSE).
