#!/bin/bash
set -euo pipefail

# Monthly encrypted backup restore verification drill.
# Requires BACKUP_AGE_IDENTITY_FILE pointing to the age private key and rclone configured for r2:.

IDENTITY_FILE="${BACKUP_AGE_IDENTITY_FILE:?BACKUP_AGE_IDENTITY_FILE must be set}"
WORK_DIR="$(mktemp -d)"
TEST_CONTAINER="tf_restore_verify_$$"
PG_IMAGE="postgres:16.4-alpine"

cleanup() {
  docker rm -f "${TEST_CONTAINER}" >/dev/null 2>&1 || true
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

LATEST_REMOTE=$(rclone lsf r2:tfunions-backups/postgres/ --files-only | grep '\.sql\.gz\.age$' | sort | tail -n 1)
if [[ -z "${LATEST_REMOTE}" ]]; then
  echo "ERROR: No encrypted backup archive found in r2:tfunions-backups/postgres/" >&2
  exit 1
fi

echo "Downloading ${LATEST_REMOTE}..."
rclone copy "r2:tfunions-backups/postgres/${LATEST_REMOTE}" "${WORK_DIR}/"

echo "Decrypting backup..."
age -d -i "${IDENTITY_FILE}" "${WORK_DIR}/${LATEST_REMOTE}" | gunzip > "${WORK_DIR}/restore.sql"

echo "Starting temporary ${PG_IMAGE} instance..."
docker run -d --name "${TEST_CONTAINER}" \
  -e POSTGRES_USER=tf_master_admin \
  -e POSTGRES_PASSWORD=restore_verify_only \
  "${PG_IMAGE}" >/dev/null

for _ in $(seq 1 30); do
  if docker exec "${TEST_CONTAINER}" pg_isready -U tf_master_admin >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Restoring archive into temporary container..."
docker exec -i "${TEST_CONTAINER}" psql -U tf_master_admin -d postgres < "${WORK_DIR}/restore.sql" >/dev/null

echo "Verifying restored databases:"
docker exec "${TEST_CONTAINER}" psql -U tf_master_admin -d postgres -c "\l"

echo "Restore verification PASSED for ${LATEST_REMOTE}."
