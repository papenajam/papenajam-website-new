// Document-level transform for the PostgreSQL importer.
//
// Pipeline per Mongo document:
//   1. Drop Mongo `_id` (plan §6 default: internal leak, drop).
//   2. Apply known field renames (legacy → Prisma column).
//   3. Drop explicitly listed legacy-only fields (e.g. news.summary).
//   4. Run transform-rules.mjs value transforms for date/timestamp/int/json.
//   5. Apply requiredDefaults for NOT NULL columns omitted by the source.
//   6. Coerce settings.value objects to text when needed.
//   7. Synthesize analytics id (surrogate UUID) when absent.
//
// Never silently drops an *unknown* field: unknown keys raise TransformPendingError
// (or are collected into result.errors depending on options).

import { randomUUID } from 'node:crypto';
import {
  TransformPendingError,
  TransformRejectedError,
  parseDateOnly,
  normalizeTimestamp,
  coerceInteger,
  roundTripJson,
} from '../../transform-rules.mjs';
import { classifyUuid, isSecretField, normalizeEmail } from '../canonicalize.mjs';
import { getPrismaEntry } from './prisma-map.mjs';

/**
 * Transform one Mongo document into a Prisma-ready row.
 *
 * @param {string} collection
 * @param {object} doc
 * @param {{
 *   onPending?: 'throw'|'collect',
 *   onRejected?: 'throw'|'collect',
 *   lowercaseEmail?: boolean,
 *   now?: Date,
 * }} [options]
 * @returns {{ collection: string, output: object, applied: object, errors: array }}
 */
export function transformForImport(collection, doc, options = {}) {
  const {
    onPending = 'collect',
    onRejected = 'collect',
    lowercaseEmail = true,
    now = new Date(),
  } = options;

  const entry = getPrismaEntry(collection);
  if (!entry) {
    throw new TransformPendingError({
      anomaly: 'unknown-collection',
      collection,
      decision: 'add collection to prisma-map.mjs',
    });
  }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new TransformRejectedError({
      reason: 'document is not a plain object',
      collection,
    });
  }

  const errors = [];
  const applied = {};
  const output = {};

  // 1. Start from a shallow clone; drop _id (resolved: drop).
  const working = { ...doc };
  if (Object.prototype.hasOwnProperty.call(working, '_id')) {
    delete working._id;
    applied._id = 'drop-mongo-id';
  }

  // 2. Field renames (legacy → Prisma).
  const renames = entry.fieldRenames || {};
  for (const [from, to] of Object.entries(renames)) {
    if (!Object.prototype.hasOwnProperty.call(working, from)) continue;
    if (to === null) {
      // Explicit drop of a known legacy key that has no Prisma column.
      delete working[from];
      applied[from] = 'drop-legacy-field';
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(working, to)) {
      working[to] = working[from];
    }
    delete working[from];
    applied[from] = `rename→${to}`;
  }

  // 3. Explicit drop list (known schema drift, documented).
  for (const drop of entry.dropFields || []) {
    if (Object.prototype.hasOwnProperty.call(working, drop)) {
      delete working[drop];
      applied[drop] = 'drop-legacy-field';
    }
  }

  // 4. Allowed field set.
  const allowed = new Set(entry.fields);

  // 5. Per-field transform.
  for (const [field, rawValue] of Object.entries(working)) {
    if (!allowed.has(field)) {
      const err = new TransformPendingError({
        anomaly: 'unknown-field',
        collection,
        field,
        decision:
          'map to typed column, legacy JSON field, fix-at-source, or quarantine',
        sampleValue: isSecretField(field) ? '<redacted>' : rawValue,
      });
      if (onPending === 'throw') throw err;
      errors.push({
        field,
        anomaly: 'unknown-field',
        message: err.message,
        kind: 'pending',
      });
      continue;
    }

    try {
      const { value, tag } = transformValue(entry, collection, field, rawValue, {
        lowercaseEmail,
      });
      // Skip undefined (field absent after coercion of empty optional).
      if (value !== undefined) {
        output[field] = value;
        applied[field] = tag;
      }
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

  // 6. Required defaults for NOT NULL columns omitted by the source.
  for (const [field, defaultValue] of Object.entries(entry.requiredDefaults || {})) {
    if (output[field] === undefined || output[field] === null) {
      // Deep-clone plain objects so callers cannot mutate the map.
      output[field] =
        defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)
          ? { ...defaultValue }
          : Array.isArray(defaultValue)
            ? [...defaultValue]
            : defaultValue;
      applied[field] = applied[field] || 'default';
    }
  }

  // 7. Timestamps: createdAt is NOT NULL on most models — synthesise if missing.
  if (allowed.has('createdAt') && (output.createdAt === undefined || output.createdAt === null)) {
    output.createdAt = now instanceof Date ? now : new Date(now);
    applied.createdAt = 'default-now';
  }

  // 8. settings.value stringify.
  if (entry.stringifyValue && Object.prototype.hasOwnProperty.call(output, 'value')) {
    if (output.value !== null && typeof output.value === 'object') {
      output.value = JSON.stringify(output.value);
      applied.value = 'stringify-json-text';
    } else if (output.value === undefined) {
      output.value = '';
    } else if (typeof output.value !== 'string') {
      output.value = output.value === null ? '' : String(output.value);
    }
  }

  // 9. analytics surrogate id.
  if (entry.synthesizeId && !output.id) {
    output.id = randomUUID();
    applied.id = 'synthesize-uuid';
  }

  // 10. Document-level missing-id for uuid/static kinds.
  if (entry.idKind === 'uuid' || entry.idKind === 'static') {
    if (output.id === undefined || output.id === null || output.id === '') {
      const err = new TransformPendingError({
        anomaly: 'missing-id',
        collection,
        field: 'id',
        decision:
          'document has no usable id; fix-at-source / synthesize-v4 / quarantine',
      });
      if (onPending === 'throw') throw err;
      errors.push({
        field: 'id',
        anomaly: 'missing-id',
        message: err.message,
        kind: 'pending',
      });
    } else if (entry.idKind === 'uuid' && typeof output.id === 'string') {
      const info = classifyUuid(output.id);
      if (!info.validUuidV4) {
        const err = new TransformPendingError({
          anomaly: 'id-uuid-vs-text',
          collection,
          field: 'id',
          decision: 'id is not a v4 UUID; owner must decide column type or migrate ids',
          sampleValue: output.id,
        });
        if (onPending === 'throw') throw err;
        errors.push({
          field: 'id',
          anomaly: 'id-uuid-vs-text',
          message: err.message,
          kind: 'pending',
        });
      }
    }
  }

  // 11. Parent id empty string → null (menus).
  if (Object.prototype.hasOwnProperty.call(output, 'parentId')) {
    if (output.parentId === '' || output.parentId === undefined) {
      output.parentId = null;
    }
  }

  // 12. Strip keys that are not Prisma columns (defensive).
  for (const key of Object.keys(output)) {
    if (!allowed.has(key)) delete output[key];
  }

  return { collection, output, applied, errors };
}

