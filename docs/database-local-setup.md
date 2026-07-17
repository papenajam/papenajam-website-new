# Local PostgreSQL setup

> **Scope.** LOCAL AND TEST ONLY. This document and the `compose.db.yml` /
> `db/` / `scripts/db/` artifacts let developers run a PostgreSQL + Prisma
> database locally without touching any production system.
>
> **There is no production reset command in this repository, by design.**
> The reset helpers below refuse to run against anything that does not look
> like a local/test database name.

This is the canonical local PostgreSQL + Prisma setup guide.

---

## 1. Prerequisites

- Docker (tested with Engine 27+ / Compose v2+). Confirm with `docker --version`
  and `docker compose version`.
- `psql` (optional but recommended) for manual inspection. Confirm with
  `psql --version`.
- A working Node.js 20.19+ toolchain (already required by the app).

No local PostgreSQL install is required — everything runs in the container.

---

## 2. First-time setup

```bash
# 1. Copy the placeholder env file (NEVER commit a real .env).
cp .env.example .env

# 2. Edit .env and replace every CHANGE_ME placeholder with a real local value.
#    In particular set:
#      POSTGRES_PASSWORD, POSTGRES_APP_PASSWORD, JWT_SECRET
#    Generate a JWT secret with, for example:
#      openssl rand -base64 48

# 3. Start PostgreSQL 16 in the background.
docker compose -f compose.db.yml up -d

# 4. Wait for it to be healthy (the healthcheck usually resolves in <5s).
docker compose -f compose.db.yml ps
#    You want STATUS "Up ... (healthy)".

# 5. Connect with psql to confirm.
psql "$(grep '^DATABASE_URL_DEV=' .env | cut -d= -f2-)"
```

On first start, the init script `db/init-databases.sh` runs once and creates:

- database `pa_penajam_dev` (development)
- database `pa_penajam_test` (isolated test target)
- application role `papenajam` (non-superuser), granted on both

The two databases are intentionally separate so tests can be reset without
disturbing development data.

---

## 3. Connection strings (dev + test)

| Purpose        | Variable           | Default                                                              |
|----------------|--------------------|----------------------------------------------------------------------|
| Development DB | `DATABASE_URL_DEV` | `postgresql://papenajam:CHANGE_ME@127.0.0.1:5432/pa_penajam_dev?schema=public` |
| Test DB        | `DATABASE_URL_TEST`| `postgresql://papenajam:CHANGE_ME@127.0.0.1:5432/pa_penajam_test?schema=public` |
| Default (Prisma)| `DATABASE_URL`    | same as `DATABASE_URL_DEV`                                           |

Use `127.0.0.1` (not `localhost`) so the driver resolves IPv4 directly to the
container's published port.

---

## 4. Everyday commands

### Start

```bash
docker compose -f compose.db.yml up -d      # start in background
docker compose -f compose.db.yml ps         # check status / health
docker compose -f compose.db.yml logs -f    # tail logs (Ctrl-C to detach)
```

### Connect

```bash
# Via psql, using the connection string from .env:
psql "$(grep '^DATABASE_URL_DEV=' .env | cut -d= -f2-)"

# Or explicitly:
psql -h 127.0.0.1 -p 5432 -U papenajam -d pa_penajam_dev
psql -h 127.0.0.1 -p 5432 -U papenajam -d pa_penajam_test
```

Inside `psql`, useful checks:

```sql
SELECT version();                  -- confirm "PostgreSQL 16.x ..."
SELECT current_database();         -- confirm which DB you landed on
SELECT current_user;               -- confirm the role
\dn                               -- list schemas
\dt                               -- list tables (after Prisma migrations land)
```

### Stop

```bash
docker compose -f compose.db.yml stop        # stop containers, KEEP data volume
```

### Stop and remove containers (data preserved)

```bash
docker compose -f compose.db.yml down        # remove containers + network, KEEP volume
```

### Wipe ALL local data and start fresh (DESTRUCTIVE — local only)

```bash
docker compose -f compose.db.yml down -v     # ALSO deletes the postgres_data volume
```

`down -v` is the only "start from a blank slate" command in this workflow. It
is safe for local/test because the volume is a named local Docker volume with
no production counterpart.

---

## 5. Resetting the dev or test database (LOCAL/TEST ONLY)

Two small helpers live under `scripts/db/`. They both refuse to operate on a
database name that does not look like a local/test target.

- `scripts/db/reset-test-db.sh` — drops and recreates the **test** database
  (`pa_penajam_test` by default). Use this from CI or before re-running Prisma
  migrations against a clean test target.
- `scripts/db/reset-dev-db.sh`  — drops and recreates the **dev** database
  (`pa_penajam_dev` by default). Use this only when you want a clean local dev
  slate.

Both scripts:

1. Read the target name from `$1` (or default to the documented local name).
2. Reject any name in a denylist (`postgres`, `admin`, `prod`, `production`,
   `pa_penajam`, anything containing `prod`), and require the name to match
   the local/test pattern (`^pa_penajam_(dev|test)(_[A-Za-z0-9]+)?$`).
3. Connect via `psql` to the local container's superuser and run
   `DROP DATABASE` / `CREATE DATABASE`, then re-grant the application role.

Example:

```bash
./scripts/db/reset-test-db.sh                       # default: pa_penajam_test
./scripts/db/reset-test-db.sh pa_penajam_test_ci    # ad-hoc local/test name
```

> **There is intentionally NO `reset-prod-db.sh` and NO generic
> "reset any database" script.** Production resets are out of scope for this
> repository and must be performed via separately-approved operational runbooks
> against the production cluster, never from this codebase.

---

## 6. Application variables

| Variable       | Purpose                                                      |
|----------------|--------------------------------------------------------------|
| `JWT_SECRET`   | JWT signing secret for auth. Generate with `openssl rand -base64 48`. |
| `UPLOAD_PATH`  | Where uploaded media is stored (default `./public/uploads`). |
| `DB_NAME`      | Convenience default database name (matches `DATABASE_URL_DEV`). |

All of these are placeholders in `.env.example` and must be replaced in your
local `.env`. None of them are ever committed with real values.

---

## 7. Troubleshooting

- **`psql: connection refused` after `up -d`** — the container is still
  starting. Re-run `docker compose -f compose.db.yml ps` and wait for
  `(healthy)`. The healthcheck polls every 5s for up to ~60s.
- **Init script did not create the dev/test DBs** — `docker-entrypoint-initdb.d`
  scripts only run when the data volume is empty. If you changed
  `db/init-databases.sh` after the first start, run
  `docker compose -f compose.db.yml down -v` and `up -d` again.
- **Port 5432 already in use** — another local Postgres is bound to it. Either
  stop it, or change the host-side port mapping in `compose.db.yml`
  (`"127.0.0.1:5433:5432"`) and update your `.env` accordingly.
- **Permission denied for `reset-*.sh`** — ensure the scripts are executable
  (`chmod +x scripts/db/*.sh`); they are committed executable in this repo.

---

## 8. What this does NOT do

- Does NOT install PostgreSQL on the host (Docker only).
- Does NOT connect to external databases unless explicitly configured.
- Does NOT expose PostgreSQL on anything other than `127.0.0.1`.
- Does NOT provide any production reset or production credential handling.
- Does NOT commit any real secret — `.env.example` is placeholders only and
  `.env` is gitignored (with an explicit `!.env.example` exception so the
  template stays tracked).
