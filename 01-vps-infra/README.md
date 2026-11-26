# Step 1: VPS Consolidated Docker Architecture (`/opt/tfunions-infra`)

## Overview
Consolidates self-hosted TF Unions backend services onto a single Ubuntu VPS, sharing **one PostgreSQL 16 instance** and **one Redis 7 instance** behind **Caddy** automatic TLS reverse proxying.

## Files in this Directory
- [`docker-compose.yml`](./docker-compose.yml) — Orchestrates `caddy`, `postgres`, `redis`, `n8n`, `baserow`, `listmonk`, `umami`, `gotenberg`, and `uptime-kuma`.
- [`.env.example`](./.env.example) — Master environment variable template (copy to `.env` on the VPS; never commit real secrets).
- [`Caddyfile`](./Caddyfile) — Reverse proxy with security headers (`HSTS`, `nosniff`, `Referrer-Policy`) for `api`, `n8n` (including `/tf-api/*`), `auto`, `ops`, `mail`, `analytics`, and `status.tfunions.com`.
- [`provision-vps.sh`](./provision-vps.sh) & [`harden-host.sh`](./harden-host.sh) — Initial host setup, SSH hardening, and firewall configuration.
- [`init-scripts/01-init-multi-db.sh`](./init-scripts/01-init-multi-db.sh) — Initializes separate PostgreSQL databases (`n8n_db`, `baserow_db`, `listmonk_db`, `umami_db`, `tf_sso_db`).
- [`backups/backup-cron.sh`](./backups/backup-cron.sh) & [`backups/restore-verify.sh`](./backups/restore-verify.sh) — Daily `pg_dumpall`, off-site sync (`rclone`), and automated backup verification.

## DNS Records (Cloudflare)
| Type | Name | Target | Proxy Status |
| :--- | :--- | :--- | :--- |
| `A` | `api` | `<VPS_IP>` | Proxied |
| `A` | `n8n` / `auto` | `<VPS_IP>` | Proxied |
| `A` | `ops` | `<VPS_IP>` | Proxied |
| `A` | `mail` | `<VPS_IP>` | Proxied |
| `A` | `analytics` | `<VPS_IP>` | Proxied |
| `A` | `status` | `<VPS_IP>` | Proxied |

## Cloudflare Zero Trust Access Policies
Protect administrative interfaces (restricting access to authorized TF Unions owners/admins):
- `ops.tfunions.com/*`
- `mail.tfunions.com/*`
- `analytics.tfunions.com/*`
- `n8n.tfunions.com/*` / `auto.tfunions.com/*` (with an explicit **Bypass** rule for `/webhook/*` and `/tf-api/*` where public)
