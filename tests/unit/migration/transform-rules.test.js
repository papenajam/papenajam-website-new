// Unit tests for the migration transform-rules engine (Task 3).
//
// Covers:
//   - empty/optional date -> null
//   - date-only YYYY-MM-DD round-trip WITHOUT timezone shift
//   - ISO timestamp normalization (with/without ms, Date input, epoch ms)
//   - integer coercion + overflow handling (Int32 bounds)
//   - JSON round-trip (preserves blocks / settings / arrays)
//   - unknown-field -> PENDING error
//   - _id -> PENDING error
//   - rating field -> PENDING error
//   - PENDING rule raises a clear error naming anomaly + collection + decision
//   - document-level transform collects / throws per options
//
// All tests use the host's default timezone for the timezone-shift assertion:
// formatDateOnly must use UTC components regardless of host TZ, so we run the
// test by setting TZ=Asia/Jakarta (UTC+7) at the top of the file via
// `process.env.TZ` and re-checking — see the date-only describe block.

import { describe, expect, test } from 'vitest';
import {
  PENDING_RULES,
  TransformPendingError,
  TransformRejectedError,
  coerceInteger,
  evaluatePendingRule,
  formatDateOnly,
  listPendingRules,
  parseDateOnly,
  normalizeTimestamp,
  roundTripJson,
  transformDocument,
  transformFieldValue,
} from '../../../scripts/migration/transform-rules.mjs';

// Force a non-UTC timezone so that any local-time bug in formatDateOnly would
// be detected. We restore nothing because vitest runs each file in its own
// process; setting this once at import time is the documented Vitest pattern.
process.env.TZ = 'Asia/Jakarta'; // UTC+7

describe('transform-rules: parseDateOnly (empty/optional -> null)', () => {
  test('undefined / null / empty / whitespace -> null', () => {
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('   ')).toBeNull();
  });

  test('rejects malformed strings instead of guessing', () => {
    expect(() => parseDateOnly('January 1st 2024', 'publishDate', 'news')).toThrow(TransformRejectedError);
    expect(() => parseDateOnly('2024-1-1', 'publishDate', 'news')).toThrow(TransformRejectedError);
    expect(() => parseDateOnly('2024/01/01', 'publishDate', 'news')).toThrow(TransformRejectedError);
    expect(() => parseDateOnly(20240101, 'publishDate', 'news')).toThrow(TransformRejectedError);
  });
});

describe('transform-rules: date-only round-trip without timezone shift', () => {
  test('parseDateOnly builds a UTC midnight Date', () => {
    const d = parseDateOnly('2024-03-15');
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(2); // March
    expect(d.getUTCDate()).toBe(15);
  });

  test('formatDateOnly(parseDateOnly(s)) === s for any YYYY-MM-DD', () => {
    const samples = ['2024-01-01', '2024-12-31', '1999-06-15', '2026-02-28', '1700-11-30'];
    for (const s of samples) {
      expect(formatDateOnly(parseDateOnly(s))).toBe(s);
    }
  });

  test('formatDateOnly uses UTC components (no shift in Asia/Jakarta TZ)', () => {
    // In Asia/Jakarta (UTC+7), a naive `new Date('2024-03-15')` is parsed as
    // UTC midnight, but formatting with getFullYear()/getMonth()/getDate() at
    // 00:00Z yields 2024-03-15T07:00+07 = "2024-03-15" by luck. The shift
    // becomes visible at the END of day. We assert against the end-of-day
    // boundary explicitly to catch any local-component bug.
    const d = new Date(Date.UTC(2024, 2, 15, 23, 59, 59)); // 2024-03-15T23:59:59Z
    // Local components in UTC+7 are 2024-03-16T06:59:59+07; a buggy impl would
    // return 2024-03-16 here. UTC impl must return 2024-03-15.
    expect(formatDateOnly(d)).toBe('2024-03-15');
  });

  test('formatDateOnly returns null for null/undefined and rejects bad inputs', () => {
    expect(formatDateOnly(null)).toBeNull();
    expect(formatDateOnly(undefined)).toBeNull();
    expect(() => formatDateOnly('2024-03-15')).toThrow(TransformRejectedError);
    expect(() => formatDateOnly(new Date('invalid'))).toThrow(TransformRejectedError);
  });
});

