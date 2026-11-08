---
title: Unified SSO & Account Guide
description: How your single TF Unions Passport works across every subdomain.
---

## One Account. All TF Unions Services.

When you sign in at [`https://auth.tfunions.org`](https://auth.tfunions.org), TF Unions mints a secure root-domain session cookie scoped to `.tfunions.org`:

1. **`tf_session` (`HttpOnly; Secure; SameSite=Lax; Domain=.tfunions.org`)**: Your 14-day encrypted session credential.
2. **`tf_user_hint` (`Secure; SameSite=Lax; Domain=.tfunions.org`)**: Allows static portals (`tfunions.org`, `docs.tfunions.org`) to immediately display your name and role badge (`student`, `volunteer`, `mentor`, `core_team`, `founder`) with zero latency.
3. **Automatic Flutter Web Hydration**: When you open `news.tfunions.org` or `connect.tfunions.org`, the app automatically exchanges your `.tfunions.org` session cookie for a Firebase Custom Token in the background—so you never have to log in twice.
