// Pure anomaly analysis for the read-only MongoDB migration profiler.
//
// Every function here takes plain JavaScript records (the shape returned by
// MongoDB's `collection.find().toArray()` when the driver deserializes BSON)
// and returns plain report objects. No I/O, no MongoDB dependency, no mutation
// of input. This is the unit-test boundary.
//
// Required anomaly dimensions (Task 2 brief):
//   - union field names + frequency per collection
//   - BSON/JS type per field incl mixed types / null / empty / missing counts
//   - duplicate / missing `id`
//   - UUID validity of `id`
//   - duplicate normalized users.email
//   - duplicate pages.slug, settings.key, analytics (date,path)
//   - invalid timestamp / date-only strings
//   - unknown fields vs proposed schema
//   - menu orphan / self-cycle / depth > 2
//   - JSON root/type/size for blocks / settings
//   - rating outside 1-5
//   - integer overflow for counters / media size
//   - invalid bcrypt hash format + email casing anomaly (no secret leakage)
//
// Output of `analyzeCollection` is a plain object suitable for JSON.stringify.

import {
  bsonTypeName,
  classifyUuid,
  emailHasCasingAnomaly,
  estimateJsonBytes,
  isEmptyValue,
  isBcryptHashFormat,
  isDateOnlyString,
  isIntegerOverflow,
  isIsoTimestampString,
  isInvalidTimestamp,
  isSecretField,
  normalizeEmail,
  normalizeId,
  redactSecret,
} from './canonicalize.mjs';
import { findUnknownFields, getSchemaEntry } from './schema-map.mjs';

const FIELD_ALLOWLIST_FOR_MISSING = new Set(['_id']);
const MAX_MENU_DEPTH = 2; // top-level -> child -> grandchild = depth 2 per the brief

/**
 * Compute per-field statistics for a sample of records.
 *
 * Returns a map: fieldName -> {
 *   frequency,                          // number of records where field is present (not missing)
 *   types: { [typeName]: count },       // observed BSON/JS types
 *   mixedTypes: boolean,                // true if more than one non-null type observed
 *   nullCount,
 *   emptyCount,
 *   missingCount,
 * }
 *
 * `totalCount` is the sample size (records.length) — used to derive missing
 * count when this is a sample rather than the full collection.
 */
export function computeFieldStats(records, options = {}) {
  const { knownCtors } = options;
  const stats = new Map();

  function ensure(name) {
    if (!stats.has(name)) {
      stats.set(name, {
        frequency: 0,
        types: {},
        mixedTypes: false,
        nullCount: 0,
        emptyCount: 0,
        missingCount: 0,
      });
    }
    return stats.get(name);
  }

  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const present = new Set(Object.keys(record));
    for (const [name, value] of Object.entries(record)) {
      const entry = ensure(name);
      entry.frequency += 1;
      if (value === null) {
        entry.nullCount += 1;
        entry.types.Null = (entry.types.Null || 0) + 1;
        continue;
      }
      const typeName = bsonTypeName(value, knownCtors);
      entry.types[typeName] = (entry.types[typeName] || 0) + 1;
      if (isEmptyValue(value)) entry.emptyCount += 1;
    }
    // Mark missing for known fields seen in any other record.
    for (const name of stats.keys()) {
      if (!present.has(name)) {
        stats.get(name).missingCount += 1;
      }
    }
  }

  // Resolve mixedTypes flag: more than one type with at least one non-null type.
  for (const entry of stats.values()) {
    const nonNullTypes = Object.entries(entry.types).filter(([name]) => name !== 'Null');
    const typeCount = new Set(nonNullTypes.map(([name]) => name)).size;
    entry.mixedTypes = typeCount > 1;
  }

  return stats;
}

/**
 * Convert the field-stats Map into a stable array suitable for JSON output.
 */
