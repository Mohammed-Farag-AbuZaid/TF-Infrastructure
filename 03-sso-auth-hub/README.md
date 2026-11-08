# Step 3: Unified Single Sign-On (SSO) Architecture (`auth.tfunions.org`)

## Overview
Implements **"One account. All TF Unions services"** across all `*.tfunions.org` subdomains using **Root-Domain Session Cookies (`.tfunions.org`) + Short-Lived Custom Token Exchange**.

## Components Outline
### 1. Central Login Hub & Edge Functions (`web-portal/`)
- **`src/pages/index.astro`**: Central login interface supporting Google OAuth, Email/Password, and GitHub via Firebase Auth, with strict `*.tfunions.org` whitelist validation on `?redirect_to=`.
- **`functions/api/sessionLogin.ts`**: Cloudflare Pages Function (`POST /api/sessionLogin`) that verifies the Firebase ID token, calls Firebase `createSessionCookie` (14-day TTL), and sets:
  - `tf_session` (`HttpOnly; Secure; SameSite=Lax; Domain=.tfunions.org`)
  - `tf_user_hint` (`Secure; SameSite=Lax; Domain=.tfunions.org` — non-sensitive JSON `{ uid, name, role }` for instant UI rendering)
- **`functions/api/mintCustomToken.ts`**: Cloudflare Pages Function (`GET /api/mintCustomToken`) that validates `tf_session` and returns a short-lived Firebase Custom Token for cross-subdomain Flutter Web SPAs.
- **`functions/api/sessionLogout.ts`**: Clears both `.tfunions.org` cookies on sign-out.

### 2. Flutter Web Client Helper (`flutter-sdk/`)
- **`tf_sso_client.dart`**: Drop-in Dart helper for `news.tfunions.org` and `connect.tfunions.org` that detects `tf_user_hint`, calls `/api/mintCustomToken` with `credentials: 'include'`, and silently hydrates `FirebaseAuth.instance.signInWithCustomToken(token)`.
