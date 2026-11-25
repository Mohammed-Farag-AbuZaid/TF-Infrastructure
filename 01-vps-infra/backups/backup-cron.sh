#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
BACKUP_DIR="/opt/tfunions-infra/backups"
PG_USER="${POSTGRES_USER:-tf_master_admin}"
AGE_KEY="${BACKUP_AGE_PUBLIC_KEY:?BACKUP_AGE_PUBLIC_KEY must be set to encrypt backups}"
ARCHIVE_NAME="tfunions_pg_dump_${TIMESTAMP}.sql.gz.age"

mkdir -p "${BACKUP_DIR}"
umask 077

# Dump all PostgreSQL databases (n8n, baserow, listmonk, umami), gzip, and encrypt with age
docker exec tf_postgres pg_dumpall -U "${PG_USER}" \
  | gzip -9 \
  | age -r "${AGE_KEY}" -o "${BACKUP_DIR}/${ARCHIVE_NAME}"

# Upload encrypted archive to Cloudflare R2
rclone copy "${BACKUP_DIR}/${ARCHIVE_NAME}" r2:tfunions-backups/postgres/

# Delete local encrypted archives older than 7 days and remote archives older than 30 days
find "${BACKUP_DIR}" -name "*.sql.gz.age" -mtime +7 -delete
rclone delete --min-age 30d r2:tfunions-backups/postgres/