export function fieldStatsToJson(stats, sampleSize) {
  const out = [];
  for (const [name, entry] of stats.entries()) {
    out.push({
      name,
      frequency: entry.frequency,
      sampleSize,
      types: sortObject(entry.types),
      mixedTypes: entry.mixedTypes,
      nullCount: entry.nullCount,
      emptyCount: entry.emptyCount,
      missingCount: entry.missingCount,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function sortObject(obj) {
  const out = {};
  for (const key of Object.keys(obj).sort()) out[key] = obj[key];
  return out;
}

/**
 * Detect duplicate and missing `id` values across the sample.
 *
 * Returns {
 *   total, missingCount, duplicateCount, duplicateValueCount, duplicates
 * }
 *
 * `duplicates` is an array of { id, count }. Duplicate ids are reported in full
 * only when they are NOT secret — ids are not secrets by policy.
 */
export function analyzeIdUniqueness(records) {
  const seen = new Map();
  let missing = 0;
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const raw = record.id;
    if (raw === undefined || raw === null || raw === '') {
      missing += 1;
      continue;
    }
    const key = normalizeId(String(raw));
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const duplicates = [];
  let duplicateValueCount = 0;
  for (const [id, count] of seen.entries()) {
    if (count > 1) {
      duplicates.push({ id, count });
      duplicateValueCount += count;
    }
  }
  duplicates.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return {
    total: records.length,
    missingCount: missing,
    duplicateValueCount,
    duplicateCount: duplicates.length,
    duplicates,
  };
}

/**
 * Classify UUID validity of `id` values.
 *
 * Returns {
 *   total, validUuidV4, validUuidAny, notUuid, samples: { notUuid: string[], nonV4: string[] }
 * }
 *
 * We include sample non-UUID ids (truncated to 64 chars) because ids are not
 * secrets. `_id` (ObjectId) is intentionally not analyzed here.
 */
export function analyzeIdUuidValidity(records) {
  let validV4 = 0;
  let validAny = 0;
  let notUuid = 0;
  let nonV4 = 0;
  const samples = [];
  const nonV4Samples = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const raw = record.id;
    if (raw === undefined || raw === null || raw === '') continue;
    const info = classifyUuid(raw);
    if (info.validUuidV4) {
      validV4 += 1;
      validAny += 1;
    } else if (info.validUuidAny) {
      validAny += 1;
      nonV4 += 1;
      if (nonV4Samples.length < 5) nonV4Samples.push(truncate(String(raw)));
    } else {
      notUuid += 1;
      if (samples.length < 5) samples.push(truncate(String(raw)));
    }
  }
  return {
    total: records.length,
    validUuidV4: validV4,
    validUuidAny: validAny,
    nonV4Count: nonV4,
    notUuidCount: notUuid,
    samples: { notUuid: samples, nonV4: nonV4Samples },
  };
}

/**
 * Detect duplicates for an arbitrary natural key. `keyFields` is an array of
 * field names whose [value,value,...] tuple identifies a record uniquely.
 *
 * Returns {
 *   total, missingCount, duplicateCount, duplicateValueCount, duplicates
 * }
 *
 * `duplicates` is an array of { key, count }. Keys are normalized: emails are
 * trimmed+lowercased; other keys are trimmed strings. Secret fields are
 * redacted — but none of our natural keys (email, slug, key, date+path) are
 * secrets.
 */
export function analyzeNaturalKeyDuplicates(records, keyFields, { normalize } = {}) {
  const seen = new Map();
  let missing = 0;
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const values = keyFields.map((field) => {
      const raw = record[field];
      if (raw === undefined || raw === null || raw === '') return null;
      const str = String(raw);
      return normalize ? normalize(str) : str.trim();
    });
    if (values.some((v) => v === null)) {
      missing += 1;
      continue;
    }
    const key = JSON.stringify(values);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const duplicates = [];
  let duplicateValueCount = 0;
  for (const [key, count] of seen.entries()) {
    if (count > 1) {
      duplicates.push({ key: JSON.parse(key), count });
      duplicateValueCount += count;
    }
  }
  duplicates.sort((a, b) => b.count - a.count);
  return {
    total: records.length,
    missingCount: missing,
    duplicateCount: duplicates.length,
    duplicateValueCount,
    duplicates,
  };
}

/**
 * Wrapper for email natural-key detection (trims + lowercases).
 */
export function analyzeEmailDuplicates(records, field = 'email') {
  return analyzeNaturalKeyDuplicates(records, [field], { normalize: (s) => normalizeEmail(s) });
}

/**
 * Detect timestamp anomalies for configured timestamp fields. A field is
 * flagged when it contains a non-empty string that is neither a valid ISO
 * timestamp nor a valid date-only.
 */
export function analyzeTimestamps(records, fields) {
  const report = {};
  for (const field of fields) {
    report[field] = { invalidCount: 0, dateOnlyCount: 0, isoTimestampCount: 0, samples: [] };
  }
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const field of fields) {
      const value = record[field];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      const entry = report[field];
      if (isIsoTimestampString(trimmed)) {
        entry.isoTimestampCount += 1;
      } else if (isDateOnlyString(trimmed)) {
        entry.dateOnlyCount += 1;
      } else if (isInvalidTimestamp(trimmed)) {
        entry.invalidCount += 1;
        if (entry.samples.length < 5) entry.samples.push(truncate(trimmed));
      }
    }
  }
  return report;
}

/**
 * Detect integer overflow on configured numeric fields (counters, sizes, order).
 * Reports the count of records whose value exceeds Int32 bounds, with samples.
 */
export function analyzeIntegerOverflow(records, fields) {
  const report = {};
  for (const field of fields) report[field] = { overflowCount: 0, samples: [] };
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const field of fields) {
      const value = record[field];
      if (value === undefined || value === null) continue;
      if (isIntegerOverflow(value)) {
        const entry = report[field];
        entry.overflowCount += 1;
        if (entry.samples.length < 5) entry.samples.push(truncate(String(value)));
      }
    }
  }
  return report;
}

