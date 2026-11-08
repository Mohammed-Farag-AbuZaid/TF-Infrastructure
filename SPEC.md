# TF UNIONS — MASTER TECHNICAL ARCHITECTURE & AI EXECUTION BLUEPRINT

## 0. AI SYSTEM PROMPT & CONTEXT DIRECTIVE
> **Instructions for the Receiving AI Agent:**
> You are acting as the **Principal Systems Architect and Lead Full-Stack Engineer** for **TF Unions** (formerly *Altafawwoq Union*), an independent non-profit educational ecosystem helping ambitious and standout students across Egypt achieve science, technology, engineering, mathematics (STEM), research, and innovation goals.
>
> **Organizational Context:**
> - **Founders:** Mohammed Farag (Founder) & Mohammed Abdelghany (Co-Founder).
> - **Team Size:** 2 technical co-founders managing the core infrastructure, supported by seasonal student volunteers.
> - **Budget Constraint:** Strictly **$0/month additional recurring cost**. Every architectural choice MUST use existing resources (1 Linux VPS already owned, Firebase Spark/Blaze Free Tier, Cloudflare Free Tier, Brevo/Resend Free Tier, and 100% open-source self-hosted Docker containers).
> - **Core Philosophy:** *"One account. All TF Unions services."* The foundation layer acts as the umbrella operating system (SSO Identity, Public Trust & Docs, Volunteer HR, Sponsor/Donation Ledger, Certificate Registry, Global QA/Bug Triage, and Student Idea Incubator) that powers all student-facing sub-projects (**TF News**, **TF Connect**, **TF Guide**, and future seasonal tools).
> - **Your Objective:** Use this specification as your single source of truth when generating code, configuring Docker containers, writing n8n workflows, designing Baserow/Firestore schemas, or building frontend web portals for TF Unions.

---

## 1. ECOSYSTEM DOMAIN TOPOLOGY & NETWORK ROUTING

All public traffic routes through **Cloudflare DNS & CDN (Free Tier)** with Full (Strict) SSL/TLS encryption. Static and SSR web portals are hosted on **Cloudflare Pages** or **Firebase Hosting**, while backend automation and back-office operations run on the **existing Linux VPS**.

| Subdomain | Service Name | Hosting Provider | Tech Stack | Access Policy |
| :--- | :--- | :--- | :--- | :--- |
| `tfunions.org` | Foundation Public Portal | Cloudflare Pages | Astro 5 + Tailwind CSS | Public |
| `docs.tfunions.org` | Official Wiki, FAQ & Charter | Cloudflare Pages | Astro Starlight | Public |
| `auth.tfunions.org` | Unified SSO Identity Hub | Cloudflare Pages + Functions | Astro + Firebase Auth SDK | Public |
| `verify.tfunions.org` | Credential & Certificate Verifier | Cloudflare Pages | Astro + n8n Read API | Public |
| `news.tfunions.org` | TF News (Opportunities & Alerts) | Cloudflare Pages / Firebase | Flutter Web or Astro | Public + Auth |
| `connect.tfunions.org` | TF Connect (Peer & Senior Cohorts) | Firebase Hosting | Flutter Web | Auth Required |
| `guide.tfunions.org` | TF Guide (STEM Study Roadmaps) | Cloudflare Pages | Astro Starlight / Flutter | Public + Auth |
| `auto.tfunions.org` | n8n Workflow & API Engine | Existing VPS (Docker) | n8n + PostgreSQL + Redis | Admin: Zero Trust / `/webhook/*`: Public |
| `ops.tfunions.org` | Central Database, CRM & CMS | Existing VPS (Docker) | Baserow | Admin Only (Cloudflare Zero Trust) |
| `mail.tfunions.org` | Newsletter & Digest Engine | Existing VPS (Docker) | Listmonk | Admin Only (Cloudflare Zero Trust) |
| `analytics.tfunions.org` | Privacy-First Web Analytics | Existing VPS (Docker) | Umami | Admin UI: Zero Trust / Tracker: Public |
| `status.tfunions.org` | Ecosystem Uptime Monitor | Existing VPS (Docker) | Uptime Kuma | Public Status Page / Admin Protected |

---

## 2. VPS CONSOLIDATED DOCKER ARCHITECTURE

To prevent out-of-memory (OOM) crashes on a single VPS, all self-hosted services share **one PostgreSQL 16 instance** (split into isolated logical databases) and **one Redis 7 instance** (split by database index `0` through `3`), orchestrated behind a **Caddy** reverse proxy that handles automatic Let's Encrypt SSL certificates.

