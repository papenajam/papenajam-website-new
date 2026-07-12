// Pure guards used by the PostgreSQL importer (unit-testable without a live DB).

import { APPLICATION_TABLES } from './prisma-map.mjs';

/**
 * Decide whether the target PostgreSQL application tables are "empty enough"
 * to import into.
 *
 * @param {Record<string, number>} counts - table → row count
 * @param {{ forceRecovery?: boolean }} [options]
 * @returns {{ ok: boolean, nonempty: string[], reason?: string }}
 */
export function assertEmptyTarget(counts, { forceRecovery = false } = {}) {
  const nonempty = [];
  for (const table of APPLICATION_TABLES) {
    const n = counts[table] ?? 0;
    if (n > 0) nonempty.push(`${table}=${n}`);
  }
  if (nonempty.length === 0) {
    return { ok: true, nonempty: [] };
  }
  if (forceRecovery) {
    return {
      ok: true,
      nonempty,
      reason:
        'Target is nonempty but --force-recovery was supplied. ' +
        'Importer will TRUNCATE application tables (not _prisma_migrations) before import.',
    };
  }
  return {
    ok: false,
    nonempty,
    reason:
      'Target PostgreSQL application tables are not empty. ' +
      `Nonempty: ${nonempty.join(', ')}. ` +
      'Refuse to import (all-or-nothing). Re-run against an empty target after ' +
      '`prisma migrate deploy`, or pass --force-recovery to TRUNCATE app tables first.',
  };
}

/**
 * Format a reject-file payload for a failed record. Secrets are redacted.
 *
 * @param {{
 *   collection: string,
 *   index: number,
 *   publicId?: string|null,
 *   errors: array,
 *   rawDoc?: object,
 * }} entry
 */
export function buildRejectEntry(entry) {
  const { collection, index, publicId = null, errors = [], rawDoc = null } = entry;
  return {
    collection,
    index,
    publicId,
    errors: errors.map((e) => ({
      field: e.field || null,
      anomaly: e.anomaly || e.kind || 'unknown',
      message: e.message || String(e),
      kind: e.kind || 'rejected',
    })),
    // Never include password / hash values in the reject artifact.
    rawDocPreview: rawDoc ? redactForReject(rawDoc) : null,
  };
}

function redactForReject(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (
      k === 'password' ||
      k === 'passwordHash' ||
      k === 'secret' ||
      k === 'token' ||
      k === 'apiKey'
    ) {
      out[k] = '<redacted>';
    } else if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      out[k] = redactForReject(v);
    } else {
      out[k] = v instanceof Date ? v.toISOString() : v;
    }
  }
  // Drop Mongo _id binary noise; keep string form if present.
  if (out._id && typeof out._id === 'object') {
    out._id = typeof out._id.toHexString === 'function'
      ? out._id.toHexString()
      : '<objectid>';
  }
  return out;
}

/**
 * All-or-nothing strategy description (embedded in reject / log output).
 */
export const ALL_OR_NOTHING_STRATEGY = Object.freeze({
  name: 'batch-tx-stop-on-first-failure',
  description:
    'Each batch (~500 rows) is imported inside a single database transaction. ' +
    'If any record in a batch fails transform or insert, the batch is rolled back, ' +
    'a reject file is written, and the entire run aborts. Previously committed ' +
    'batches (if any) leave the target in a partial state — the operator MUST ' +
    're-run against an empty target (or pass --force-recovery to TRUNCATE app ' +
    'tables first). Partial-success is never reported as success. ' +
    '_prisma_migrations is never truncated.',
});