/**
 * Detect bcrypt hash format anomalies. We never print the hash itself; we
 * report counts and validity status only.
 */
export function analyzeBcryptHashes(records, fields) {
  const report = {};
  for (const field of fields) {
    report[field] = { presentCount: 0, validFormatCount: 0, invalidFormatCount: 0 };
  }
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const field of fields) {
      const value = record[field];
      if (value === undefined || value === null || value === '') continue;
      const entry = report[field];
      entry.presentCount += 1;
      if (isBcryptHashFormat(value)) entry.validFormatCount += 1;
      else entry.invalidFormatCount += 1;
    }
  }
  return report;
}

/**
 * Detect email casing anomalies (uppercase letters in an email the application
 * lowercases on write). We never print the offending email; we redact it.
 */
export function analyzeEmailCasing(records, field = 'email') {
  let count = 0;
  let totalNonEmpty = 0;
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const value = record[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    totalNonEmpty += 1;
    if (emailHasCasingAnomaly(trimmed)) count += 1;
  }
  return {
    field,
    totalNonEmpty,
    anomalyCount: count,
    sample: count > 0 ? redactSecret('sample') : null,
  };
}

/**
 * Analyze a JSON-blob field (e.g. pages.blocks, settings.value) for root
 * type, structural type, and byte size statistics. We do not embed the value;
 * only aggregate stats.
 *
 * For each blob field returns {
 *   rootTypeCounts: { Array|Object|String|Number|Boolean|Null: count },
 *   arrayItemCountStats: { min, max, sum, count },   // when root is array
 *   objectKeyCountStats: { min, max, sum, count },   // when root is object
 *   sizeBytesStats: { min, max, sum, count },
 *   emptyCount,
 * }
 */
