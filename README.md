# TF Unions — Master Infrastructure & Foundation Monorepo

> *"One account. All TF Unions services."*
> Supporting ambitious high school and university students across all 27 Egyptian governorates with open admissions data, research roadmaps, local chapters, and transparent student governance — built on a self-hosted & edge architecture.

---

## Foundation Timeline

- **Season 1 (July–November 2025):** Co-founded in **July 2025** by Mohammed Farag & Mohammed Abdelghany, scaling to 118 student leaders across HR, PR, Marketing, Social Media, Content Production, and Academic Fields before completing Season 1 in November 2025 (archived as Season 1 Alumni).
- **Season 2 (2026–Present):** Active core operations led by the Co-Founders alongside **Zain** (joined **October 2026** as TF Unions' first Autonomous AI Operations Engineer & Executive Assistant), powering 7 live Cloudflare Pages portals, Firebase/Firestore identity, and VPS automation.

---

## Repository Architecture

```text
TF-Infrastructure/
├── README.md
├── SPEC.md                                     # Master Technical Architecture Blueprint
├── .gitignore                                  # Ignores .env, node_modules, .wrangler, build artifacts
├── .github/workflows/
│   ├── api.yml                                 # TypeScript API build & test CI
│   ├── rules.yml                               # Firestore security rules test CI (15 unit tests)
│   ├── web.yml                                 # Astro web portals build & smoke-check CI
│   └── nightly.yml                             # Scheduled nightly verification checks
│
├── packages/
│   ├── tokens/                                 # Design system tokens (Calm Alabaster & Fjord Slate)
│   │   ├── tokens.json
│   │   ├── dist/                               # Generated tokens.css, tailwind-preset.cjs, tf_tokens.dart
│   │   └── scripts/generate.mjs                # Sync & verify 46 generated targets (--check)
│   └── ui-web/                                 # Shared top navigation, siteCopy hydrator & utilities
│       ├── tf-chrome.js                        # Shared ecosystem bar + live Firestore siteCopy hydrator
│       ├── tf-ui.css
│       ├── og-card.svg
│       └── illustrations/
│
├── scripts/
│   ├── extract-copy-catalog.mjs                # Extracts editable [data-tf-copy] fields across 6 portals
│   └── smoke-check.mjs                         # Verifies built dist/ HTML, headers, RTL & <header> policy
│
├── 01-vps-infra/                               # [Step 1] Self-Hosted Docker Stack (/opt/tfunions-infra)
│   ├── README.md
│   ├── docker-compose.yml                      # Caddy, Postgres, Redis, n8n, Baserow, Listmonk, Umami, Gotenberg, Uptime Kuma
│   ├── .env.example
│   ├── Caddyfile                               # Reverse proxy for api, n8n, auto, ops, mail, analytics, status.tfunions.com
│   ├── provision-vps.sh
│   ├── harden-host.sh
│   ├── init-scripts/01-init-multi-db.sh
│   └── backups/
│       ├── backup-cron.sh                      # Daily pg_dumpall + rclone off-site sync
│       └── restore-verify.sh
│
├── 02-database-schemas/                        # [Step 2] Firestore RBAC Rules & Baserow Relational Schemas
│   ├── README.md
│   ├── firestore/
│   │   ├── firebase.json
│   │   ├── firestore.rules                     # Zero-trust RBAC, permission helpers & PII boundaries
│   │   ├── firestore.indexes.json
│   │   ├── user-schema.json
│   │   └── test/rules.test.mjs                 # 15 security rules tests
│   └── baserow/
│       ├── bootstrap_baserow.py
│       └── schema-definition.json              # 6 core relational tables in TF_Unions_Core
│
├── 03-sso-auth-hub/                            # [Step 3] Unified SSO Hub, API Service & Flutter SDK
│   ├── README.md
│   ├── web-portal/                             # auth.tfunions.com (Astro + Cloudflare Pages Functions)
│   │   ├── functions/api/                      # sessionLogin, mintCustomToken, sessionLogout, _firebaseAdmin
│   │   └── src/pages/index.astro
│   ├── tf-api/                                 # Hono/TypeScript backend service + Vitest suite
│   ├── vps-auth-service/                       # Self-hosted auth bridge & Firebase migration helper
│   └── flutter-sdk/tf_sso_client.dart
│
├── 04-n8n-workflows/                           # [Step 4] Automation Pipelines & PDF Certificate Template
│   ├── README.md
│   ├── import_workflows_to_n8n.js
│   ├── templates/certificate-a4-landscape.html
│   └── workflows/                              # 01–07 n8n JSON exports (onboarding, HR, certs, ledger, QA, photos)
│
└── 05-web-portals/                             # [Step 5] 7 Astro 5 Portals on Cloudflare Pages
    ├── README.md
    ├── foundation-portal/                      # www.tfunions.com (EN/AR home, /team, /roster, /transparency, /desk, etc.)
    ├── dashboard-portal/                       # dashboard.tfunions.com (Owner & Team Operations control plane)
    ├── news-portal/                            # news.tfunions.com (Scholarships, universities & opportunities)
    ├── guides-portal/                          # guides.tfunions.com (Olympiad & STEM research guides)
    ├── connect-portal/                         # connect.tfunions.com (Governorate chapters & project guilds)
    ├── verify-portal/                          # verify.tfunions.com (Credential & serial verification)
    └── docs-portal/                            # docs.tfunions.com (Official documentation, FAQ & Firestore API docs)
```

---

## Ecosystem Domain Topology

| Subdomain | Service | Hosting | Source Directory | Access Policy |
| :--- | :--- | :--- | :--- | :--- |
| `www.tfunions.com` | Foundation Public Portal (EN / AR) | Cloudflare Pages | [`05-web-portals/foundation-portal`](./05-web-portals/foundation-portal) | Public |
| `dashboard.tfunions.com` | Owner & Team Operations Dashboard | Cloudflare Pages | [`05-web-portals/dashboard-portal`](./05-web-portals/dashboard-portal) | Role-Gated (Firebase RBAC) |
| `news.tfunions.com` | Scholarships, Programs & Admissions | Cloudflare Pages | [`05-web-portals/news-portal`](./05-web-portals/news-portal) | Public |
| `guides.tfunions.com` | Research & Olympiad Guides | Cloudflare Pages | [`05-web-portals/guides-portal`](./05-web-portals/guides-portal) | Public |
| `connect.tfunions.com` | Governorate Chapters & Guilds | Cloudflare Pages | [`05-web-portals/connect-portal`](./05-web-portals/connect-portal) | Public |
| `verify.tfunions.com` | Credential & Certificate Verifier | Cloudflare Pages | [`05-web-portals/verify-portal`](./05-web-portals/verify-portal) | Public |
| `docs.tfunions.com` | Documentation, FAQ & API Reference | Cloudflare Pages | [`05-web-portals/docs-portal`](./05-web-portals/docs-portal) | Public |
| `auth.tfunions.com` | Unified SSO Identity Hub | Cloudflare Pages + Functions | [`03-sso-auth-hub/web-portal`](./03-sso-auth-hub/web-portal) | Public |
| `api.tfunions.com` | TF Backend API (`tf-api`) | VPS (Docker + Caddy) | [`03-sso-auth-hub/tf-api`](./03-sso-auth-hub/tf-api) | Authenticated / Public Health |
| `n8n.tfunions.com` / `auto.tfunions.com` | n8n Workflow Engine | VPS (Docker) | [`01-vps-infra`](./01-vps-infra) & [`04-n8n-workflows`](./04-n8n-workflows) | Admin Zero Trust / `/webhook/*` |
| `ops.tfunions.com` | Baserow Internal Database | VPS (Docker) | [`01-vps-infra`](./01-vps-infra) & [`02-database-schemas`](./02-database-schemas) | Admin Only (Zero Trust) |
| `mail.tfunions.com` | Listmonk Mailing Lists | VPS (Docker) | [`01-vps-infra`](./01-vps-infra) | Admin Only (Zero Trust) |
| `analytics.tfunions.com` | Privacy-First Umami Analytics | VPS (Docker) | [`01-vps-infra`](./01-vps-infra) | Admin Zero Trust |
| `status.tfunions.com` | Uptime Kuma Status Monitor | VPS (Docker) | [`01-vps-infra`](./01-vps-infra) | Public Status Page |

---

## Local Verification & Build Commands

```bash
# 1. Verify generated design tokens & shared UI chrome across all 46 targets
node packages/tokens/scripts/generate.mjs --check

# 2. Run Firestore security rules unit tests (15 checks)
cd 02-database-schemas/firestore && node test/rules.test.mjs

# 3. Extract editable copy catalog after building the 6 public portals
node scripts/extract-copy-catalog.mjs

# 4. Run smoke checks across all 8 built portals (dist/, _headers, SEO, RTL, Mojibake, <header> ban)
node scripts/smoke-check.mjs
```

> Note: When building `05-web-portals/news-portal` without live network data sync, run `npm run build:offline` inside `05-web-portals/news-portal`.

---

## Status Checklist

- [x] **Step 1 — VPS Consolidated Stack, Hardening & Backups (`01-vps-infra/`)**
- [x] **Step 2 — Firestore Zero-Trust RBAC Rules & Baserow Schemas (`02-database-schemas/`)**
- [x] **Step 3 — Unified `.tfunions.com` SSO Hub, `tf-api` & Flutter Client SDK (`03-sso-auth-hub/`)**
- [x] **Step 4 — n8n Automation Pipelines & Certificate Template (`04-n8n-workflows/`)**
- [x] **Step 5 — All 7 Web Portals, Season 1 (2025) → Season 2 (2026) + Zain AI Org Constellation & TF Dashboard (`05-web-portals/`)**
