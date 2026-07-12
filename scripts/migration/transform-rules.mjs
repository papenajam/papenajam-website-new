// Deterministic transform engine for the MongoDB -> PostgreSQL/Prisma migration.
//
// This module encodes the DATA-INDEPENDENT cleansing transforms that the importer
// (Task 16) will apply to every document read from the MongoDB snapshot, before
// the document is handed to Prisma. Every transform implemented here MUST be
// fully knowable from the plan's compatibility requirements (plan section 6,
// `parseDateOnly` / `formatDateOnly` / `serializeRecord` semantics) and from the
// proposed schema map (Task 2). They do NOT depend on profiler output or owner
// sign-off, so they are safe to commit now.
//
// Data-dependent decisions (UUID vs text id, duplicate handling, malformed data
// quarantine, _id compatibility) stay PENDING: they are recorded in the
// `PENDING_RULES` registry and any attempt to evaluate one raises a loud,
// structured `TransformPendingError` that names the anomaly category, the
// collection, and the decision that is still required. The importer MUST NOT
// silently drop fields or guess a resolution; it MUST surface the error so the
// schema/data owner can resolve it before re-running.
//
// Design rules:
//   - Pure functions. No I/O, no Mongo/Prisma imports, no mutation of inputs.
//   - Deterministic: same input always yields same output (or same error).
//   - Never silently drop a field. Unknown fields raise (PENDING), not vanish.
//   - Round-trip safe for date-only (YYYY-MM-DD): no timezone shift, see
//     `parseDateOnly` / `formatDateOnly`.
//   - Reuses the canonicalize helpers + schema map from Task 2 so collection /
//     field names stay consistent across profiler and importer.

import {
  INT32_MAX,
  INT32_MIN,
  classifyUuid,
  isDateOnlyString,
  isIntegerOverflow,
  isIsoTimestampString,
  isSecretField,
} from './lib/canonicalize.mjs';
import { getSchemaEntry } from './lib/schema-map.mjs';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Raised when a transform encounters an anomaly whose resolution is PENDING
 * owner sign-off or pending real profiler output. The error message names the
 * anomaly category, the collection, the offending field (when known), and the
 * decision that must be made before this rule can be resolved.
 *
 * The importer MUST surface this error verbatim and MUST NOT retry with a
 * guessed default. The contract is "fail loud, never silently drop".
 */
export class TransformPendingError extends Error {
  constructor({
    anomaly,
    collection,
    field = null,
    decision,
    sampleValue = null,
  } = {}) {
    const parts = [
      `PENDING transform rule`,
      `anomaly=${anomaly || '<unknown>'}`,
      `collection=${collection || '<unknown>'}`,
    ];
    if (field) parts.push(`field=${field}`);
    parts.push(`decision=${decision || '<unspecified>'}`);
    // M1: Never render the sample value into the message when the field is a
    // secret field — the message may be logged, surfaced in reports, or shown
    // to operators who must not see the raw credential/hash. The structured
    // `sampleValue` property is still preserved on the error object for the
    // importer's internal handling, but it is also redacted for secret fields
    // so a downstream serializer cannot leak it.
    const revealSample = sampleValue !== null && sampleValue !== undefined && !isSecretField(field);
    if (revealSample) {
      parts.push(`sample=${truncateForError(sampleValue)}`);
    } else if (sampleValue !== null && sampleValue !== undefined && isSecretField(field)) {
      parts.push('sample=<redacted>');
    }
    super(parts.join(' | '));
    this.name = 'TransformPendingError';
    this.anomaly = anomaly;
    this.collection = collection;
    this.field = field;
    this.decision = decision;
    this.sampleValue = isSecretField(field) ? '<redacted>' : sampleValue;
  }
}

/**
 * Raised when a transform encounters a value it cannot deterministically
 * coerce given the declared target type. This is a hard rejection — the
 * importer must quarantine the document; it is NOT a pending decision.
 */
