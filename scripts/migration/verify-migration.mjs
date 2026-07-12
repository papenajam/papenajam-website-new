#!/usr/bin/env node
// Migration verifier: compare a Mongo NDJSON export against PostgreSQL.
//
// Checks (plan Task 16):
//   - count equality per collection/table
//   - set equality for public ids
//   - unique keys / duplicate absence
//   - canonical business-field hashes
//   - aggregates (downloads, analytics, survey, cases, active/public)
//   - menu referential integrity
//   - JSON deep equality for pages/sidebar samples
//   - date boundary and sort samples
//   - targeted first/last/null/large samples
//   - file URL existence sampling (bytes not moved by DB scripts)
//
// USAGE
//   DATABASE_URL='postgresql://…' \
//   node scripts/migration/verify-migration.mjs \
//     --export-dir=.migration-artifacts/export-… \
//     [--uploads-root=public] \
//     [--only=news,users]
//
// EXIT CODES
//   0  all checks passed
//   2  DATABASE_URL missing
//   3  bad args
//   5  one or more checks failed
//   1  other runtime error

import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../lib/generated/prisma/client.ts';
import { parseDatabaseUrl } from '../../lib/prisma.js';

import {
  IMPORT_ORDER,
  getPrismaEntry,
  parseNdjsonContent,
  normalizeRecordForCompare,
  compareCounts,
  compareIdSets,
  findDuplicates,
  compareBusinessHashes,
  sumField,
  countWhere,
  groupCount,
  averageField,
  checkMenuIntegrity,
  compareJsonFields,
  sampleDateBounds,
  pickTargetedSamples,
  sampleFileUrlExistence,
  transformForImport,
  sortMenusParentsFirst,
} from './lib/transforms/index.mjs';
import { resolveCollections } from './collections.mjs';
import { formatDateOnly } from './transform-rules.mjs';

function parseArgs(argv) {
  const out = {
    exportDir: '',
    uploadsRoot: 'public',
    only: '',
    help: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--export-dir=')) out.exportDir = arg.slice('--export-dir='.length);
    else if (arg.startsWith('--uploads-root=')) out.uploadsRoot = arg.slice('--uploads-root='.length);
    else if (arg.startsWith('--only=')) out.only = arg.slice('--only='.length);
  }
  return out;
}

const HELP = `Usage:
  DATABASE_URL='postgresql://…' node scripts/migration/verify-migration.mjs [options]

Required:
  --export-dir=<path>   Directory produced by export-mongodb.mjs.
  DATABASE_URL          PostgreSQL connection string.

Options:
  --uploads-root=<path> Root for local file URL sampling (default: public).
  --only=<a,b,c>        Only verify these collections.
  -h, --help            Show this help.`;

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

function createPrisma() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error(HELP);
    fail('\nERROR: DATABASE_URL is required.', 2);
  }
  const { connectionString, schema } = parseDatabaseUrl(raw);
  const adapter = new PrismaPg({ connectionString }, { schema });
  return new PrismaClient({ adapter });
}

async function loadSourceDocs(exportDir, collection) {
  const filePath = path.join(exportDir, `${collection}.ndjson`);
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, 'utf8');
  return parseNdjsonContent(content);
}

/**
 * Transform source docs the same way the importer does, so comparison is
 * apples-to-apples (date-only Dates, renames, defaults).
 */
function expectedRows(collection, docs) {
  const rows = [];
  for (const doc of docs) {
    const result = transformForImport(collection, doc, {
      onPending: 'collect',
      onRejected: 'collect',
    });
    if (result.errors.length === 0) rows.push(result.output);
  }
  if (collection === 'menus') return sortMenusParentsFirst(rows);
  return rows;
}

function publicIdOf(collection, row) {
  const entry = getPrismaEntry(collection);
  if (!entry) return null;
  if (entry.idKind === 'none') {
    if (collection === 'settings') return row.key;
    if (collection === 'analytics') {
      const d = row.date instanceof Date ? formatDateOnly(row.date) : row.date;
      return `${d}::${row.path}`;
    }
  }
  return row.id ?? null;
}

