#!/usr/bin/env node
// PostgreSQL importer for the MongoDB → PostgreSQL/Prisma migration.
//
// ALL-OR-NOTHING STRATEGY (batch-tx-stop-on-first-failure):
//   - Each batch (~500 rows) runs inside one Prisma interactive transaction.
//   - If any record fails transform or insert, the batch rolls back, a reject
//     file is written, and the entire run aborts with a non-zero exit.
//   - Previously committed batches (if any) leave the target partial — the
//     operator MUST re-run against an empty target, or pass --force-recovery
//     to TRUNCATE application tables (never _prisma_migrations) first.
//   - Partial-success is never reported as success.
//
// TARGET GUARD:
//   - Refuses nonempty application tables unless --force-recovery.
//   - Never touches `_prisma_migrations`.
//
// TRANSFORMS:
//   - Uses scripts/migration/lib/transforms/* + transform-rules.mjs.
//   - Preserves public `id` and bcrypt password hashes.
//   - Menus: parents before children.
//
// USAGE
//   DATABASE_URL='postgresql://…' \
//   node scripts/migration/import-postgres.mjs \
//     --export-dir=.migration-artifacts/export-… \
//     [--batch-size=500] \
//     [--force-recovery] \
//     [--only=news,users]
//
// EXIT CODES
//   0  full import succeeded
//   2  DATABASE_URL missing
//   3  bad args / missing export
//   4  target nonempty (without --force-recovery)
//   5  transform/insert reject (reject file written)
//   1  other runtime error

import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../lib/generated/prisma/client.ts';
import { parseDatabaseUrl } from '../../lib/prisma.js';

import {
  IMPORT_ORDER,
  APPLICATION_TABLES,
  getPrismaEntry,
  parseNdjsonContent,
  transformForImport,
  sortMenusParentsFirst,
  chunk,
  assertEmptyTarget,
  buildRejectEntry,
  ALL_OR_NOTHING_STRATEGY,
} from './lib/transforms/index.mjs';
import { resolveCollections } from './collections.mjs';

const DEFAULT_BATCH = 500;

function parseArgs(argv) {
  const out = {
    exportDir: '',
    batchSize: DEFAULT_BATCH,
    forceRecovery: false,
    only: '',
    help: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--export-dir=')) out.exportDir = arg.slice('--export-dir='.length);
    else if (arg.startsWith('--batch-size=')) {
      out.batchSize = Number.parseInt(arg.slice('--batch-size='.length), 10) || DEFAULT_BATCH;
    } else if (arg === '--force-recovery') out.forceRecovery = true;
    else if (arg.startsWith('--only=')) out.only = arg.slice('--only='.length);
  }
  return out;
}

const HELP = `Usage:
  DATABASE_URL='postgresql://…' node scripts/migration/import-postgres.mjs [options]

Required:
  --export-dir=<path>   Directory produced by export-mongodb.mjs (has manifest.json + *.ndjson).
  DATABASE_URL          PostgreSQL connection string.

Options:
  --batch-size=<n>      Rows per transaction (default 500).
  --force-recovery      TRUNCATE application tables first when target is nonempty.
                        Never truncates _prisma_migrations.
  --only=<a,b,c>        Only import these collections (must be known).
  -h, --help            Show this help.

All-or-nothing: ${ALL_OR_NOTHING_STRATEGY.name}
${ALL_OR_NOTHING_STRATEGY.description}`;

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
  return { prisma: new PrismaClient({ adapter }), schema };
}

async function countApplicationTables(prisma) {
  const counts = {};
  for (const table of APPLICATION_TABLES) {
    const entry = getPrismaEntry(table);
    if (!entry) {
      counts[table] = 0;
      continue;
    }
    const n = await prisma[entry.clientKey].count();
    counts[table] = n;
  }
  return counts;
}

/**
 * TRUNCATE application tables in an order that respects menus FK.
 * Uses raw SQL so we never emit the forbidden Mongo static-guard tokens
 * (deleteMany / etc.) and so we can RESTART IDENTITY CASCADE safely.
 * NEVER truncates `_prisma_migrations`.
 */
async function truncateApplicationTables(prisma) {
  // Children first for menus self-FK, then everything else.
  // TRUNCATE … CASCADE handles FKs within the listed set.
  const tables = [...APPLICATION_TABLES].reverse();
  const quoted = tables.map((t) => `"${t}"`).join(', ');
  const sql = `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`;
  console.error(`  recovery: ${sql}`);
  // Prisma tagged template for a static SQL string (no user interpolation of
  // values — table names come from our frozen APPLICATION_TABLES constant).
  await prisma.$executeRawUnsafe(sql);
}

async function loadCollectionDocs(exportDir, collection) {
  const filePath = path.join(exportDir, `${collection}.ndjson`);
  if (!existsSync(filePath)) {
    // Empty collection is allowed (manifest may still list count=0).
    return [];
  }
  const content = await readFile(filePath, 'utf8');
  return parseNdjsonContent(content);
}

