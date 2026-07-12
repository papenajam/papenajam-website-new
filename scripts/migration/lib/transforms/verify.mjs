// Pure verification comparisons for the migration verifier.
// Operates on in-memory record arrays (no live DB required for unit tests).

import { formatDateOnly } from '../../transform-rules.mjs';
import {
  businessFieldHash,
  collectionBusinessHash,
  stableStringify,
} from './canonical-hash.mjs';
import { getPrismaEntry } from './prisma-map.mjs';

/**
 * Normalize a Prisma/Mongo record for comparison:
 *   - Dates → ISO or YYYY-MM-DD depending on field class
 *   - drop _id
 *   - sort object keys via stableStringify on the caller side
 */
export function normalizeRecordForCompare(collection, record) {
  if (!record || typeof record !== 'object') return record;
  const entry = getPrismaEntry(collection);
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (k === '_id') continue;
    if (v instanceof Date) {
      if (entry?.dateOnlyFields?.includes(k)) {
        out[k] = formatDateOnly(v);
      } else {
        out[k] = v.toISOString();
      }
      continue;
    }
    // Prisma may return date-only as Date; Mongo export may already be string.
    if (typeof v === 'string' && entry?.dateOnlyFields?.includes(k)) {
      out[k] = v.trim() === '' ? null : v.slice(0, 10);
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Count equality: { ok, expected, actual, delta }.
 */
export function compareCounts(expected, actual) {
  const exp = Number(expected) || 0;
  const act = Number(actual) || 0;
  return {
    ok: exp === act,
    expected: exp,
    actual: act,
    delta: act - exp,
  };
}

/**
 * Set equality of public ids (or natural keys).
 * @param {string[]} expectedIds
 * @param {string[]} actualIds
 */
export function compareIdSets(expectedIds, actualIds) {
  const exp = new Set((expectedIds || []).map(String));
  const act = new Set((actualIds || []).map(String));
  const missing = [...exp].filter((id) => !act.has(id)).sort();
  const extra = [...act].filter((id) => !exp.has(id)).sort();
  return {
    ok: missing.length === 0 && extra.length === 0,
    expectedCount: exp.size,
    actualCount: act.size,
    missing,
    extra,
  };
}

/**
 * Detect duplicates in a list of key strings.
 */
export function findDuplicates(keys) {
  const seen = new Map();
  for (const k of keys || []) {
    const s = String(k);
    seen.set(s, (seen.get(s) || 0) + 1);
  }
  const dups = [];
  for (const [k, n] of seen.entries()) {
    if (n > 1) dups.push({ key: k, count: n });
  }
  dups.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return dups;
}

/**
 * Canonical business-field hash equality for two record lists.
 * Records should already be sorted by the same key.
 */
export function compareBusinessHashes(sourceRecords, targetRecords, options) {
  const sourceHash = collectionBusinessHash(sourceRecords, options);
  const targetHash = collectionBusinessHash(targetRecords, options);
  return {
    ok: sourceHash === targetHash,
    sourceHash,
    targetHash,
  };
}

/**
 * Aggregate helpers.
 */
export function sumField(records, field) {
  let total = 0;
  for (const r of records || []) {
    const n = r?.[field];
    if (typeof n === 'number' && Number.isFinite(n)) total += n;
  }
  return total;
}

export function countWhere(records, predicate) {
  let n = 0;
  for (const r of records || []) {
    if (predicate(r)) n += 1;
  }
  return n;
}

export function groupCount(records, keyFn) {
  const map = new Map();
  for (const r of records || []) {
    const k = keyFn(r);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

export function averageField(records, field) {
  let sum = 0;
  let n = 0;
  for (const r of records || []) {
    const v = r?.[field];
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n === 0 ? null : sum / n;
}

/**
 * Menu referential integrity: every parentId must reference an existing id;
 * no self-cycles.
 */
export function checkMenuIntegrity(menus) {
  const byId = new Map();
  for (const m of menus || []) {
    if (m?.id != null) byId.set(String(m.id), m);
  }
  const orphans = [];
  const selfCycles = [];
  for (const m of menus || []) {
    if (m.parentId == null || m.parentId === '') continue;
    const pid = String(m.parentId);
    if (pid === String(m.id)) {
      selfCycles.push(String(m.id));
      continue;
    }
    if (!byId.has(pid)) {
      orphans.push({ id: String(m.id), parentId: pid });
    }
  }
  return {
    ok: orphans.length === 0 && selfCycles.length === 0,
    orphans,
    selfCycles,
    total: byId.size,
  };
}

/**
 * Deep JSON equality for a sample of records (pages.blocks, sidebar settings).
 */
export function compareJsonFields(sourceRecords, targetRecords, field, idKey = 'id') {
  const targetById = new Map(
    (targetRecords || []).map((r) => [String(r[idKey]), r]),
  );
  const mismatches = [];
  for (const src of sourceRecords || []) {
    const id = String(src[idKey]);
    const tgt = targetById.get(id);
    if (!tgt) {
      mismatches.push({ id, reason: 'missing-in-target' });
      continue;
    }
    const a = stableStringify(src[field] ?? null);
    const b = stableStringify(tgt[field] ?? null);
    if (a !== b) {
      mismatches.push({ id, reason: 'json-mismatch', field });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * Date boundary + sort sample: first/last by a sort field.
 */
export function sampleDateBounds(records, dateField) {
  const dated = (records || [])
    .map((r) => ({ id: r.id, value: r[dateField] }))
    .filter((x) => x.value != null && x.value !== '');
  dated.sort((a, b) => String(a.value).localeCompare(String(b.value)));
  return {
    count: dated.length,
    first: dated[0] || null,
    last: dated[dated.length - 1] || null,
  };
}

/**
 * Build a deterministic sample set: first, last, null-ish, largest (by JSON size).
 */
export function pickTargetedSamples(records, { idKey = 'id', max = 10 } = {}) {
  const list = [...(records || [])];
  if (list.length === 0) return [];
  const samples = [];
  const push = (r, tag) => {
    if (!r) return;
    const id = r[idKey];
    if (samples.some((s) => s.id === id && s.tag === tag)) return;
    samples.push({ id, tag, record: r });
  };
  push(list[0], 'first');
  push(list[list.length - 1], 'last');
  // null-ish on common optional fields
  for (const r of list) {
    if (
      r.publishDate == null ||
      r.publishDate === '' ||
      r.endDate == null ||
      r.endDate === '' ||
      r.jadwalSidang == null ||
      r.jadwalSidang === ''
    ) {
      push(r, 'nullish-date');
      break;
    }
  }
  // largest by approximate JSON size
  let largest = null;
  let largestBytes = -1;
  for (const r of list) {
    const bytes = Buffer.byteLength(JSON.stringify(r) || '', 'utf8');
    if (bytes > largestBytes) {
      largestBytes = bytes;
      largest = r;
    }
  }
  push(largest, 'largest');
  // random-ish but deterministic: every Nth
  if (list.length > 4) {
    const step = Math.max(1, Math.floor(list.length / Math.min(max, list.length)));
    for (let i = 0; i < list.length && samples.length < max; i += step) {
      push(list[i], 'stride');
    }
  }
  return samples.slice(0, max);
}

/**
 * File URL existence sampling — checks that referenced paths exist on disk
 * under `uploadsRoot` when they look like local `/uploads/...` URLs.
 * Does NOT move bytes; only samples presence.
 *
 * @param {string[]} urls
 * @param {(url: string) => boolean} existsFn - injected for tests
 */
export function sampleFileUrlExistence(urls, existsFn) {
  const results = [];
  for (const url of urls || []) {
    if (typeof url !== 'string' || !url) continue;
    // Only check local /uploads paths; external URLs are skipped.
    if (!url.startsWith('/uploads/') && !url.startsWith('uploads/')) {
      results.push({ url, checked: false, reason: 'not-local-upload' });
      continue;
    }
    const ok = Boolean(existsFn(url));
    results.push({ url, checked: true, exists: ok });
  }
  const checked = results.filter((r) => r.checked);
  const missing = checked.filter((r) => !r.exists);
  return {
    ok: missing.length === 0,
    total: results.length,
    checked: checked.length,
    missing,
    results,
  };
}

export { businessFieldHash, collectionBusinessHash };
