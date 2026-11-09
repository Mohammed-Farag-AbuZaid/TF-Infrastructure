# Step 3: Unified Single Sign-On (SSO) Architecture (`auth.tfunions.com`)

## Overview
Implements **"One account. All TF Unions services"** across all `*.tfunions.com` subdomains using **Root-Domain Session Cookies (`.tfunions.com`) + Short-Lived Custom Token Exchange**.

## Components Outline
### 1. Central Login Hub & Edge Functions (`web-portal/`)
- **`src/pages/index.astro`**: Central login interface supporting Google OAuth, Email/Password, and GitHub via Firebase Auth, with strict `*.tfunions.com` whitelist validation on `?redirect_to=`.
- **`functions/api/sessionLogin.ts`**: Cloudflare Pages Function (`POST /api/sessionLogin`) that verifies the Firebase ID token, calls Firebase `createSessionCookie` (14-day TTL), and sets:
  - `tf_session` (`HttpOnly; Secure; SameSite=Lax; Domain=.tfunions.com`)
  - `tf_user_hint` (`Secure; SameSite=Lax; Domain=.tfunions.com` â€” non-sensitive JSON `{ uid, name, role }` for instant UI rendering)
- **`functions/api/mintCustomToken.ts`**: Cloudflare Pages Function (`GET /api/mintCustomToken`) that validates `tf_session` and returns a short-lived Firebase Custom Token for cross-subdomain Flutter Web SPAs.
- **`functions/api/sessionLogout.ts`**: Clears both `.tfunions.com` cookies on sign-out.

### 2. Flutter Web Client Helper (`flutter-sdk/`)
- **`tf_sso_client.dart`**: Drop-in Dart helper for `news.tfunions.com` and `connect.tfunions.com` that detects `tf_user_hint`, calls `/api/mintCustomToken` with `credentials: 'include'`, and silently hydrates `FirebaseAuth.instance.signInWithCustomToken(token)`.

