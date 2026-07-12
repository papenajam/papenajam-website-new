#!/usr/bin/env bash
# Reset the LOCAL/TEST PostgreSQL dev database.
#
# Drops and recreates the local development database, then re-grants the
# application role. LOCAL AND TEST ONLY. Use this when you want a clean dev
# slate (e.g. before re-running Prisma migrations from scratch locally).
#
# There is intentionally NO production reset counterpart in this repository.
# This script REFUSES any database name that does not look like a local/test
# target.

set -euo pipefail

DB_NAME="${1:-${POSTGRES_DEV_DB:-pa_penajam_dev}}"
APP_USER="${POSTGRES_APP_USER:-papenajam}"
PGSUPERUSER="${PGUSER:-postgres}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"
export PGHOST PGPORT PGPASSWORD

# --- Safety: refuse anything that is not an obvious local/test target. ----
DENYLIST='^(postgres|template0|template1|admin|prod|production|pa_penajam)$'
ALLOWED='^pa_penajam_(dev|test)(_[A-Za-z0-9]+)?$'

if printf '%s' "$DB_NAME" | grep -Eq "$DENYLIST" || \
   printf '%s' "$DB_NAME" | grep -qi 'prod'; then
  echo "ERROR: refusing to reset '$DB_NAME' — name is in the denylist or looks production-like." >&2
  exit 2
fi
if ! printf '%s' "$DB_NAME" | grep -Eq "$ALLOWED"; then
  echo "ERROR: refusing to reset '$DB_NAME' — must match: $ALLOWED" >&2
  echo "       This script is LOCAL/TEST ONLY. There is no production reset." >&2
  exit 2
fi

echo "Resetting LOCAL/TEST database: $DB_NAME (host=$PGHOST port=$PGPORT)"
psql -v ON_ERROR_STOP=1 --username "$PGSUPERUSER" --dbname postgres <<EOSQL
SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
 WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$DB_NAME";
CREATE DATABASE "$DB_NAME";
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$APP_USER";
EOSQL

psql -v ON_ERROR_STOP=1 --username "$PGSUPERUSER" --dbname "$DB_NAME" <<EOSQL
GRANT ALL PRIVILEGES ON SCHEMA public TO "$APP_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO "$APP_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO "$APP_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "$APP_USER";
EOSQL

echo "Done. '$DB_NAME' has been dropped and recreated (LOCAL/TEST)."