export class TransformRejectedError extends Error {
  constructor({ reason, collection, field = null, sampleValue = null } = {}) {
    const parts = [
      `REJECTED transform`,
      `reason=${reason || '<unspecified>'}`,
      `collection=${collection || '<unknown>'}`,
    ];
    if (field) parts.push(`field=${field}`);
    // M1: Same secret-field guard as TransformPendingError — never render a
    // raw secret/hash value into the message stream.
    const revealSample = sampleValue !== null && sampleValue !== undefined && !isSecretField(field);
    if (revealSample) {
      parts.push(`sample=${truncateForError(sampleValue)}`);
    } else if (sampleValue !== null && sampleValue !== undefined && isSecretField(field)) {
      parts.push('sample=<redacted>');
    }
    super(parts.join(' | '));
    this.name = 'TransformRejectedError';
    this.reason = reason;
    this.collection = collection;
    this.field = field;
    this.sampleValue = isSecretField(field) ? '<redacted>' : sampleValue;
  }
}

function truncateForError(value, max = 64) {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }
  try {
    const s = JSON.stringify(value);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Deterministic value-level transforms
// ---------------------------------------------------------------------------

/**
 * Parse a YYYY-MM-DD date-only value into a UTC Date at midnight, WITHOUT
 * introducing a timezone shift.
 *
 * Rules (per plan section 6 `parseDateOnly`):
 *   - `undefined` / `null` / empty-or-whitespace string -> null (optional field)
 *   - `YYYY-MM-DD` -> `new Date(Date.UTC(y, m-1, d))` (stable across TZ)
 *   - anything else -> REJECTED. We refuse to guess; the importer reports it
 *     and the profiler / owner decides whether to fix-at-source or quarantine.
 *
 * Returns a plain JS `Date` (UTC midnight) or `null`. Never returns a local
 * date — the contract guarantees `formatDateOnly(parseDateOnly(s)) === s` for
 * any accepted `s`.
 */
export function parseDateOnly(value, field = null, collection = null) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (!isDateOnlyString(trimmed)) {
      throw new TransformRejectedError({
        reason: 'date-only field is neither empty nor YYYY-MM-DD',
        collection,
        field,
        sampleValue: value,
      });
    }
    return dateOnlyFromYyyyMmDd(trimmed, field, collection);
  }
  throw new TransformRejectedError({
    reason: `date-only field has unsupported type ${typeof value}`,
    collection,
    field,
    sampleValue: value,
  });
}

function dateOnlyFromYyyyMmDd(s, field = null, collection = null) {
  // We parse the components manually instead of `new Date(s)` because the
  // ECMAScript spec treats date-only strings (YYYY-MM-DD) as UTC, but some
  // engines historically disagreed. Manual construction is unambiguous.
  const [y, m, d] = s.split('-').map(Number);
  // C1: Reject calendar-invalid dates. `Date.UTC` (and `new Date(s)` for the
  // ISO branch in normalizeTimestamp) silently ROLL out-of-range components
  // forward/backward instead of failing — e.g. 2024-02-30 -> 2024-03-01,
  // 2024-13-01 -> 2025-01-01, 0000-00-00 -> 1899-11-30. The regex
  // `isDateOnlyString` only checks the digit pattern, so we MUST additionally
  // assert the constructed Date's UTC components match the input components.
  // On mismatch we raise TransformRejectedError so the importer quarantines
  // the record instead of writing a silently shifted date.
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new TransformRejectedError({
      reason: 'date-only field is not a valid calendar date (component rollover)',
      collection,
      field,
      sampleValue: s,
    });
  }
  return date;
}

/**
 * Format a UTC Date (or null) back to `YYYY-MM-DD` using UTC components so
 * there is no timezone shift regardless of host TZ. Round-trips with
 * `parseDateOnly`. Returns `null` for null/undefined input.
 */