### 2.1 Directory Structure on VPS (`/opt/tfunions-infra`)
```text
/opt/tfunions-infra/
├── docker-compose.yml
├── .env
├── Caddyfile
├── init-scripts/
│   └── 01-init-multi-db.sh
└── backups/
    └── backup-cron.sh
```

### 2.2 Multi-Database Initialization Script (`init-scripts/01-init-multi-db.sh`)
```bash
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE n8n_db;
    CREATE DATABASE baserow_db;
    CREATE DATABASE listmonk_db;
    CREATE DATABASE umami_db;
EOSQL
```

### 2.3 Master Environment Template (`.env`)
```ini
# Global Domain & Admin
ROOT_DOMAIN=tfunions.org
ADMIN_EMAIL=founders@tfunions.org
TZ=Africa/Cairo

# Shared PostgreSQL 16
POSTGRES_USER=tf_master_admin
POSTGRES_PASSWORD=CHANGE_ME_STRONG_POSTGRES_PASSWORD
POSTGRES_DB=postgres

# Shared Redis 7
REDIS_PASSWORD=CHANGE_ME_STRONG_REDIS_PASSWORD

# n8n Configuration
N8N_ENCRYPTION_KEY=CHANGE_ME_32_CHAR_HEX_KEY
N8N_JWT_SECRET=CHANGE_ME_JWT_SECRET

# Baserow Configuration
BASEROW_SECRET_KEY=CHANGE_ME_BASEROW_SECRET
BASEROW_JWT_SIGNING_KEY=CHANGE_ME_BASEROW_JWT

# Umami Configuration
UMAMI_APP_SECRET=CHANGE_ME_UMAMI_SECRET

# SMTP Relay (Brevo / Resend Free Tier)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=founders@tfunions.org
SMTP_PASS=CHANGE_ME_BREVO_SMTP_KEY
```

### 2.4 Production `docker-compose.yml`
```yaml
version: "3.9"

networks:
  tf_internal:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
  pg_data:
  redis_data:
  n8n_data:
  baserow_media:
  uptime_kuma_data:

services:
  # 1. Reverse Proxy & Auto-SSL
  caddy:
    image: caddy:2-alpine
    container_name: tf_caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - tf_internal

  # 2. Shared PostgreSQL 16 Server
  postgres:
    image: postgres:16-alpine
    container_name: tf_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      TZ: ${TZ}
    command: >
      postgres
      -c shared_buffers=256MB
      -c max_connections=150
      -c work_mem=8MB
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d:ro
    networks:
      - tf_internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 3. Shared Redis 7 Server
  redis:
    image: redis:7-alpine
    container_name: tf_redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - tf_internal
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 4. n8n Automation & Webhook Hub
  n8n:
    image: n8nio/n8n:latest
    container_name: tf_n8n
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n_db
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - N8N_HOST=auto.${ROOT_DOMAIN}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://auto.${ROOT_DOMAIN}/
      - GENERIC_TIMEZONE=${TZ}
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - tf_internal

  # 5. Baserow (Internal CRM, HR, Ledger & CMS)
  baserow:
    image: baserow/baserow:1.28.0
    container_name: tf_baserow
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - BASEROW_PUBLIC_URL=https://ops.${ROOT_DOMAIN}
      - DATABASE_HOST=postgres
      - DATABASE_PORT=5432
      - DATABASE_NAME=baserow_db
      - DATABASE_USER=${POSTGRES_USER}
      - DATABASE_PASSWORD=${POSTGRES_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - SECRET_KEY=${BASEROW_SECRET_KEY}
      - BASEROW_JWT_SIGNING_KEY=${BASEROW_JWT_SIGNING_KEY}
      - BASEROW_CADDY_ADDRESSES=:80
      - BASEROW_AMOUNT_OF_WORKERS=1
      - EMAIL_SMTP=True
      - EMAIL_SMTP_HOST=${SMTP_HOST}
      - EMAIL_SMTP_PORT=${SMTP_PORT}
      - EMAIL_SMTP_USE_TLS=True
      - EMAIL_SMTP_USER=${SMTP_USER}
      - EMAIL_SMTP_PASSWORD=${SMTP_PASS}
      - FROM_EMAIL=no-reply@${ROOT_DOMAIN}
    volumes:
      - baserow_media:/baserow/data
    networks:
      - tf_internal

  # 6. Listmonk (Newsletter & Digest Manager)
  listmonk:
    image: listmonk/listmonk:latest
    container_name: tf_listmonk
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    command: [sh, -c, "./listmonk --install --idempotent --yes && ./listmonk"]
    environment:
      - LISTMONK_app__address=0.0.0.0:9000
      - LISTMONK_db__host=postgres
      - LISTMONK_db__port=5432
      - LISTMONK_db__user=${POSTGRES_USER}
      - LISTMONK_db__password=${POSTGRES_PASSWORD}
      - LISTMONK_db__database=listmonk_db
      - LISTMONK_db__ssl_mode=disable
      - TZ=${TZ}
    networks:
      - tf_internal

  # 7. Umami (Privacy-First Web Analytics)
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    container_name: tf_umami
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/umami_db
      - DATABASE_TYPE=postgresql
      - APP_SECRET=${UMAMI_APP_SECRET}
    networks:
      - tf_internal

  # 8. Gotenberg (Internal Stateless HTML-to-PDF Engine for Certificates)
  gotenberg:
    image: gotenberg/gotenberg:8
    container_name: tf_gotenberg
    restart: unless-stopped
    command:
      - "gotenberg"
      - "--chromium-disable-javascript=true"
      - "--chromium-allow-list=^file:///.*$"
    networks:
      - tf_internal

  # 9. Uptime Kuma (Public Ecosystem Status Page)
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: tf_uptime_kuma
    restart: unless-stopped
    volumes:
      - uptime_kuma_data:/app/data
    networks:
      - tf_internal
```

