import { describe, expect, test } from 'vitest';

import {
  analyzeBcryptHashes,
  analyzeCollection,
  analyzeEmailCasing,
  analyzeEmailDuplicates,
  analyzeIdUniqueness,
  analyzeIdUuidValidity,
  analyzeIntegerOverflow,
  analyzeJsonBlobs,
  analyzeMenuGraph,
  analyzeNaturalKeyDuplicates,
  analyzeRatings,
  analyzeTimestamps,
  computeByteStats,
  computeFieldFrequency,
  computeFieldStats,
  computeUnknownFields,
  countAnomalies,
  fieldStatsToJson,
} from '../../../scripts/migration/lib/anomaly.mjs';
import { findUnknownFields, getSchemaEntry, isKnownCollection, listKnownCollections } from '../../../scripts/migration/lib/schema-map.mjs';
import {
  analyticsFixture,
  FIXTURES,
  mediaFixture,
  menusFixture,
  mixedTypesFixture,
  pagesFixture,
  settingsFixture,
  surveyResponsesFixture,
  timestampAnomalyFixture,
  usersFixture,
} from './fixtures.js';

describe('schema-map', () => {
  test('covers every application collection from the contract inventory', () => {
    const known = new Set(listKnownCollections());
    const expected = [
      'users', 'news', 'announcements', 'services', 'cases', 'pages', 'agenda',
      'putusan', 'sidebar_widgets', 'gallery', 'documents', 'faq', 'banners',
      'complaints', 'analytics', 'survey_config', 'survey_responses', 'menus',
      'settings', 'media',
    ];
    for (const name of expected) expect(known.has(name)).toBe(true);
  });

  test('exposes per-collection field sets and special field kinds', () => {
    const users = getSchemaEntry('users');
    expect(users.fields.has('email')).toBe(true);
    expect(users.bcryptFields.has('password')).toBe(true);
    expect(users.naturalKey).toEqual(['email']);

    const menus = getSchemaEntry('menus');
    expect(menus.menuParentField).toBe('parentId');

    const analytics = getSchemaEntry('analytics');
    expect(analytics.idKind).toBe('none');
    expect(analytics.integerFields.has('views')).toBe(true);

    const survey = getSchemaEntry('survey_responses');
    expect(survey.ratingFields.has('rating')).toBe(true);
  });

  test('findUnknownFields returns sorted unknown names; schema-known flag is correct', () => {
    const r1 = findUnknownFields('users', ['id', 'email', 'rogue']);
    expect(r1.unknown).toEqual(['rogue']);
    expect(r1.schemaKnown).toBe(true);

    const r2 = findUnknownFields('not-a-collection', ['id']);
    expect(r2.unknown).toEqual([]);
    expect(r2.schemaKnown).toBe(false);
  });

  test('isKnownCollection returns false for unknown collections', () => {
    expect(isKnownCollection('users')).toBe(true);
    expect(isKnownCollection('unknown')).toBe(false);
  });
});

describe('anomaly: computeFieldStats / frequency', () => {
  test('computeFieldStats reports type counts, null/empty/missing, mixedTypes', () => {
    const stats = computeFieldStats(mixedTypesFixture());
    const titleStats = fieldStatsToJson(stats, 3).find((f) => f.name === 'title');
    expect(titleStats.frequency).toBe(3);
    expect(titleStats.types.String).toBe(2);
    expect(titleStats.types.Int32).toBe(1);
    expect(titleStats.mixedTypes).toBe(true);

    const noteStats = fieldStatsToJson(stats, 3).find((f) => f.name === 'note');
    expect(noteStats.frequency).toBe(2); // missing in record 3
    expect(noteStats.missingCount).toBe(1);
    expect(noteStats.nullCount).toBe(1); // record 2 sets it to null
    expect(noteStats.types.Null).toBe(1);

    const freq = computeFieldFrequency(mixedTypesFixture());
    expect(freq.find((f) => f.name === 'title').frequency).toBe(3);
    expect(freq.find((f) => f.name === 'note').frequency).toBe(2);
  });

  test('computeFieldStats skips non-object records without throwing', () => {
    const stats = computeFieldStats([null, 'nope', { a: 1 }]);
    expect(stats.size).toBe(1);
  });
});

describe('anomaly: id uniqueness + UUID validity', () => {
  test('analyzeIdUniqueness detects duplicates and missing', () => {
    const r = analyzeIdUniqueness(usersFixture());
    expect(r.total).toBe(4);
    expect(r.missingCount).toBe(1); // record 4 has no id
    expect(r.duplicateCount).toBe(0); // ids are all distinct in the fixture
  });

  test('analyzeIdUniqueness reports duplicate ids when present', () => {
    const records = [{ id: 'dup' }, { id: 'dup' }, { id: 'unique' }];
    const r = analyzeIdUniqueness(records);
    expect(r.duplicateCount).toBe(1);
    expect(r.duplicateValueCount).toBe(2);
    expect(r.duplicates[0]).toEqual({ id: 'dup', count: 2 });
  });

  test('analyzeIdUuidValidity classifies v4, non-v4, and not-uuid', () => {
    const r = analyzeIdUuidValidity([
      { id: FIXTURES.UUID_V4 },
      { id: FIXTURES.UUID_NON_V4 },
      { id: FIXTURES.NON_UUID },
      { id: '' },
      { id: undefined },
      {},
    ]);
    expect(r.total).toBe(6);
    expect(r.validUuidV4).toBe(1);
    expect(r.nonV4Count).toBe(1);
    expect(r.notUuidCount).toBe(1);
    expect(r.samples.notUuid).toContain(FIXTURES.NON_UUID);
    expect(r.samples.nonV4).toContain(FIXTURES.UUID_NON_V4);
  });
});

