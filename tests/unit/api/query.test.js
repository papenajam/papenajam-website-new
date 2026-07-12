// Unit tests for lib/api/query.js (Task 6).
//
// Covers the REQUIRED test cases from plan lines 540-548 + plan line 286:
//   - parsePagination preserves current endpoint defaults per collection
//     (news=10, agenda=20, media=30, gallery=50, complaints=20, etc.)
//   - page/limit NaN falls back to defaults (matches legacy Mongo handlers'
//     `parseInt(x || 'default')` behaviour for valid input)
//   - page < 1 and limit < 1 clamp to >= 1 so Prisma `skip`/`take` never go
//     negative (stabilises garbage input that previously crashed Mongo)
//   - skip = (page - 1) * limit and take = limit for Prisma findMany
//   - media sort allowlist: arbitrary user input never reaches Prisma
//     orderBy; unknown fields fall back to createdAt; sortDir 'asc' is the
//     only way to get ascending order
//   - unregistered collection -> fail-loud (prevents silent wrong defaults)

import { describe, expect, test } from 'vitest';
import {
  DEFAULT_LIMITS,
  DEFAULT_MEDIA_SORT,
  MEDIA_SORT_FIELDS,
  mediaOrderBy,
  mediaOrderByFromQuery,
  paginationEnvelope,
  parsePagination,
} from '../../../lib/api/query.js';

function params(obj) {
  return new URLSearchParams(obj);
}

describe('parsePagination: per-collection defaults match legacy Mongo handlers', () => {
  // These are the EXACT defaults observed in app/api/handlers/*.js. If a
  // handler task changes a default, update DEFAULT_LIMITS + this table.
  test.each([
    ['news', 10],
    ['announcements', 10],
    ['cases', 10],
    ['putusan', 10],
    ['agenda', 20],
    ['complaints', 20],
    ['documents', 20],
    ['survey_responses', 20],
    ['media', 30],
    ['gallery', 50],
  ])('default limit for %s is %d (matches current handler)', (col, expected) => {
    const out = parsePagination(params({}), col);
    expect(out.limit).toBe(expected);
    expect(out.page).toBe(1);
    expect(out.skip).toBe(0);
    expect(out.take).toBe(expected);
  });

  test('DEFAULT_LIMITS is frozen and complete', () => {
    expect(Object.isFrozen(DEFAULT_LIMITS)).toBe(true);
    // The collections exercised by the contract suite MUST be registered.
    for (const col of [
      'news', 'announcements', 'cases', 'agenda', 'putusan',
      'documents', 'complaints', 'media', 'gallery', 'survey_responses',
    ]) {
      expect(DEFAULT_LIMITS[col]).toBeDefined();
    }
  });
});

describe('parsePagination: explicit page/limit honored', () => {
  test('passes page=2 limit=5 through to skip/take', () => {
    const out = parsePagination(params({ page: '2', limit: '5' }), 'news');
    expect(out).toEqual({ page: 2, limit: 5, skip: 5, take: 5 });
  });

  test('page=3 limit=10 -> skip 20 take 10', () => {
    const out = parsePagination(params({ page: '3', limit: '10' }), 'agenda');
    expect(out.skip).toBe(20);
    expect(out.take).toBe(10);
  });
});

describe('parsePagination: NaN / missing fall back to defaults (legacy behaviour)', () => {
  test('missing params -> default page=1 + collection default limit', () => {
    const out = parsePagination(params({}), 'media');
    expect(out.page).toBe(1);
    expect(out.limit).toBe(30);
    expect(out.skip).toBe(0);
  });

  test('non-numeric strings fall back to defaults', () => {
    // Legacy: parseInt('abc' || '1') -> parseInt('1') -> 1. We preserve that
    // by treating NaN as missing.
    const out = parsePagination(params({ page: 'abc', limit: 'xyz' }), 'news');
    expect(out.page).toBe(1);
    expect(out.limit).toBe(10);
  });

  test('empty string falls back (mirrors `x || default` from Mongo handlers)', () => {
    const out = parsePagination(params({ page: '', limit: '' }), 'agenda');
    expect(out.page).toBe(1);
    expect(out.limit).toBe(20);
  });
});

describe('parsePagination: negative / zero clamp to >= 1', () => {
  // Prisma requires non-negative skip and take; we clamp to 1 so the handler
  // never hands Prisma a value that throws. This is the only behaviour
  // CHANGE from the legacy Mongo handlers (which had undefined behaviour for
  // negative skip/limit). It is safe because no legitimate client sends
  // page=0.
  test('page=0 -> page=1', () => {
    const out = parsePagination(params({ page: '0', limit: '10' }), 'news');
    expect(out.page).toBe(1);
    expect(out.skip).toBe(0);
  });

  test('page=-2 -> page=1', () => {
    const out = parsePagination(params({ page: '-2', limit: '10' }), 'news');
    expect(out.page).toBe(1);
    expect(out.skip).toBe(0);
  });

  test('limit=0 -> collection default', () => {
    const out = parsePagination(params({ limit: '0' }), 'news');
    expect(out.limit).toBe(10);
  });

  test('limit=-5 -> collection default', () => {
    const out = parsePagination(params({ limit: '-5' }), 'media');
    expect(out.limit).toBe(30);
  });
});

