#!/bin/bash
# Init script for the local/test PostgreSQL 16 container.
#
# Runs ONCE, on first container start (when the data volume is empty), via
# docker-entrypoint-initdb.d. It creates the separate development and test
# databases plus a non-root application role granted on both.
#
# Scope: LOCAL AND TEST ONLY. Never run this against any other environment.
# There is intentionally NO production reset here.
#
# This script is executed by the postgres entrypoint with the superuser
# (`POSTGRES_USER`, default `postgres`) and `$PGDATA`/`PGUSER`/`PGPASSWORD`
# already set so psql connects as the cluster owner.

set -euo pipefail

: "${POSTGRES_APP_USER:=papenajam}"
: "${POSTGRES_APP_PASSWORD:=papenajam}"
: "${POSTGRES_DEV_DB:=pa_penajam_dev}"
: "${POSTGRES_TEST_DB:=pa_penajam_test}"

echo "[$(date -u +%FT%TZ)] creating application role '${POSTGRES_APP_USER}' (if missing)"
psql -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_APP_USER}') THEN
      CREATE ROLE "${POSTGRES_APP_USER}" LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}';
    END IF;
  END
  \$\$;
EOSQL

for db in "${POSTGRES_DEV_DB}" "${POSTGRES_TEST_DB}"; do
  echo "[$(date -u +%FT%TZ)] creating database '${db}' (if missing)"
  # Idempotent CREATE DATABASE via shell guard: createdb errors out if it
  # already exists, which is fine when re-running after a partial init.
  if ! psql -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1; then
    createdb --username "$PGUSER" "$db"
  fi

  echo "[$(date -u +%FT%TZ)] granting on '${db}' to '${POSTGRES_APP_USER}'"
  psql -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$db" <<-EOSQL
    GRANT ALL PRIVILEGES ON SCHEMA public TO "${POSTGRES_APP_USER}";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO "${POSTGRES_APP_USER}";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO "${POSTGRES_APP_USER}";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "${POSTGRES_APP_USER}";
EOSQL
done

echo "[$(date -u +%FT%TZ)] init-databases.sh complete (dev=${POSTGRES_DEV_DB} test=${POSTGRES_TEST_DB})"