export function analyzeJsonBlobs(records, fields) {
  const report = {};
  for (const field of fields) {
    report[field] = {
      rootTypeCounts: {},
      arrayItemCountStats: { min: Infinity, max: 0, sum: 0, count: 0 },
      objectKeyCountStats: { min: Infinity, max: 0, sum: 0, count: 0 },
      sizeBytesStats: { min: Infinity, max: 0, sum: 0, count: 0 },
      emptyCount: 0,
    };
  }
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const field of fields) {
      const value = record[field];
      const entry = report[field];
      if (value === undefined) continue;
      if (value === null) {
        entry.rootTypeCounts.Null = (entry.rootTypeCounts.Null || 0) + 1;
        continue;
      }
      const rootType = bsonTypeName(value);
      entry.rootTypeCounts[rootType] = (entry.rootTypeCounts[rootType] || 0) + 1;
      if (isEmptyValue(value)) {
        entry.emptyCount += 1;
      }
      const bytes = estimateJsonBytes(value);
      entry.sizeBytesStats.count += 1;
      entry.sizeBytesStats.sum += bytes;
      entry.sizeBytesStats.min = Math.min(entry.sizeBytesStats.min, bytes);
      entry.sizeBytesStats.max = Math.max(entry.sizeBytesStats.max, bytes);
      if (Array.isArray(value)) {
        entry.arrayItemCountStats.count += 1;
        entry.arrayItemCountStats.sum += value.length;
        entry.arrayItemCountStats.min = Math.min(entry.arrayItemCountStats.min, value.length);
        entry.arrayItemCountStats.max = Math.max(entry.arrayItemCountStats.max, value.length);
      } else if (typeof value === 'object') {
        const keys = Object.keys(value).length;
        entry.objectKeyCountStats.count += 1;
        entry.objectKeyCountStats.sum += keys;
        entry.objectKeyCountStats.min = Math.min(entry.objectKeyCountStats.min, keys);
        entry.objectKeyCountStats.max = Math.max(entry.objectKeyCountStats.max, keys);
      }
    }
  }
  for (const field of fields) {
    const entry = report[field];
    entry.rootTypeCounts = sortObject(entry.rootTypeCounts);
    normalizeStats(entry.arrayItemCountStats);
    normalizeStats(entry.objectKeyCountStats);
    normalizeStats(entry.sizeBytesStats);
  }
  return report;
}

function normalizeStats(s) {
  if (!Number.isFinite(s.min)) s.min = 0;
  s.avg = s.count > 0 ? Number((s.sum / s.count).toFixed(2)) : 0;
  return s;
}

/**
 * Detect ratings outside the inclusive [1, 5] integer range.
 */
export function analyzeRatings(records, fields) {
  const report = {};
  for (const field of fields) {
    report[field] = { outOfRangeCount: 0, samples: [], totalNonEmpty: 0 };
  }
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const field of fields) {
      const value = record[field];
      if (value === undefined || value === null) continue;
      const entry = report[field];
      entry.totalNonEmpty += 1;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
        entry.outOfRangeCount += 1;
        if (entry.samples.length < 5) entry.samples.push(truncate(String(value)));
      }
    }
  }
  return report;
}

/**
 * Analyze the menus collection for graph anomalies:
 *   - orphan parentId (points to a non-existent id)
 *   - self-cycle (parentId === own id)
 *   - depth > 2 (chain longer than top -> child -> grandchild)
 *
 * Returns {
 *   total, orphanCount, selfCycleCount, depthExceededCount,
 *   orphanSamples, selfCycleSamples, depthExceededSamples,
 *   maxDepthObserved,
 * }
 *
 * `parentId === null` is the canonical "top-level" marker; we never flag it.
 */
export function analyzeMenuGraph(records, parentField = 'parentId') {
  const byId = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    if (record.id === undefined || record.id === null) continue;
    byId.set(normalizeId(String(record.id)), record);
  }
  const orphanSamples = [];
  const selfCycleSamples = [];
  const depthExceededSamples = [];
  let orphanCount = 0;
  let selfCycleCount = 0;
  let depthExceededCount = 0;
  let maxDepth = 0;
  const memo = new Map();

  function depthOf(id, visited) {
    if (memo.has(id)) return memo.get(id);
    if (visited.has(id)) {
      memo.set(id, Infinity);
      return Infinity;
    }
    visited.add(id);
    const node = byId.get(id);
    if (!node) {
      memo.set(id, 0);
      return 0;
    }
    const parentRaw = node[parentField];
    if (parentRaw === undefined || parentRaw === null || parentRaw === '') {
      memo.set(id, 0);
      return 0;
    }
    const parentKey = normalizeId(String(parentRaw));
    if (parentKey === id) {
      memo.set(id, Infinity);
      return Infinity;
    }
    const parentDepth = depthOf(parentKey, visited);
    const result = parentDepth === Infinity ? Infinity : parentDepth + 1;
    memo.set(id, result);
    return result;
  }

  for (const record of byId.values()) {
    const id = normalizeId(String(record.id));
    const parentRaw = record[parentField];
    if (parentRaw === undefined || parentRaw === null || parentRaw === '') {
      continue;
    }
    const parentKey = normalizeId(String(parentRaw));
    if (parentKey === id) {
      selfCycleCount += 1;
      if (selfCycleSamples.length < 5) selfCycleSamples.push(id);
      continue;
    }
    if (!byId.has(parentKey)) {
      orphanCount += 1;
      if (orphanSamples.length < 5) orphanSamples.push({ id, parentId: parentKey });
      continue;
    }
    const visited = new Set();
    const depth = depthOf(id, visited);
    if (depth === Infinity) {
      // treat a cycle (not self) as a depth-exceeded anomaly
      depthExceededCount += 1;
      if (depthExceededSamples.length < 5) depthExceededSamples.push(id);
      if (Number.isFinite(maxDepth)) maxDepth = Infinity;
    } else {
      if (depth > MAX_MENU_DEPTH) {
        depthExceededCount += 1;
        if (depthExceededSamples.length < 5) depthExceededSamples.push({ id, depth });
      }
      if (depth > maxDepth && Number.isFinite(maxDepth)) maxDepth = depth;
    }
  }

  return {
    total: byId.size,
    maxMenuDepth: MAX_MENU_DEPTH,
    maxDepthObserved: maxDepth,
    orphanCount,
    selfCycleCount,
    depthExceededCount,
    orphanSamples,
    selfCycleSamples,
    depthExceededSamples,
  };
}

