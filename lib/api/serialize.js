// Response serializer for the MongoDB -> PostgreSQL/Prisma migration
// (plan section 6, line 279-285).
//
// After Prisma returns rows whose `DateTime @db.Date` columns come back as JS
// `Date` objects (UTC midnight) and whose `DateTime @db.Timestamptz(3)` columns
// come back as JS `Date` objects (instant), the API must emit JSON that matches
// the legacy Mongo wire shape exactly:
//
//   - date-only columns -> `YYYY-MM-DD` string (UTC, no shift)
//   - timestamp columns -> ISO-8601 UTC string with milliseconds
//   - JSON / JsonB columns (`pages.blocks`, `sidebar_widgets.settings`) ->
//     preserved verbatim (deep-equal round-trip)
//   - `password` -> NEVER emitted, for any model (defence-in-depth even when
//     the handler already used a Prisma `select` that excludes it)
//   - `BigInt` -> coerced to number when safe, otherwise to string (the
//     current schema uses `Int` everywhere, but the guard is here so a future
//     BigInt column does not silently emit `{}` from `JSON.stringify`)
//   - `_id` -> NOT emitted. Plan §6 `_id` decision gate default is to declare
//     it an internal leak and drop it from the target contract; the contract
//     suite already lists `_id` in `ignoredKeys`. We do not synthesise one.
//
// The date-only / timestamp field lists are keyed by MODEL NAME (the Prisma
// model name, e.g. `'News'`, `'CaseRecord'`) and mirror Task 5's
// `prisma/schema.prisma`. They are ALSO keyed by collection name (e.g.
// `'news'`, `'cases'`) so handlers that still reason in collection terms can
// pass either. Unknown models fall back to "no date-only fields, leave
// everything as-is, drop password", which is always safe.
//
// Pure functions. No I/O. Inputs are NOT mutated.

import { formatDateOnly } from './dates.js';

// ---------------------------------------------------------------------------
// Per-model field classification
// ---------------------------------------------------------------------------

/**
 * Date-only fields by Prisma model name AND legacy collection name. Values are
 * `DateTime @db.Date` columns in `prisma/schema.prisma`; they must serialise
 * to `YYYY-MM-DD`. Source of truth: prisma/schema.prisma (Task 5).
 */
const DATE_ONLY_FIELDS = {
  // Prisma model name -> date-only field set
  News: ['publishDate'],
  Announcement: ['publishDate'],
  CaseRecord: ['jadwalSidang'],
  Agenda: ['tanggalSidang'],
  Decision: ['tanggalPutusan'],
  Banner: ['startDate', 'endDate'],
  AnalyticsDailyPath: ['date'],

  // Legacy collection name -> same sets (for handlers that still pass the
  // collection name they got from `getCollection(...)`).
  news: ['publishDate'],
  announcements: ['publishDate'],
  cases: ['jadwalSidang'],
  agenda: ['tanggalSidang'],
  putusan: ['tanggalPutusan'],
  banners: ['startDate', 'endDate'],
  analytics: ['date'],
};

/**
 * Models whose response must never include `password`. Only `User` carries a
 * password hash in the schema, but we also keep the legacy `users` collection
 * name for handler convenience.
 */
const MODELS_WITH_PASSWORD = new Set(['User', 'users']);

/**
 * JsonB columns by model / collection. These are returned by Prisma as plain
 * JS values already (the pg adapter parses JsonB), so the serializer just
 * preserves them by reference. We list them so future tightening (e.g. clone
 * to break shared references, or validation) has a single dispatch point.
 */
const JSON_FIELDS = {
  Page: ['blocks'],
  SidebarWidget: ['settings'],
  pages: ['blocks'],
  sidebar_widgets: ['settings'],
};

const ALWAYS_DROPPED = new Set(['_id']);
const PASSWORD_FIELDS = new Set(['password']);

function getDateOnlySet(model) {
  return DATE_ONLY_FIELDS[model] || null;
}

function getJsonSet(model) {
  return JSON_FIELDS[model] || null;
}

// ---------------------------------------------------------------------------
// Value-level coercion
// ---------------------------------------------------------------------------