### 2.5 Reverse Proxy Routing (`Caddyfile`)
```caddyfile
auto.tfunions.org {
    reverse_proxy n8n:5678
}

ops.tfunions.org {
    reverse_proxy baserow:80
}

mail.tfunions.org {
    reverse_proxy listmonk:9000
}

analytics.tfunions.org {
    reverse_proxy umami:3000
}

status.tfunions.org {
    reverse_proxy uptime-kuma:3001
}
```

---

## 3. UNIFIED SINGLE SIGN-ON (SSO) ARCHITECTURE

### 3.1 The Subdomain Session Challenge & Solution
Standard Firebase Client SDK authentication stores tokens in `IndexedDB` or `localStorage`, which is strictly origin-bound (`https://news.tfunions.org` cannot read `https://auth.tfunions.org` storage). To achieve **"One account. All TF Unions services"**, TF Unions implements **Root-Domain Session Cookies + Short-Lived Custom Token Exchange**:

1. **Central Login Hub (`https://auth.tfunions.org`):**
   - Accepts `?redirect_to=https://news.tfunions.org/dashboard` (validated against a strict whitelist of `*.tfunions.org` subdomains).
   - User authenticates via Firebase Auth (Google OAuth, Email/Password, or GitHub).
2. **Session Cookie Minting (`POST https://auth.tfunions.org/api/sessionLogin`):**
   - Hosted as a **Cloudflare Pages Function** (free up to 100,000 requests/day).
   - Verifies the Firebase ID token and calls Firebase REST/Admin API `createSessionCookie` (valid for 14 days).
   - Responds with two cookies scoped to `.tfunions.org`:
     - `tf_session`: `HttpOnly; Secure; SameSite=Lax; Domain=.tfunions.org; Path=/; Max-Age=1209600` (contains the signed Firebase Session Cookie).
     - `tf_user_hint`: `Secure; SameSite=Lax; Domain=.tfunions.org; Path=/; Max-Age=1209600` (non-sensitive JSON containing `{"uid": "...", "name": "...", "role": "student"}` so static pages can immediately render the logged-in header without waiting for an API call).
3. **Sub-Project Hydration (Flutter Web & Astro Apps):**
   - For **Astro SSR / Cloudflare Pages apps**: Middleware reads `tf_session` directly from the request cookie header.
   - For **Flutter Web SPA apps (`news.tfunions.org`, `connect.tfunions.org`)**: On startup, if Firebase Client SDK `currentUser` is null but `tf_user_hint` cookie exists, Flutter calls `GET https://auth.tfunions.org/api/mintCustomToken` with `credentials: 'include'`. The Cloudflare Function validates `tf_session`, generates a Firebase Custom Token, and Flutter calls `FirebaseAuth.instance.signInWithCustomToken(token)` silently in the background.