describe('transform-rules: parseDateOnly rejects calendar-invalid dates (C1)', () => {
  // C1: the YYYY-MM-DD regex only checks digit pattern. Date.UTC silently rolls
  // out-of-range components (Feb 30 -> Mar 1, month 13 -> next year Jan, etc.)
  // instead of failing. parseDateOnly must detect the rollover and REJECT.
  test('rejects 2024-02-30 (would silently roll to 2024-03-01)', () => {
    expect(() => parseDateOnly('2024-02-30', 'publishDate', 'news')).toThrow(TransformRejectedError);
    try {
      parseDateOnly('2024-02-30', 'publishDate', 'news');
    } catch (err) {
      expect(err).toBeInstanceOf(TransformRejectedError);
      expect(err.field).toBe('publishDate');
      expect(err.collection).toBe('news');
      expect(err.reason).toMatch(/calendar|rollover/i);
    }
  });

  test('rejects 2024-13-01 (month 13 would roll to 2025-01-01)', () => {
    expect(() => parseDateOnly('2024-13-01', 'publishDate', 'news')).toThrow(TransformRejectedError);
  });

  test('rejects 0000-00-00 (zero year/month/day all invalid)', () => {
    expect(() => parseDateOnly('0000-00-00', 'publishDate', 'news')).toThrow(TransformRejectedError);
  });

  test('rejects 2023-02-29 (2023 is not a leap year)', () => {
    expect(() => parseDateOnly('2023-02-29', 'publishDate', 'news')).toThrow(TransformRejectedError);
  });

  test('rejects 2024-04-31 (April has 30 days)', () => {
    expect(() => parseDateOnly('2024-04-31', 'publishDate', 'news')).toThrow(TransformRejectedError);
  });

  test('valid calendar dates still round-trip after the C1 fix', () => {
    // Leap-day and month-end boundary: must still pass.
    const samples = ['2024-02-29', '2024-12-31', '2024-01-31', '2024-04-30', '2026-02-28'];
    for (const s of samples) {
      expect(formatDateOnly(parseDateOnly(s))).toBe(s);
    }
  });
});