/**
 * Coerce a single value to its wire shape.
 *
 *   - Date on a date-only field -> `YYYY-MM-DD` (UTC, no shift)
 *   - Date on any other field  -> ISO timestamp string (the legacy shape for
 *     createdAt / updatedAt / Timestamptz columns)
 *   - BigInt -> number when within Number.MAX_SAFE_INTEGER, else string
 *   - everything else -> returned by reference
 *
 * `dateOnlyFields` is the per-model Set (or null) so the per-field dispatch
 * stays O(1). We do NOT mutate the input.
 */
function coerceValue(value, key, dateOnlyFields) {
  if (value === null || value === undefined) return value;

  // BigInt guard BEFORE typeof number, because typeof bigint !== 'number'.
  if (typeof value === 'bigint') {
    return value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER
      ? String(value)
      : Number(value);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    if (dateOnlyFields && dateOnlyFields.has(key)) {
      return formatDateOnly(value);
    }
    return value.toISOString();
  }

  return value;
}

/**
 * Deep-walk a JSON-shaped value (the parsed content of a JsonB column) to
 * replace Date / BigInt nodes the same way as the top-level record. Prisma's
 * pg adapter does not currently emit Date inside JsonB, but Mongo used to
 * allow it, so this preserves byte-for-byte parity for any value the importer
 * carried through. Returns a new structure; input is not mutated.
 *
 * `dateOnlyFields` is intentionally NOT applied inside JSON blobs: nested
 * dates inside `blocks` / `settings` have no schema-declared field name and
 * the legacy wire shape always emitted them as ISO strings, so we treat any
 * nested Date as a timestamp.
 */
function coerceJson(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') {
    return value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER
      ? String(value)
      : Number(value);
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(coerceJson);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // Defence-in-depth: even inside a JSON blob we drop password keys and
      // Mongo internals. The legacy Mongo docs never embedded passwords in
      // blocks/settings, but a paranoid serializer is cheap and matches the
      // plan line 283 "NEVER return password" rule.
      if (PASSWORD_FIELDS.has(k) || ALWAYS_DROPPED.has(k)) continue;
      out[k] = coerceJson(v);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Record / list serializer
// ---------------------------------------------------------------------------

/**
 * Serialize a single Prisma row to the legacy Mongo wire shape.
 *
 * @param {string} model - Prisma model name (e.g. `'News'`) OR legacy Mongo
 *   collection name (e.g. `'news'`). Unknown models are handled gracefully:
 *   the row is returned with timestamps as ISO strings, no date-only
 *   formatting, password dropped.
 * @param {object|null|undefined} record - the Prisma row (plain object)
 * @returns {object|null} the serialized row, or `null` for null/undefined
 *   input (so list helpers do not emit the string `"null"` in arrays).
 */
export function serializeRecord(model, record) {
  if (record === null || record === undefined) return null;
  if (typeof record !== 'object' || Array.isArray(record)) {
    // Nothing sensible to serialize; return as-is so the caller can decide.
    return record;
  }

  const dateOnlyFields = getDateOnlySet(model)
    ? new Set(getDateOnlySet(model))
    : null;
  const jsonFields = getJsonSet(model) ? new Set(getJsonSet(model)) : null;
  const dropPassword = MODELS_WITH_PASSWORD.has(model);

  const out = {};
  for (const [key, raw] of Object.entries(record)) {
    // Always drop Mongo internals and the password hash. `_id` is dropped per
    // the plan's default `_id` decision (declare internal leak). `password`
    // is dropped for every model that has one, and is ALSO dropped if it
    // appears on any other model (paranoid).
    if (ALWAYS_DROPPED.has(key)) continue;
    if (PASSWORD_FIELDS.has(key)) continue;
    if (dropPassword && key === 'password') continue; // belt and braces

    const value = raw;
    if (jsonFields && jsonFields.has(key)) {
      out[key] = coerceJson(value);
      continue;
    }
    out[key] = coerceValue(value, key, dateOnlyFields);
  }
  return out;
}

/**
 * Serialize a list of Prisma rows. Returns a fresh array; `null`/`undefined`
 * entries are preserved as `null` (rare; usually the input is a dense array
 * from `findMany`). The caller wraps this in the endpoint's pagination
 * envelope (`{ items, total, page, totalPages }`) — see `lib/api/query.js`.
 *
 * @param {string} model
 * @param {Array<object>} records
 * @returns {Array<object|null>}
 */
export function serializeList(model, records) {
  if (!Array.isArray(records)) return [];
  return records.map((r) => serializeRecord(model, r));
}