export function formatDateOnly(date) {
  if (date === null || date === undefined) return null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TransformRejectedError({ reason: 'cannot format non-Date to date-only' });
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalize a timestamp field to a canonical ISO-8601 UTC string with
 * millisecond precision (`YYYY-MM-DDTHH:mm:ss.sssZ`).
 *
 * Accepted inputs (deterministic, no profiler data needed):
 *   - `undefined` / `null` / empty-or-whitespace string -> null
 *   - JS `Date` (valid) -> `toISOString()`
 *   - valid ISO timestamp string (with or without `.sss`) -> normalized ISO string
 *   - integer epoch ms within safe range -> ISO string
 *
 * Rejected (hard):
 *   - any string that does not parse as a Date AND is not empty
 *   - non-finite Date
 *
 * Date-only strings (`YYYY-MM-DD`) are intentionally NOT accepted here; they
 * are the responsibility of `parseDateOnly`. If a timestamp field receives a
 * date-only value, that is an anomaly and we surface it. (This is a deliberate
 * tightening: the profiler reports date-only values that leak into timestamp
 * fields, so the importer should not silently coerce them.)
 */
export function normalizeTimestamp(value, field = null, collection = null) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (isIsoTimestampString(trimmed)) {
      // C1: The ISO regex only checks the digit pattern (`\d{2}` for each
      // component), so out-of-range values like 2024-01-01T25:00:00Z or
      // 2024-02-30T00:00:00Z pass the regex. `new Date(trimmed)` either
      // returns Invalid Date (hour>23) or silently rolls the calendar forward
      // (Feb 30 -> Mar 1). We must assert every component round-trips exactly.
      const parsed = new Date(trimmed);
      const components = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/.exec(trimmed);
      if (!components) {
        // Should be unreachable because isIsoTimestampString already matched,
        // but guard defensively against regex drift.
        throw new TransformRejectedError({
          reason: 'timestamp ISO string failed component extraction',
          collection,
          field,
          sampleValue: value,
        });
      }
      const [, yS, moS, dS, hS, miS, sS] = components;
      const y = Number(yS);
      const mo = Number(moS);
      const d = Number(dS);
      const h = Number(hS);
      const mi = Number(miS);
      const s = Number(sS);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getUTCFullYear() !== y ||
        parsed.getUTCMonth() !== mo - 1 ||
        parsed.getUTCDate() !== d ||
        parsed.getUTCHours() !== h ||
        parsed.getUTCMinutes() !== mi ||
        parsed.getUTCSeconds() !== s
      ) {
        throw new TransformRejectedError({
          reason: 'timestamp has out-of-range calendar/time component (rollover or invalid)',
          collection,
          field,
          sampleValue: value,
        });
      }
      return parsed.toISOString();
    }
    // Reject everything else, including date-only. The owner decides.
    throw new TransformRejectedError({
      reason: 'timestamp is not a valid ISO-8601 UTC string',
      collection,
      field,
      sampleValue: value,
    });
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TransformRejectedError({
        reason: 'timestamp is an invalid Date',
        collection,
        field,
        sampleValue: value,
      });
    }
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Treat as epoch ms. Reject anything outside safe integer range to avoid
    // silent precision loss.
    if (!Number.isSafeInteger(value)) {
      throw new TransformRejectedError({
        reason: 'timestamp epoch ms is outside safe integer range',
        collection,
        field,
        sampleValue: value,
      });
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new TransformRejectedError({
        reason: 'timestamp epoch ms does not parse',
        collection,
        field,
        sampleValue: value,
      });
    }
    return d.toISOString();
  }
  throw new TransformRejectedError({
    reason: `timestamp has unsupported type ${typeof value}`,
    collection,
    field,
    sampleValue: value,
  });
}

/**
 * Coerce a value to a 32-bit signed integer, the Prisma `Int` type.
 *
 * Accepted:
 *   - `undefined` / `null` -> null (treat as absent)
 *   - JS number that is an integer within [INT32_MIN, INT32_MAX] -> that number
 *
 * Rejected (hard):
 *   - non-integer numbers
 *   - integers outside Int32 range
 *   - numeric strings (we refuse to guess base; e.g. "010" is ambiguous and
 *     owner must decide if it is octal/decimal). This is a deliberate tightening:
 *     the schema map declares these fields as counters/sizes, and the profiler
 *     reports wrong-type values, so the importer must not silently stringify.
 *   - non-numeric types
 *
 * `bigint` is rejected (not coerced) because the plan defers the BigInt-column
 * decision (e.g. media size) to owner sign-off — that path goes through
 * `PENDING_RULES.integerOverflow` instead.
 */
export function coerceInteger(value, field = null, collection = null, options = {}) {
  const { max = INT32_MAX, min = INT32_MIN } = options;
  if (value === undefined || value === null) return null;
  if (typeof value === 'bigint') {
    throw new TransformRejectedError({
      reason: 'integer field received bigint (use BigInt column decision)',
      collection,
      field,
      sampleValue: value,
    });
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new TransformRejectedError({
        reason: 'integer field received non-integer number',
        collection,
        field,
        sampleValue: value,
      });
    }
    if (value > max || value < min) {
      throw new TransformRejectedError({
        reason: `integer field out of bounds [${min}, ${max}]`,
        collection,
        field,
        sampleValue: value,
      });
    }
    return value;
  }
  throw new TransformRejectedError({
    reason: `integer field has unsupported type ${typeof value}`,
    collection,
    field,
    sampleValue: value,
  });
}

