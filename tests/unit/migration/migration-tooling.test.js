// Unit tests for Task 16 migration tooling (export / import / verify helpers).
// No live MongoDB or PostgreSQL required — all fixtures are in-memory.

import { describe, expect, test } from 'vitest';
import { createHash } from 'node:crypto';

import {
  IMPORT_ORDER,
  APPLICATION_TABLES,
  getPrismaEntry,
  stableStringify,
  sha256Canonical,
  businessFieldHash,
  collectionBusinessHash,
  documentToNdjsonLine,
  parseNdjsonLine,
  parseNdjsonContent,
  findBlockersInProfile,
  hasUnresolvedBlockers,
  transformForImport,
  sortMenusParentsFirst,
  chunk,
  assertEmptyTarget,
  buildRejectEntry,
  ALL_OR_NOTHING_STRATEGY,
  normalizeRecordForCompare,
  compareCounts,
  compareIdSets,
  findDuplicates,
  compareBusinessHashes,
  sumField,
  averageField,
  checkMenuIntegrity,
  compareJsonFields,
  sampleDateBounds,
  pickTargetedSamples,
  sampleFileUrlExistence,
} from '../../../scripts/migration/lib/transforms/index.mjs';

const UUID_A = '10000000-0000-4000-8000-000000000001';
const UUID_B = '10000000-0000-4000-8000-000000000002';
const UUID_C = '10000000-0000-4000-8000-000000000003';
const BCRYPT = '$2a$10$.FMTahov29ELSZgnu18DKRYfmt07CJQXelsz6BIPWdkry5AHOVcjq';

// ---------------------------------------------------------------------------
// prisma-map
// ---------------------------------------------------------------------------

describe('prisma-map', () => {
  test('IMPORT_ORDER covers all 20 application collections', () => {
    expect(IMPORT_ORDER).toHaveLength(20);
    expect(APPLICATION_TABLES).toHaveLength(20);
    for (const name of IMPORT_ORDER) {
      expect(getPrismaEntry(name)).not.toBeNull();
    }
  });

  test('menus comes after independent content; parents handled inside importer', () => {
    expect(IMPORT_ORDER.indexOf('settings')).toBeLessThan(IMPORT_ORDER.indexOf('menus'));
    expect(IMPORT_ORDER.indexOf('users')).toBeLessThan(IMPORT_ORDER.indexOf('menus'));
    expect(IMPORT_ORDER.indexOf('menus')).toBeLessThan(IMPORT_ORDER.indexOf('media'));
  });

  test('putusan renames ringkasan/fileUrl; menus renames title→label', () => {
    expect(getPrismaEntry('putusan').fieldRenames.ringkasan).toBe('ringkasanPutusan');
    expect(getPrismaEntry('putusan').fieldRenames.fileUrl).toBe('filePutusan');
    expect(getPrismaEntry('menus').fieldRenames.title).toBe('label');
  });
});

// ---------------------------------------------------------------------------
// canonical hash / NDJSON
// ---------------------------------------------------------------------------

