# Step 5: Public Web Portals & Operations Dashboard (`*.tfunions.com`)

## Overview
Contains all **7 Astro 5 + Tailwind CSS** applications built around TF Unions' **Calm Alabaster & Fjord Slate** design system (`../packages/tokens` & `../packages/ui-web`) and deployed on **Cloudflare Pages**.

## Portals

1. **[`foundation-portal/`](./foundation-portal) (`https://www.tfunions.com`)**
   - Bilingual foundation home (`/` & `/ar/`), `/about`, `/charter`, `/commitments`, `/divisions`, `/desk` (live deadlines, chapters & ledger snapshot), `/privacy`.
   - `/team`, `/team.json`, and `/roster` — Interactive Season 1 (**July–November 2025**) → Season 2 (**2026** + **Zain AI** joined **October 2026**) orbital constellation & searchable directory powered by `src/data/team-nodes.json` + live PII-free Firestore `/teamMembers`. Departed Season 1 members transition out cleanly as Alumni while remaining browsable in `/roster` and the Alumni filter.
   - `/transparency` — Open-Book Financial Ledger (HCB-inspired transparency metrics, inflows vs. outflows, live balance from Firestore `/ledgerEntries`).
   - `/volunteer` & `/volunteer-apply`, `/support` & `/support-receipt`, `/ideas` & `/ideas-submit`, `/photos-submit`, and `/studio` (redirects cleanly to `dashboard.tfunions.com`).
2. **[`dashboard-portal/`](./dashboard-portal) (`https://dashboard.tfunions.com`)**
   - Role-gated 5-workspace Operations Control Plane synced with Firestore Auth + `/staffAccess` + `/roleDefinitions`:
     - **Home & Timer** (clickable KPIs, work-session timer, manual work logs)
     - **Site Copy** (`copy-catalog.json` live click-to-edit across all 6 public portals + global find-and-replace)
     - **Content & Ledger** (Open Financial Ledger, Chapters, Guides, Opportunities, Certificates)
     - **Team, Tasks & Inbox** (Tasks Kanban board, **Org Tree & Tenure** lifecycle with End Tenure / Replace modal, Top Achievers, **Submissions Inbox** for Donations / Volunteers / Ideas / Photos)
     - **People & Access** (Unified **People & Assign** searchable member directory, custom **Dynamic Role Rules Builder**, and append-only **Audit Log**)
3. **[`news-portal/`](./news-portal) (`https://news.tfunions.com`)**
   - Bilingual EN/AR opportunities, universities, scholarships, and announcements portal (`npm run build:offline` builds static pages without external data fetches).
4. **[`guides-portal/`](./guides-portal) (`https://guides.tfunions.com`)**
   - STEM Olympiad and scientific research roadmaps (`/guides/[slug]`).
5. **[`connect-portal/`](./connect-portal) (`https://connect.tfunions.com`)**
   - Governorate chapters directory and chapter/guild proposal portal (`/propose`).
6. **[`verify-portal/`](./verify-portal) (`https://verify.tfunions.com`)**
   - Instant public certificate serial verification (`/schema` & live Firestore `/certificates/{serial}` lookup).
7. **[`docs-portal/`](./docs-portal) (`https://docs.tfunions.com`)**
   - Official Wiki, `/faq`, `/sso`, and `/api` live Firestore REST documentation.

## Shared Design System & Verification Commands
Run from `TF-Infrastructure/` root:
- Sync design tokens & shared UI chrome (`packages/ui-web/tf-chrome.js`): `node packages/tokens/scripts/generate.mjs` (`--check` in CI)
- Regenerate Dashboard copy catalog after editing public pages: `node scripts/extract-copy-catalog.mjs`
- Run full 8-portal build verification: `node scripts/smoke-check.mjs`
