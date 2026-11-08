# TF Unions — Master Infrastructure & Foundation Monorepo

> *"One account. All TF Unions services."*
> Helping ambitious and standout students across Egypt achieve STEM, research, and innovation goals — built on a strictly **$0/month additional recurring cost** architecture.

---

## 🏛️ Repository Architecture & Directory Outline

```text
TF-Infrastructure/
├── SPEC.md                                     # Master Technical Architecture & AI Execution Blueprint
├── .gitignore                                  # Global ignore rules (.env, node_modules, secrets)
│
├── 01-vps-infra/                               # [Step 1] Consolidated VPS Docker Architecture (/opt/tfunions-infra)
│   ├── README.md                               # Provisioning, DNS & Cloudflare Zero Trust guide
│   ├── docker-compose.yml                      # Caddy, Postgres 16, Redis 7, n8n, Baserow, Listmonk, Umami, Gotenberg, Uptime Kuma
│   ├── .env.example                            # Master environment variables template
│   ├── Caddyfile                               # Reverse proxy & automatic SSL routing
│   ├── init-scripts/
│   │   └── 01-init-multi-db.sh                 # Splits single Postgres instance into n8n_db, baserow_db, listmonk_db, umami_db
│   └── backups/
│       └── backup-cron.sh                      # Nightly pg_dumpall + rclone off-site sync to Cloudflare R2
│
├── 02-database-schemas/                        # [Step 2] Firestore & Baserow Relational Schemas
│   ├── README.md                               # Schema documentation & bootstrap instructions
│   ├── firestore/
│   │   ├── firestore.rules                     # Zero-trust RBAC rules for users/{firebase_uid}
│   │   ├── firestore.indexes.json              # Composite indexes for high-concurrency queries
│   │   └── user-schema.json                    # JSON Schema reference for student profiles & custom claims
│   └── baserow/
│       ├── bootstrap_baserow.py                # Automated Python script to create TF_Unions_Core & all 6 tables via API
│       └── schema-definition.json              # Declarative definition of the 6 core operational tables
│
├── 03-sso-auth-hub/                            # [Step 3] Unified SSO Identity Hub (auth.tfunions.org)
│   ├── README.md                               # Cross-subdomain cookie & custom token exchange architecture
│   ├── web-portal/                             # Astro + Cloudflare Pages Functions
│   │   ├── package.json
│   │   ├── astro.config.mjs
│   │   ├── wrangler.toml
│   │   ├── functions/
│   │   │   └── api/
│   │   │       ├── sessionLogin.ts             # POST /api/sessionLogin -> mints .tfunions.org HttpOnly session cookies
│   │   │       ├── mintCustomToken.ts          # GET /api/mintCustomToken -> exchanges cookie for Firebase Custom Token
│   │   │       └── sessionLogout.ts            # POST /api/sessionLogout -> clears root-domain cookies
│   │   └── src/
│   │       └── pages/
│   │           └── index.astro                 # Central login UI with ?redirect_to= subdomain whitelist validation
│   └── flutter-sdk/
│       └── tf_sso_client.dart                  # Reusable Flutter Web SSO hydration helper for TF News & TF Connect
│
├── 04-n8n-workflows/                           # [Step 4] Core Automation Pipelines (auto.tfunions.org)
│   ├── README.md                               # Webhook secrets, credentials setup & import guide
│   ├── workflows/
│   │   ├── 01-sso-user-onboarding-sync.json    # Syncs new Firebase user -> Baserow + Firestore + Listmonk + Welcome Email
│   │   ├── 02-volunteer-hr-auto-promotion.json # Automates custom claims, team directory & rebuild hook on acceptance
│   │   ├── 03-certificate-generator.json       # Renders HTML -> Gotenberg PDF -> Cloudflare R2 -> Baserow + Email
│   │   ├── 04-certificate-verifier-api.json    # Public GET endpoint backing verify.tfunions.org
│   │   ├── 05-donation-ledger-sync.json        # InstaPay receipt upload -> Telegram inline approval -> Open-Book Ledger
│   │   └── 06-global-qa-and-idea-voting.json   # Triage bug reports & deduplicated Firebase JWT idea upvoting
│   └── templates/
│       └── certificate-a4-landscape.html       # Print-ready HTML/CSS certificate template with SVG QR & founder signatures
│
└── 05-web-portals/                             # [Step 5] Public Web Portals & Global Widgets
    ├── README.md                               # Cloudflare Pages deployment & build hooks guide
    ├── foundation-portal/                      # tfunions.org (Astro 5 + Tailwind CSS)
    │   ├── package.json
    │   ├── astro.config.mjs
    │   ├── public/
    │   │   └── widgets/
    │   │       └── tf-qa-widget.js             # <4KB embeddable <tf-qa-widget> Web Component for all subdomains
    │   └── src/
    │       ├── layouts/
    │       │   └── BaseLayout.astro            # Shared layout with SSO user-hint hydration & QA widget
    │       └── pages/
    │           ├── index.astro                 # Ecosystem Landing Page & Live Impact Counters
    │           ├── about.astro                 # Mission & Non-Profit Governance
    │           ├── charter.astro               # Official Organizational Charter
    │           ├── team.astro                  # Dynamic Team & Contributors Wall (from Baserow)
    │           ├── volunteer.astro             # Seasonal Role Board & Application Portal
    │           ├── support.astro               # InstaPay / Vodafone Cash / Sponsor Tiers & Receipt Submission
    │           ├── transparency.astro          # Open-Book Financial Ledger (Donations vs. Expenses)
    │           └── ideas.astro                 # Student Problem & Project Incubator Board
    ├── verify-portal/                          # verify.tfunions.org (Credential & Certificate Verifier)
    │   ├── package.json
    │   └── src/pages/index.astro
    └── docs-portal/                            # docs.tfunions.org (Official Wiki, FAQ & Charter via Astro Starlight)
        ├── package.json
        └── astro.config.mjs
```