### 3.2 Firebase Custom Claims Role Schema
Stored inside the user's Firebase Auth token (< 1000 bytes limit) for zero-cost permission checks:
```json
{
  "role": "student", 
  "tier": "volunteer",
  "tracks": ["tf_news_editor", "tf_guide_math"],
  "verified": true
}
```
- **Allowed `role` values:** `student` | `volunteer` | `mentor` | `core_team` | `founder`

---

## 4. COMPLETE DATABASE SCHEMAS (FIRESTORE + BASEROW)

### 4.1 Cloud Firestore Schema (High-Concurrency Student App Layer)

#### Collection: `users/{firebase_uid}`
```json
{
  "uid": "string (PK)",
  "fullName": "string",
  "email": "string",
  "avatarUrl": "string",
  "governorate": "string (e.g., Giza, Cairo, Alexandria, Dakahlia)",
  "educationSystem": "string (STEM, Thanaweya Amma, IG, American, Azhar, University)",
  "gradeOrYear": "string",
  "interests": ["math_olympiad", "physics", "ai_ml", "scholarships", "research"],
  "role": "student | volunteer | mentor | core_team | founder",
  "badges": ["early_member", "imo_cohort_2026", "verified_volunteer"],
  "baserowRowId": 1042,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

#### Firestore Security Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function isFounderOrCore() {
      return isSignedIn() && (request.auth.token.role == 'founder' || request.auth.token.role == 'core_team');
    }
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.auth.uid == userId
                    && request.resource.data.role == 'student';
      allow update: if (isSignedIn() && request.auth.uid == userId 
                    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'badges', 'baserowRowId']))
                    || isFounderOrCore();
    }
  }
}
```

### 4.2 Baserow Relational Database Schema (`ops.tfunions.org`)

Create a single workspace named **`TF_Unions_Core`** with 6 linked tables:

#### Table 1: `Members_Passport`
| Field Name | Baserow Field Type | Configuration / Notes |
| :--- | :--- | :--- |
| `firebase_uid` | Single Line Text (Primary) | Unique Firebase Auth UID |
| `full_name` | Single Line Text | Student's full name |
| `email` | Email | Student's primary email |
| `phone_whatsapp` | Phone Number | Optional Egyptian phone (`+20...`) |
| `governorate` | Single Select | All 27 Egyptian Governorates + International |
| `education_system` | Single Select | `STEM`, `Thanaweya_Amma`, `IGCSE`, `American`, `Azhar`, `University` |
| `grade_level` | Single Select | `Prep_3`, `G10`, `G11`, `G12`, `Undergrad`, `Grad` |
| `stem_interests` | Multiple Select | `Math`, `Physics`, `CS_AI`, `Biology`, `Chemistry`, `Robotics`, `Scholarships`, `Research` |
| `ecosystem_role` | Single Select | `Student`, `Volunteer`, `Mentor`, `Core_Team`, `Founder` |
| `joined_at` | Created On | Auto-timestamp |

#### Table 2: `Volunteer_HR_Pipeline`
| Field Name | Baserow Field Type | Configuration / Notes |
| :--- | :--- | :--- |
| `application_id` | Autonumber (Primary) | Sequential ID |
| `member` | Link to Table | Links to `Members_Passport` |
| `applicant_email` | Lookup | Lookup from `member.email` |
| `season_cohort` | Single Select | e.g., `Summer_2026`, `Winter_2026` |
| `target_track` | Single Select | `TF_News_Researcher`, `TF_Guide_Curator`, `Frontend_Dev`, `Automation_Dev`, `Graphic_Design`, `Community_Mod` |
| `portfolio_or_cv_url` | URL | Link to GitHub, Drive, or Behance |
| `motivation_answer` | Long Text | Why they want to contribute & hours/week available |
| `status` | Single Select | `1_Applied`, `2_Screening`, `3_Interview`, `4_Accepted`, `5_Active`, `6_Completed_Season`, `7_Rejected` |
| `reviewer_notes` | Long Text | Notes by Mohammed Farag or Mohammed Abdelghany |
| `logged_hours` | Number ( Integer ) | Total verified contribution hours |
| `issue_certificate_trigger` | Boolean | Checking this triggers n8n Workflow #3 |

