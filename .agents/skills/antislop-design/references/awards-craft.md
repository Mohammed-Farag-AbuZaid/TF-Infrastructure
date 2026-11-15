# Awards Craft Tier — Opt-In

Companion to `../SKILL.md`. This is the **only** file in this skill that is allowed to
raise the craft ceiling. It is opt-in and gated, because award-grade detail and
slop are separated by one thing: whether the detail pays for itself.

## Contents

- 0. When this tier applies
- 1. The rubric — score before you decorate
- 2. Hard gates — a fail denies the tier outright
- 3. Craft patterns and their cost
- 4. Award theatre — earns nothing, costs the tier
- 5. The only two relaxations this tier may request
- 6. Procedure
- Sources

## 0. When this tier applies

**Applies when** the user asks for premium, award-grade, "wow", portfolio, studio,
launch-page, or brand-site work — or explicitly names a craft tier.

**Does not apply** to dashboards, admin tools, internal apps, docs, checkout, forms,
onboarding, or any surface where the user's job is the product. There, the tier is
denied: its budget is not available.

**Never** overrides this skill's bans. This tier can add craft; it cannot spend a ban.
The two relaxations it *is* allowed to request are listed in §5 and nowhere else.

## 1. The rubric — score before you decorate

Weights mirror the Awwwards evaluation system (Design 40 · Usability 30 ·
Creativity 20 · Content 10). Score each criterion 0–10, multiply by weight, sum.

| Criterion | Weight | What earns points | What loses points |
|---|---|---|---|
| **Design** | 40 | Composition, hierarchy, type colour, grid discipline, contrast, consistency across breakpoints, deliberate negative space, finished states (empty/loading/error) | Decoration masking weak composition; mismatched radii; default-feeling sections; unfinished states |
| **Usability** | 30 | Keyboard reachable, focus visible, labels wired, hit areas ≥44px, no scroll traps, reduced-motion parity, mobile parity at 375px, navigation legible in one pass | Scroll hijack, cursor-only affordances, hidden nav, motion that blocks input, contrast below AA |
| **Creativity** | 20 | A concept that belongs to *this* product; one memorable mechanism; type/motion/imagery that carry meaning | Trends applied without reason; borrowed mechanism with no content tie; gimmick that dies after 4 seconds |
| **Content** | 10 | Real copy with concrete numbers, real screenshots, real logos, honest proof | Invented metrics, stock testimonial faces, "trusted by" theatre, lorem leftovers |

**Verdict bands:** ≤6.0 → deny the tier and ship the solid version. 6.1–7.9 → craft
tier with the weakest criterion fixed. ≥8.0 → shippable as premium. ≥9.0 → award
submission candidate, and only if every hard gate in §2 passes.

Report the score as a table with one line of evidence per criterion
(`criterion — score — evidence`). No evidence, no points.

## 2. Hard gates — a fail denies the tier outright

These are pass/fail, measured, and not negotiable by taste. A single fail means the
page ships at "solid", not "premium".

| Gate | Threshold | How to check |
|---|---|---|
| LCP | ≤2.5s (p75, mobile) | Lighthouse / field data |
| CLS | ≤0.1 | Lighthouse |
| INP | ≤200ms | Lighthouse / field data |
| Long task | no >200ms blocking task on first interaction | Performance panel |
| JS payload | ≤200KB gzip initial, excluding a single justified 3D chunk | bundle report |
| Reduced motion | full parity — content identical, no spatial motion, no autoplay | OS setting + reload |
| Keyboard | every action reachable, no trap, `focus-visible` visible on every stop | tab through |
| Mobile | usable at 375px: no horizontal scroll, tap targets ≥44px, no hover-only reveal | device emulation |
| Contrast | 4.5:1 body, 3:1 large/UI, light and dark | contrast checker |
| Content | zero invented numbers, logos, or testimonials | manual read |

## 3. Craft patterns and their cost

Every entry states the budget it spends. Budget is the point: a mechanism that cannot
be paid for is slop with better marketing.

