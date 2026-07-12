# Database cutover runbook — MongoDB → PostgreSQL

> Condensed from plan section 12 (`.omo/plans/mongodb-to-postgresql-prisma-migration.md`)
> plus how to run the Task 16 migration tools.
>
> **Related:** `docs/database-migration.md` (cleansing policy / transform engine),
> `docs/database-local-setup.md` (local Postgres).

## 0. Tools at a glance

| Script | package.json | Purpose |
|---|---|---|
| `scripts/migration/profile-mongodb.mjs` | `yarn db:profile:mongo` | Read-only profiler (counts, anomalies). |
| `scripts/migration/export-mongodb.mjs` | `yarn db:export:mongo` | Read-only NDJSON export + manifest. |
| `scripts/migration/import-postgres.mjs` | `yarn db:import:postgres` | Transform + import into empty Postgres. |
| `scripts/migration/verify-migration.mjs` | `yarn db:verify:migration` | Count/id/hash/aggregate verification. |

Supporting modules:

- `scripts/migration/transform-rules.mjs` — deterministic value transforms.
- `scripts/migration/lib/transforms/*` — prisma map, NDJSON, blockers, document
  transform, import guards, verify helpers.
- `scripts/migration/{collections,profile,canonicalize,anomaly,report,schema-map}.mjs`
  — shared profiler infrastructure (reused, not duplicated).

Environment:

| Variable | Used by |
|---|---|
| `MONGODB_URI` or `MONGO_URL` | profiler, exporter |
| `MONGODB_DB_NAME` or `DB_NAME` | profiler, exporter (optional) |
| `DATABASE_URL` | importer, verifier, Prisma migrate/seed |

Artifacts land under `.migration-artifacts/` (gitignored). NDJSON exports
**contain bcrypt password hashes** — encrypt at rest and restrict access.

---

## 1. All-or-nothing import strategy

**Name:** `batch-tx-stop-on-first-failure`

1. Target application tables must be **empty** (row count 0 for every table in
   `APPLICATION_TABLES`). `_prisma_migrations` is never inspected for emptiness
   and is **never truncated**.
2. If the target is nonempty, the importer **refuses** unless
   `--force-recovery` is passed. With that flag the importer issues
   `TRUNCATE … RESTART IDENTITY CASCADE` on application tables only, then
   proceeds.
3. Documents are transformed via `transformForImport` (renames, date-only,
   timestamps, integers, JSON round-trip, email lowercase, bcrypt passthrough).
4. Rows are inserted in batches of ~500 inside a Prisma interactive transaction
   per batch. Menus are ordered **parents before children**.
5. On **any** failed transform or insert:
   - the current batch is rolled back,
   - a reject file is written under `<export-dir>/rejects/reject-<ts>.json`
     (password hashes redacted),
   - the process exits non-zero.
6. Previously committed batches (if any) leave a partial target. The operator
   **must** re-run against an empty target or with `--force-recovery`. Success
   is never reported for a partial run.

Public `id` values and bcrypt password hashes are preserved exactly.

---

## 2. How to run the tools (local / rehearsal)

### 2.1 Profile (read-only)

```bash
MONGODB_URI='mongodb://…' MONGODB_DB_NAME='pa_penajam' \
  corepack yarn db:profile:mongo -- --sample=500 --out-dir=.migration-artifacts
```

Review `profile-*/profile.md` for blockers (duplicates, missing ids, invalid
dates, menu orphans, invalid bcrypt, unknown fields, …). **Cleanse at source
or record owner sign-off** in `docs/database-migration.md` §6 before cutover.

### 2.2 Export (read-only)

```bash
MONGODB_URI='mongodb://…' MONGODB_DB_NAME='pa_penajam' \
  corepack yarn db:export:mongo -- \
    --profile=.migration-artifacts/profile-<ts>/profile.json \
    --out-dir=.migration-artifacts
```

- Fails with exit 4 if the profile still has unresolved blockers.
- `--allow-unprofiled` skips the gate for **local dry-runs only** — never for
  cutover.
- Writes `export-<ts>/{*.ndjson,manifest.json}`. Manifest includes counts,
  byte sizes, min/max dates, canonical SHA-256, sanitized source URI/db/host,
  timestamp. Password hashes are **not** printed in the manifest.

### 2.3 Prepare empty Postgres target