function transformValue(entry, collection, field, rawValue, { lowercaseEmail }) {
  // date-only
  if (entry.dateOnlyFields.includes(field)) {
    return { value: parseDateOnly(rawValue, field, collection), tag: 'date-only' };
  }
  // timestamps
  if (entry.timestampFields.includes(field)) {
    const iso = normalizeTimestamp(rawValue, field, collection);
    if (iso === null) return { value: null, tag: 'timestamp-null' };
    return { value: new Date(iso), tag: 'timestamp' };
  }
  // integers
  if (entry.integerFields.includes(field)) {
    // survey_responses.rating: accept 1..5 only (hard reject otherwise via pending)
    if (collection === 'survey_responses' && field === 'rating') {
      if (
        typeof rawValue === 'number' &&
        Number.isInteger(rawValue) &&
        rawValue >= 1 &&
        rawValue <= 5
      ) {
        return { value: rawValue, tag: 'identity-rating' };
      }
      throw new TransformPendingError({
        anomaly: 'rating-out-of-range',
        collection,
        field,
        decision: 'rating must be integer in [1,5]',
        sampleValue: rawValue,
      });
    }
    return { value: coerceInteger(rawValue, field, collection), tag: 'integer' };
  }
  // json blobs
  if (entry.jsonBlobFields.includes(field)) {
    const v = roundTripJson(rawValue, field, collection);
    return { value: v === null ? (field === 'blocks' ? [] : {}) : v, tag: 'json-blob' };
  }
  // bcrypt — pass through verbatim (never log)
  if (entry.bcryptFields.includes(field)) {
    return { value: rawValue, tag: 'identity-bcrypt' };
  }
  // email lowercase
  if (field === 'email' && lowercaseEmail && typeof rawValue === 'string') {
    return { value: normalizeEmail(rawValue), tag: 'email-lowercase' };
  }
  // empty string on optional text stays as-is (Prisma Text accepts ''); date-only
  // already handled. Booleans / numbers pass through.
  return { value: rawValue, tag: 'identity' };
}

/**
 * Sort menus so parents (parentId null/absent) come before children.
 * Stable for equal parent groups by `order` then `id`.
 */
export function sortMenusParentsFirst(rows) {
  const parents = [];
  const children = [];
  for (const row of rows) {
    if (row.parentId == null || row.parentId === '') parents.push(row);
    else children.push(row);
  }
  const byOrderId = (a, b) => {
    const ao = typeof a.order === 'number' ? a.order : 0;
    const bo = typeof b.order === 'number' ? b.order : 0;
    if (ao !== bo) return ao - bo;
    return String(a.id || '').localeCompare(String(b.id || ''));
  };
  parents.sort(byOrderId);
  children.sort(byOrderId);
  return [...parents, ...children];
}

/**
 * Chunk an array into batches of `size` (default 500).
 */
export function chunk(array, size = 500) {
  if (!Array.isArray(array) || size < 1) return [];
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}