describe('canonical-hash + ndjson', () => {
  test('stableStringify sorts object keys', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  test('sha256Canonical is deterministic', () => {
    const a = sha256Canonical({ id: UUID_A, title: 'x' });
    const b = sha256Canonical({ title: 'x', id: UUID_A });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test('businessFieldHash redacts secret values to presence marker', () => {
    const h1 = businessFieldHash({ id: UUID_A, password: BCRYPT, name: 'A' });
    const h2 = businessFieldHash({ id: UUID_A, password: 'other-hash', name: 'A' });
    // Both passwords become '<present>' so hashes match.
    expect(h1).toBe(h2);
  });

  test('NDJSON round-trips plain documents', () => {
    const doc = {
      id: UUID_A,
      title: 'Hello',
      createdAt: '2024-01-01T00:00:00.000Z',
      nested: { z: 1, a: 2 },
    };
    const line = documentToNdjsonLine(doc);
    const back = parseNdjsonLine(line);
    expect(back.id).toBe(UUID_A);
    expect(back.title).toBe('Hello');
    expect(back.nested).toEqual({ a: 2, z: 1 });
  });

  test('NDJSON Extended JSON restores $date to Date', () => {
    const line = documentToNdjsonLine({
      id: UUID_A,
      createdAt: new Date('2024-06-01T12:00:00.000Z'),
    });
    expect(line).toContain('"$date"');
    const back = parseNdjsonLine(line);
    expect(back.createdAt).toBeInstanceOf(Date);
    expect(back.createdAt.toISOString()).toBe('2024-06-01T12:00:00.000Z');
  });

  test('parseNdjsonContent skips blank lines', () => {
    const content = `${documentToNdjsonLine({ id: UUID_A })}\n\n${documentToNdjsonLine({ id: UUID_B })}\n`;
    const docs = parseNdjsonContent(content);
    expect(docs).toHaveLength(2);
  });

  test('collectionBusinessHash changes when a field flips', () => {
    const a = collectionBusinessHash([{ id: UUID_A, n: 1 }]);
    const b = collectionBusinessHash([{ id: UUID_A, n: 2 }]);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// blockers
// ---------------------------------------------------------------------------

describe('blockers', () => {
  test('missing profile is a blocker', () => {
    const findings = findBlockersInProfile(null);
    expect(hasUnresolvedBlockers(findings)).toBe(true);
    expect(findings[0].kind).toBe('missing-profile');
  });

  test('clean profile has no blockers', () => {
    const report = {
      collections: [
        {
          collection: 'users',
          analysis: {
            idUniqueness: { duplicateCount: 0, missingCount: 0 },
            idUuidValidity: { notUuidCount: 0, nonV4Count: 0 },
            unknownFields: { perRecordUnknownCount: 0 },
            bcryptHashes: { password: { invalidCount: 0 } },
            fieldStats: {},
          },
        },
      ],
    };
    expect(findBlockersInProfile(report)).toEqual([]);
  });

  test('duplicate ids are blockers', () => {
    const report = {
      collections: [
        {
          collection: 'users',
          analysis: {
            idUniqueness: { duplicateCount: 2, missingCount: 0 },
          },
        },
      ],
    };
    const findings = findBlockersInProfile(report);
    expect(findings.some((f) => f.anomaly === 'duplicate-id')).toBe(true);
  });

  test('menu graph orphans are blockers', () => {
    const report = {
      collections: [
        {
          collection: 'menus',
          analysis: {
            menuGraph: { orphanCount: 1, selfCycleCount: 0, depthExceededCount: 0 },
          },
        },
      ],
    };
    const findings = findBlockersInProfile(report);
    expect(findings.some((f) => f.anomaly === 'menu-graph-anomaly')).toBe(true);
  });

  test('gate.blockersUnresolved flag is a blocker', () => {
    const findings = findBlockersInProfile({ collections: [], gate: { blockersUnresolved: true } });
    expect(findings.some((f) => f.kind === 'gate-flag')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// transformForImport
// ---------------------------------------------------------------------------

describe('transformForImport', () => {
  test('preserves public id and bcrypt hash', () => {
    const { output, errors } = transformForImport('users', {
      _id: 'deadbeef',
      id: UUID_A,
      name: 'Admin',
      email: 'Admin@Example.TEST',
      password: BCRYPT,
      role: 'superadmin',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(errors).toEqual([]);
    expect(output.id).toBe(UUID_A);
    expect(output.password).toBe(BCRYPT);
    expect(output.email).toBe('admin@example.test');
    expect(output).not.toHaveProperty('_id');
    expect(output.createdAt).toBeInstanceOf(Date);
  });

  test('renames putusan ringkasan/fileUrl and menus title', () => {
    const putusan = transformForImport('putusan', {
      id: UUID_A,
      nomorPerkara: '1',
      statusPublish: true,
      ringkasan: 'ok',
      fileUrl: '/uploads/pdfs/a.pdf',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(putusan.errors).toEqual([]);
    expect(putusan.output.ringkasanPutusan).toBe('ok');
    expect(putusan.output.filePutusan).toBe('/uploads/pdfs/a.pdf');
    expect(putusan.output).not.toHaveProperty('ringkasan');
    expect(putusan.output).not.toHaveProperty('fileUrl');

    const menu = transformForImport('menus', {
      id: UUID_A,
      title: 'Home',
      url: '/',
      order: 1,
      isActive: true,
      parentId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(menu.errors).toEqual([]);
    expect(menu.output.label).toBe('Home');
    expect(menu.output).not.toHaveProperty('title');
  });

  test('parses date-only without timezone shift', () => {
    const { output, errors } = transformForImport('news', {
      id: UUID_A,
      title: 'T',
      content: 'C',
      isPublished: true,
      publishDate: '2024-02-29',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(errors).toEqual([]);
    expect(output.publishDate).toBeInstanceOf(Date);
    expect(output.publishDate.getUTCFullYear()).toBe(2024);
    expect(output.publishDate.getUTCMonth()).toBe(1);
    expect(output.publishDate.getUTCDate()).toBe(29);
  });

  test('rejects calendar-invalid date-only', () => {
    const { errors } = transformForImport('news', {
      id: UUID_A,
      title: 'T',
      content: 'C',
      isPublished: true,
      publishDate: '2024-02-30',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(errors.some((e) => e.kind === 'rejected')).toBe(true);
  });

  test('unknown field is collected as pending (never silent drop)', () => {
    const { errors, output } = transformForImport('users', {
      id: UUID_A,
      name: 'A',
      email: 'a@example.test',
      password: BCRYPT,
      role: 'admin',
      createdAt: '2024-01-01T00:00:00.000Z',
      rogueField: true,
    });
    expect(errors.some((e) => e.anomaly === 'unknown-field')).toBe(true);
    expect(output).not.toHaveProperty('rogueField');
  });

  test('missing id is pending for uuid collections', () => {
    const { errors } = transformForImport('users', {
      name: 'A',
      email: 'a@example.test',
      password: BCRYPT,
      role: 'admin',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(errors.some((e) => e.anomaly === 'missing-id')).toBe(true);
  });

  test('settings value objects are stringified to text', () => {
    const { output, errors } = transformForImport('settings', {
      key: 'footer_links',
      value: [{ label: 'Home', href: '/' }],
    });
    expect(errors).toEqual([]);
    expect(typeof output.value).toBe('string');
    expect(JSON.parse(output.value)).toEqual([{ label: 'Home', href: '/' }]);
  });

  test('analytics synthesises a uuid id', () => {
    const { output, errors } = transformForImport('analytics', {
      date: '2024-01-01',
      path: '/',
      views: 3,
    });
    expect(errors).toEqual([]);
    expect(output.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(output.views).toBe(3);
    expect(output.date).toBeInstanceOf(Date);
  });

  test('pages.blocks JSON is preserved', () => {
    const blocks = [{ id: 'b1', type: 'hero', settings: { title: 'Hi' } }];
    const { output, errors } = transformForImport('pages', {
      id: UUID_A,
      title: 'P',
      slug: 'p',
      status: 'published',
      blocks,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(errors).toEqual([]);
    expect(output.blocks).toEqual(blocks);
  });

  test('reject entry never contains raw password', () => {
    const entry = buildRejectEntry({
      collection: 'users',
      index: 0,
      publicId: UUID_A,
      errors: [{ field: 'password', anomaly: 'invalid-bcrypt-hash', message: 'bad', kind: 'pending' }],
      rawDoc: { id: UUID_A, password: BCRYPT, email: 'a@example.test' },
    });
    expect(entry.rawDocPreview.password).toBe('<redacted>');
    expect(JSON.stringify(entry)).not.toContain(BCRYPT);
  });
});

// ---------------------------------------------------------------------------
// menus parent-first + chunk
// ---------------------------------------------------------------------------

describe('sortMenusParentsFirst + chunk', () => {
  test('parents come before children', () => {
    const rows = [
      { id: UUID_B, parentId: UUID_A, order: 2, label: 'Child' },
      { id: UUID_A, parentId: null, order: 1, label: 'Parent' },
      { id: UUID_C, parentId: UUID_A, order: 1, label: 'Child2' },
    ];
    const sorted = sortMenusParentsFirst(rows);
    expect(sorted[0].id).toBe(UUID_A);
    expect(sorted.slice(1).map((r) => r.id).sort()).toEqual([UUID_B, UUID_C].sort());
  });

  test('chunk splits into batches of N', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 500)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// nonempty target refusal
// ---------------------------------------------------------------------------

describe('assertEmptyTarget', () => {
  test('empty counts are ok', () => {
    const counts = Object.fromEntries(APPLICATION_TABLES.map((t) => [t, 0]));
    const r = assertEmptyTarget(counts);
    expect(r.ok).toBe(true);
    expect(r.nonempty).toEqual([]);
  });

  test('nonempty target is refused without force-recovery', () => {
    const counts = Object.fromEntries(APPLICATION_TABLES.map((t) => [t, 0]));
    counts.users = 3;
    counts.news = 1;
    const r = assertEmptyTarget(counts, { forceRecovery: false });
    expect(r.ok).toBe(false);
    expect(r.nonempty.some((s) => s.startsWith('users='))).toBe(true);
    expect(r.reason).toMatch(/not empty/i);
  });

  test('nonempty target is allowed with force-recovery', () => {
    const counts = Object.fromEntries(APPLICATION_TABLES.map((t) => [t, 0]));
    counts.users = 3;
    const r = assertEmptyTarget(counts, { forceRecovery: true });
    expect(r.ok).toBe(true);
    expect(r.reason).toMatch(/force-recovery/i);
    expect(r.reason).toMatch(/TRUNCATE/i);
  });

  test('all-or-nothing strategy is documented', () => {
    expect(ALL_OR_NOTHING_STRATEGY.name).toBe('batch-tx-stop-on-first-failure');
    expect(ALL_OR_NOTHING_STRATEGY.description).toMatch(/reject/i);
    expect(ALL_OR_NOTHING_STRATEGY.description).toMatch(/_prisma_migrations/);
  });
});

// ---------------------------------------------------------------------------
// verifier comparisons
// ---------------------------------------------------------------------------

describe('verifier comparisons', () => {
  test('compareCounts detects delta', () => {
    expect(compareCounts(2, 2).ok).toBe(true);
    expect(compareCounts(2, 3).ok).toBe(false);
    expect(compareCounts(2, 3).delta).toBe(1);
  });

  test('compareIdSets reports missing and extra', () => {
    const r = compareIdSets([UUID_A, UUID_B], [UUID_A, UUID_C]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([UUID_B]);
    expect(r.extra).toEqual([UUID_C]);
  });

  test('findDuplicates finds repeated keys', () => {
    const dups = findDuplicates(['a', 'b', 'a', 'c', 'b', 'b']);
    expect(dups).toEqual([
      { key: 'b', count: 3 },
      { key: 'a', count: 2 },
    ]);
  });

  test('compareBusinessHashes equal for same payload different key order', () => {
    const src = [{ id: UUID_A, title: 'T', n: 1 }];
    const tgt = [{ n: 1, title: 'T', id: UUID_A }];
    expect(compareBusinessHashes(src, tgt).ok).toBe(true);
  });

  test('checkMenuIntegrity flags orphans and self-cycles', () => {
    const menus = [
      { id: UUID_A, parentId: null, label: 'Root' },
      { id: UUID_B, parentId: 'missing-parent', label: 'Orphan' },
      { id: UUID_C, parentId: UUID_C, label: 'Self' },
    ];
    const r = checkMenuIntegrity(menus);
    expect(r.ok).toBe(false);
    expect(r.orphans).toHaveLength(1);
    expect(r.selfCycles).toEqual([UUID_C]);
  });

  test('compareJsonFields deep-equals blocks', () => {
    const blocks = [{ id: 'b1', type: 'hero', settings: { title: 'A' } }];
    const src = [{ id: UUID_A, blocks }];
    const ok = [{ id: UUID_A, blocks: [{ settings: { title: 'A' }, type: 'hero', id: 'b1' }] }];
    const bad = [{ id: UUID_A, blocks: [{ id: 'b1', type: 'hero', settings: { title: 'B' } }] }];
    expect(compareJsonFields(src, ok, 'blocks').ok).toBe(true);
    expect(compareJsonFields(src, bad, 'blocks').ok).toBe(false);
  });

  test('aggregates: sum and average', () => {
    const docs = [{ downloadCount: 1 }, { downloadCount: 4 }, { downloadCount: 0 }];
    expect(sumField(docs, 'downloadCount')).toBe(5);
    const surveys = [{ rating: 4 }, { rating: 2 }];
    expect(averageField(surveys, 'rating')).toBe(3);
  });

  test('sampleDateBounds returns first/last', () => {
    const rows = [
      { id: UUID_A, publishDate: '2024-03-01' },
      { id: UUID_B, publishDate: '2024-01-01' },
      { id: UUID_C, publishDate: '2024-02-01' },
    ];
    const b = sampleDateBounds(rows, 'publishDate');
    expect(b.first.id).toBe(UUID_B);
    expect(b.last.id).toBe(UUID_A);
  });

  test('pickTargetedSamples includes first/last/largest', () => {
    const rows = [
      { id: UUID_A, title: 'a' },
      { id: UUID_B, title: 'bbbbbbbbbbbbbbbbbbbb' },
      { id: UUID_C, title: 'c' },
    ];
    const samples = pickTargetedSamples(rows);
    expect(samples.some((s) => s.tag === 'first')).toBe(true);
    expect(samples.some((s) => s.tag === 'last')).toBe(true);
    expect(samples.some((s) => s.tag === 'largest')).toBe(true);
  });

  test('sampleFileUrlExistence checks local uploads only', () => {
    const existsFn = (url) => url === '/uploads/images/ok.png';
    const r = sampleFileUrlExistence(
      ['/uploads/images/ok.png', '/uploads/images/missing.png', 'https://cdn.example/x.png'],
      existsFn,
    );
    expect(r.checked).toBe(2);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0].url).toBe('/uploads/images/missing.png');
    expect(r.ok).toBe(false);
  });

  test('normalizeRecordForCompare formats date-only fields', () => {
    const rec = normalizeRecordForCompare('news', {
      id: UUID_A,
      publishDate: new Date(Date.UTC(2024, 0, 15)),
      createdAt: new Date('2024-01-01T12:00:00.000Z'),
    });
    expect(rec.publishDate).toBe('2024-01-15');
    expect(rec.createdAt).toBe('2024-01-01T12:00:00.000Z');
  });

  test('end-to-end sample: transform → compare equal source/target', () => {
    const mongoDoc = {
      id: UUID_A,
      title: 'News',
      content: '<p>x</p>',
      isPublished: true,
      publishDate: '2024-05-01',
      createdAt: '2024-05-01T10:00:00.000Z',
      updatedAt: '2024-05-01T10:00:00.000Z',
    };
    const { output, errors } = transformForImport('news', mongoDoc);
    expect(errors).toEqual([]);
    const source = [normalizeRecordForCompare('news', output)];
    // Simulate Postgres row (same shape after normalize).
    const target = [normalizeRecordForCompare('news', { ...output })];
    expect(compareCounts(source.length, target.length).ok).toBe(true);
    expect(compareIdSets([source[0].id], [target[0].id]).ok).toBe(true);
    expect(compareBusinessHashes(source, target).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// reject-file behaviour (structure)
// ---------------------------------------------------------------------------

describe('reject-file behaviour', () => {
  test('buildRejectEntry structure is stable and secret-safe', () => {
    const entry = buildRejectEntry({
      collection: 'users',
      index: 2,
      publicId: UUID_A,
      errors: [
        {
          field: 'email',
          anomaly: 'duplicate-natural-key',
          message: 'dup',
          kind: 'pending',
        },
      ],
      rawDoc: { id: UUID_A, password: BCRYPT, token: 'sekrit' },
    });
    expect(entry.collection).toBe('users');
    expect(entry.index).toBe(2);
    expect(entry.errors).toHaveLength(1);
    expect(entry.rawDocPreview.password).toBe('<redacted>');
    expect(entry.rawDocPreview.token).toBe('<redacted>');
  });
});

// ---------------------------------------------------------------------------
// package scripts smoke (files exist + parse)
// ---------------------------------------------------------------------------

describe('tooling entrypoints exist', () => {
  test('export/import/verify scripts are present', async () => {
    const { existsSync } = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(process.cwd(), 'scripts/migration');
    expect(existsSync(path.join(root, 'export-mongodb.mjs'))).toBe(true);
    expect(existsSync(path.join(root, 'import-postgres.mjs'))).toBe(true);
    expect(existsSync(path.join(root, 'verify-migration.mjs'))).toBe(true);
    expect(existsSync(path.join(root, 'lib/transforms/index.mjs'))).toBe(true);
  });

  test('cutover runbook exists', async () => {
    const { existsSync } = await import('node:fs');
    const path = await import('node:path');
    expect(existsSync(path.resolve(process.cwd(), 'docs/database-cutover.md'))).toBe(true);
  });
});