describe('parsePagination: accepts URL as well as URLSearchParams', () => {
  test('URL input is unwrapped to searchParams', () => {
    const url = new URL('https://example.test/api/news?page=2&limit=5');
    const out = parsePagination(url, 'news');
    expect(out).toEqual({ page: 2, limit: 5, skip: 5, take: 5 });
  });
});

describe('parsePagination: unregistered collection fails loud', () => {
  test('throws for an unknown collection name', () => {
    expect(() => parsePagination(params({}), 'totally-made-up')).toThrow(/default limit/i);
    expect(() => parsePagination(params({}), 'totally-made-up')).toThrow(/totally-made-up/);
  });
});

describe('paginationEnvelope', () => {
  test('produces the standard {items,total,page,totalPages} shape', () => {
    const out = paginationEnvelope([1, 2, 3], 25, 2, 10);
    expect(out).toEqual({ items: [1, 2, 3], total: 25, page: 2, totalPages: 3 });
  });

  test('totalPages = ceil(total/limit)', () => {
    expect(paginationEnvelope([], 0, 1, 10).totalPages).toBe(0);
    expect(paginationEnvelope([], 1, 1, 10).totalPages).toBe(1);
    expect(paginationEnvelope([], 11, 1, 10).totalPages).toBe(2);
  });
});

describe('mediaOrderBy: allowlist security (plan line 287 + 132)', () => {
  test('MEDIA_SORT_FIELDS is exactly {createdAt, originalName, size}', () => {
    expect([...MEDIA_SORT_FIELDS].sort()).toEqual(['createdAt', 'originalName', 'size']);
    expect(Object.isFrozen(MEDIA_SORT_FIELDS)).toBe(true);
  });

  test('DEFAULT_MEDIA_SORT is createdAt', () => {
    expect(DEFAULT_MEDIA_SORT).toBe('createdAt');
  });

  test.each(['createdAt', 'originalName', 'size'])(
    'allowlisted field %s passes through',
    (field) => {
      const out = mediaOrderBy(field, 'asc');
      expect(out.field).toBe(field);
      expect(out.direction).toBe('asc');
    },
  );

  test('missing sortField -> createdAt default', () => {
    expect(mediaOrderBy(undefined, 'desc').field).toBe('createdAt');
    expect(mediaOrderBy(null, 'desc').field).toBe('createdAt');
  });

  test('empty sortField -> createdAt default', () => {
    expect(mediaOrderBy('', 'desc').field).toBe('createdAt');
  });

  test('ARBITRARY user input is REJECTED (falls back to default)', () => {
    // This is the security-critical assertion: a malicious client cannot
    // probe arbitrary Prisma columns by passing e.g. ?sortField=user.password.
    // The field is normalised to a known-safe value before it can reach
    // Prisma's orderBy.
    const attacks = [
      'password',
      'user.password',
      'id',
      'email',
      '*',
      '; DROP TABLE',
      'createdAt; --',
      'originalName\x00',
      'createdAtcreatedAt',
    ];
    for (const attack of attacks) {
      const out = mediaOrderBy(attack, 'desc');
      // Field MUST be one of the three allowed values.
      expect(MEDIA_SORT_FIELDS).toContain(out.field);
      if (attack !== 'createdAt' && attack !== 'originalName' && attack !== 'size') {
        expect(out.field).toBe('createdAt'); // normalised to default
      }
    }
  });

  test('sortDir is case-insensitive "asc", anything else -> desc', () => {
    // Mirrors legacy `sortDir === 'asc' ? 1 : -1` rule.
    expect(mediaOrderBy('createdAt', 'asc').direction).toBe('asc');
    expect(mediaOrderBy('createdAt', 'ASC').direction).toBe('asc');
    expect(mediaOrderBy('createdAt', 'Asc').direction).toBe('asc');
    expect(mediaOrderBy('createdAt', 'desc').direction).toBe('desc');
    expect(mediaOrderBy('createdAt', undefined).direction).toBe('desc');
    expect(mediaOrderBy('createdAt', '').direction).toBe('desc');
    expect(mediaOrderBy('createdAt', 'garbage').direction).toBe('desc');
  });
});

describe('mediaOrderByFromQuery: thin wrapper', () => {
  test('reads sortField / sortDir off URLSearchParams', () => {
    const out = mediaOrderByFromQuery(params({ sortField: 'size', sortDir: 'asc' }));
    expect(out).toEqual({ field: 'size', direction: 'asc' });
  });

  test('falls back to defaults on missing params', () => {
    const out = mediaOrderByFromQuery(params({}));
    expect(out).toEqual({ field: 'createdAt', direction: 'desc' });
  });

  test('rejects arbitrary sortField from query (security)', () => {
    const out = mediaOrderByFromQuery(params({ sortField: 'password' }));
    expect(out.field).toBe('createdAt');
  });

  test('accepts URL input', () => {
    const url = new URL('https://example.test/api/media?sortField=originalName&sortDir=asc');
    expect(mediaOrderByFromQuery(url)).toEqual({ field: 'originalName', direction: 'asc' });
  });
});
