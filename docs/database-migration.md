# Database migration — PostgreSQL/Prisma decision record

> **Scope.** This document is the decision record for the MongoDB → PostgreSQL +
> Prisma migration. It is the canonical reference for the cleansing policy and
> the transform engine (`scripts/migration/transform-rules.mjs`) and is the
> artifact the schema/data owner signs off on at the Task 3 gate.
>
> **Status: DRAFT — owner sign-off PENDING.** Live profiler output is not yet
> available in this environment (no live MongoDB). Sections marked **PENDING**
> depend on the real profile report (Task 2 output) and explicit owner sign-off
> before they can be promoted to resolved rules. The deterministic transforms
> in section 3 are environment-independent and ARE safe to commit now.

## 1. References

- Plan: `.omo/plans/mongodb-to-postgresql-prisma-migration.md` (section 5 schema
  map, section 6 API/serialization compatibility, Task 3 brief).
- Read-only profiler (Task 2): `scripts/migration/lib/{schema-map,anomaly,
  canonicalize,report}.mjs` + `scripts/migration/profile-mongodb.mjs`.
- Transform engine (Task 3, this document's executable counterpart):
  `scripts/migration/transform-rules.mjs`.
- Tests: `tests/unit/migration/transform-rules.test.js` (78 tests) and
  `tests/unit/migration/schema-map.test.js` (6 tests).

The transform engine imports the schema map and the canonicalize helpers from
Task 2 so collection and field names are identical across profiler, this
document, and the importer. There is one source of truth.

## 2. Resolution strategies

Every anomaly resolved by this policy falls into exactly one of four buckets.
The same vocabulary is used by `evaluatePendingRule(..., { resolved: true,
strategy })` in the transform engine, so a sign-off decision can be promoted
to a live rule by naming the strategy.

| Strategy | Meaning | When to use |
|---|---|---|
| `map-to-typed-column` | Add a typed Prisma column for the value (e.g. `legacyMongoId String?`, or move a `BigInt` field to `BigInt` column). | The value is real application data and must remain queryable. |
| `legacy-json-field` | Preserve the value inside an explicit Prisma `Json` column reserved for legacy data (e.g. `legacyFields Json?`). | The value is non-canonical but must not be lost; we will not silently drop it. |
| `fix-at-source` | Edit the MongoDB document before taking the migration snapshot. | The value is wrong and the corrected value can be authored in MongoDB without breaking the live app. |
| `reject-quarantine` | Quarantine the record (move to a side table / `migration_quarantine`) and exclude it from cutover until a human reviews. | The value cannot be coerced, fixed at source, or carried as legacy data without risk. |

The policy invariant is **never silently drop a field**. If a value is not
mapped to a typed column, a legacy JSON field, or fixed at source, the record
is quarantined. `TransformPendingError` and `TransformRejectedError` in
`transform-rules.mjs` enforce this at runtime.

## 3. Deterministic transforms (committed now)

These transforms are data-independent — they are knowable from the plan's
`parseDateOnly` / `formatDateOnly` / `serializeRecord` semantics (plan
section 6) and from the proposed schema map (Task 2). They run on every
imported document regardless of profiler output.

### 3.1 Date-only fields — `parseDateOnly` / `formatDateOnly`

Applies to: `news.publishDate`, `announcements.publishDate`,
`cases.jadwalSidang`, `agenda.tanggalSidang`, `putusan.tanggalPutusan`,
`banners.startDate`, `banners.endDate`, `analytics.date`.

Rules:
- `undefined` / `null` / empty-or-whitespace string → `null` (optional
  field, no value inserted).
- `YYYY-MM-DD` → `new Date(Date.UTC(y, m-1, d))`. We construct from components
  explicitly so the result is UTC midnight regardless of host timezone.
  **Calendar validity is asserted (C1):** after constructing the Date we
  compare `getUTCFullYear` / `getUTCMonth` / `getUTCDate` against the input
  components and REJECT on mismatch. `Date.UTC` silently rolls out-of-range
  dates (`2024-02-30` → `2024-03-01`, `2024-13-01` → `2025-01-01`,
  `0000-00-00` → `1899-11-30`); the regex `^\d{4}-\d{2}-\d{2}$` only checks
  the digit pattern, so without this assertion the importer would write a
  silently shifted date. Field + collection context is threaded into the
  helper so the rejection error names both.
- Any other value → **REJECTED** (`TransformRejectedError`). We refuse to
  guess "January 1st 2024" → "2024-01-01"; the profiler reports invalid
  date-only strings, and the owner decides whether to fix-at-source or
  quarantine.
- Round-trip guarantee: `formatDateOnly(parseDateOnly(s)) === s` for any
  accepted `s`. `formatDateOnly` uses UTC components only, so it never
  shifts a date by a day in non-UTC host environments (asserted in
  `transform-rules.test.js` under `TZ=Asia/Jakarta`).

### 3.2 Timestamp fields — `normalizeTimestamp`

Applies to: every collection's `createdAt` / `updatedAt` (auto-added by
`makeEntry` in `schema-map.mjs`).