/**
 * Compute the union field-name set across the sample and per-field frequency.
 * Complements computeFieldStats but returns a simpler { name, frequency, sampleSize }
 * array.
 */
export function computeFieldFrequency(records) {
  const counts = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    for (const name of Object.keys(record)) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  const out = [];
  for (const [name, frequency] of counts.entries()) {
    out.push({ name, frequency });
  }
  out.sort((a, b) => b.frequency - a.frequency || a.name.localeCompare(b.name));
  return out;
}

/**
 * Estimate per-collection byte stats: total bytes (sum of record bytes) and
 * the largest records (id + bytes). Records without an id are reported with
 * `id: null`.
 *
 * Returns { totalBytes, sampleSize, largestRecords: [{ id, bytes }], averageBytes }
 */
export function computeByteStats(records, { topLargest = 5 } = {}) {
  let totalBytes = 0;
  const sized = [];
  for (const record of records) {
    const bytes = estimateJsonBytes(record);
    totalBytes += bytes;
    const id = record && typeof record === 'object' ? record.id : null;
    sized.push({ id: id === undefined ? null : truncate(String(id ?? '')) || null, bytes });
  }
  sized.sort((a, b) => b.bytes - a.bytes);
  const averageBytes = sized.length ? Math.round(totalBytes / sized.length) : 0;
  return {
    totalBytes,
    sampleSize: sized.length,
    averageBytes,
    largestRecords: sized.slice(0, topLargest),
  };
}

/**
 * Compute unknown-field report for a collection given the proposed schema.
 * Returns { schemaKnown, unknownFields, perRecordUnknownCount }.
 */
export function computeUnknownFields(collectionName, records) {
  const { unknown: unknownFields, schemaKnown } = findUnknownFields(
    collectionName,
    unionFieldNames(records),
  );
  let perRecordUnknownCount = 0;
  if (schemaKnown) {
    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      for (const name of Object.keys(record)) {
        if (FIELD_ALLOWLIST_FOR_MISSING.has(name)) continue;
        if (!getSchemaEntry(collectionName).fields.has(name)) {
          perRecordUnknownCount += 1;
        }
      }
    }
  }
  return { schemaKnown, unknownFields, perRecordUnknownCount };
}

function unionFieldNames(records) {
  const set = new Set();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const name of Object.keys(record)) set.add(name);
  }
  return set;
}

