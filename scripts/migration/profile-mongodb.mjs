#!/usr/bin/env node
// Read-only MongoDB profiler for the MongoDB -> PostgreSQL/Prisma migration.
//
// INVARIANT — this script is provably read-only. The only MongoDB driver
// methods invoked are:
//   - MongoClient connect / close
//   - db()                      (select database)
//   - collection()              (select collection)
//   - countDocuments()          (read count)
//   - find().toArray()          (read sample)
//
// It never calls any write/mutation method and never constructs an aggregation
// pipeline. A static guard test in tests/unit/migration/static-guard.test.js
// scans this file (and the lib helpers) for forbidden tokens.
//
// SECRETS — connection URIs are sanitized before logging; sample records are
// passed through sanitizeRecord() which replaces `password` with `<redacted>`.
// No bcrypt hash or password is ever written to the output directory.
//
// USAGE
//   MONGODB_URI='mongodb://...' \
//   MONGODB_DB_NAME='pa_penajam' \
//   node scripts/migration/profile-mongodb.mjs [--sample=500] [--only=news,users] [--out-dir=.migration-artifacts]
//
// EXIT CODES
//   0  profile written successfully
//   2  MONGODB_URI missing (fail-closed)
//   3  unknown collection requested via --only
//   1  other runtime error (e.g. cannot reach Mongo)

import { MongoClient } from 'mongodb';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveCollections } from './collections.mjs';
import { analyzeCollection } from './lib/anomaly.mjs';
import { buildReport, renderMarkdown } from './lib/report.mjs';
import { sanitizeConnectionUri } from './lib/canonicalize.mjs';

const DEFAULT_SAMPLE_LIMIT = 500;
const ENV_URI_KEYS = ['MONGODB_URI', 'MONGO_URL'];
const ENV_DB_KEYS = ['MONGODB_DB_NAME', 'DB_NAME'];

function parseArgs(argv) {
  const out = { sampleLimit: DEFAULT_SAMPLE_LIMIT, only: '', outDir: '.migration-artifacts' };
  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg.startsWith('--sample=')) {
      out.sampleLimit = Number.parseInt(arg.slice('--sample='.length), 10) || DEFAULT_SAMPLE_LIMIT;
    } else if (arg.startsWith('--only=')) {
      out.only = arg.slice('--only='.length);
    } else if (arg.startsWith('--out-dir=')) {
      out.outDir = arg.slice('--out-dir='.length);
    }
  }
  return out;
}

const HELP = `Usage:
  MONGODB_URI='mongodb://...' node scripts/migration/profile-mongodb.mjs [options]

Required environment:
  MONGODB_URI (or MONGO_URL)        MongoDB connection string. Sanitized in logs.

Optional environment:
  MONGODB_DB_NAME (or DB_NAME)      Database name (defaults to URI default db).

Options:
  --sample=<n>        Max records to sample per collection (default 500).
  --only=<a,b,c>      Only profile these collections (must be known).
  --out-dir=<path>    Where to write profile-<timestamp>/ (default .migration-artifacts).
  -h, --help          Show this help and exit.

This profiler is strictly read-only. It calls only countDocuments() and
find().toArray(). It never mutates data.`;

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

async function profileDatabase({ uri, dbName, sampleLimit, only }) {
  const collections = resolveCollections({ only });
  const client = new MongoClient(uri);
  let db;
  try {
    await client.connect();
    db = dbName ? client.db(dbName) : client.db();
  } catch (err) {
    await client.close().catch(() => {});
    throw new Error(`Unable to connect to MongoDB (${sanitizeConnectionUri(uri)}): ${err.message}`);
  }

  const collectionAnalyses = [];
  try {
    for (const name of collections) {
      const col = db.collection(name);
      const total = await col.countDocuments({});
      const sample = total === 0 ? [] : await col.find({}).limit(sampleLimit).toArray();
      const analysis = analyzeCollection(name, sample);
      collectionAnalyses.push({ collection: name, analysis, sampleRecords: sample, total });
      console.error(`  profiled ${name}: total=${total}, sample=${sample.length}`);
    }
  } finally {
    await client.close().catch(() => {});
  }
  return collectionAnalyses;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(HELP);
    return;
  }

  const uri = ENV_URI_KEYS.map((k) => process.env[k]).find((v) => v && v.trim());
  if (!uri) {
    console.error(HELP);
    fail(
      `\nERROR: MONGODB_URI (or MONGO_URL) is required. The profiler is read-only but still needs a source to read from. Refusing to run without a source URI.`,
      2,
    );
  }
  const dbName = ENV_DB_KEYS.map((k) => process.env[k]).find((v) => v && v.trim()) || '';

  let collectionAnalyses;
  try {
    collectionAnalyses = await profileDatabase({
      uri,
      dbName,
      sampleLimit: args.sampleLimit,
      only: args.only,
    });
  } catch (err) {
    if (err.message && /Unknown collection/i.test(err.message)) {
      fail(err.message, 3);
    }
    fail(`Profiler failed: ${err.message}`, 1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outRoot = path.resolve(args.outDir, `profile-${timestamp}`);
  await mkdir(outRoot, { recursive: true });

  const report = buildReport({
    mongoUriRaw: uri,
    dbName: dbName || '<from-uri>',
    generatedAt: new Date().toISOString(),
    sampleLimit: args.sampleLimit,
    collectionAnalyses,
  });

  const jsonPath = path.join(outRoot, 'profile.json');
  const mdPath = path.join(outRoot, 'profile.md');
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(mdPath, renderMarkdown(report), 'utf8');

  console.error(`\nProfile written:`);
  console.error(`  ${jsonPath}`);
  console.error(`  ${mdPath}`);
  console.error(`Source URI: ${sanitizeConnectionUri(uri)}`);
  console.error(`Collections profiled: ${report.totals.collections}`);
  console.error(`Anomalies flagged: ${report.totals.totalAnomalies}`);
}

main().catch((err) => fail(`Unhandled error: ${err.stack || err.message}`, 1));