describe('transform-rules: normalizeTimestamp', () => {
  test('null / empty -> null', () => {
    expect(normalizeTimestamp(null)).toBeNull();
    expect(normalizeTimestamp(undefined)).toBeNull();
    expect(normalizeTimestamp('')).toBeNull();
    expect(normalizeTimestamp('   ')).toBeNull();
  });

  test('normalizes ISO string with milliseconds (already canonical)', () => {
    expect(normalizeTimestamp('2024-01-01T00:00:00.000Z')).toBe('2024-01-01T00:00:00.000Z');
  });

  test('normalizes ISO string without milliseconds to canonical with .000', () => {
    expect(normalizeTimestamp('2024-01-01T12:34:56Z')).toBe('2024-01-01T12:34:56.000Z');
  });

  test('accepts JS Date and returns toISOString()', () => {
    const d = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
    expect(normalizeTimestamp(d)).toBe('2024-01-01T00:00:00.000Z');
  });

  test('accepts integer epoch ms in safe range', () => {
    const ms = Date.UTC(2024, 0, 1, 0, 0, 0);
    expect(normalizeTimestamp(ms)).toBe('2024-01-01T00:00:00.000Z');
  });

  test('rejects invalid Date', () => {
    expect(() => normalizeTimestamp(new Date('invalid'), 'createdAt', 'news')).toThrow(TransformRejectedError);
  });

  test('rejects non-ISO strings (including date-only) so owner decides', () => {
    expect(() => normalizeTimestamp('January 1st 2024', 'createdAt', 'news')).toThrow(TransformRejectedError);
    expect(() => normalizeTimestamp('2024-01-01', 'createdAt', 'news')).toThrow(TransformRejectedError);
    expect(() => normalizeTimestamp('yesterday', 'createdAt', 'news')).toThrow(TransformRejectedError);
  });

  test('rejects unsafe epoch ms', () => {
    const tooBig = Number.MAX_SAFE_INTEGER + 1;
    expect(() => normalizeTimestamp(tooBig, 'createdAt', 'news')).toThrow(TransformRejectedError);
  });

  test('rejects non-numeric / non-string types', () => {
    expect(() => normalizeTimestamp(true, 'createdAt', 'news')).toThrow(TransformRejectedError);
    expect(() => normalizeTimestamp({}, 'createdAt', 'news')).toThrow(TransformRejectedError);
  });

  test('C1: rejects ISO timestamps with out-of-range hour/min/sec that the regex admits', () => {
    // 2024-01-01T25:00:00Z matches the regex (\d{2}) but is not a valid time.
    // `new Date(...)` returns Invalid Date; previously this leaked as a
    // RangeError from toISOString() instead of TransformRejectedError.
    expect(() => normalizeTimestamp('2024-01-01T25:00:00Z', 'createdAt', 'news')).toThrow(TransformRejectedError);
    expect(() => normalizeTimestamp('2024-01-01T00:61:00Z', 'createdAt', 'news')).toThrow(TransformRejectedError);
    expect(() => normalizeTimestamp('2024-01-01T00:00:61Z', 'createdAt', 'news')).toThrow(TransformRejectedError);
    try {
      normalizeTimestamp('2024-01-01T25:00:00Z', 'createdAt', 'news');
    } catch (err) {
      expect(err).toBeInstanceOf(TransformRejectedError);
      expect(err.field).toBe('createdAt');
      expect(err.collection).toBe('news');
    }
  });

  test('C1: rejects ISO timestamps whose date component would silently roll', () => {
    // 2024-02-30T00:00:00Z matches the regex; new Date(...) rolls to 2024-03-01.
    expect(() => normalizeTimestamp('2024-02-30T00:00:00Z', 'createdAt', 'news')).toThrow(TransformRejectedError);
    // 2024-13-01T00:00:00Z matches the regex; new Date(...) is Invalid Date.
    expect(() => normalizeTimestamp('2024-13-01T00:00:00Z', 'createdAt', 'news')).toThrow(TransformRejectedError);
  });

  test('C1: valid ISO timestamps still pass after the component round-trip check', () => {
    // Leap-day and end-of-day boundaries that previously passed must keep passing.
    expect(normalizeTimestamp('2024-02-29T23:59:59Z', 'createdAt', 'news')).toBe('2024-02-29T23:59:59.000Z');
    expect(normalizeTimestamp('2024-12-31T23:59:59.999Z', 'createdAt', 'news')).toBe('2024-12-31T23:59:59.999Z');
    expect(normalizeTimestamp('2024-01-01T00:00:00Z', 'createdAt', 'news')).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('transform-rules: coerceInteger', () => {
  test('null / undefined -> null', () => {
    expect(coerceInteger(null)).toBeNull();
    expect(coerceInteger(undefined)).toBeNull();
  });

  test('accepts integers within Int32 bounds', () => {
    expect(coerceInteger(0)).toBe(0);
    expect(coerceInteger(42)).toBe(42);
    expect(coerceInteger(-42)).toBe(-42);
    expect(coerceInteger(2147483647)).toBe(2147483647);
    expect(coerceInteger(-2147483648)).toBe(-2147483648);
  });

  test('rejects integer overflow beyond Int32', () => {
    expect(() => coerceInteger(2147483648, 'views', 'analytics')).toThrow(TransformRejectedError);
    expect(() => coerceInteger(-2147483649, 'views', 'analytics')).toThrow(TransformRejectedError);
    expect(() => coerceInteger(5000000000, 'size', 'media')).toThrow(TransformRejectedError);
  });

  test('rejects non-integer numbers', () => {
    expect(() => coerceInteger(3.14, 'views', 'analytics')).toThrow(TransformRejectedError);
    expect(() => coerceInteger(NaN, 'views', 'analytics')).toThrow(TransformRejectedError);
    expect(() => coerceInteger(Infinity, 'views', 'analytics')).toThrow(TransformRejectedError);
  });

  test('rejects bigint (deferred to BigInt-column decision)', () => {
    expect(() => coerceInteger(5000000000n, 'size', 'media')).toThrow(TransformRejectedError);
  });

  test('rejects numeric strings and other types (do not guess base)', () => {
    expect(() => coerceInteger('42', 'views', 'analytics')).toThrow(TransformRejectedError);
    expect(() => coerceInteger('010', 'views', 'analytics')).toThrow(TransformRejectedError);
    expect(() => coerceInteger(true, 'views', 'analytics')).toThrow(TransformRejectedError);
  });

  test('honors custom bounds', () => {
    expect(coerceInteger(50, 'rating', 'x', { max: 100, min: 0 })).toBe(50);
    expect(() => coerceInteger(150, 'rating', 'x', { max: 100, min: 0 })).toThrow(TransformRejectedError);
  });
});

describe('transform-rules: roundTripJson', () => {
  test('null / undefined -> null', () => {
    expect(roundTripJson(null)).toBeNull();
    expect(roundTripJson(undefined)).toBeNull();
  });

  test('round-trips arrays and objects unchanged', () => {
    const blocks = [
      { id: 'b1', type: 'hero', settings: { title: 'A', count: 3 } },
      { id: 'b2', type: 'stats', settings: { items: [1, 2, 3] } },
    ];
    expect(roundTripJson(blocks)).toBe(blocks); // same reference, validated
    expect(roundTripJson({ nested: { deep: [1, 2, 3] } })).toEqual({ nested: { deep: [1, 2, 3] } });
    expect(roundTripJson('plain string')).toBe('plain string');
    expect(roundTripJson(42)).toBe(42);
    expect(roundTripJson(true)).toBe(true);
  });

  test('round-trips settings.value blobs (object + array + scalar)', () => {
    expect(roundTripJson({ a: 1, b: [1, 2] })).toEqual({ a: 1, b: [1, 2] });
    expect(roundTripJson([1, 2, 3])).toEqual([1, 2, 3]);
    expect(roundTripJson('string-blob')).toBe('string-blob');
  });

  test('rejects values with nested undefined (silent mutation would occur)', () => {
    const bad = { a: 1, b: undefined };
    expect(() => roundTripJson(bad, 'blocks', 'pages')).toThrow(TransformRejectedError);
  });

  test('rejects functions and symbols', () => {
    expect(() => roundTripJson({ fn: () => 1 }, 'blocks', 'pages')).toThrow(TransformRejectedError);
    expect(() => roundTripJson({ s: Symbol('x') }, 'blocks', 'pages')).toThrow(TransformRejectedError);
  });

  test('rejects circular references', () => {
    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    expect(() => roundTripJson(cyclic, 'blocks', 'pages')).toThrow(TransformRejectedError);
  });
});

describe('transform-rules: transformFieldValue routing + unknown-field PENDING', () => {
  test('date-only field routes through parseDateOnly', () => {
    const r = transformFieldValue('news', 'publishDate', '2024-03-15');
    expect(r.applied).toBe('date-only');
    expect(formatDateOnly(r.value)).toBe('2024-03-15');
  });

  test('timestamp field routes through normalizeTimestamp', () => {
    const r = transformFieldValue('news', 'createdAt', '2024-01-01T00:00:00Z');
    expect(r.applied).toBe('timestamp');
    expect(r.value).toBe('2024-01-01T00:00:00.000Z');
  });

  test('integer field routes through coerceInteger', () => {
    const r = transformFieldValue('analytics', 'views', 42);
    expect(r.applied).toBe('integer');
    expect(r.value).toBe(42);
  });

  test('json-blob field routes through roundTripJson (preserves reference)', () => {
    const blocks = [{ id: 'b1', type: 'hero' }];
    const r = transformFieldValue('pages', 'blocks', blocks);
    expect(r.applied).toBe('json-blob');
    expect(r.value).toBe(blocks);
  });

  test('M2: settings.value routes through as identity (text), NOT json-blob', () => {
    // Per plan line 33, settings.value stays text. Even when the value happens
    // to be a JSON-looking string (e.g. footer_links), it is carried verbatim.
    const r = transformFieldValue('settings', 'value', '{"links":["/a","/b"]}');
    expect(r.applied).toBe('identity');
    expect(r.value).toBe('{"links":["/a","/b"]}');
  });

  test('M2: a JSON-object value in settings.value is still identity (not round-trip validated)', () => {
    // Even if a caller hands a real object, the schema map says settings.value
    // is text; we do not run the JSON round-trip walker on it. This pins the
    // schema-map decision so a future revert (re-adding value to jsonBlobFields)
    // is caught.
    const v = { nested: { deep: [1, 2, 3] } };
    const r = transformFieldValue('settings', 'value', v);
    expect(r.applied).toBe('identity');
    expect(r.value).toBe(v);
  });

  test('bcrypt field passes through as identity-bcrypt', () => {
    const r = transformFieldValue('users', 'password', '$2a$10$abc');
    expect(r.applied).toBe('identity-bcrypt');
    expect(r.value).toBe('$2a$10$abc');
  });

  test('ordinary string field passes through as identity', () => {
    const r = transformFieldValue('news', 'title', 'Hello');
    expect(r.applied).toBe('identity');
    expect(r.value).toBe('Hello');
  });

  test('unknown field raises PENDING error naming anomaly + collection + decision', () => {
    expect(() => transformFieldValue('news', 'rogueField', true)).toThrow(TransformPendingError);
    try {
      transformFieldValue('news', 'rogueField', true);
    } catch (err) {
      expect(err).toBeInstanceOf(TransformPendingError);
      expect(err.anomaly).toBe('unknown-field');
      expect(err.collection).toBe('news');
      expect(err.field).toBe('rogueField');
      expect(err.decision).toMatch(/map to typed column|legacy JSON|fix-at-source|quarantine/);
      // Message must surface all three: anomaly, collection, decision.
      expect(err.message).toContain('anomaly=unknown-field');
      expect(err.message).toContain('collection=news');
      expect(err.message).toContain('field=rogueField');
      expect(err.message).toContain('decision=');
    }
  });

  test('_id raises PENDING error (not silent drop)', () => {
    expect(() => transformFieldValue('news', '_id', '65a1f0c0f1d2e3a4b5c6d7e8')).toThrow(TransformPendingError);
    try {
      transformFieldValue('news', '_id', '65a1f0c0f1d2e3a4b5c6d7e8');
    } catch (err) {
      expect(err.anomaly).toBe('mongo-_id-compat');
      expect(err.collection).toBe('news');
      expect(err.decision).toMatch(/_id/);
    }
  });

  test('I1: non-UUID id on a uuid-kind collection raises id-uuid-vs-text PENDING', () => {
    expect(() => transformFieldValue('news', 'id', 'not-a-uuid')).toThrow(TransformPendingError);
    try {
      transformFieldValue('news', 'id', 'not-a-uuid');
    } catch (err) {
      expect(err).toBeInstanceOf(TransformPendingError);
      expect(err.anomaly).toBe('id-uuid-vs-text');
      expect(err.collection).toBe('news');
      expect(err.field).toBe('id');
      expect(err.decision).toMatch(/UUID|text/i);
    }
  });

  test('I1: valid v4 UUID id on a uuid-kind collection passes as identity', () => {
    const r = transformFieldValue('news', 'id', '10000000-0000-4000-8000-000000000001');
    expect(r.applied).toBe('identity');
    expect(r.value).toBe('10000000-0000-4000-8000-000000000001');
  });

  test('I1: non-v4 UUID (e.g. v1) also raises id-uuid-vs-text PENDING', () => {
    // The app generates v4 UUIDs; legacy v1 UUIDs are anomalous.
    const v1 = 'b8a85d80-11c0-11d1-80b4-00c04fd430c8'; // classic v1 UUID
    expect(() => transformFieldValue('news', 'id', v1)).toThrow(TransformPendingError);
    try {
      transformFieldValue('news', 'id', v1);
    } catch (err) {
      expect(err.anomaly).toBe('id-uuid-vs-text');
    }
  });

  test('I1: non-canonical UUID (no hyphens) raises id-uuid-vs-text PENDING', () => {
    expect(() => transformFieldValue('news', 'id', '1000000000004000800000000000000')).toThrow(TransformPendingError);
  });

  test('rating field: valid integer 1..5 passes as identity-rating; out-of-range / non-integer raises PENDING', () => {
    // Valid 1..5 integers pass through unchanged (I2).
    for (const v of [1, 2, 3, 4, 5]) {
      const r = transformFieldValue('survey_responses', 'rating', v);
      expect(r.applied).toBe('identity-rating');
      expect(r.value).toBe(v);
    }
    // Out-of-range / non-integer raise PENDING with the rating-out-of-range anomaly.
    for (const bad of [0, 6, 7, -1, 3.5, NaN, Infinity, '3', true]) {
      expect(() => transformFieldValue('survey_responses', 'rating', bad)).toThrow(TransformPendingError);
      try {
        transformFieldValue('survey_responses', 'rating', bad);
      } catch (err) {
        expect(err.anomaly).toBe('rating-out-of-range');
        expect(err.collection).toBe('survey_responses');
        expect(err.decision).toMatch(/1.*5/);
      }
    }
  });

  test('unknown collection raises PENDING error', () => {
    expect(() => transformFieldValue('mystery', 'id', 'x')).toThrow(TransformPendingError);
  });
});

describe('transform-rules: transformDocument', () => {
  test('transforms a well-formed news document end-to-end', () => {
    const doc = {
      id: '10000000-0000-4000-8000-000000000001',
      title: 'Hello',
      content: 'body',
      author: 'Admin',
      category: 'umum',
      isPublished: true,
      publishDate: '2024-03-15',
      summary: '',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    };
    const { output, applied, errors } = transformDocument('news', doc);
    expect(errors).toEqual([]);
    expect(formatDateOnly(output.publishDate)).toBe('2024-03-15');
    expect(output.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(output.updatedAt).toBe('2024-01-02T00:00:00.000Z');
    expect(output.title).toBe('Hello');
    expect(output.isPublished).toBe(true);
    expect(applied.publishDate).toBe('date-only');
    expect(applied.createdAt).toBe('timestamp');
    expect(applied.title).toBe('identity');
  });

  test('collects PENDING errors and omits offending fields (onPending: collect is opt-in)', () => {
    // I3: the default is now 'throw', so a caller that wants to collect MUST
    // pass onPending: 'collect' explicitly AND inspect result.errors.
    const doc = {
      id: '10000000-0000-4000-8000-000000000001',
      title: 'Hello',
      rogueField: 'oops',
      _id: '65a1f0c0f1d2e3a4b5c6d7e8',
    };
    const { output, errors } = transformDocument('news', doc, { onPending: 'collect' });
    expect(Object.keys(output).sort()).toEqual(['id', 'title']);
    expect(errors).toHaveLength(2);
    const anomalies = errors.map((e) => e.anomaly).sort();
    expect(anomalies).toEqual(['mongo-_id-compat', 'unknown-field']);
    for (const e of errors) expect(e.kind).toBe('pending');
  });

  test('onPending defaults to throw (no option passed)', () => {
    // I3: the default is 'throw', so a caller that forgets the option fails
    // loudly instead of silently producing a document with missing fields.
    const doc = {
      id: '10000000-0000-4000-8000-000000000001',
      rogueField: 'oops',
    };
    expect(() => transformDocument('news', doc)).toThrow(TransformPendingError);
  });

  test('onPending:throw aborts the whole document on first PENDING', () => {
    const doc = {
      id: '10000000-0000-4000-8000-000000000001',
      rogueField: 'oops',
    };
    expect(() => transformDocument('news', doc, { onPending: 'throw' })).toThrow(TransformPendingError);
  });

  test('onRejected:throw aborts on first hard rejection', () => {
    const doc = {
      id: '10000000-0000-4000-8000-000000000001',
      publishDate: 'January 1st 2024', // malformed -> REJECTED
    };
    expect(() => transformDocument('news', doc, { onRejected: 'throw' })).toThrow(TransformRejectedError);
  });

  test('does not mutate the input document', () => {
    const doc = {
      id: '10000000-0000-4000-8000-000000000001',
      title: 'Hello',
      publishDate: '2024-03-15',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const snapshot = JSON.parse(JSON.stringify(doc));
    transformDocument('news', doc);
    expect(doc).toEqual(snapshot);
  });

  test('rejects non-object document', () => {
    expect(() => transformDocument('news', null)).toThrow(TransformRejectedError);
    expect(() => transformDocument('news', [1, 2])).toThrow(TransformRejectedError);
  });

  test('rejects unknown collection up front', () => {
    expect(() => transformDocument('mystery', { id: 'x' })).toThrow(TransformPendingError);
  });

  test('I1: document-level missing-id raises PENDING missing-id (default throw)', () => {
    // news has idKind: 'uuid'; a document without a usable id cannot satisfy a
    // non-null @id column. transformDocument surfaces this at the doc level
    // because transformFieldValue only runs on PRESENT fields.
    expect(() => transformDocument('news', { title: 'Hello' })).toThrow(TransformPendingError);
    try {
      transformDocument('news', { title: 'Hello' });
    } catch (err) {
      expect(err.anomaly).toBe('missing-id');
      expect(err.field).toBe('id');
      expect(err.collection).toBe('news');
    }
  });

  test('I1: document-level missing-id is collected when onPending: collect', () => {
    const { output, errors } = transformDocument('news', { title: 'Hello' }, { onPending: 'collect' });
    expect(errors).toHaveLength(1);
    expect(errors[0].anomaly).toBe('missing-id');
    expect(errors[0].field).toBe('id');
    // The title field still passes through; the importer MUST abort because
    // errors.length > 0 (output has no id).
    expect(output.title).toBe('Hello');
    expect(output.id).toBeUndefined();
  });

  test('I1: empty-string id is treated as missing-id at the document level', () => {
    expect(() => transformDocument('news', { id: '', title: 'Hello' })).toThrow(TransformPendingError);
    const { errors } = transformDocument('news', { id: '', title: 'Hello' }, { onPending: 'collect' });
    expect(errors.some((e) => e.anomaly === 'missing-id')).toBe(true);
  });

  test('I1: static-idKind collection also surfaces missing-id', () => {
    // survey_config has idKind: 'static'.
    expect(() => transformDocument('survey_config', { isActive: true }, { onPending: 'throw' })).toThrow(TransformPendingError);
  });

  test('I1: idKind:none collection (analytics) does NOT surface missing-id', () => {
    // analytics has idKind: 'none' — no id column, so missing-id is irrelevant.
    const { errors } = transformDocument('analytics', {
      date: '2024-01-01', path: '/', views: 1,
    }, { onPending: 'collect' });
    expect(errors.some((e) => e.anomaly === 'missing-id')).toBe(false);
  });
});

describe('transform-rules: secret-field redaction in error messages (M1)', () => {
  test('M1: TransformPendingError on a secret field does not leak the value into the message', () => {
    // Force a PENDING on the password field by using an unknown bcrypt format
    // is NOT a PENDING path; instead we use the unknown-field path by routing
    // through a collection whose schema does not list 'password' as a known
    // field — but users does. The simplest deterministic way to raise a
    // PENDING whose field is 'password' is evaluatePendingRule.
    try {
      evaluatePendingRule('invalid-bcrypt-hash', {
        collection: 'users',
        field: 'password',
        value: '$9$99$sup3r$secret-hash-value-that-must-not-leak',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TransformPendingError);
      expect(err.field).toBe('password');
      // Message must NOT contain the raw secret value.
      expect(err.message).not.toContain('sup3r');
      expect(err.message).not.toContain('secret-hash-value');
      expect(err.message).toMatch(/sample=<redacted>/);
      // Structured sampleValue must also be redacted for secret fields so a
      // downstream serializer cannot leak it.
      expect(err.sampleValue).toBe('<redacted>');
    }
  });

  test('M1: TransformRejectedError on a secret field does not leak the value', () => {
    // We synthesize a rejection by feeding a non-string to a bcrypt field's
    // downstream check — but the simplest path is to construct the error
    // directly via the public class.
    const err = new TransformRejectedError({
      reason: 'test',
      collection: 'users',
      field: 'password',
      sampleValue: 'leaking-bcrypt-hash-$2a$10$abcdef',
    });
    expect(err.message).not.toContain('abcdef');
    expect(err.message).toMatch(/sample=<redacted>/);
    expect(err.sampleValue).toBe('<redacted>');
  });

  test('M1: non-secret field still renders the sample value (regression guard)', () => {
    try {
      evaluatePendingRule('mongo-_id-compat', {
        collection: 'news',
        field: '_id',
        value: '65a1f0c0f1d2e3a4b5c6d7e8',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.message).toContain('65a1f0c0f1d2e3a4b5c6d7e8');
    }
  });
});

describe('transform-rules: PENDING registry + evaluatePendingRule', () => {
  test('listPendingRules returns a stable, well-formed array', () => {
    const list = listPendingRules();
    expect(list.length).toBeGreaterThan(0);
    for (const r of list) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.anomaly).toBe('string');
      expect(typeof r.decision).toBe('string');
      expect(r.decision.length).toBeGreaterThan(10);
      expect([
        'map-to-typed-column',
        'legacy-json-field',
        'fix-at-source',
        'reject-quarantine',
      ]).toContain(r.defaultOnceResolved);
    }
    // Sorted.
    const ids = list.map((r) => r.id);
    expect([...ids].sort()).toEqual(ids);
  });

  test('expected rule ids are present', () => {
    const ids = Object.keys(PENDING_RULES);
    expect(ids).toContain('mongo-_id-compat');
    expect(ids).toContain('id-uuid-vs-text');
    expect(ids).toContain('duplicate-id');
    expect(ids).toContain('duplicate-natural-key');
    expect(ids).toContain('missing-id');
    expect(ids).toContain('rating-out-of-range');
    expect(ids).toContain('integer-overflow');
    expect(ids).toContain('unknown-field');
    expect(ids).toContain('menu-graph-anomaly');
    expect(ids).toContain('invalid-bcrypt-hash');
    expect(ids).toContain('email-casing-anomaly');
    expect(ids).toContain('mixed-type-field');
  });

  test('evaluatePendingRule raises clear error naming anomaly + collection + decision', () => {
    try {
      evaluatePendingRule('unknown-field', { collection: 'news', field: 'rogueField' });
      throw new Error('expected evaluatePendingRule to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TransformPendingError);
      expect(err.anomaly).toBe('unknown-field');
      expect(err.collection).toBe('news');
      expect(err.field).toBe('rogueField');
      expect(err.decision).toMatch(/map to typed column|legacy JSON|fix-at-source|quarantine/);
      // The plain-text message must surface everything an operator needs.
      expect(err.message).toContain('PENDING transform rule');
      expect(err.message).toContain('anomaly=unknown-field');
      expect(err.message).toContain('collection=news');
      expect(err.message).toContain('field=rogueField');
      expect(err.message).toContain('decision=');
    }
  });

  test('evaluatePendingRule surfaces sample value when provided', () => {
    try {
      evaluatePendingRule('mongo-_id-compat', {
        collection: 'news',
        field: '_id',
        value: '65a1f0c0f1d2e3a4b5c6d7e8',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.message).toContain('65a1f0c0f1d2e3a4b5c6d7e8');
    }
  });

  test('evaluatePendingRule rejects unknown rule id', () => {
    expect(() => evaluatePendingRule('not-a-real-rule', { collection: 'news' })).toThrow(TransformPendingError);
  });

  test('evaluatePendingRule returns strategy only when explicitly resolved + valid', () => {
    const s = evaluatePendingRule(
      'unknown-field',
      { collection: 'news', field: 'rogueField' },
      { resolved: true, strategy: 'legacy-json-field' },
    );
    expect(s).toBe('legacy-json-field');
  });

  test('evaluatePendingRule rejects invalid strategy even when resolved=true', () => {
    expect(() =>
      evaluatePendingRule(
        'unknown-field',
        { collection: 'news', field: 'rogueField' },
        { resolved: true, strategy: 'silently-drop' },
      ),
    ).toThrow(TransformPendingError);
  });
});

describe('transform-rules: regression — profile fixtures', () => {
  // Sanity-check the engine against the same in-memory fixtures used by the
  // Task 2 profiler tests. The point is to prove the engine behaves on the
  // shapes the profiler actually reports.
  test('news document with date-only publishDate round-trips', () => {
    const doc = {
      id: '10000000-0000-4000-8000-000000000001',
      title: 'T',
      content: 'C',
      author: 'A',
      category: 'umum',
      isPublished: true,
      publishDate: '2024-01-01',
      summary: '',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const { output, errors } = transformDocument('news', doc);
    expect(errors).toEqual([]);
    expect(formatDateOnly(output.publishDate)).toBe('2024-01-01');
  });

  test('analytics row with int32 views is accepted; overflow row surfaces PENDING at the rule level', () => {
    const ok = transformFieldValue('analytics', 'views', 5);
    expect(ok.applied).toBe('integer');
    expect(ok.value).toBe(5);
    // Overflow is caught by coerceInteger as REJECTED (we know deterministically
    // it exceeds Int32). The PENDING rule exists so the owner can pick the
    // strategy (BigInt column vs reject vs fix-at-source) once the full
    // profile is in.
    expect(() => transformFieldValue('analytics', 'views', 2147483648)).toThrow(TransformRejectedError);
    expect(() =>
      evaluatePendingRule('integer-overflow', { collection: 'analytics', field: 'views', value: 2147483648 }),
    ).toThrow(TransformPendingError);
  });
});