function truncate(value, max = 64) {
  if (typeof value !== 'string') return value;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * High-level analyzer that runs every required dimension for a collection.
 *
 * Inputs:
 *   - collectionName: string (must exist in schema map for unknown-field check)
 *   - records: array of plain JS records (sample or full)
 *   - options: { knownCtors }  (used to disambiguate BSON types in unit tests)
 *
 * Output: a plain object. Suitable for JSON.stringify.
 */
export function analyzeCollection(collectionName, records, options = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const sampleSize = safeRecords.length;
  const schema = getSchemaEntry(collectionName);
  const knownCtors = options.knownCtors;

  const result = {
    collection: collectionName,
    sampleSize,
    schemaKnown: Boolean(schema),
    fieldStats: fieldStatsToJson(computeFieldStats(safeRecords, { knownCtors }), sampleSize),
    fieldFrequency: computeFieldFrequency(safeRecords),
    idUniqueness: analyzeIdUniqueness(safeRecords),
    idUuidValidity: schema?.idKind === 'uuid' ? analyzeIdUuidValidity(safeRecords) : null,
    unknownFields: computeUnknownFields(collectionName, safeRecords),
    timestampAnomalies: schema
      ? analyzeTimestamps(safeRecords, [...schema.timestampFields, ...schema.dateOnlyFields])
      : {},
    integerOverflow: schema ? analyzeIntegerOverflow(safeRecords, [...schema.integerFields]) : {},
    ratingAnomalies: schema ? analyzeRatings(safeRecords, [...schema.ratingFields]) : {},
    bcryptHashes: schema ? analyzeBcryptHashes(safeRecords, [...schema.bcryptFields]) : {},
    jsonBlobs: schema ? analyzeJsonBlobs(safeRecords, [...schema.jsonBlobFields]) : {},
    byteStats: computeByteStats(safeRecords),
  };

  // Collection-specific dimensions.
  if (collectionName === 'users') {
    result.emailDuplicates = analyzeEmailDuplicates(safeRecords, 'email');
    result.emailCasing = analyzeEmailCasing(safeRecords, 'email');
  }
  if (collectionName === 'pages') {
    result.slugDuplicates = analyzeNaturalKeyDuplicates(safeRecords, ['slug']);
  }
  if (collectionName === 'settings') {
    result.keyDuplicates = analyzeNaturalKeyDuplicates(safeRecords, ['key']);
  }
  if (collectionName === 'analytics') {
    result.datePathDuplicates = analyzeNaturalKeyDuplicates(safeRecords, ['date', 'path']);
  }
  if (collectionName === 'menus' && schema?.menuParentField) {
    result.menuGraph = analyzeMenuGraph(safeRecords, schema.menuParentField);
  }

  return result;
}

/**
 * Convenience helper to summarize the analysis for the report header (so the
 * markdown can show "X anomalies" without recomputing). Pure function.
 */
export function countAnomalies(analysis) {
  if (!analysis) return 0;
  let n = 0;
  n += analysis.idUniqueness?.duplicateCount || 0;
  n += analysis.idUniqueness?.missingCount || 0;
  if (analysis.idUuidValidity) {
    n += analysis.idUuidValidity.notUuidCount || 0;
    n += analysis.idUuidValidity.nonV4Count || 0;
  }
  n += analysis.unknownFields?.perRecordUnknownCount || 0;
  if (analysis.emailDuplicates) n += analysis.emailDuplicates.duplicateCount;
  if (analysis.emailCasing) n += analysis.emailCasing.anomalyCount;
  if (analysis.slugDuplicates) n += analysis.slugDuplicates.duplicateCount;
  if (analysis.keyDuplicates) n += analysis.keyDuplicates.duplicateCount;
  if (analysis.datePathDuplicates) n += analysis.datePathDuplicates.duplicateCount;
  if (analysis.menuGraph) {
    n += analysis.menuGraph.orphanCount;
    n += analysis.menuGraph.selfCycleCount;
    n += analysis.menuGraph.depthExceededCount;
  }
  for (const field of Object.keys(analysis.timestampAnomalies || {})) {
    n += analysis.timestampAnomalies[field].invalidCount || 0;
  }
  for (const field of Object.keys(analysis.integerOverflow || {})) {
    n += analysis.integerOverflow[field].overflowCount || 0;
  }
  for (const field of Object.keys(analysis.ratingAnomalies || {})) {
    n += analysis.ratingAnomalies[field].outOfRangeCount || 0;
  }
  for (const field of Object.keys(analysis.bcryptHashes || {})) {
    n += analysis.bcryptHashes[field].invalidFormatCount || 0;
  }
  return n;
}
