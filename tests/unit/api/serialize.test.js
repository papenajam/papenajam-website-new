// Unit tests for lib/api/serialize.js (Task 6).
//
// Covers the REQUIRED test cases from plan lines 540-548:
//   - date-only fields (YYYY-MM-DD) emitted via UTC formatting, no TZ shift
//   - timestamp fields (Timestamptz) emitted as ISO strings, unchanged
//   - JSON / JsonB columns (pages.blocks, sidebar_widgets.settings)
//     round-trip DEEP-EQUAL (preserved verbatim, no key drops)
//   - BigInt -> number when safe, string when out of Number range
//   - password NEVER appears in the serialized output for ANY model
//   - _id dropped (internal, plan _id gate default); __v NOT stripped
//   - both Prisma model names ('User', 'News') and legacy collection names
//     ('users', 'news') route to the same per-model rules
//
// All tests run with TZ=Asia/Jakarta so any local-time bug in date
// formatting surfaces. No DB connection is needed.

process.env.TZ = 'Asia/Jakarta';

import { describe, expect, test } from 'vitest';
import { serializeList, serializeRecord } from '../../../lib/api/serialize.js';

// Helper: build a Date from ISO timestamp for fixtures.
const ts = (iso) => new Date(iso);
const utcMidnight = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

describe('serializeRecord: timestamp fields emitted as ISO strings', () => {
  test('News timestamps stay as full ISO strings, not YYYY-MM-DD', () => {
    const created = ts('2024-02-02T10:00:00.000Z');
    const out = serializeRecord('News', {
      id: 'abc',
      title: 't',
      createdAt: created,
      updatedAt: created,
    });
    expect(out.createdAt).toBe('2024-02-02T10:00:00.000Z');
    expect(out.updatedAt).toBe('2024-02-02T10:00:00.000Z');
    expect(typeof out.createdAt).toBe('string');
    // Defensive: ensure it wasn't accidentally truncated to YYYY-MM-DD.
    expect(out.createdAt).toContain('T');
    expect(out.createdAt).toContain('Z');
  });

  test('Timestamp ISO output is unchanged for every model', () => {
    // Per plan line 541: timestamps must round-trip as ISO strings regardless
    // of model. Use a model WITH a date-only field to confirm the dispatch
    // correctly distinguishes timestamp vs date-only columns.
    const created = ts('2024-01-15T23:59:59.999Z');
    for (const model of ['News', 'Agenda', 'Banner', 'User']) {
      const out = serializeRecord(model, {
        id: 'x',
        createdAt: created,
        publishDate: utcMidnight(2024, 1, 15),
      });
      expect(out.createdAt).toBe('2024-01-15T23:59:59.999Z');
    }
  });
});

describe('serializeRecord: date-only fields emitted as YYYY-MM-DD', () => {
  test('News.publishDate -> YYYY-MM-DD using UTC components', () => {
    const out = serializeRecord('News', {
      id: 'n1',
      publishDate: utcMidnight(2024, 2, 29),
      createdAt: ts('2024-02-29T10:00:00.000Z'),
    });
    expect(out.publishDate).toBe('2024-02-29'); // leap day
  });

  test('CaseRecord.jadwalSidang -> YYYY-MM-DD (legacy collection name "cases")', () => {
    const out = serializeRecord('cases', {
      id: 'c1',
      jadwalSidang: utcMidnight(2024, 7, 12),
    });
    expect(out.jadwalSidang).toBe('2024-07-12');
  });

  test('Agenda.tanggalSidang -> YYYY-MM-DD', () => {
    const out = serializeRecord('Agenda', {
      id: 'a1',
      tanggalSidang: utcMidnight(2024, 3, 1),
    });
    expect(out.tanggalSidang).toBe('2024-03-01');
  });

  test('Decision.tanggalPutusan -> YYYY-MM-DD (null stays null)', () => {
    const populated = serializeRecord('putusan', {
      id: 'p1',
      tanggalPutusan: utcMidnight(2024, 2, 2),
    });
    expect(populated.tanggalPutusan).toBe('2024-02-02');

    const empty = serializeRecord('putusan', {
      id: 'p2',
      tanggalPutusan: null,
    });
    expect(empty.tanggalPutusan).toBeNull();
  });

  test('Banner.startDate / endDate -> YYYY-MM-DD or null', () => {
    const out = serializeRecord('banners', {
      id: 'b1',
      startDate: utcMidnight(2024, 1, 1),
      endDate: null,
    });
    expect(out.startDate).toBe('2024-01-01');
    expect(out.endDate).toBeNull();
  });

  test('AnalyticsDailyPath.date -> YYYY-MM-DD', () => {
    const out = serializeRecord('analytics', {
      date: utcMidnight(2024, 1, 1),
      path: '/',
      views: 5,
    });
    expect(out.date).toBe('2024-01-01');
  });

  test('Timezone boundary: a Date at 2024-07-12T18:00Z serializes to 2024-07-12 (not 2024-07-13)', () => {
    // Host TZ is UTC+7, so this instant is locally 2024-07-13 01:00. A
    // buggy local-component formatter would emit the wrong day. The
    // date-only formatter must use UTC components.
    const out = serializeRecord('news', {
      publishDate: new Date(Date.UTC(2024, 6, 12, 18, 0, 0)),
    });
    expect(out.publishDate).toBe('2024-07-12');
  });
});