#### Table 3: `Public_Team_Directory`
| Field Name | Baserow Field Type | Configuration / Notes |
| :--- | :--- | :--- |
| `team_member_id` | Autonumber (Primary) | Sequential ID |
| `member` | Link to Table | Links to `Members_Passport` |
| `display_name` | Single Line Text | Public display name |
| `role_title` | Single Line Text | e.g., `Founder & System Architect`, `Co-Founder`, `TF News Lead` |
| `category` | Single Select | `Founders`, `Core_Team`, `Advisors`, `Seasonal_Contributors` |
| `season_badge` | Single Line Text | e.g., `Founding Team`, `Season 1 Cohort` |
| `avatar_url` | URL | Optimized WebP image hosted on Cloudflare R2 / GitHub |
| `linkedin_url` | URL | Optional social link |
| `github_url` | URL | Optional GitHub link |
| `is_public` | Boolean | Only rows with `is_public = true` render on `tfunions.org/team` |
| `sort_order` | Number | Controls display order (1 = top) |

#### Table 4: `Certificates_Registry`
| Field Name | Baserow Field Type | Configuration / Notes |
| :--- | :--- | :--- |
| `serial_code` | Formula / Text (Primary) | Format: `TFU-2026-XXXX` (Unique alphanumeric hash) |
| `member` | Link to Table | Links to `Members_Passport` |
| `recipient_name` | Single Line Text | Snapshot of full official name on certificate |
| `credential_type` | Single Select | `Volunteer_Service`, `Mentorship_Excellence`, `Program_Completion`, `Core_Team_Recognition` |
| `role_or_program_title` | Single Line Text | e.g., `STEM Opportunities Researcher — TF News` |
| `hours_credited` | Number | Verified hours completed |
| `issue_date` | Date (ISO) | Date issued |
| `pdf_download_url` | URL | Direct link to PDF stored in Cloudflare R2 |
| `is_revoked` | Boolean | Default `false`; if `true`, verifier shows "Revoked" |

#### Table 5: `Financial_Ledger_And_Sponsors`
| Field Name | Baserow Field Type | Configuration / Notes |
| :--- | :--- | :--- |
| `tx_id` | Autonumber (Primary) | Transaction ID |
| `tx_type` | Single Select | `Incoming_Donation`, `Corporate_Sponsorship`, `Founder_Contribution`, `Outgoing_Expense` |
| `payment_channel` | Single Select | `InstaPay`, `Vodafone_Cash`, `Kashier_Paymob`, `Open_Collective`, `Direct_Invoice` |
| `amount_egp` | Number (2 decimals) | Equivalent value in EGP |
| `amount_usd` | Number (2 decimals) | Equivalent value in USD |
| `donor_or_vendor_name` | Single Line Text | Public name or `"Anonymous Supporter"` or `"Hetzner VPS"` |
| `is_anonymous` | Boolean | Masks donor name on public ledger if `true` |
| `category` | Single Select | `VPS_Hosting`, `Domain_Registration`, `Project_Fund`, `General_Support` |
| `proof_screenshot_url` | File / URL | InstaPay receipt or vendor invoice PDF (Private to Founders) |
| `verification_status` | Single Select | `Pending_Review`, `Verified_Published`, `Rejected` |
| `tx_date` | Date | Date of transaction |

#### Table 6: `QA_Tickets_And_Idea_Incubator`
| Field Name | Baserow Field Type | Configuration / Notes |
| :--- | :--- | :--- |
| `item_id` | Autonumber (Primary) | Ticket / Idea ID |
| `submission_type` | Single Select | `Bug_Report`, `Broken_Link_Or_Typo`, `Project_Idea`, `Feature_Request` |
| `source_service` | Single Select | `Foundation_Portal`, `TF_News`, `TF_Connect`, `TF_Guide`, `Auth_SSO` |
| `title` | Single Line Text | Short summary |
| `description` | Long Text | Detailed problem statement or reproduction steps |
| `page_url` | URL | Exact URL where the issue occurred |
| `submitted_by` | Link to Table | Optional link to `Members_Passport` |
| `voter_uids_json` | Long Text | JSON array of `firebase_uid`s to prevent duplicate upvotes |
| `upvote_count` | Number | Count of student upvotes (default `1`) |
| `status` | Single Select | `New_Triage`, `Under_Review`, `Planned_On_Roadmap`, `In_Progress`, `Shipped_Fixed`, `Closed` |
| `is_public_on_board` | Boolean | `true` for approved `Project_Idea` items shown on `/ideas` |

---

## 5. CORE n8n AUTOMATION PIPELINES (`auto.tfunions.org`)

