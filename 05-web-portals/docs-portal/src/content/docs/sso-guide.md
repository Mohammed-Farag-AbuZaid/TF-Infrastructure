---
title: Unified SSO & Account Guide
description: How your single TF Unions Passport works across every subdomain.
---

## One Account. All TF Unions Services.

When you sign in at [`https://auth.tfunions.com`](https://auth.tfunions.com), TF Unions mints a secure root-domain session cookie scoped to `.tfunions.com`:

1. **`tf_session` (`HttpOnly; Secure; SameSite=Lax; Domain=.tfunions.com`)**: Your 14-day encrypted session credential.
2. **`tf_user_hint` (`Secure; SameSite=Lax; Domain=.tfunions.com`)**: Allows static portals (`tfunions.com`, `docs.tfunions.com`) to immediately display your name and role badge (`student`, `volunteer`, `mentor`, `core_team`, `founder`) with zero latency.
3. **Automatic Flutter Web Hydration**: When you open `news.tfunions.com` or `connect.tfunions.com`, the app automatically exchanges your `.tfunions.com` session cookie for a Firebase Custom Token in the backgroundâ€”so you never have to log in twice.