Rules:
- `undefined` / `null` / empty-or-whitespace string → `null`.
- Valid ISO-8601 UTC string (with or without `.sss`) → canonical
  `YYYY-MM-DDTHH:mm:ss.sssZ`. **Calendar/time validity is asserted (C1):**
  the ISO regex only checks the digit pattern, so out-of-range components
  like `2024-01-01T25:00:00Z` (hour 25) or `2024-02-30T00:00:00Z` (Feb 30)
  would otherwise either return Invalid Date from `new Date(...)` (and leak
  as a `RangeError` from `toISOString`) or silently roll to the next valid
  date. We re-extract the components and assert `getUTCFullYear` /
  `getUTCMonth` / `getUTCDate` / `getUTCHours` / `getUTCMinutes` /
  `getUTCSeconds` all match the input, raising `TransformRejectedError` on
  mismatch. Field + collection context is threaded through.
- JS `Date` (valid) → `toISOString()`.
- Integer epoch ms within `Number.isSafeInteger` → ISO string.
- Anything else → **REJECTED**. Date-only strings (`YYYY-MM-DD`) are
  intentionally NOT accepted into timestamp fields: that is an anomaly the
  profiler reports, and we refuse to coerce `2024-01-01` into
  `2024-01-01T00:00:00.000Z` silently. The owner must decide.

### 3.3 Integer fields — `coerceInteger`

Applies to: `services.order`, `sidebar_widgets.order`, `gallery.order`,
`documents.downloadCount`, `faq.order`, `banners.order`, `menus.order`,
`analytics.views`, `media.size`.

Rules (Prisma `Int` = 32-bit signed):
- `undefined` / `null` → `null`.
- JS integer within `[INT32_MIN, INT32_MAX]` → that integer.
- Non-integer numbers, integers outside Int32, bigint, numeric strings, and
  other types → **REJECTED**.

Why bigint is rejected rather than coerced: the plan defers the BigInt-column
decision (e.g. for `media.size > 2GB`) to owner sign-off. The runtime path
for an overflow is REJECT here, and the **PENDING** rule `integer-overflow`
(see section 5) lets the owner pick the strategy once the profiler confirms
which fields actually overflow.

Why numeric strings are rejected: `"010"` is ambiguous (octal vs decimal) and
the schema map declares these fields as counters/sizes; the profiler reports
wrong-type values, so we surface them rather than guess.

### 3.4 JSON-blob fields — `roundTripJson`

Applies to: `pages.blocks` ONLY.

Per plan line 33, `settings.value` stays **text** (every current consumer
treats it as a string, including `footer_links` which is a JSON *string*,
not a JSON *object*). `settings.value` is therefore NOT in `jsonBlobFields`
in `schema-map.mjs`; it is carried through verbatim as `identity` (plain
text). Only `pages.blocks` is mapped to a PostgreSQL `Json`/JSONB column,
so only `pages.blocks` runs through `roundTripJson`.

