#!/bin/bash
# =============================================================================
# TF Unions — VPS Automated Provisioning & Health-Check Script
# Target Path on VPS: /opt/tfunions-infra
# =============================================================================
set -euo pipefail

INSTALL_DIR="/opt/tfunions-infra"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 [TF Unions] Provisioning VPS Consolidated Docker Architecture..."

mkdir -p "${INSTALL_DIR}/init-scripts" "${INSTALL_DIR}/backups"

cp -f "${SCRIPT_DIR}/docker-compose.yml" "${INSTALL_DIR}/docker-compose.yml"
cp -f "${SCRIPT_DIR}/Caddyfile" "${INSTALL_DIR}/Caddyfile"
cp -f "${SCRIPT_DIR}/init-scripts/01-init-multi-db.sh" "${INSTALL_DIR}/init-scripts/01-init-multi-db.sh"
cp -f "${SCRIPT_DIR}/backups/backup-cron.sh" "${INSTALL_DIR}/backups/backup-cron.sh"

chmod +x "${INSTALL_DIR}/init-scripts/01-init-multi-db.sh"
chmod +x "${INSTALL_DIR}/backups/backup-cron.sh"

# Generate .env with strong cryptographic secrets if it does not exist yet
if [ ! -f "${INSTALL_DIR}/.env" ]; then
    echo "🔐 Generating ${INSTALL_DIR}/.env with strong random secrets..."
    cp "${SCRIPT_DIR}/.env.example" "${INSTALL_DIR}/.env"
    PG_PASS=$(openssl rand -hex 24)
    REDIS_PASS=$(openssl rand -hex 24)
    N8N_ENC=$(openssl rand -hex 16)
    N8N_JWT=$(openssl rand -hex 32)
    N8N_WH=$(openssl rand -hex 24)
    BR_SEC=$(openssl rand -hex 32)
    BR_JWT=$(openssl rand -hex 32)
    UMAMI_SEC=$(openssl rand -hex 32)

    sed -i "s/CHANGE_ME_STRONG_POSTGRES_PASSWORD/${PG_PASS}/g" "${INSTALL_DIR}/.env"
    sed -i "s/CHANGE_ME_STRONG_REDIS_PASSWORD/${REDIS_PASS}/g" "${INSTALL_DIR}/.env"
    sed -i "s/CHANGE_ME_32_CHAR_HEX_KEY/${N8N_ENC}/g" "${INSTALL_DIR}/.env"
    sed -i "s/CHANGE_ME_JWT_SECRET/${N8N_JWT}/g" "${INSTALL_DIR}/.env"
    sed -i "s/CHANGE_ME_WEBHOOK_SECRET/${N8N_WH}/g" "${INSTALL_DIR}/.env"
    sed -i "s/CHANGE_ME_BASEROW_SECRET/${BR_SEC}/g" "${INSTALL_DIR}/.env"
    sed -i "s/CHANGE_ME_BASEROW_JWT/${BR_JWT}/g" "${INSTALL_DIR}/.env"
    sed -i "s/CHANGE_ME_UMAMI_SECRET/${UMAMI_SEC}/g" "${INSTALL_DIR}/.env"
    chmod 600 "${INSTALL_DIR}/.env"
    echo "⚠️  Remember to update SMTP_PASS in ${INSTALL_DIR}/.env with your Brevo/Resend SMTP key."
fi

# Register nightly 03:00 AM Cairo backup cron job if not already installed
CRON_ENTRY="0 3 * * * /opt/tfunions-infra/backups/backup-cron.sh >> /var/log/tfunions-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "backup-cron.sh" || true; echo "${CRON_ENTRY}") | crontab -

echo "🐳 Starting Docker Compose stack..."
cd "${INSTALL_DIR}"
docker compose up -d

echo "⏳ Waiting 15s for PostgreSQL & Redis health checks..."
sleep 15
docker compose ps
echo "✅ [TF Unions] VPS stack deployed at ${INSTALL_DIR}!"