Below are the 6 foundational n8n workflows that eliminate manual administrative overhead for the co-founders.

### Workflow 1: `SSO_User_Onboarding_Sync`
- **Trigger:** `POST https://auto.tfunions.org/webhook/user-onboard` (Authenticated via header `X-TF-Webhook-Secret`).
- **Input Payload:**
  ```json
  {
    "uid": "firebase_uid_123",
    "fullName": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "governorate": "Cairo",
    "educationSystem": "STEM",
    "gradeOrYear": "G11",
    "interests": ["math_olympiad", "scholarships"]
  }
  ```
- **Node Sequence:**
  1. **Webhook Node:** Validates secret header.
  2. **Baserow Node (Search):** Checks if `firebase_uid` already exists in `Members_Passport`.
  3. **IF Node (New User):**
     - **Baserow Node (Create Row):** Inserts student into `Members_Passport`.
     - **HTTP Request Node (Firestore Patch):** Writes `baserowRowId` back to `users/{uid}`.
     - **HTTP Request Node (Listmonk API):** `POST http://listmonk:9000/api/subscribers` adds student to the "TF Unions Ecosystem Digest" mailing list with attributes `{"governorate": "Cairo", "interests": [...]}`.
     - **SMTP Email Node:** Sends a personalized welcome email explaining how their single account unlocks TF News, TF Guide, and TF Connect.

### Workflow 2: `Volunteer_Recruitment_And_Auto_Promotion`
- **Trigger:** Baserow Webhook when `Volunteer_HR_Pipeline.status` changes.
- **Node Sequence:**
  1. **Switch Node on `status`:**
     - **Case `1_Applied`:** Sends a Telegram notification to the Founders group (`New Volunteer Application: {{full_name}} for {{target_track}}`) and emails confirmation to the student.
     - **Case `4_Accepted`:**
       1. **HTTP Request (Firebase Admin Auth):** Updates the user's Custom Claims to `{"role": "volunteer", "tracks": ["{{target_track}}"]}`.
       2. **Baserow Node (Update `Members_Passport`):** Sets `ecosystem_role = Volunteer`.
       3. **Baserow Node (Create Row in `Public_Team_Directory`):** Creates their contributor entry with `is_public = true` and `category = Seasonal_Contributors`.
       4. **HTTP Request (Cloudflare Pages Deploy Hook):** Triggers a static rebuild of `tfunions.org/team` so their name appears automatically.
       5. **SMTP Email Node:** Sends the Volunteer Onboarding Kit & Discord/Telegram invite link.

### Workflow 3: `Automated_Certificate_Generator_Gotenberg`
- **Trigger:** Baserow Webhook when `Volunteer_HR_Pipeline.issue_certificate_trigger` is set to `true`.
- **Node Sequence:**
  1. **Crypto Node:** Generates a deterministic short serial code `TFU-{{YEAR}}-{{6_CHAR_HEX}}`.
  2. **Code Node (HTML Template Injection):** Compiles a print-ready A4 landscape HTML/CSS template containing:
     - Recipient Name, Role Title, Verified Hours, Issue Date, Serial Code, Founders' Digital Signatures (Mohammed Farag & Mohammed Abdelghany), and an embedded SVG QR code pointing to `https://verify.tfunions.org/?code=TFU-...`.
  3. **HTTP Request Node (Internal Gotenberg Call):**
     - `POST http://gotenberg:3000/forms/chromium/convert/html`
     - Multipart form-data containing `index.html`, `paperWidth=11.69`, `paperHeight=8.27`, `landscape=true`, `printBackground=true`.
  4. **S3 / Cloudflare R2 Node:** Uploads the returned binary PDF to R2 bucket `tf-certificates/TFU-2026-XXXXXX.pdf` (Free up to 10 GB storage, $0 egress).
  5. **Baserow Node (Create Row in `Certificates_Registry`):** Saves the `serial_code`, `pdf_download_url`, and metadata.
  6. **SMTP Email Node:** Emails the student their PDF certificate and their permanent verification link.