/**
 * Verify that a JSON-blob field (e.g. `pages.blocks`, `settings.value`) is
 * JSON-round-trippable and return it unchanged. The plan explicitly states we
 * preserve blocks/settings WITHOUT normalizing; this function only validates
 * that the value is safe for Prisma's `Json` column.
 *
 * Rules:
 *   - `undefined` -> null (treat as absent)
 *   - `null` -> null (preserved as NULL)
 *   - any plain JSON-serializable value -> returned by reference, unchanged
 *   - values that contain non-JSON types (function, undefined nested, symbol,
 *     bigint, non-finite number, or circular reference) -> REJECTED.
 *
 * We do NOT rely on `JSON.stringify` to detect silent drops: the JSON
 * serializer silently OMITS functions, symbols, and nested `undefined` rather
 * than throwing, so a naive "stringify then parse then stringify" equality
 * check would happily accept `{a: 1, b: undefined}` (whose serialization
 * `{"a":1}` round-trips to itself, hiding the dropped key). Instead we walk
 * the structure explicitly and reject any value that would not survive a
 * round-trip unchanged. This guarantees the importer never silently drops a
 * nested value the application relies on.
 *
 * We never mutate the input; on success we return the same reference (cheap).
 */
export function roundTripJson(value, field = null, collection = null) {
  if (value === undefined) return null;
  if (value === null) return null;
  const incompat = findJsonIncompatibility(value, new WeakSet());
  if (incompat) {
    throw new TransformRejectedError({
      reason: `JSON blob is not round-trippable: ${incompat}`,
      collection,
      field,
      sampleValue: '[incompatible]',
    });
  }
  // Defensive: still attempt a stringify so any edge case the structural walk
  // missed (e.g. a host object that throws on accessors) becomes a hard error.
  try {
    JSON.stringify(value);
  } catch (err) {
    throw new TransformRejectedError({
      reason: `JSON blob is not serializable: ${err.message}`,
      collection,
      field,
      sampleValue: '[unserializable]',
    });
  }
  return value; // unchanged reference, validated safe
}

/**
 * Structural walker. Returns a short reason string if `value` contains any
 * sub-value that JSON cannot preserve verbatim, otherwise null. Detects:
 *   - undefined nested value (silently dropped by JSON.stringify)
 *   - function (silently dropped)
 *   - symbol (silently dropped)
 *   - bigint (throws on JSON.stringify)
 *   - non-finite number (serializes to `null`)
 *   - circular reference (throws on JSON.stringify)
 *
 * `seen` is a WeakSet used to detect cycles without leaking memory.
 */