function sortKey(collection, row) {
  const id = publicIdOf(collection, row);
  return id == null ? '' : String(id);
}

async function loadTargetRows(prisma, collection) {
  const entry = getPrismaEntry(collection);
  if (!entry) return [];
  const delegate = prisma[entry.clientKey];
  return delegate.findMany();
}

function checkCollection(collection, sourceDocs, targetRows) {
  const expected = expectedRows(collection, sourceDocs).map((r) =>
    normalizeRecordForCompare(collection, r),
  );
  const actual = targetRows.map((r) => normalizeRecordForCompare(collection, r));

  expected.sort((a, b) => sortKey(collection, a).localeCompare(sortKey(collection, b)));
  actual.sort((a, b) => sortKey(collection, a).localeCompare(sortKey(collection, b)));

  const checks = {};

  checks.count = compareCounts(expected.length, actual.length);

  const expIds = expected.map((r) => sortKey(collection, r)).filter(Boolean);
  const actIds = actual.map((r) => sortKey(collection, r)).filter(Boolean);
  checks.idSet = compareIdSets(expIds, actIds);

  checks.duplicateIds = {
    ok: findDuplicates(actIds).length === 0,
    duplicates: findDuplicates(actIds),
  };

  const entry = getPrismaEntry(collection);
  if (entry?.naturalKey) {
    const keyOf = (r) => entry.naturalKey.map((k) => String(r[k] ?? '')).join('::');
    checks.naturalKeyDuplicates = {
      ok: findDuplicates(actual.map(keyOf)).length === 0,
      duplicates: findDuplicates(actual.map(keyOf)),
    };
  }

  // Business hash: for analytics, ids are synthesised so drop id from hash.
  const hashOpts =
    collection === 'analytics' ? { dropKeys: ['_id', 'id'] } : { dropKeys: ['_id'] };
  checks.businessHash = compareBusinessHashes(expected, actual, hashOpts);

  if (collection === 'menus') {
    checks.menuIntegrity = checkMenuIntegrity(actual);
  }
  if (collection === 'pages') {
    checks.jsonBlocks = compareJsonFields(expected, actual, 'blocks');
  }
  if (collection === 'sidebar_widgets') {
    checks.jsonSettings = compareJsonFields(expected, actual, 'settings');
  }

  // Date bounds samples
  const dateField =
    entry?.dateOnlyFields?.[0] ||
    (entry?.timestampFields?.includes('createdAt') ? 'createdAt' : null);
  if (dateField) {
    checks.dateBounds = {
      source: sampleDateBounds(expected, dateField),
      target: sampleDateBounds(actual, dateField),
    };
    checks.dateBounds.ok =
      JSON.stringify(checks.dateBounds.source.first) ===
        JSON.stringify(checks.dateBounds.target.first) &&
      JSON.stringify(checks.dateBounds.source.last) ===
        JSON.stringify(checks.dateBounds.target.last);
  }

  checks.samples = pickTargetedSamples(expected).map((s) => {
    const tgt = actual.find((r) => sortKey(collection, r) === sortKey(collection, s.record));
    return {
      tag: s.tag,
      id: s.id,
      presentInTarget: Boolean(tgt),
    };
  });
  checks.samplesOk = checks.samples.every((s) => s.presentInTarget);

  const failed = Object.entries(checks)
    .filter(([k, v]) => {
      if (k === 'samples' || k === 'dateBounds') return false;
      if (k === 'samplesOk') return v !== true;
      return v && typeof v === 'object' && 'ok' in v ? !v.ok : false;
    })
    .map(([k]) => k);
  if (checks.dateBounds && checks.dateBounds.ok === false) failed.push('dateBounds');
  if (checks.samplesOk === false) failed.push('samples');

  return {
    collection,
    ok: failed.length === 0,
    failed,
    checks,
    counts: { expected: expected.length, actual: actual.length },
  };
}