### Workflow 4: `Certificate_Verification_Public_API`
- **Trigger:** `GET https://auto.tfunions.org/webhook/verify-certificate?code=TFU-2026-XXXXXX`
- **CORS Headers:** `Access-Control-Allow-Origin: https://verify.tfunions.org`
- **Node Sequence:**
  1. **Sanitize Input:** Validates regex `^TFU-\d{4}-[A-Z0-9]{6}$`.
  2. **Baserow Node (Get Row):** Queries `Certificates_Registry` where `serial_code` matches.
  3. **Respond to Webhook Node:**
     - If found and `is_revoked == false`, returns HTTP 200:
       ```json
       {
         "valid": true,
         "serialCode": "TFU-2026-8F92A1",
         "recipientName": "Sara Mahmoud",
         "credentialType": "Volunteer Service",
         "roleTitle": "STEM Opportunities Researcher — TF News",
         "hoursCredited": 45,
         "issueDate": "2026-09-15",
         "pdfUrl": "https://certs.tfunions.org/TFU-2026-8F92A1.pdf"
       }
       ```
     - Otherwise returns HTTP 404 `{"valid": false, "message": "Certificate not found or revoked."}`.

### Workflow 5: `Donation_Verification_And_Ledger_Sync`
- **Trigger:** `POST https://auto.tfunions.org/webhook/submit-donation` (from `tfunions.org/support` form when a donor uploads an InstaPay screenshot or submits a sponsor inquiry).
- **Node Sequence:**
  1. **Baserow Node:** Inserts row into `Financial_Ledger_And_Sponsors` with `verification_status = Pending_Review`.
  2. **Telegram Bot Node:** Sends the InstaPay screenshot and details to the Founders' private Telegram chat with inline callback buttons: `[✅ Approve & Publish]` and `[❌ Reject]`.
  3. **Telegram Callback Trigger:** When Mohammed Farag or Mohammed Abdelghany taps `[✅ Approve & Publish]`, n8n updates `verification_status = Verified_Published`, sends a thank-you email receipt to the donor, and triggers a rebuild/cache update of the public Open-Book Ledger on `tfunions.org/transparency`.

### Workflow 6: `Global_QA_Triage_And_Idea_Voting`
- **Trigger 1 (`POST /webhook/qa-submit`):** Receives bug reports, broken scholarship links, or new project ideas from the global widget embedded across all TF Unions sites.
  - Inserts into `QA_Tickets_And_Idea_Incubator`.
  - If `submission_type == Bug_Report`, posts an alert to the `#qa-alerts` Telegram topic with the exact `page_url`, browser user-agent, and reporter email.
- **Trigger 2 (`POST /webhook/idea-upvote`):**
  - Verifies the student's Firebase ID Token via Google's public JWKS certificate.
  - Checks if `uid` is already in `voter_uids_json`. If not, appends `uid`, increments `upvote_count` by 1, and returns the updated score.

---

## 6. FRONTEND FOUNDATION PORTAL (`tfunions.org`)

Build the main foundation portal using **Astro 5** (Static Site Generation with selective client islands) and **Tailwind CSS**, deployed on **Cloudflare Pages**.

### 6.1 Required Routes & Pages
1. **`/` (Ecosystem Landing Page):**
   - Hero section with mission statement: *"Helping ambitious students in Egypt move closer to their science & innovation goals."*
   - Live Ecosystem Grid showing active products (**TF News**), upcoming seasonal launches (**TF Connect**, **TF Guide**), and live impact counters pulled at build/edge time from Baserow.
   - Unified SSO Call-to-Action (*"One account. All TF Unions services."*).
2. **`/about` & `/charter`:**
   - Complete breakdown of the non-profit initiative, how projects are selected, and organizational governance.
3. **`/team` (Dynamic Team & Contributors Wall):**
   - Fetches accepted members from `Public_Team_Directory` (Founders, Core Team, Advisors, Seasonal Volunteers) filtered by cohort.
4. **`/volunteer` (Role Board & Application Portal):**
   - Displays open seasonal tracks and submits applications directly to n8n Workflow #2.
5. **`/support` & `/transparency` (Donations, Sponsors & Open-Book Ledger):**
   - **Individual Support Tab:** InstaPay QR code & payment address, Vodafone Cash details, and international Open Collective / Buy Me a Coffee embed, plus a 30-second "Submit Transfer Receipt" form.
   - **Corporate & Institutional Sponsors Tab:** Downloadable PDF Impact Deck, server/program sponsorship tiers, and direct booking link.
   - **Open-Book Financial Ledger:** Displays verified monthly server/domain costs (`Outgoing_Expense`) alongside verified community contributions (`Incoming_Donation`) so every supporter sees 100% financial transparency.
6. **`/ideas` (Student Problem & Project Incubator):**
   - Public board where students propose new student challenges for TF Unions to solve and upvote existing proposals.