```bash
# Local: see docs/database-local-setup.md / compose.db.yml
corepack yarn db:migrate:deploy
# Confirm app tables are empty (seed is optional and separate).
```

### 2.4 Import

```bash
DATABASE_URL='postgresql://…' \
  corepack yarn db:import:postgres -- \
    --export-dir=.migration-artifacts/export-<ts> \
    --batch-size=500
```

- Exit 4 if target nonempty (without `--force-recovery`).
- Exit 5 if any record is rejected (reject file written).
- Progress logs counts only — no PII / no password hashes.

Recovery re-run after a failed import:

```bash
DATABASE_URL='postgresql://…' \
  corepack yarn db:import:postgres -- \
    --export-dir=.migration-artifacts/export-<ts> \
    --force-recovery
```

### 2.5 Verify

```bash
DATABASE_URL='postgresql://…' \
  corepack yarn db:verify:migration -- \
    --export-dir=.migration-artifacts/export-<ts> \
    --uploads-root=public
```

Checks:

| Check | Notes |
|---|---|
| Count equality | per collection/table |
| Id set equality | public ids / natural keys |
| Unique keys | no duplicate ids / natural keys |
| Business-field hashes | after type normalization |
| Aggregates | downloads sum, analytics views + per date/path, survey count/avg, case status/type, active/public counts |
| Menu integrity | no orphan parentId, no self-cycle |
| JSON deep equality | `pages.blocks`, `sidebar_widgets.settings` |
| Date bounds / samples | first/last + targeted first/last/null/large |
| File URL sampling | local `/uploads/…` presence under `--uploads-root` (warning only — file bytes are not moved by DB scripts) |

Exit 5 if any hard check fails. Writes `verify-report.json` into the export dir.

---

## 3. T-7 → T-1 (rehearsal)

- Final rehearsal on a recent clone/snapshot.
- Record durations: profile, export, import, verify, build/deploy, buffer.
- Test PostgreSQL restore.
- Confirm migration artifact encryption + retention.
- Freeze schema/content deploys that change fields.
- Prepare maintenance page and stakeholder communication.
- Keep old deployment artifact + MongoDB connection ready for abort **before
  write is opened**.

---

## 4. T-0 execution

1. Announce maintenance start.
2. Switch app to maintenance / read-only; verify no new writes.
3. Record source counts and final timestamp.
4. Take a native MongoDB backup **outside** application scripts.
5. Run final profiler; **abort** if new blockers appear.
6. Export MongoDB; store manifest + checksums securely.
7. Confirm PostgreSQL target is empty and a backup point exists.
8. Run `corepack yarn db:migrate:deploy` on the target.
9. Run importer (`yarn db:import:postgres`).
10. Run verifier (`yarn db:verify:migration`); **abort** if any check fails.
11. Deploy PostgreSQL app candidate to canary / internal URL.
12. Run smoke suite: public / admin / upload / search / analytics.
13. Manual UI checks: home, admin dashboard, page builder, menu/sidebar,
    upload/download.
14. If all pass, switch traffic to candidate but keep maintenance / read-only.
15. Short soak: watch connection / error / query metrics.
16. Open write.
17. Record authoritative switch time; MongoDB becomes read-only archive.

---

## 5. Abort before write is opened

- Switch traffic back to the old app / MongoDB.
- PostgreSQL candidate can be discarded or fixed — no production writes were
  accepted.
- Document the failure and re-run the rehearsal.

---

## 6. After write is opened

- Do **not** return to a stale MongoDB without a validated reverse-migration.
- Application errors → deploy fix / roll-forward on PostgreSQL.
- Catastrophic database issue → restore PostgreSQL backup / WAL per provider
  runbook.
- If the organisation requires rollback after write, that needs dual-write /
  CDC / reverse-sync — out of scope for this cutover design.

---

## 7. T+1h / T+24h / end of rollback window

- Re-run verifier read-only + aggregate checks.
- Review 5xx, pool, slow query, duplicate/constraint errors.
- Validate automated backups.
- After approval: remove MongoDB write access, then decommission per retention.

---

## 8. Security notes

- Never commit `.migration-artifacts/` or real `.env` files.
- Exporter / profiler sanitize connection URIs and redact `password` fields in
  logs and manifests.
- Importer reject files redact password / secret fields.
- Seed passwords come from env or are generated once by `prisma/seed.mjs` —
  never hard-code production credentials.
- Keep `mongodb` dependency until after the rollback window and tooling are
  retired (Task 20).