---

## 🌐 Ecosystem Domain Topology

| Subdomain | Service Name | Hosting Provider | Directory in Repo | Access Policy |
| :--- | :--- | :--- | :--- | :--- |
| `tfunions.org` | Foundation Public Portal | Cloudflare Pages | [`05-web-portals/foundation-portal`](./05-web-portals/foundation-portal) | Public |
| `docs.tfunions.org` | Official Wiki, FAQ & Charter | Cloudflare Pages | [`05-web-portals/docs-portal`](./05-web-portals/docs-portal) | Public |
| `auth.tfunions.org` | Unified SSO Identity Hub | Cloudflare Pages + Functions | [`03-sso-auth-hub/web-portal`](./03-sso-auth-hub/web-portal) | Public |
| `verify.tfunions.org` | Credential & Certificate Verifier | Cloudflare Pages | [`05-web-portals/verify-portal`](./05-web-portals/verify-portal) | Public |
| `auto.tfunions.org` | n8n Workflow & API Engine | Existing VPS (Docker) | [`01-vps-infra`](./01-vps-infra) & [`04-n8n-workflows`](./04-n8n-workflows) | Admin: Zero Trust / `/webhook/*`: Public |
| `ops.tfunions.org` | Central Database, CRM & CMS | Existing VPS (Docker) | [`01-vps-infra`](./01-vps-infra) & [`02-database-schemas`](./02-database-schemas) | Admin Only (Cloudflare Zero Trust) |
| `mail.tfunions.org` | Newsletter & Digest Engine | Existing VPS (Docker) | [`01-vps-infra`](./01-vps-infra) | Admin Only (Cloudflare Zero Trust) |
| `analytics.tfunions.org` | Privacy-First Web Analytics | Existing VPS (Docker) | [`01-vps-infra`](./01-vps-infra) | Admin UI: Zero Trust / Tracker: Public |
| `status.tfunions.org` | Ecosystem Uptime Monitor | Existing VPS (Docker) | [`01-vps-infra`](./01-vps-infra) | Public Status Page / Admin Protected |

---

## 🚀 Execution Roadmap Status

- [x] **Repository & Architectural Outline Scaffolded**
- [x] **Step 1 — VPS Infrastructure Provisioning (`01-vps-infra/`)**
- [x] **Step 2 — Baserow & Firestore Schema Initialization (`02-database-schemas/`)**
- [x] **Step 3 — Unified SSO Hub & Flutter Client SDK (`03-sso-auth-hub/`)**
- [x] **Step 4 — Core n8n Automation Workflows & Gotenberg Templates (`04-n8n-workflows/`)**
- [x] **Step 5 — Public Foundation Portal, Verifier, Docs & QA Widget (`05-web-portals/`)**