### 6.2 Embeddable Global QA & Bug Reporter Widget (`tf-qa-widget.js`)
Host a single lightweight `<4 KB` vanilla JS web component on `https://tfunions.org/widgets/tf-qa-widget.js` and include it in the footer of **TF Unions, TF News, TF Connect, and TF Guide**:
```html
<script src="https://tfunions.org/widgets/tf-qa-widget.js" defer></script>
<tf-qa-widget service="TF_News"></tf-qa-widget>
```
- Renders a discreet floating button in the bottom-left corner: `"🛠️ Report Bug / Suggest Fix"`.
- Automatically captures `window.location.href`, `navigator.userAgent`, `service` attribute, and the logged-in user's `tf_user_hint` UID, posting directly to `https://auto.tfunions.org/webhook/qa-submit`.

---

## 7. SECURITY, ZERO-TRUST ACCESS & AUTOMATED BACKUPS

1. **Cloudflare Zero Trust Access (Free up to 50 Users):**
   - Create an Access Application in the Cloudflare Dashboard protecting:
     - `ops.tfunions.org` (Baserow UI)
     - `mail.tfunions.org` (Listmonk UI)
     - `auto.tfunions.org` (Bypass `/webhook/*` for public APIs, require Zero Trust Policy on `/` and `/workflow/*`)
   - Configure an Access Policy allowing only the exact email addresses of **Mohammed Farag** and **Mohammed Abdelghany** via One-Time Pin (OTP) or Google Workspace OAuth. Even if an attacker discovers the admin URLs, Cloudflare blocks the request at the edge before it ever touches the VPS.
2. **Automated Nightly Off-Site Backup Script (`/opt/tfunions-infra/backups/backup-cron.sh`):**
   - Runs daily at `03:00 AM` Cairo time via Linux `crontab` or an n8n Schedule Trigger:
   ```bash
   #!/bin/bash
   TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
   BACKUP_DIR="/opt/tfunions-infra/backups"
   ARCHIVE_NAME="tfunions_pg_dump_${TIMESTAMP}.sql.gz"

   # Dump all PostgreSQL databases (n8n, baserow, listmonk, umami)
   docker exec tf_postgres pg_dumpall -U tf_master_admin | gzip > "${BACKUP_DIR}/${ARCHIVE_NAME}"

   # Upload to Cloudflare R2 (Free 10GB Bucket) using rclone
   rclone copy "${BACKUP_DIR}/${ARCHIVE_NAME}" r2:tfunions-backups/postgres/

   # Delete local backups older than 7 days and remote backups older than 30 days
   find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete
   rclone delete --min-age 30d r2:tfunions-backups/postgres/
   ```

---

## 8. STEP-BY-STEP EXECUTION ROADMAP FOR THE AI AGENT

When prompted by the user to begin implementation, execute the build in the following strict order:

- **Step 1 — VPS Infrastructure Provisioning:** Generate the final deployment scripts for `/opt/tfunions-infra` (`docker-compose.yml`, `Caddyfile`, `01-init-multi-db.sh`, and `.env`), configure Cloudflare DNS A-records for `auto`, `ops`, `mail`, `analytics`, and `status`, and verify all containers pass health checks.
- **Step 2 — Baserow Workspace Initialization:** Provide a Python/Bash bootstrap script or Baserow JSON import template that automatically creates the 6 foundation tables (`Members_Passport`, `Volunteer_HR_Pipeline`, `Public_Team_Directory`, `Certificates_Registry`, `Financial_Ledger_And_Sponsors`, `QA_Tickets_And_Idea_Incubator`) with exact column types.
- **Step 3 — Unified SSO Hub (`auth.tfunions.org`):** Scaffold the Astro + Cloudflare Pages Functions repository for root-domain `.tfunions.org` session cookies, plus the reusable Dart/Flutter auth helper class for `TF News` and `TF Connect`.
- **Step 4 — n8n Workflows Import:** Generate the importable n8n JSON workflow files for the 6 core automation pipelines, including the HTML/CSS certificate template for Gotenberg.
- **Step 5 — Public Foundation Portal & Docs (`tfunions.org`, `docs.tfunions.org`, `verify.tfunions.org`):** Scaffold the Astro 5 frontend mono-repo containing the Landing Page, Dynamic Team Wall, Volunteer Application Portal, Sponsor & Open-Book Ledger Page, Certificate Verifier, and the global `<tf-qa-widget>` web component.