Rules (the plan states we preserve `blocks` WITHOUT normalizing):
- `undefined` → `null`.
- `null` → `null` (preserved as SQL `NULL`).
- Any plain JSON value → returned by reference, unchanged, AFTER we
  structurally validate it is round-trippable.
- A structural walk rejects any value that contains `undefined`, a function,
  a symbol, a bigint, a non-finite number, or a circular reference. We do
  NOT rely on `JSON.stringify` to detect these — it silently drops functions,
  symbols, and nested `undefined`, which would let the importer lose data
  the app depends on.

### 3.5 Bcrypt / password fields

Applies to: `users.password`. The hash is carried through verbatim (we do
NOT re-hash or validate at import time — that is the profiler's job). The
importer never redacts at this layer; redaction happens at the report
boundary (`sanitizeRecord` in Task 2).

### 3.6 Other ordinary string/boolean fields

Passed through unchanged (`identity` applied tag). The transform engine
assumes Prisma will validate the column types.

### 3.7 Field-level deterministic guards enforced inside `transformFieldValue`

These are deterministic checks that run as part of field routing, even
though the broader anomaly they relate to is still PENDING at the rule
level. They exist so a single bad value cannot silently flow into a column
that obviously cannot accept it.

- **`id-uuid-vs-text` per-value guard (I1).** When `field === 'id'` and the
  collection's `idKind === 'uuid'`, `transformFieldValue` runs `classifyUuid`
  on the value. A non-v4-UUID id raises `TransformPendingError`
  (`anomaly=id-uuid-vs-text`) immediately rather than falling through to
  `identity`. The PENDING part of the rule (decide `UUID @id` vs `String @id`
  from the FULL collection) still lives in `PENDING_RULES` and is invoked
  separately by the importer once the full profile is available. A valid v4
  UUID passes as `identity`.
- **`rating` range guard (I2).** For `survey_responses.rating`, a valid
  integer in `[1, 5]` returns as `identity-rating` (it already satisfies the
  CHECK constraint the plan will add once source validation completes). Any
  out-of-range value (`0`, `6`, `7`, ...) or non-integer (`3.5`, `'3'`,
  `true`, `NaN`, `Infinity`) raises `TransformPendingError`
  (`anomaly=rating-out-of-range`). This unblocks every well-formed
  `survey_responses` row instead of PENDING on every value.
- **Secret-field redaction in error messages (M1).** When an error is raised
  whose `field` is a secret field (`password`, `passwordHash`, `passphrase`,
  `secret`, `token`, `apiKey`, `apikey`, `authorization`), the raw sample
  value is NOT rendered into `err.message` and the structured
  `err.sampleValue` is replaced with `<redacted>`. Non-secret fields still
  surface the sample value (truncated) so operators can debug.

### 3.8 Document-level guards in `transformDocument`

- **`missing-id` document check (I1).** For collections with
  `idKind: 'uuid'` or `'static'`, a document whose `id` is absent, `null`,
  or `''` raises `TransformPendingError` (`anomaly=missing-id`) because a
  non-null `@id` column cannot accept it. This check is at the document
  level (not the field level) because `transformFieldValue` only runs on
  PRESENT fields, so it cannot detect "the field is absent".
  `idKind: 'none'` collections (`analytics`, `settings`) are exempt.
- **`onPending` default is `'throw'` (I3).** `transformDocument(collection,
  doc, { onPending })` defaults `onPending` to `'throw'`, NOT `'collect'`.
  Rationale: a caller that forgets the option must NOT silently produce a
  document with missing fields. `'collect'` is opt-in: when a caller passes
  `onPending: 'collect'`, the importer MUST abort the whole batch when
  `result.errors.length > 0`, because the returned `output` is intentionally
  missing the fields that raised. `onRejected` still defaults to `'collect'`
  (a hard rejection is a per-field quarantine decision the caller may want
  to inspect alongside other errors).

## 4. Decision policy framework — anomaly → default strategy

For every anomaly category in Task 2's taxonomy, this section records the
default strategy the owner will apply once the profiler report is in. None
of these are committed as live rules yet — they live in `PENDING_RULES` and
raise `TransformPendingError` until the owner signs off via
`evaluatePendingRule(id, ctx, { resolved: true, strategy })`.

| Anomaly (Task 2 taxonomy) | Default strategy | Resolution gate |
|---|---|---|
| `mongo-_id-compat` | `map-to-typed-column` (drop) | Plan `_id` gate. Recommended: drop. If external consumer needs `_id`, add `legacyMongoId String?` + compatibility serializer for a deprecation window. **PENDING** owner sign-off. |
| `id-uuid-vs-text` | `map-to-typed-column` | Decide `UUID @id` vs `String @id` from the FULL collection, not a sample. **PENDING** profiler output on all collections with `idKind: uuid`. |
| `duplicate-id` | `reject-quarantine` | Owner chooses newest-wins / oldest-wins / quarantine. **PENDING**. |
| `duplicate-natural-key` | `reject-quarantine` | Per collection (`users.email`, `pages.slug`, `settings.key`, `analytics(date,path)`). Owner decides per natural key. **PENDING**. |
| `missing-id` | `reject-quarantine` | Owner chooses synthesize-v4 / fix-at-source / quarantine. **PENDING**. |
| `rating-out-of-range` | `fix-at-source` | Plan: add `CHECK rating BETWEEN 1 AND 5` only AFTER source validation. **PENDING** owner confirmation that source produces 1..5. |
| `integer-overflow` | `map-to-typed-column` (BigInt) | Plan: `media.size <= 2147483647` with explicit BigInt fallback. Owner decides per collection. **PENDING**. |
| `unknown-field` | `legacy-json-field` | Per field: typed column / legacy JSON / fix-at-source / quarantine. **PENDING** profiler output. |
| `menu-graph-anomaly` (orphan / self-cycle / depth>2) | `fix-at-source` | Owner fixes parent pointers in MongoDB before snapshot. **PENDING**. |
| `invalid-bcrypt-hash` | `fix-at-source` | Re-hash, force-reset, or quarantine the user. **PENDING**. |
| `email-casing-anomaly` | `fix-at-source` | Lowercase at import is idempotent (app already lowercases); owner confirms. **PENDING**. |
| `mixed-type-field` | `legacy-json-field` | Owner chooses typed column + reject minority type, or legacy JSON. **PENDING** profiler output. |

The four-bucket vocabulary is the same as `evaluatePendingRule`'s
`strategy` enum, so promoting a rule is a one-line change once the owner
signs off.

## 5. Pending-items registry (mirrors `PENDING_RULES`)

The transform engine exports `PENDING_RULES` and `listPendingRules()`. The
runtime contract is: if the importer hits an anomaly for which no rule is
resolved, `evaluatePendingRule(ruleId, ctx)` raises
`TransformPendingError` with the `anomaly`, `collection`, `field`, the
required `decision`, and (when relevant) the offending `sampleValue`. The
importer MUST surface the error and MUST NOT retry with a guessed default.

| `ruleId` | Anomaly | Applies to | Decision needed (summary) |
|---|---|---|---|
| `mongo-_id-compat` | `mongo-_id-compat` | all collections | Drop `_id` (recommended) vs add `legacyMongoId` column. |
| `id-uuid-vs-text` | `id-uuid-vs-text` | all `idKind: uuid` collections | `UUID @id` vs `String @id`, decided from the full collection not a sample. |
| `duplicate-id` | `duplicate-id` | all collections | Newest-wins / oldest-wins / quarantine. |
| `duplicate-natural-key` | `duplicate-natural-key` | `users(email)`, `pages(slug)`, `settings(key)`, `analytics(date,path)` | Per-key dedupe rule. |
| `missing-id` | `missing-id` | uuid + static collections | Synthesize v4 / fix-at-source / quarantine. |
| `rating-out-of-range` | `rating-out-of-range` | `survey_responses(rating)` | Confirm source produces 1..5 before adding CHECK. |
| `integer-overflow` | `integer-overflow` | counters + `media.size` | BigInt column vs cap-at-source vs reject, per collection. |
| `unknown-field` | `unknown-field` | all collections | Per field: typed column / legacy JSON / fix-at-source / quarantine. |
| `menu-graph-anomaly` | `menu-graph-anomaly` | `menus(parentId)` | Fix parent pointers at source. |
| `invalid-bcrypt-hash` | `invalid-bcrypt-hash` | `users(password)` | Re-hash / force-reset / quarantine. |
| `email-casing-anomaly` | `email-casing-anomaly` | `users(email)` | Lowercase at import (idempotent) or fix-at-source. |
| `mixed-type-field` | `mixed-type-field` | all collections | Typed column + reject minority type, or legacy JSON. |

To promote any of these to a live rule: the schema/data owner records the
decision in this document (section 6) and the importer calls
`evaluatePendingRule(id, ctx, { resolved: true, strategy })`. Any other
attempt to "resolve" a rule raises `TransformPendingError`.

## 6. Sign-off log

Empty. No anomaly has been resolved yet — there is no live profiler output
and no owner sign-off in this environment.

When sign-offs happen they will be recorded here in the form:

```
- ruleId: <id>
  resolvedAt: <ISO date>
  owner: <name>
  strategy: <map-to-typed-column | legacy-json-field | fix-at-source | reject-quarantine>
  evidence: <profiler report path + sample size + collection coverage>
  notes: <free text, e.g. value-by-value mapping for empty dates / missing
          timestamps / null / malformed data>
```

The Task 3 plan gate is **zero unresolved blocking anomaly**. Until section
6 contains an entry for every rule in section 5 that affects the live
snapshot, the gate is not met and the importer (Task 16) cannot run against
production data. The deterministic transforms in section 3 are exempt: they
do not depend on the profiler output.

## 7. What this branch delivers vs what it deliberately defers

Delivered now (Tested):
- Deterministic value-level transforms: `parseDateOnly`, `formatDateOnly`,
  `normalizeTimestamp`, `coerceInteger`, `roundTripJson`.
- Calendar/time validity assertions (C1) in `parseDateOnly` and the ISO
  branch of `normalizeTimestamp` so `2024-02-30`, `2024-13-01`,
  `0000-00-00`, `2024-01-01T25:00:00Z`, `2024-02-30T00:00:00Z`, etc. are
  rejected instead of silently rolled.
- Per-value deterministic guards inside `transformFieldValue`: `id-uuid-vs-text`
  guard on UUID-kind collections (I1), `rating` range guard (I2), and
  secret-field redaction in error messages (M1).
- Document-level `missing-id` check for uuid/static collections (I1) and
  `onPending` default of `'throw'` (I3).
- Document-level dispatcher: `transformFieldValue`, `transformDocument`.
- `PENDING_RULES` registry + `evaluatePendingRule` + `listPendingRules`.
- Structured errors: `TransformPendingError`, `TransformRejectedError`.
- `settings.value` reconciled with plan line 33 as TEXT (removed from
  `jsonBlobFields`); only `pages.blocks` runs through `roundTripJson` (M2).
- 78 unit tests in `transform-rules.test.js` + 6 in `schema-map.test.js`
  covering every deterministic transform, the field routing, the PENDING
  behaviour for `_id` / unknown fields / non-UUID ids / out-of-range ratings
  / missing ids / unknown collections, secret-field redaction, the C1
  calendar-validity rejections, and the timezone-independence of date-only
  round-trips.

Deferred (PENDING owner sign-off + live profiler output):
- `_id` compatibility decision.
- UUID vs text id column type, per collection.
- Duplicate id / duplicate natural key handling.
- Out-of-range rating CHECK constraint activation.
- BigInt-column decision for overflowing counters and `media.size`.
- Any value-by-value mapping for malformed data — the importer will surface
  every offending record via `TransformPendingError` / `TransformRejectedError`
  so the owner can record the mapping in section 6.

## 8. Plan gate status

| Gate | Status |
|---|---|
| Decide duplicate/invalid/unknown-field per anomaly category | Framework in place (sections 2, 4, 5). Per-instance decisions **PENDING** profiler output. |
| Never silently drop a field | Enforced by `TransformPendingError` on unknown fields, `_id`, non-v4-UUID ids on UUID-kind collections (I1), and missing-id at the document level (I1). The importer cannot carry any of these without an explicit decision. |
| UUID vs text id decision | **PENDING**. Rule `id-uuid-vs-text` registered; raises until owner signs off. |
| `_id` compatibility decision | **PENDING**. Rule `mongo-_id-compat` registered; raises until owner signs off. |
| Value-by-value mapping for empty dates / missing timestamps / null / malformed | Deterministic transforms cover the data-independent cases (empty → null, ISO normalization, Int32 coercion). Data-dependent cases raise and are logged for owner resolution. |
| Schema/data owner sign-off | **PENDING**. Section 6 is empty by design. |
| Zero unresolved blocking anomaly | **NOT MET** — environment has no live MongoDB; profiler output and owner sign-off are required inputs that do not exist here. |

## 9. Task 5 — Prisma schema decisions and deviations

Task 5 introduced `prisma/schema.prisma`, `prisma.config.mjs`, `lib/prisma.js`,
the initial migration SQL, and the matching `package.json` / `.gitignore`
wiring. The schema is the target state per plan section 5; the items below
are the decisions that had to be made NOW (because they are load-bearing for
the schema or the build) and the deviations from the plan's literal text.
Every PENDING item below is also enforced loudly by the transform engine
(Task 3) so the importer cannot silently carry bad data past it.

### 9.1 Deviations from the plan's literal text (load-bearing)

| Plan line | Plan says | Implemented as | Reason |
|---|---|---|---|
| 350 | `output = "../app/generated/prisma"` | `output = "../lib/generated/prisma"` | Next.js 16 Turbopack scans `app/` for routes/types. Generated `.ts` files inside `app/` make Next auto-promote the JS project to TypeScript (rewriting `tsconfig.json`, dropping the `@/` path aliases from `jsconfig.json`), which breaks `next build` with `Module not found: '@/components/...'`. Moving the generated client OUTSIDE `app/` (to `lib/generated/prisma`) preserves the plan's intent (custom output location, not the default `node_modules/.prisma/client`) while keeping the JavaScript application building. Verified: baseline build at `d48bdf7` passes; build with the deviation passes; build with the plan's literal path fails. The `importFileExtension = "js"` setting means handlers import `./generated/prisma/client.js` and Next/SWC resolves the `.ts` source at build time. |
| 361 | `prisma.config.mjs` uses `env('DATABASE_URL')` for the datasource URL | `url: process.env.DATABASE_URL ?? ''` | The v7 `env()` helper THROWS `PrismaConfigEnvError` when the variable is unset. That breaks `prisma generate` (and the `postinstall` hook) in CI environments that legitimately do not have a database URL — confirmed against Prisma issue #28590 and the v7 config reference, which states only `migrate *` / `db *` commands need the URL. `lib/prisma.js` still enforces the runtime URL is present before constructing the adapter (loud failure at request time), so a missing URL at runtime still fails loudly. The config's job is just to not crash on load. |
| 380-396 | `package.json` includes `"prisma": { "seed": "tsx prisma/seed.mjs" }` | seed declared in `prisma.config.mjs` under `migrations.seed` | Prisma v7 reads the seed command from `prisma.config.mjs` (`migrations.seed`), not from a `package.json` `prisma.seed` field. The plan's `package.json` snippet was the v6 pattern. |

### 9.2 Target-state constraints defined NOW (importer must cleanse first)

Per Task 5 brief instruction (a), the schema declares the TARGET state with
uniqueness constraints as plan section 5 specifies, and the importer
(Task 16) must resolve duplicates BEFORE applying the migration. The
transform-rules PENDING registry from Task 3 already fails loud on these
anomalies, so the importer cannot silently carry duplicate data past them.

- `User.email @unique` (plan line 170). Unique index `users_email_key`.
- `Page.slug @unique` (plan line 204). Unique index `pages_slug_key`.
- `AnalyticsDailyPath @@unique([date, path])` (plan line 238). Unique index
  `analytics_date_path_key`. Surrogate UUID `id` is the primary key, so the
  compound key is a separate uniqueness constraint (not the PK), matching the
  plan's recommendation.

If the live profiler reveals duplicates the owner cannot cleanse in time,
the fallback is to drop the constraint in a follow-up migration; the schema
is the target, not the migration-day reality.

### 9.3 PENDING schema decisions (deferred per plan, do NOT block Task 5)

These are recorded as PENDING in section 7 and enforced by the transform
engine. The schema picks the plan's default for each so Task 5 is not
blocked, and each default is revisited once the profiler output exists.

- **UUID vs text id** (plan line 158): all public ids are
  `String @id @default(uuid()) @db.Uuid`. If the profiler finds non-UUID
  legacy ids on any collection, that collection's id column is widened to
  `String @id @db.Text` WITHOUT changing external ids. This is a per-collection
  decision; the schema's uniform UUID default is the starting point.
- **CHECK constraints** (plan lines 164, 247): NONE added initially. No
  `CHECK (rating BETWEEN 1 AND 5)` on `survey_responses`, no role/status
  enums. Legacy MongoDB values are unconstrained; adding constraints now
  could reject real data. These are added in a later migration AFTER the
  profiler proves the value set is clean.
- **`media.size` integer range** (plan line 251): modeled as `Int`
  (PostgreSQL `INTEGER`, max 2147483647). If the profiler finds sizes
  exceeding INT32_MAX, the column is widened to `BigInt` in a later
  migration and the serializer is updated to emit safe numbers.
- **`_id` compatibility** (plan section 6 decision gate): NO `legacyMongoId`
  column added. The recommended default is to treat `_id` as an internal
  leak and drop it from the target contract. If an external consumer is
  found to depend on `_id`, a `legacyMongoId String?` column is added to
  the affected models and a compatibility serializer is introduced; this is
  a per-model decision driven by the consumer audit, not a Task 5 decision.
- **Menu deletion semantics** (plan line 209): `MenuItem.parent` self-relation
  uses `onDelete: Restrict` (NOT `Cascade`). This preserves the current
  one-level deletion behavior — a parent with children must be explicitly
  cleared by the handler. Recursive cascade deletion would require explicit
  owner approval.

### 9.4 Conventions applied (binding, from plan section 5.1)

- Timestamps: `DateTime @db.Timestamptz(3)`. NO `@updatedAt` anywhere;
  handlers set `updatedAt` explicitly so legacy write semantics survive
  (plan line 159). `updatedAt` is nullable on every model that has it.
- Calendar dates: `DateTime? @db.Date` (nullable); `agenda.tanggalSidang`
  and `analytics.date` are the only non-nullable date fields (plan lines
  191, 239). Boundary parse/serialize keeps the wire shape `YYYY-MM-DD`.
- Long text/HTML: `String @db.Text`. JSON blobs: `Json @db.JsonB`
  (`Page.blocks`, `SidebarWidget.settings`). `Setting.value` stays `@db.Text`
  per plan line 33 (`footer_links` is a JSON string consumers `JSON.parse`).
- Model/field names are camelCase; tables/columns map to the legacy
  snake_case collection names via `@@map` so the importer's collection
  identity is preserved (`CaseRecord @@map("cases")`,
  `Decision @@map("putusan")`, `MenuItem @@map("menus")`, etc.).
- `CaseRecord` (not `Case`) and `Decision` (not `Putusan`) are the Prisma
  model names per plan lines 185 and 194 — avoids the JS `Case` keyword
  collision and keeps the model name readable.
- Minimum indexes per plan section 5 are declared on every model. No
  `pg_trgm` / GIN trigram indexes yet (plan line 38, 950: added later via
  custom migration after EXPLAIN measurement).