function findJsonIncompatibility(value, seen) {
  const type = typeof value;
  if (value === undefined) return 'contains undefined';
  if (type === 'function') return 'contains function';
  if (type === 'symbol') return 'contains symbol';
  if (type === 'bigint') return 'contains bigint';
  if (type === 'number' && !Number.isFinite(value)) return 'contains non-finite number';
  if (value === null || type !== 'object') return null; // primitive, fine
  if (seen.has(value)) return 'contains circular reference';
  seen.add(value);
  if (Array.isArray(value)) {
    for (const v of value) {
      const r = findJsonIncompatibility(v, seen);
      if (r) return r;
    }
    return null;
  }
  for (const v of Object.values(value)) {
    const r = findJsonIncompatibility(v, seen);
    if (r) return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field routing per schema map
// ---------------------------------------------------------------------------

/**
 * Dispatch a single field value to the correct deterministic transform based
 * on the schema map's field-classification sets.
 *
 * Returns `{ value, applied }` where `applied` is a short tag naming the
 * transform that ran ('identity', 'date-only', 'timestamp', 'integer',
 * 'json-blob', 'rating' is PENDING). Throws `TransformPendingError` or
 * `TransformRejectedError` on failure.
 *
 * Unknown fields (not in the schema for this collection) raise a PENDING error
 * — we never silently drop them. This is the rule that catches any
 * not-yet-decided schema drift.
 */
export function transformFieldValue(collection, field, value) {
  const entry = getSchemaEntry(collection);
  if (!entry) {
    throw new TransformPendingError({
      anomaly: 'unknown-collection',
      collection,
      field,
      decision: 'add collection to schema map or reject',
    });
  }
  if (field === '_id') {
    // _id compatibility decision is PENDING per plan gate; do not silently drop.
    throw new TransformPendingError({
      anomaly: 'mongo-_id-compat',
      collection,
      field,
      decision: 'decide _id drop vs legacyMongoId column (plan section 6 _id gate)',
      sampleValue: value,
    });
  }
  if (!entry.fields.has(field)) {
    throw new TransformPendingError({
      anomaly: 'unknown-field',
      collection,
      field,
      decision: 'map to typed column, legacy JSON field, fix-at-source, or quarantine',
      sampleValue: value,
    });
  }
  if (entry.dateOnlyFields.has(field)) {
    return { value: parseDateOnly(value, field, collection), applied: 'date-only' };
  }
  if (entry.timestampFields.has(field)) {
    return { value: normalizeTimestamp(value, field, collection), applied: 'timestamp' };
  }
  if (entry.integerFields.has(field)) {
    return { value: coerceInteger(value, field, collection), applied: 'integer' };
  }
  if (entry.jsonBlobFields.has(field)) {
    return { value: roundTripJson(value, field, collection), applied: 'json-blob' };
  }
  if (entry.ratingFields.has(field)) {
    // I2: A valid integer in [1,5] is acceptable now — it satisfies the
    // CHECK constraint the plan will add once source validation is complete,
    // so we carry it through as identity. Out-of-range or non-integer values
    // raise PENDING (rating-out-of-range): the plan explicitly defers the
    // CHECK constraint until the owner confirms the source produces 1..5, and
    // we must NOT silently clamp or drop the value.
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 5
    ) {
      return { value, applied: 'identity-rating' };
    }
    throw new TransformPendingError({
      anomaly: 'rating-out-of-range',
      collection,
      field,
      decision: 'rating must be an integer in [1,5]; confirm source produces 1..5 before adding CHECK constraint',
      sampleValue: value,
    });
  }
  if (entry.bcryptFields.has(field)) {
    // Password hash compatibility: bcrypt format only. We do NOT validate the
    // hash here (that is the profiler's job); the importer just carries it
    // through as-is so the auth contract is preserved. We never redact at this
    // layer — redaction happens at the report boundary, not in the data path.
    return { value, applied: 'identity-bcrypt' };
  }
  if (field === 'id' && entry.idKind === 'uuid') {
    // I1: The deterministic part of the id-uuid-vs-text rule IS knowable:
    // given a single id value we can run `classifyUuid` and reject any
    // non-UUID-v4 id immediately. The PENDING part of the rule (decide UUID
    // vs text column type from the FULL collection) stays in PENDING_RULES,
    // but for an individual non-conforming id we surface PENDING here so the
    // importer cannot silently carry it as identity into a UUID @id column.
    // Missing/empty id is a document-level concern (see transformDocument)
    // because it depends on whether the field is present at all.
    if (typeof value === 'string' && value !== '') {
      const info = classifyUuid(value);
      if (!info.validUuidV4) {
        throw new TransformPendingError({
          anomaly: 'id-uuid-vs-text',
          collection,
          field,
          decision:
            'id on a UUID-kind collection is not a v4 UUID; owner must decide UUID @id vs text @id from the full collection, or migrate/quarantine offending ids',
          sampleValue: value,
        });
      }
    }
  }
  // Plain string/boolean field with no special transform — pass through.
  return { value, applied: 'identity' };
}

// ---------------------------------------------------------------------------
// Whole-document transform
// ---------------------------------------------------------------------------

/**
 * Apply deterministic transforms to every field of a MongoDB document.
 *
 * Returns a NEW object (`output`) with transformed values plus an
 * `applied` map keyed by field name -> applied tag, and a list of `errors`
 * (one per field that raised). Does NOT mutate the input.
 *
 * Behaviour:
 *   - Each field is dispatched through `transformFieldValue`.
 *   - On `TransformPendingError` or `TransformRejectedError`, the behaviour
 *     depends on the `onPending` / `onRejected` mode (see Options). In
 *     `'throw'` mode (the default for PENDING) the first matching error
 *     aborts the whole document. In `'collect'` mode the error is appended
 *     to `errors` and the field is OMITTED from `output` — the importer MUST
 *     then abort when `errors.length > 0`, because the output is intentionally
 *     missing those fields and must NOT be written as-is.
 *   - `_id` is always routed through `transformFieldValue`, which raises
 *     PENDING — so by default the importer cannot carry `_id` into Postgres
 *     without an explicit decision. (This is intentional: the plan's _id gate
 *     is undecided.)
 *   - Document-level missing-id: for collections whose schema entry has
 *     `idKind: 'uuid'` or `idKind: 'static'`, a document that has no `id`
 *     field at all (or an empty/null id) raises a PENDING `missing-id` error
 *     in addition to the per-field pass. A non-null `@id` column cannot
 *     accept such a record, so the owner must decide synthesize-v4 /
 *     fix-at-source / quarantine. This check is document-level rather than
 *     field-level because it depends on whether the field is PRESENT, not on
 *     the value of a present field.
 *
 * Options:
 *   - onPending: 'throw' (DEFAULT) | 'collect'. When 'throw', the first
 *     PENDING error aborts the whole document. The default is 'throw' so a
 *     caller that forgets to pass an option cannot accidentally write a
 *     document with missing fields. 'collect' is opt-in: the caller MUST
 *     inspect `result.errors` and abort when `errors.length > 0`.
 *   - onRejected: 'collect' (default) | 'throw'. Same shape. Hard rejections
 *     default to 'collect' because a rejected field is a single-field
 *     quarantine decision the caller may want to inspect alongside other
 *     errors; flip to 'throw' for fail-fast.
 */
export function transformDocument(collection, doc, options = {}) {
  const { onPending = 'throw', onRejected = 'collect' } = options;
  const output = {};
  const applied = {};
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new TransformRejectedError({
      reason: 'document is not a plain object',
      collection,
    });
  }
  const entry = getSchemaEntry(collection);
  if (!entry) {
    throw new TransformPendingError({
      anomaly: 'unknown-collection',
      collection,
      decision: 'add collection to schema map or reject',
    });
  }
  // I1 (document-level): missing-id. For collections whose `id` column is
  // non-null (`idKind: 'uuid'` or `'static'`), a document with no usable id
  // cannot be inserted. `transformFieldValue` cannot detect "the field is
  // absent" because it only runs on present fields, so we surface it here.
  // `analytics` and `settings` have `idKind: 'none'` and are exempt.
  if (entry.idKind === 'uuid' || entry.idKind === 'static') {
    const idValue = doc.id;
    if (idValue === undefined || idValue === null || idValue === '') {
      const missingErr = new TransformPendingError({
        anomaly: 'missing-id',
        collection,
        field: 'id',
        decision:
          'document has no usable id; owner must decide synthesize-v4 / fix-at-source / quarantine before import into a non-null @id column',
        sampleValue: idValue,
      });
      if (onPending === 'throw') throw missingErr;
      errors.push({
        field: 'id',
        anomaly: 'missing-id',
        message: missingErr.message,
        kind: 'pending',
      });
    }
  }
  for (const [field, rawValue] of Object.entries(doc)) {
    try {
      const result = transformFieldValue(collection, field, rawValue);
      output[field] = result.value;
      applied[field] = result.applied;
    } catch (err) {
      const isPending = err instanceof TransformPendingError;
      const mode = isPending ? onPending : onRejected;
      if (mode === 'throw') throw err;
      errors.push({
        field,
        anomaly: err.anomaly || err.reason || err.name,
        message: err.message,
        kind: isPending ? 'pending' : 'rejected',
      });
    }
  }
  return { collection, output, applied, errors };
}

