// Deterministic canonical JSON + SHA-256 helpers for export manifests and
// migration verification. Pure functions; no I/O.

import { createHash } from 'node:crypto';
import { isSecretField } from '../canonicalize.mjs';

/**
 * Stable JSON stringify: object keys sorted recursively, arrays keep order,
 * Dates → ISO string, ObjectId-like → string, undefined keys omitted.
 * Never mutates input.
 */
export function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  // BSON ObjectId / Long-like
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }
    if (typeof value.toJSON === 'function' && value._bsontype) {
      try {
        return value.toJSON();
      } catch {
        /* fall through */
      }
    }
    if (Array.isArray(value)) {
      return value.map((v) => canonicalize(v));
    }
    const keys = Object.keys(value).sort();
    const out = {};
    for (const k of keys) {
      if (value[k] === undefined) continue;
      out[k] = canonicalize(value[k]);
    }
    return out;
  }
  return String(value);
}

/**
 * SHA-256 hex digest of the stable JSON form of `value`.
 */
export function sha256Canonical(value) {
  const payload = stableStringify(value);
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Business-field hash: drop secrets + internal keys, then SHA-256.
 * Used by the verifier for cross-DB equality after type normalization.
 */
export function businessFieldHash(record, { dropKeys = ['_id'] } = {}) {
  if (!record || typeof record !== 'object') {
    return sha256Canonical(null);
  }
  const cleaned = {};
  for (const [k, v] of Object.entries(record)) {
    if (dropKeys.includes(k)) continue;
    if (isSecretField(k)) {
      // Include presence of secret field without its value so count of
      // password-bearing rows still contributes to the hash shape.
      cleaned[k] = '<present>';
      continue;
    }
    cleaned[k] = v;
  }
  return sha256Canonical(cleaned);
}

/**
 * Hash an ordered list of records (already sorted by public id / natural key).
 * Returns a single digest over the concatenation of per-record digests so a
 * single flipped field invalidates the whole collection hash.
 */
export function collectionBusinessHash(records, options) {
  const digests = (records || []).map((r) => businessFieldHash(r, options));
  return sha256Canonical(digests);
}