function aggregateChecks(allSource, allTarget) {
  const out = {};

  out.documentsDownloadSum = {
    source: sumField(allSource.documents || [], 'downloadCount'),
    target: sumField(allTarget.documents || [], 'downloadCount'),
  };
  out.documentsDownloadSum.ok =
    out.documentsDownloadSum.source === out.documentsDownloadSum.target;

  out.analyticsViewsSum = {
    source: sumField(allSource.analytics || [], 'views'),
    target: sumField(allTarget.analytics || [], 'views'),
  };
  out.analyticsViewsSum.ok =
    out.analyticsViewsSum.source === out.analyticsViewsSum.target;

  out.analyticsByDatePath = {
    source: groupCount(allSource.analytics || [], (r) => {
      const d = r.date instanceof Date ? formatDateOnly(r.date) : r.date;
      return `${d}::${r.path}`;
    }),
    target: groupCount(allTarget.analytics || [], (r) => {
      const d = r.date instanceof Date ? formatDateOnly(r.date) : r.date;
      return `${d}::${r.path}`;
    }),
  };
  out.analyticsByDatePath.ok =
    JSON.stringify(out.analyticsByDatePath.source) ===
    JSON.stringify(out.analyticsByDatePath.target);

  out.survey = {
    sourceCount: (allSource.survey_responses || []).length,
    targetCount: (allTarget.survey_responses || []).length,
    sourceAvg: averageField(allSource.survey_responses || [], 'rating'),
    targetAvg: averageField(allTarget.survey_responses || [], 'rating'),
  };
  out.survey.ok =
    out.survey.sourceCount === out.survey.targetCount &&
    out.survey.sourceAvg === out.survey.targetAvg;

  out.casesByStatus = {
    source: groupCount(allSource.cases || [], (r) => String(r.status ?? '')),
    target: groupCount(allTarget.cases || [], (r) => String(r.status ?? '')),
  };
  out.casesByStatus.ok =
    JSON.stringify(out.casesByStatus.source) === JSON.stringify(out.casesByStatus.target);

  out.casesByType = {
    source: groupCount(allSource.cases || [], (r) => String(r.jenisPerkara ?? '')),
    target: groupCount(allTarget.cases || [], (r) => String(r.jenisPerkara ?? '')),
  };
  out.casesByType.ok =
    JSON.stringify(out.casesByType.source) === JSON.stringify(out.casesByType.target);

  out.activePublic = {
    newsPublished: {
      source: countWhere(allSource.news || [], (r) => r.isPublished === true),
      target: countWhere(allTarget.news || [], (r) => r.isPublished === true),
    },
    announcementsActive: {
      source: countWhere(allSource.announcements || [], (r) => r.isActive === true),
      target: countWhere(allTarget.announcements || [], (r) => r.isActive === true),
    },
    putusanPublished: {
      source: countWhere(allSource.putusan || [], (r) => r.statusPublish === true),
      target: countWhere(allTarget.putusan || [], (r) => r.statusPublish === true),
    },
  };
  out.activePublic.ok =
    out.activePublic.newsPublished.source === out.activePublic.newsPublished.target &&
    out.activePublic.announcementsActive.source ===
      out.activePublic.announcementsActive.target &&
    out.activePublic.putusanPublished.source === out.activePublic.putusanPublished.target;

  const failed = Object.entries(out)
    .filter(([, v]) => v && typeof v === 'object' && v.ok === false)
    .map(([k]) => k);

  return { ok: failed.length === 0, failed, details: out };
}

