# Step 3: Unified Single Sign-On (SSO), Backend API & Client SDK (`auth.tfunions.com`)

## Overview
Implements **"One account. All TF Unions services"** across all `*.tfunions.com` subdomains using Firebase Authentication, root-domain `.tfunions.com` session cookies, custom token exchange, and supporting backend API helpers.

## Subdirectories

### 1. Central Login Hub & Edge Functions (`web-portal/`)
- **`src/pages/index.astro`** — Central SSO sign-in portal on `auth.tfunions.com` supporting Google OAuth and Email/Password via Firebase Auth, with strict `*.tfunions.com` whitelist validation on `?redirect_to=`.
- **`functions/api/sessionLogin.ts`** — Cloudflare Pages Function (`POST /api/sessionLogin`) that verifies the Firebase ID token, creates a 14-day Firebase session cookie, and sets:
  - `tf_session` (`HttpOnly; Secure; SameSite=Lax; Domain=.tfunions.com`)
  - `tf_user_hint` (`Secure; SameSite=Lax; Domain=.tfunions.com` — non-sensitive display metadata)
- **`functions/api/mintCustomToken.ts`** — Exchanges a valid `tf_session` cookie for a short-lived Firebase Custom Token for cross-subdomain clients.
- **`functions/api/sessionLogout.ts`** — Clears both `.tfunions.com` cookies on sign-out.
- **`functions/api/_firebaseAdmin.ts`** — Lightweight Web Crypto Firebase Admin helper compatible with Cloudflare Workers/Pages runtime.

### 2. TF Backend API (`tf-api/`)
- Hono + TypeScript + Zod API service (`src/app.ts`, `src/schemas.ts`, `src/server.ts`, `src/middleware/`) with `Dockerfile` and Vitest test suite (`npm test` runs `test/api.test.ts`).

### 3. Self-Hosted VPS Auth Bridge (`vps-auth-service/`)
- Standalone Node auth service (`server.js`) and Firebase migration utility (`migrate_firebase_to_vps.js`).

### 4. Flutter Web Client Helper (`flutter-sdk/`)
- **`tf_sso_client.dart`** — Drop-in Dart helper that detects `tf_user_hint`, calls `/api/mintCustomToken` with `credentials: 'include'`, and silently hydrates `FirebaseAuth.instance.signInWithCustomToken(token)`.
