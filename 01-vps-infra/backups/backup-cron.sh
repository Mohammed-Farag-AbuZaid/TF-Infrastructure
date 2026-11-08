#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
BACKUP_DIR="/opt/tfunions-infra/backups"
ARCHIVE_NAME="tfunions_pg_dump_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Dump all PostgreSQL databases (n8n, baserow, listmonk, umami)
docker exec tf_postgres pg_dumpall -U tf_master_admin | gzip > "${BACKUP_DIR}/${ARCHIVE_NAME}"

# Upload to Cloudflare R2 (Free 10GB Bucket) using rclone
rclone copy "${BACKUP_DIR}/${ARCHIVE_NAME}" r2:tfunions-backups/postgres/

# Delete local backups older than 7 days and remote backups older than 30 days
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete
rclone delete --min-age 30d r2:tfunions-backups/postgres/