// ---------------------------------------------------------------------------
// PENDING rule registry
// ---------------------------------------------------------------------------

/**
 * Registry of transforms whose resolution is intentionally PENDING real
 * profiler output or owner sign-off. Each entry names:
 *   - anomaly:       the anomaly category from Task 2's taxonomy
 *   - collections:   the collections it applies to (or 'all')
 *   - decision:      the decision the owner must make
 *   - defaultOnceResolved: the strategy we will apply once the owner signs off
 *     (one of 'map-to-typed-column' | 'legacy-json-field' | 'fix-at-source' |
 *     'reject-quarantine')
 *
 * `evaluatePendingRule(ruleId, ctx)` raises `TransformPendingError` for any
 * rule that is still unresolved. The importer calls this when it encounters an
 * anomaly for which no deterministic rule exists, so the failure is loud and
 * the operator knows exactly which decision to make.
 */
export const PENDING_RULES = Object.freeze({
  'mongo-_id-compat': Object.freeze({
    anomaly: 'mongo-_id-compat',
    collections: 'all',
    decision:
      'Decide whether the public contract exposes MongoDB `_id`. Default plan recommendation: drop `_id` (declare internal leak). If an external consumer needs it, add a `legacyMongoId` column + compatibility serializer for the deprecation window.',
    defaultOnceResolved: 'map-to-typed-column',
    trigger: (ctx) => ctx.field === '_id',
  }),

  'id-uuid-vs-text': Object.freeze({
    anomaly: 'id-uuid-vs-text',
    collections: 'all-uuid-collections',
    decision:
      'Decide UUID vs text id column type from the FULL collection (not a sample). If the profiler reports any non-UUID-v4 id (non-v4, no-hyphens, or not-uuid), the owner must choose: keep `String @id` (text), or migrate offending ids to v4 UUIDs at source, or quarantine.',
    defaultOnceResolved: 'map-to-typed-column',
    trigger: (ctx) => {
      if (typeof ctx.value !== 'string' || ctx.value === '') return false;
      const info = classifyUuid(ctx.value);
      return !info.validUuidV4;
    },
  }),

  'duplicate-id': Object.freeze({
    anomaly: 'duplicate-id',
    collections: 'all',
    decision:
      'Duplicate `id` values must be resolved before import. Options: keep newest, keep oldest (audit), or quarantine both for manual merge. Cannot be decided without the full profiler output and the data owner.',
    defaultOnceResolved: 'reject-quarantine',
    trigger: (ctx) => ctx.anomalyKind === 'duplicate-id',
  }),

  'duplicate-natural-key': Object.freeze({
    anomaly: 'duplicate-natural-key',
    collections: ['users(email)', 'pages(slug)', 'settings(key)', 'analytics(date,path)'],
    decision:
      'Duplicate natural keys violate a UNIQUE constraint in Postgres. Per collection: dedupe rule (newest wins, oldest wins, or merge) must be signed off by the data owner. The plan preserves current behavior, so we cannot guess.',
    defaultOnceResolved: 'reject-quarantine',
    trigger: (ctx) => ctx.anomalyKind === 'duplicate-natural-key',
  }),

  'missing-id': Object.freeze({
    anomaly: 'missing-id',
    collections: 'all-uuid-and-static-collections',
    decision:
      'Records with no `id` cannot be imported into a non-null `@id` column. Owner must decide: synthesize a v4 UUID, fix at source, or quarantine.',
    defaultOnceResolved: 'reject-quarantine',
    trigger: (ctx) => ctx.value === undefined || ctx.value === null || ctx.value === '',
  }),

  'rating-out-of-range': Object.freeze({
    anomaly: 'rating-out-of-range',
    collections: ['survey_responses(rating)'],
    decision:
      'The plan says add CHECK rating BETWEEN 1 AND 5 only AFTER source validation. Until the data owner confirms the source produces 1..5, the importer must reject out-of-range ratings rather than clamp them silently.',
    defaultOnceResolved: 'fix-at-source',
    trigger: (ctx) =>
      typeof ctx.value === 'number' &&
      (!Number.isInteger(ctx.value) || ctx.value < 1 || ctx.value > 5),
  }),

  'integer-overflow': Object.freeze({
    anomaly: 'integer-overflow',
    collections: [
      'analytics(views)',
      'services(order)',
      'sidebar_widgets(order)',
      'gallery(order)',
      'documents(downloadCount)',
      'faq(order)',
      'banners(order)',
      'menus(order)',
      'media(size)',
    ],
    decision:
      'Counters/sizes/order that exceed Int32 must be moved to a BigInt column (and serialized safely as a number/string), OR capped at source, OR rejected. The plan gates `media.size <= 2147483647` with explicit BigInt fallback. Owner must choose per collection.',
    defaultOnceResolved: 'map-to-typed-column',
    trigger: (ctx) => isIntegerOverflow(ctx.value),
  }),

  'unknown-field': Object.freeze({
    anomaly: 'unknown-field',
    collections: 'all',
    decision:
      'Fields not in the proposed schema must NOT be silently dropped. Owner chooses per field: map to typed column (schema change), preserve in an explicit legacy-JSON column, fix at source, or quarantine the record.',
    defaultOnceResolved: 'legacy-json-field',
    trigger: (ctx) => ctx.anomalyKind === 'unknown-field',
  }),

  'menu-graph-anomaly': Object.freeze({
    anomaly: 'menu-graph-anomaly',
    collections: ['menus(parentId)'],
    decision:
      'Orphan parentId, self-cycle, and depth>2 cannot be silently normalized. Owner must fix the parent pointers at source or quarantine the offending menus. The plan caps depth at 2 (top -> child -> grandchild).',
    defaultOnceResolved: 'fix-at-source',
    trigger: (ctx) => ctx.anomalyKind === 'menu-graph-anomaly',
  }),

  'invalid-bcrypt-hash': Object.freeze({
    anomaly: 'invalid-bcrypt-hash',
    collections: ['users(password)'],
    decision:
      'Password hashes that do not match the bcrypt format cannot be migrated verbatim (they will fail re-hash on next login). Owner must decide: re-hash at source, reset password (force reset flow), or quarantine the user.',
    defaultOnceResolved: 'fix-at-source',
    trigger: (ctx) => ctx.anomalyKind === 'invalid-bcrypt-hash',
  }),

  'email-casing-anomaly': Object.freeze({
    anomaly: 'email-casing-anomaly',
    collections: ['users(email)'],
    decision:
      'Mongo stored emails with uppercase letters; the app lowercases on write so Postgres UNIQUE(email) could collide after normalization. Owner must decide: lowercase at import (idempotent) or fix at source. Default recommendation: lowercase at import because the application already treats emails case-insensitively.',
    defaultOnceResolved: 'fix-at-source',
    trigger: (ctx) => ctx.anomalyKind === 'email-casing-anomaly',
  }),

  'mixed-type-field': Object.freeze({
    anomaly: 'mixed-type-field',
    collections: 'all',
    decision:
      'A field carrying more than one non-null BSON type cannot be coerced to a single Prisma column type without a rule. Owner must choose: typed column + reject minority type, or legacy-JSON column. The profiler report (Task 2 output) is the source of truth for which fields are mixed.',
    defaultOnceResolved: 'legacy-json-field',
    trigger: (ctx) => ctx.anomalyKind === 'mixed-type-field',
  }),
});