describe('serializeRecord: JSON / JsonB round-trip deep-equal', () => {
  test('Page.blocks preserved verbatim (deep-equal, no key drops)', () => {
    const blocks = [
      {
        id: 'hero-1',
        type: 'hero',
        settings: {
          title: 'Pengadilan Agama Penajam',
          subtitle: 'Memberikan keadilan yang cepat',
          backgroundImage: 'https://example.com/bg.jpg',
          buttonText: 'Lihat Layanan',
          buttonLink: '#layanan',
        },
      },
      {
        id: 'stats-1',
        type: 'stats',
        settings: {
          items: [
            { number: '500+', label: 'Perkara' },
            { number: '8', label: 'Hakim' },
          ],
        },
      },
    ];
    const out = serializeRecord('Page', {
      id: 'p1',
      title: 'Tentang',
      slug: 'tentang',
      status: 'published',
      blocks,
      createdAt: ts('2024-01-01T00:00:00.000Z'),
    });
    expect(out.blocks).toEqual(blocks); // deep-equal
    // Ensure it is NOT the same reference (no shared mutable state leak).
    expect(out.blocks).not.toBe(blocks);
    expect(out.blocks[0]).not.toBe(blocks[0]);
  });

  test('SidebarWidget.settings preserved verbatim (deep-equal)', () => {
    const settings = {
      limit: 4,
      title: 'Pertanyaan Umum',
      showAll: true,
      schedule: [{ days: 'Sen-Kam', hours: '08:00-16:00' }],
    };
    const out = serializeRecord('sidebar_widgets', {
      id: 'sw1',
      settings,
    });
    expect(out.settings).toEqual(settings);
    expect(out.settings).not.toBe(settings);
    expect(out.settings.schedule).not.toBe(settings.schedule);
  });

  test('JSON blob with nested Date nodes coerces them to ISO strings', () => {
    // Stored JSON may contain Date values inside JSON blobs; the pg adapter
    // normally parses JsonB as plain JS, but the importer might carry Date
    // values through. The serializer normalises nested dates to ISO strings
    // (treats them as timestamps, NOT date-only).
    const out = serializeRecord('Page', {
      blocks: [
        { type: 'text', at: ts('2024-02-02T10:00:00.000Z') },
      ],
    });
    expect(out.blocks[0].at).toBe('2024-02-02T10:00:00.000Z');
  });

  test('JSON blob drops any embedded password / _id keys (defence-in-depth); __v passes through (not stripped, so the contract suite flags it)', () => {
    const out = serializeRecord('Page', {
      blocks: [
        { type: 'text', password: 'LEAK', _id: 'previous-datastore-id', __v: 3 },
        { settings: { ok: true } },
      ],
      _id: 'should-not-appear',
      __v: 2,
    });
    expect(out).not.toHaveProperty('_id');
    // __v is intentionally NOT stripped (the API serializer doesn't emit it;
    // if it ever appears, let it surface so the contract suite catches it).
    expect(out.__v).toBe(2);
    expect(out.blocks[0]).not.toHaveProperty('password');
    expect(out.blocks[0]).not.toHaveProperty('_id');
    expect(out.blocks[0].__v).toBe(3);
    expect(out.blocks[1].settings.ok).toBe(true);
  });
});

describe('serializeRecord: BigInt guard', () => {
  // The current schema uses Int, not BigInt, but the guard is here so a
  // future BigInt column does not emit `{}` (the default JSON.stringify
  // behaviour for BigInt throws, which would crash the response).
  test('BigInt within safe range -> number', () => {
    const out = serializeRecord('media', {
      id: 'm1',
      size: BigInt(123456),
    });
    expect(out.size).toBe(123456);
    expect(typeof out.size).toBe('number');
  });

  test('BigInt beyond Number.MAX_SAFE_INTEGER -> string', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(2);
    const out = serializeRecord('media', { id: 'm2', size: huge });
    expect(typeof out.size).toBe('string');
    expect(out.size).toBe(huge.toString());
  });

  test('BigInt deep inside a JSON blob is coerced', () => {
    const out = serializeRecord('Page', {
      blocks: [{ count: BigInt(99), huge: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1) }],
    });
    expect(out.blocks[0].count).toBe(99);
    expect(typeof out.blocks[0].huge).toBe('string');
  });
});

