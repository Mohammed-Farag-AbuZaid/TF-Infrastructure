#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE n8n_db;
    CREATE DATABASE baserow_db;
    CREATE DATABASE listmonk_db;
    CREATE DATABASE umami_db;
EOSQL