/**
 * Evaluate a PENDING rule by id. Always raises `TransformPendingError` unless
 * the caller explicitly passes `{ resolved: true, strategy }` AND the strategy
 * is one of the allowed enum values — in which case we return the strategy
 * (so the importer can dispatch on it). This is the single point at which a
 * PENDING rule may be promoted to a real rule, and only by explicit owner
 * sign-off.
 */
export function evaluatePendingRule(ruleId, ctx = {}, options = {}) {
  const rule = PENDING_RULES[ruleId];
  if (!rule) {
    throw new TransformPendingError({
      anomaly: ruleId,
      collection: ctx.collection,
      field: ctx.field,
      decision: `Unknown pending rule id "${ruleId}". Register it in PENDING_RULES or fix the call site.`,
    });
  }
  const allowedStrategies = new Set([
    'map-to-typed-column',
    'legacy-json-field',
    'fix-at-source',
    'reject-quarantine',
  ]);
  if (options.resolved === true) {
    if (!allowedStrategies.has(options.strategy)) {
      throw new TransformPendingError({
        anomaly: rule.anomaly,
        collection: ctx.collection,
        field: ctx.field,
        decision: `Owner signed off but strategy "${options.strategy}" is not in ${[...allowedStrategies].join(' | ')}.`,
      });
    }
    return options.strategy;
  }
  throw new TransformPendingError({
    anomaly: rule.anomaly,
    collection: ctx.collection || rule.collections,
    field: ctx.field,
    decision: rule.decision,
    sampleValue: ctx.value,
  });
}

/**
 * Convenience: list every pending rule id and its decision text, for the docs
 * page and for importer startup banners. Returns a stable array.
 */
export function listPendingRules() {
  return Object.keys(PENDING_RULES)
    .sort()
    .map((id) => ({
      id,
      anomaly: PENDING_RULES[id].anomaly,
      collections: PENDING_RULES[id].collections,
      decision: PENDING_RULES[id].decision,
      defaultOnceResolved: PENDING_RULES[id].defaultOnceResolved,
    }));
}
