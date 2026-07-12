import { describe, expect, test } from 'vitest';

import { analyzeCollection } from '../../../scripts/migration/lib/anomaly.mjs';
import { buildReport, renderMarkdown } from '../../../scripts/migration/lib/report.mjs';
import { FIXTURES, usersFixture, menusFixture, pagesFixture } from './fixtures.js';

function buildFixtureReport() {
  const collectionAnalyses = [
    {
      collection: 'users',
      total: usersFixture().length,
      analysis: analyzeCollection('users', usersFixture()),
      sampleRecords: usersFixture(),
    },
    {
      collection: 'pages',
      total: pagesFixture().length,
      analysis: analyzeCollection('pages', pagesFixture()),
      sampleRecords: pagesFixture(),
    },
    {
      collection: 'menus',
      total: menusFixture().length,
      analysis: analyzeCollection('menus', menusFixture()),
      sampleRecords: menusFixture(),
    },
  ];
  return buildReport({
    mongoUriRaw: 'mongodb://admin:supersecret@cluster.example:27017/pa_penajam?authSource=admin&password=hunter2',
    dbName: 'pa_penajam',
    generatedAt: '2024-01-01T00:00:00.000Z',
    sampleLimit: 500,
    collectionAnalyses,
  });
}

describe('report: buildReport', () => {
  test('sanitizes the connection URI in the header', () => {
    const r = buildFixtureReport();
    expect(r.header.source.mongoUri).not.toContain('supersecret');
    expect(r.header.source.mongoUri).not.toContain('hunter2');
    expect(r.header.source.mongoUri).toContain('<redacted>');
  });

  test('emits per-collection totals and a roll-up summary', () => {
    const r = buildFixtureReport();
    expect(r.totals.collections).toBe(3);
    expect(r.totals.totalDocuments).toBe(usersFixture().length + pagesFixture().length + menusFixture().length);
    expect(r.totals.totalAnomalies).toBeGreaterThan(0);
    expect(r.collections[0].collection).toBe('users');
  });

  test('redacts passwords in sample records and never leaks a bcrypt hash', () => {
    const r = buildFixtureReport();
    const json = JSON.stringify(r);
    expect(json).not.toContain(FIXTURES.BCRYPT_VALID);
    expect(json).not.toContain(FIXTURES.BCRYPT_INVALID);
    expect(json).not.toContain('supersecret');
    const usersCollection = r.collections.find((c) => c.collection === 'users');
    for (const sample of usersCollection.sampleRecords) {
      expect(sample.password).toBe('<redacted>');
    }
  });

  test('sample records preserve non-secret fields', () => {
    const r = buildFixtureReport();
    const usersCollection = r.collections.find((c) => c.collection === 'users');
    const first = usersCollection.sampleRecords[0];
    expect(first.email).toBe('ADMIN@example.test');
    expect(first.role).toBe('superadmin');
  });
});

describe('report: renderMarkdown', () => {
  test('produces a non-empty Markdown string with every collection heading', () => {
    const md = renderMarkdown(buildFixtureReport());
    expect(md).toContain('# MongoDB Migration Profile');
    expect(md).toContain('## users');
    expect(md).toContain('## pages');
    expect(md).toContain('## menus');
    expect(md).toContain('| Collection | Total | Sample |');
  });

  test('does not contain raw passwords or bcrypt hashes', () => {
    const md = renderMarkdown(buildFixtureReport());
    expect(md).not.toContain(FIXTURES.BCRYPT_VALID);
    expect(md).not.toContain(FIXTURES.BCRYPT_INVALID);
    expect(md).not.toContain('supersecret');
    expect(md).not.toContain('hunter2');
    expect(md).toContain('<redacted>');
  });

  test('includes read-only policy banner', () => {
    const md = renderMarkdown(buildFixtureReport());
    expect(md).toContain('Read-only policy: enforced');
    expect(md).toContain('Secret fields redacted');
  });

  test('renders menu graph section and email casing section when applicable', () => {
    const md = renderMarkdown(buildFixtureReport());
    expect(md).toContain('Menu graph');
    expect(md).toContain('Email casing anomaly');
    expect(md).toContain('Email duplicates');
  });

  test('renders unknown-fields section even when none found', () => {
    const md = renderMarkdown(buildFixtureReport());
    expect(md).toMatch(/Unknown fields/);
  });
});
