# Step 1: VPS Consolidated Docker Architecture (`/opt/tfunions-infra`)

## Overview
Consolidates all self-hosted TF Unions services onto a single Linux VPS with **$0 additional recurring cost**, sharing **one PostgreSQL 16 instance** and **one Redis 7 instance** behind **Caddy** automatic SSL.

## Files in this Directory
- [`docker-compose.yml`](./docker-compose.yml) — Orchestrates `caddy`, `postgres`, `redis`, `n8n`, `baserow`, `listmonk`, `umami`, `gotenberg`, and `uptime-kuma`.
- [`.env.example`](./.env.example) — Master environment variable template (copy to `.env` on the VPS).
- [`Caddyfile`](./Caddyfile) — Reverse proxy configuration for `auto`, `ops`, `mail`, `analytics`, and `status.tfunions.org`.
- [`init-scripts/01-init-multi-db.sh`](./init-scripts/01-init-multi-db.sh) — Initializes `n8n_db`, `baserow_db`, `listmonk_db`, and `umami_db`.
- [`backups/backup-cron.sh`](./backups/backup-cron.sh) — Daily `03:00 AM` Cairo time `pg_dumpall` + Cloudflare R2 off-site backup script.

## DNS Records Required (Cloudflare)
| Type | Name | Target | Proxy Status |
| :--- | :--- | :--- | :--- |
| `A` | `auto` | `<VPS_IP>` | Proxied (Orange Cloud) |
| `A` | `ops` | `<VPS_IP>` | Proxied (Orange Cloud) |
| `A` | `mail` | `<VPS_IP>` | Proxied (Orange Cloud) |
| `A` | `analytics` | `<VPS_IP>` | Proxied (Orange Cloud) |
| `A` | `status` | `<VPS_IP>` | Proxied (Orange Cloud) |

## Cloudflare Zero Trust Access Policies
Protect the following administrative routes (allowing only Founders' emails via OTP / Google OAuth):
- `ops.tfunions.org/*`
- `mail.tfunions.org/*`
- `auto.tfunions.org/*` (with an explicit **Bypass** policy for `auto.tfunions.org/webhook/*`)