describe('anomaly: natural keys (email, slug, key, analytics)', () => {
  test('analyzeEmailDuplicates lowercases for comparison and reports counts', () => {
    const r = analyzeEmailDuplicates(usersFixture(), 'email');
    // Two records: ADMIN@example.test and admin@example.test
    expect(r.duplicateCount).toBe(1);
    expect(r.duplicateValueCount).toBe(2);
    expect(r.duplicates[0].key).toEqual(['admin@example.test']);
  });

  test('analyzeNaturalKeyDuplicates supports composite keys (analytics date+path)', () => {
    const r = analyzeNaturalKeyDuplicates(analyticsFixture(), ['date', 'path']);
    expect(r.duplicateCount).toBe(1);
    expect(r.duplicates[0].key).toEqual(['2024-01-01', '/']);
    expect(r.duplicateValueCount).toBe(2);
  });

  test('reports slug duplicates and key duplicates', () => {
    const slug = analyzeNaturalKeyDuplicates(pagesFixture(), ['slug']);
    expect(slug.duplicateCount).toBe(1);
    expect(slug.duplicates[0].key).toEqual(['dup-slug']);

    const key = analyzeNaturalKeyDuplicates(settingsFixture(), ['key']);
    expect(key.duplicateCount).toBe(1);
    expect(key.duplicates[0].key).toEqual(['court_name']);
  });

  test('analyzeEmailCasing counts upper-case emails without printing them', () => {
    const r = analyzeEmailCasing(usersFixture(), 'email');
    expect(r.totalNonEmpty).toBe(4);
    expect(r.anomalyCount).toBe(1);
    expect(r.sample).toBe('<redacted>');
  });
});

describe('anomaly: timestamps, ratings, integer overflow, bcrypt, JSON blobs', () => {
  test('analyzeTimestamps categorizes iso / date-only / invalid per field', () => {
    const ts = analyzeTimestamps(timestampAnomalyFixture(), ['publishDate', 'createdAt', 'updatedAt']);
    expect(ts.publishDate.invalidCount).toBe(1);
    expect(ts.publishDate.dateOnlyCount).toBe(1);
    expect(ts.updatedAt.invalidCount).toBe(1);
    expect(ts.createdAt.isoTimestampCount).toBe(2);
  });

  test('analyzeRatings flags out-of-range integers', () => {
    const r = analyzeRatings(surveyResponsesFixture(), ['rating']);
    expect(r.rating.outOfRangeCount).toBe(2); // 0 and 9
    expect(r.rating.samples).toContain('0');
    expect(r.rating.samples).toContain('9');
    expect(r.rating.totalNonEmpty).toBe(4);
  });

  test('analyzeIntegerOverflow flags int32 boundary crossings', () => {
    const r = analyzeIntegerOverflow(analyticsFixture(), ['views']);
    expect(r.views.overflowCount).toBe(1);
    expect(r.views.samples).toContain('2147483648');
  });

  test('analyzeIntegerOverflow flags media size over int32', () => {
    const r = analyzeIntegerOverflow(mediaFixture(), ['size']);
    expect(r.size.overflowCount).toBe(1);
    expect(r.size.samples).toContain('5000000000');
  });

  test('analyzeBcryptHashes counts valid/invalid without leaking hashes', () => {
    const r = analyzeBcryptHashes(usersFixture(), ['password']);
    expect(r.password.presentCount).toBe(4);
    expect(r.password.validFormatCount).toBe(3);
    expect(r.password.invalidFormatCount).toBe(1);
    // No field of the report contains a real hash.
    expect(JSON.stringify(r)).not.toContain(FIXTURES.BCRYPT_VALID);
    expect(JSON.stringify(r)).not.toContain(FIXTURES.BCRYPT_INVALID);
  });

  test('analyzeJsonBlobs reports root types, sizes, array/item counts', () => {
    const r = analyzeJsonBlobs(pagesFixture(), ['blocks']);
    expect(r.blocks.rootTypeCounts.Array).toBeGreaterThanOrEqual(2); // [] and [{...}]
    expect(r.blocks.rootTypeCounts.Object).toBe(1); // { root: 'object' }
    expect(r.blocks.sizeBytesStats.max).toBeGreaterThan(0);
    expect(r.blocks.arrayItemCountStats.max).toBe(1);
    expect(r.blocks.emptyCount).toBe(1); // []
  });

  test('analyzeJsonBlobs for settings.value covers scalars and objects', () => {
    const r = analyzeJsonBlobs(settingsFixture(), ['value']);
    expect(r.value.rootTypeCounts.String).toBeGreaterThanOrEqual(2);
    expect(r.value.rootTypeCounts.Null).toBe(1);
    expect(r.value.rootTypeCounts.Object).toBeGreaterThanOrEqual(1);
    expect(r.value.rootTypeCounts.Array).toBe(1);
    expect(r.value.emptyCount).toBe(1); // ''
  });
});