async function fileUrlCheck(allTarget, uploadsRoot) {
  const urls = [];
  for (const r of allTarget.media || []) if (r.url) urls.push(r.url);
  for (const r of allTarget.documents || []) if (r.fileUrl) urls.push(r.fileUrl);
  for (const r of allTarget.putusan || []) if (r.filePutusan) urls.push(r.filePutusan);
  for (const r of allTarget.gallery || []) if (r.imageUrl) urls.push(r.imageUrl);
  for (const r of allTarget.banners || []) if (r.imageUrl) urls.push(r.imageUrl);
  for (const r of allTarget.news || []) if (r.image) urls.push(r.image);

  const root = path.resolve(uploadsRoot);
  const existsFn = (url) => {
    const rel = url.replace(/^\//, '');
    const full = path.join(root, rel);
    return existsSync(full);
  };
  // Soft check: missing files are reported but do not fail the DB migration
  // verifier by default (file bytes are not moved by DB scripts). We still
  // surface them so operators can fix storage separately.
  const result = sampleFileUrlExistence(urls, existsFn);
  return {
    ...result,
    // File absence is a WARNING for cutover, not a hard DB verify failure.
    ok: true,
    warning: result.missing.length > 0,
    uploadsRoot: root,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (!args.exportDir) {
    console.error(HELP);
    fail('\nERROR: --export-dir=<path> is required.', 3);
  }
  const exportDir = path.resolve(args.exportDir);
  if (!existsSync(exportDir)) fail(`Export directory not found: ${exportDir}`, 3);

  let collections;
  try {
    collections = args.only
      ? resolveCollections({ only: args.only })
      : [...IMPORT_ORDER];
  } catch (err) {
    fail(err.message, 3);
  }
  collections = IMPORT_ORDER.filter((c) => collections.includes(c));

  const prisma = createPrisma();
  const perCollection = [];
  const allSource = {};
  const allTarget = {};

  try {
    for (const collection of collections) {
      console.error(`  verifying ${collection}…`);
      const sourceDocs = await loadSourceDocs(exportDir, collection);
      const targetRows = await loadTargetRows(prisma, collection);
      allSource[collection] = expectedRows(collection, sourceDocs);
      allTarget[collection] = targetRows.map((r) =>
        normalizeRecordForCompare(collection, r),
      );
      // Also normalize source expected for aggregates
      allSource[collection] = allSource[collection].map((r) =>
        normalizeRecordForCompare(collection, r),
      );

      const result = checkCollection(collection, sourceDocs, targetRows);
      perCollection.push(result);
      console.error(
        `    ${collection}: ${result.ok ? 'OK' : 'FAIL'} ` +
          `expected=${result.counts.expected} actual=${result.counts.actual}` +
          (result.failed.length ? ` failed=[${result.failed.join(',')}]` : ''),
      );
    }

    const aggregates = aggregateChecks(allSource, allTarget);
    console.error(
      `  aggregates: ${aggregates.ok ? 'OK' : 'FAIL'}` +
        (aggregates.failed.length ? ` failed=[${aggregates.failed.join(',')}]` : ''),
    );

    const fileUrls = await fileUrlCheck(allTarget, args.uploadsRoot);
    if (fileUrls.warning) {
      console.error(
        `  file-urls: WARNING ${fileUrls.missing.length} local upload path(s) missing under ${fileUrls.uploadsRoot}`,
      );
    } else {
      console.error(`  file-urls: OK (checked=${fileUrls.checked})`);
    }

    const report = {
      generatedAt: new Date().toISOString(),
      exportDir,
      collections: perCollection,
      aggregates,
      fileUrls,
      summary: {
        collectionOk: perCollection.every((c) => c.ok),
        aggregatesOk: aggregates.ok,
        failedCollections: perCollection.filter((c) => !c.ok).map((c) => c.collection),
      },
    };
    report.summary.ok = report.summary.collectionOk && report.summary.aggregatesOk;

    const reportPath = path.join(exportDir, 'verify-report.json');
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(`\nVerify report: ${reportPath}`);

    if (!report.summary.ok) {
      fail(
        `Verification FAILED. Failed collections: ${report.summary.failedCollections.join(', ') || '(none)'}; ` +
          `aggregate failures: ${aggregates.failed.join(', ') || '(none)'}`,
        5,
      );
    }
    console.error('Verification PASSED.');
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => fail(`Unhandled error: ${err.stack || err.message}`, 1));