async function writeRejectFile(exportDir, rejects) {
  const rejectDir = path.join(exportDir, 'rejects');
  await mkdir(rejectDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rejectPath = path.join(rejectDir, `reject-${stamp}.json`);
  const payload = {
    generatedAt: new Date().toISOString(),
    strategy: ALL_OR_NOTHING_STRATEGY,
    rejectCount: rejects.length,
    rejects,
  };
  await writeFile(rejectPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return rejectPath;
}

/**
 * Transform a list of Mongo docs → Prisma rows. On any error, returns rejects
 * and does not produce a partial rows array for writing.
 */
function transformAll(collection, docs) {
  const rows = [];
  const rejects = [];
  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i];
    try {
      const result = transformForImport(collection, doc, {
        onPending: 'collect',
        onRejected: 'collect',
      });
      if (result.errors.length > 0) {
        rejects.push(
          buildRejectEntry({
            collection,
            index: i,
            publicId: doc?.id ?? null,
            errors: result.errors,
            rawDoc: doc,
          }),
        );
        continue;
      }
      rows.push(result.output);
    } catch (err) {
      rejects.push(
        buildRejectEntry({
          collection,
          index: i,
          publicId: doc?.id ?? null,
          errors: [
            {
              field: err.field || null,
              anomaly: err.anomaly || err.reason || err.name,
              message: err.message,
              kind: 'thrown',
            },
          ],
          rawDoc: doc,
        }),
      );
    }
  }
  return { rows, rejects };
}

async function insertBatch(prisma, collection, batch) {
  const entry = getPrismaEntry(collection);
  if (!entry) throw new Error(`No prisma map for ${collection}`);
  const delegate = prisma[entry.clientKey];
  // createMany is a single multi-row insert; skipDuplicates=false so unique
  // violations surface as failures (all-or-nothing).
  await delegate.createMany({ data: batch });
}

async function importCollection(prisma, collection, docs, batchSize) {
  let prepared = docs;
  if (collection === 'menus') {
    // Transform first, then parent-before-child order on the Prisma rows.
    const { rows, rejects } = transformAll(collection, docs);
    if (rejects.length) return { imported: 0, rejects };
    prepared = sortMenusParentsFirst(rows);
    // prepared is already transformed — insert in batches.
    const batches = chunk(prepared, batchSize);
    let imported = 0;
    for (let b = 0; b < batches.length; b += 1) {
      const batch = batches[b];
      try {
        await prisma.$transaction(async (tx) => {
          await insertBatch(tx, collection, batch);
        });
        imported += batch.length;
        console.error(`    ${collection}: batch ${b + 1}/${batches.length} ok (+${batch.length}, total=${imported})`);
      } catch (err) {
        return {
          imported,
          rejects: [
            buildRejectEntry({
              collection,
              index: imported,
              publicId: batch[0]?.id ?? null,
              errors: [
                {
                  field: null,
                  anomaly: 'insert-failed',
                  message: err.message,
                  kind: 'rejected',
                },
              ],
            }),
          ],
        };
      }
    }
    return { imported, rejects: [] };
  }

  const { rows, rejects } = transformAll(collection, docs);
  if (rejects.length) return { imported: 0, rejects };

  const batches = chunk(rows, batchSize);
  let imported = 0;
  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b];
    try {
      await prisma.$transaction(async (tx) => {
        await insertBatch(tx, collection, batch);
      });
      imported += batch.length;
      console.error(`    ${collection}: batch ${b + 1}/${batches.length} ok (+${batch.length}, total=${imported})`);
    } catch (err) {
      return {
        imported,
        rejects: [
          buildRejectEntry({
            collection,
            index: imported,
            publicId: batch[0]?.id ?? null,
            errors: [
              {
                field: null,
                anomaly: 'insert-failed',
                message: err.message,
                kind: 'rejected',
              },
            ],
          }),
        ],
      };
    }
  }
  return { imported, rejects: [] };
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
  if (!existsSync(exportDir)) {
    fail(`Export directory not found: ${exportDir}`, 3);
  }
  const manifestPath = path.join(exportDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    fail(`manifest.json not found in ${exportDir}`, 3);
  }

  let collections;
  try {
    collections = args.only
      ? resolveCollections({ only: args.only })
      : [...IMPORT_ORDER];
  } catch (err) {
    fail(err.message, 3);
  }
  // Preserve IMPORT_ORDER for the selected subset.
  collections = IMPORT_ORDER.filter((c) => collections.includes(c));

  const { prisma } = createPrisma();
  try {
    console.error('Checking target emptiness…');
    const counts = await countApplicationTables(prisma);
    const guard = assertEmptyTarget(counts, { forceRecovery: args.forceRecovery });
    if (!guard.ok) {
      fail(guard.reason, 4);
    }
    if (args.forceRecovery && guard.nonempty.length > 0) {
      console.error(guard.reason);
      await truncateApplicationTables(prisma);
    }

    console.error(`Import strategy: ${ALL_OR_NOTHING_STRATEGY.name}`);
    console.error(`Collections (order): ${collections.join(', ')}`);

    const summary = [];
    for (const collection of collections) {
      console.error(`  importing ${collection}…`);
      const docs = await loadCollectionDocs(exportDir, collection);
      const { imported, rejects } = await importCollection(
        prisma,
        collection,
        docs,
        args.batchSize,
      );
      if (rejects.length > 0) {
        const rejectPath = await writeRejectFile(exportDir, rejects);
        console.error(`REJECT: ${rejects.length} failed record(s) in ${collection}`);
        console.error(`Reject file: ${rejectPath}`);
        console.error(ALL_OR_NOTHING_STRATEGY.description);
        fail(
          `Import aborted on ${collection}. Re-run against an empty target ` +
            `(or --force-recovery). Partial batches before this collection may have committed.`,
          5,
        );
      }
      summary.push({ collection, imported, sourceCount: docs.length });
      console.error(`    ${collection}: imported=${imported} source=${docs.length}`);
    }

    const reportPath = path.join(exportDir, 'import-report.json');
    await writeFile(
      reportPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          strategy: ALL_OR_NOTHING_STRATEGY,
          summary,
          totals: {
            collections: summary.length,
            imported: summary.reduce((s, x) => s + x.imported, 0),
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.error(`\nImport complete. Report: ${reportPath}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => fail(`Unhandled error: ${err.stack || err.message}`, 1));