describe('anomaly: menu graph', () => {
  test('reports orphan, self-cycle, and depth-exceeded', () => {
    const g = analyzeMenuGraph(menusFixture(), 'parentId');
    expect(g.total).toBe(6);
    expect(g.orphanCount).toBe(1); // ORPHAN -> MISSING
    expect(g.selfCycleCount).toBe(1); // SELF -> SELF
    expect(g.depthExceededCount).toBe(1); // GREAT_GRAND at depth 3
    expect(g.maxDepthObserved).toBe(3); // chain TOP->CHILD->GRANDCHILD->GREAT_GRAND
  });

  test('returns zeros for a flat menu', () => {
    const flat = [{ id: 'a', parentId: null }, { id: 'b', parentId: null }];
    const g = analyzeMenuGraph(flat, 'parentId');
    expect(g.orphanCount).toBe(0);
    expect(g.selfCycleCount).toBe(0);
    expect(g.depthExceededCount).toBe(0);
    expect(g.maxDepthObserved).toBe(0);
  });
});

describe('anomaly: byte stats and unknown fields', () => {
  test('computeByteStats returns total + largest records', () => {
    const r = computeByteStats(pagesFixture());
    expect(r.totalBytes).toBeGreaterThan(0);
    expect(r.sampleSize).toBe(3);
    expect(r.largestRecords).toHaveLength(3);
    // Largest is sorted descending.
    expect(r.largestRecords[0].bytes).toBeGreaterThanOrEqual(r.largestRecords[1].bytes);
  });

  test('computeUnknownFields aggregates per-record unknown counts', () => {
    const r = computeUnknownFields('users', usersFixture());
    expect(r.schemaKnown).toBe(true);
    expect(r.unknownFields).toContain('rogueField');
    expect(r.perRecordUnknownCount).toBe(1);
  });

  test('computeUnknownFields returns schemaKnown=false for unknown collections', () => {
    const r = computeUnknownFields('mystery', [{ id: 1 }]);
    expect(r.schemaKnown).toBe(false);
    expect(r.unknownFields).toEqual([]);
    expect(r.perRecordUnknownCount).toBe(0);
  });
});

describe('anomaly: analyzeCollection integration', () => {
  test('produces every required dimension for users', () => {
    const a = analyzeCollection('users', usersFixture());
    expect(a.sampleSize).toBe(4);
    expect(a.fieldStats.length).toBeGreaterThan(0);
    expect(a.idUniqueness.missingCount).toBe(1);
    expect(a.idUuidValidity).not.toBeNull();
    expect(a.idUuidValidity.validUuidV4).toBe(3);
    expect(a.idUuidValidity.notUuidCount).toBe(0);
    expect(a.emailDuplicates.duplicateCount).toBe(1);
    expect(a.emailCasing.anomalyCount).toBe(1);
    expect(a.bcryptHashes.password.invalidFormatCount).toBe(1);
    expect(a.unknownFields.unknownFields).toContain('rogueField');
    expect(a.byteStats.totalBytes).toBeGreaterThan(0);
  });

  test('produces menu graph dimension for menus', () => {
    const a = analyzeCollection('menus', menusFixture());
    expect(a.menuGraph.orphanCount).toBe(1);
    expect(a.menuGraph.selfCycleCount).toBe(1);
    expect(a.menuGraph.depthExceededCount).toBe(1);
  });

  test('produces slug/key/(date,path) dimension for the right collections', () => {
    expect(analyzeCollection('pages', pagesFixture()).slugDuplicates.duplicateCount).toBe(1);
    expect(analyzeCollection('settings', settingsFixture()).keyDuplicates.duplicateCount).toBe(1);
    expect(analyzeCollection('analytics', analyticsFixture()).datePathDuplicates.duplicateCount).toBe(1);
  });

  test('skips idUuidValidity for analytics (idKind none)', () => {
    const a = analyzeCollection('analytics', analyticsFixture());
    expect(a.idUuidValidity).toBeNull();
  });

  test('countAnomalies sums every dimension', () => {
    const a = analyzeCollection('users', usersFixture());
    expect(countAnomalies(a)).toBeGreaterThan(0);
    expect(countAnomalies(null)).toBe(0);
  });

  test('does not embed raw bcrypt hashes anywhere in the analysis', () => {
    const a = analyzeCollection('users', usersFixture());
    const json = JSON.stringify(a);
    expect(json).not.toContain(FIXTURES.BCRYPT_VALID);
    expect(json).not.toContain(FIXTURES.BCRYPT_INVALID);
  });
});