describe('serializeRecord: password NEVER emitted', () => {
  // The plan mandates (line 283): NEVER return password. We assert this for
  // EVERY model that the schema marks as having a password column, plus a
  // paranoid check for any other model that happens to carry one.
  test('User model drops password', () => {
    const out = serializeRecord('User', {
      id: 'u1',
      name: 'Admin',
      email: 'a@b.c',
      password: '$2b$10$supersecrethash',
      role: 'admin',
      createdAt: ts('2024-01-01T00:00:00.000Z'),
    });
    expect(out).not.toHaveProperty('password');
    expect(JSON.stringify(out)).not.toContain('supersecrethash');
  });

  test('legacy "users" collection name also drops password', () => {
    const out = serializeRecord('users', {
      id: 'u1',
      password: 'LEAK-ME',
    });
    expect(out).not.toHaveProperty('password');
  });

  test('password is dropped from EVERY model, even ones that should not have one', () => {
    // Defence-in-depth: if a stray record ends up with a password key on a
    // model that does not declare one, we still strip it.
    for (const model of ['News', 'Agenda', 'Page', 'Banner', 'cases', 'putusan', 'media']) {
      const out = serializeRecord(model, {
        id: 'x',
        password: 'should-not-leak',
        title: 'ok',
      });
      expect(out).not.toHaveProperty('password');
    }
  });

  test('serializeList drops password from every user row', () => {
    const out = serializeList('users', [
      { id: 'u1', password: 'h1', name: 'A' },
      { id: 'u2', password: 'h2', name: 'B' },
      null, // preserved
    ]);
    expect(out).toHaveLength(3);
    expect(out[2]).toBeNull();
    expect(out[0]).not.toHaveProperty('password');
    expect(out[1]).not.toHaveProperty('password');
    expect(JSON.stringify(out)).not.toContain('h1');
    expect(JSON.stringify(out)).not.toContain('h2');
  });
});

describe('serializeRecord: internal fields dropped', () => {
  test('_id is never emitted (plan _id decision gate default); __v is NOT stripped so a stray key is surfaced by the contract suite', () => {
    const out = serializeRecord('news', {
      _id: '507f1f77bcf86cd799439011',
      __v: 0,
      id: 'uuid-1',
      title: 't',
    });
    expect(out).not.toHaveProperty('_id');
    // __v intentionally passes through — only _id is blessed for stripping.
    expect(out.__v).toBe(0);
    expect(out.id).toBe('uuid-1');
  });
});

describe('serializeRecord: unknown model falls back safely', () => {
  test('unknown model: timestamps as ISO, no date-only formatting, password still dropped', () => {
    const out = serializeRecord('SomeFutureModel', {
      id: 'x',
      someDate: utcMidnight(2024, 1, 1), // unknown model -> treated as timestamp
      createdAt: ts('2024-01-01T00:00:00.000Z'),
      password: 'leak',
    });
    expect(out.someDate).toBe('2024-01-01T00:00:00.000Z'); // treated as timestamp
    expect(out.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(out).not.toHaveProperty('password');
  });

  test('null / undefined record returned as null (not "null" string in arrays)', () => {
    expect(serializeRecord('news', null)).toBeNull();
    expect(serializeRecord('news', undefined)).toBeNull();
  });

  test('non-object record returned as-is (defensive)', () => {
    expect(serializeRecord('news', 'string')).toBe('string');
    expect(serializeRecord('news', 42)).toBe(42);
  });

  test('input is NOT mutated', () => {
    const record = {
      id: 'x',
      publishDate: utcMidnight(2024, 1, 1),
      createdAt: ts('2024-01-01T00:00:00.000Z'),
      blocks: [{ a: 1 }],
    };
    // Capture references + types so we can prove the serializer did not touch
    // the input. We deliberately do NOT JSON.parse(JSON.stringify(record))
    // for the snapshot because that would coerce the Date instances to
    // strings on the snapshot side, making the comparison meaningless.
    const publishDateRef = record.publishDate;
    const createdAtRef = record.createdAt;
    const blocksRef = record.blocks;
    const out = serializeRecord('news', record);
    // The input record still has its original Date instances and arrays.
    expect(record.publishDate).toBe(publishDateRef);
    expect(record.createdAt).toBe(createdAtRef);
    expect(record.blocks).toBe(blocksRef);
    expect(record.publishDate).toBeInstanceOf(Date);
    // The output is a NEW object with serialized values.
    expect(out).not.toBe(record);
    expect(out.publishDate).toBe('2024-01-01');
    expect(out.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('serializeList', () => {
  test('returns a fresh array; preserves order and nulls', () => {
    const rows = [
      { id: 'a', createdAt: ts('2024-01-01T00:00:00.000Z') },
      { id: 'b', createdAt: ts('2024-01-02T00:00:00.000Z') },
    ];
    const out = serializeList('news', rows);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('a');
    expect(out[1].id).toBe('b');
    expect(out[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(Array.isArray(out)).toBe(true);
  });

  test('empty / non-array input -> []', () => {
    expect(serializeList('news', [])).toEqual([]);
    expect(serializeList('news', null)).toEqual([]);
    expect(serializeList('news', undefined)).toEqual([]);
  });
});