| Pattern | Earns | Cost | Guardrail |
|---|---|---|---|
| Kinetic display type | Concept expression, one hero moment | 1 animated text component, ≤2 animated properties | Settles to static; `prefers-reduced-motion` renders the final frame immediately |
| Route / section transition | Continuity between views | Canonical route limit (≤300ms); no §5 OVERRIDE applies to routes | Skipped entirely under reduced motion; no transition on back-navigation |
| Scroll choreography | Rhythm across sections | max 1 trigger per section, fires once; only the hero choreography duration may use the §5 `OVERRIDE`; `transform`/`opacity` only | No pinning longer than one viewport; no scroll-jack; native scroll always wins |
| 3D / WebGL accent | Memorability where the product is spatial | ≤800KB gzip, one canvas, capped DPR | Static poster fallback; paused off-screen; paused under reduced motion; no autoplay audio |
| Custom cursor | Tone, if the brand is the tool | 1 layer, must not hide the native affordance for text/links | Keyboard path unaffected; disabled under reduced motion and on touch |
| Video loop | Atmosphere or product proof | ≤2MB, muted, `playsinline`, poster, `preload="metadata"` | Visible pause control; paused off-screen and under reduced motion |
| Oversized editorial type | Confidence, hierarchy | fluid `clamp()`, measure ≤2 lines, ≤3 words per line | Reflows at 375px without clipping; no `text-*`-only headline without a semantic heading |
| Micro-interaction set | Perceived quality | ≤3 distinct interactions per view; follow canonical timing | No layout shift; no hover-only information |
| Sound | Rarely | opt-in only, default off | Never required to understand state |

## 4. Award theatre — earns nothing, costs the tier

These are the moves that make a page look like it is competing for an award while
scoring worse on the actual rubric:

- Cursor trails, custom scrollbars, and hover chaos on every element.
- A load animation between the user and the content, with no progress value.
- Scroll hijacking, snap-to-section on a content page, pinned sections longer than a viewport.
- Autoplay audio, unmuted video, or a "click to enter" gate.
- Motion that repeats on every visit with no way to stop it.
- Fake 3D: parallax on text, tilt on cards, perspective on grids.
- Decorative elements that carry no information and slow the first paint.
- Gradient text, glass surfaces, and glow used as the *only* idea.

## 5. The only two relaxations this tier may request

Everything else in `../SKILL.md` stays exactly as written.

1. **Hero choreography duration** — may use 400ms. Declare `OVERRIDE: canonical motion limit → 400ms [craft tier §5]` on the motion instance.
2. **Viewport-wide ambient animation** — the single permitted ambient animation (max one per page) may span the viewport. Declare `OVERRIDE: ambient one section → viewport-wide, still max one per page [craft tier §5]`. Keep it pausable and static under `prefers-reduced-motion`.

Both relaxations remain pausable and static under reduced motion. Hovers and non-hero transitions stay within canonical limits.

## 6. Procedure

1. Confirm the tier applies (§0). If not, refuse and ship solid.
2. Run the Pre-Delivery Audit in `../SKILL.md` first. A P0 fail, or 3+ P0/HIGH tells, denies the tier — do not
   decorate a page that has not passed the Delivery gate.
3. Measure the §2 gates. Record numbers, not impressions.
4. Score the §1 rubric. Fix the weakest criterion before adding any §3 pattern.
5. Add craft patterns only while budget remains. Each one needs a one-line reason
   tied to content.
6. Re-measure the gates after the last pattern. Regressions revoke the pattern.
7. Report: gate table (PASS/FAIL + number), rubric table (score + evidence),
   overrides declared.

## Sources

Awwwards evaluation system (Design 40 / Usability 30 / Creativity 20 / Content 10;
Developer Award requires a developer-jury score above 7), W3C WAI-ARIA APG, WCAG 2.2
(2.3.3 Animation from Interactions, 2.2.2 Pause Stop Hide), Core Web Vitals
thresholds, and the performance budgets used by Linear, Vercel, Stripe, and Raycast
marketing surfaces.
