#!/usr/bin/env node
// Read-only MongoDB exporter for the MongoDB → PostgreSQL/Prisma migration.
//
// INVARIANT — this script is provably read-only against MongoDB. The only
// MongoDB driver methods invoked are:
//   - MongoClient connect / close
//   - db() / collection()
//   - countDocuments()
//   - find().sort({ _id: 1 }).toArray()   (or cursor stream)
//
// It never mutates Mongo data. A static guard test scans this tree for
// forbidden write tokens.
//
// SECRETS — connection URIs are sanitized before logging. Password / bcrypt
// hashes are NEVER printed. The NDJSON export DOES contain bcrypt hashes
// (they must be migrated), so the output directory must be access-restricted
// and preferably encrypted at rest. Manifest metadata redacts secret fields.
//
// USAGE
//   MONGODB_URI='mongodb://...' \
//   MONGODB_DB_NAME='pa_penajam' \
//   node scripts/migration/export-mongodb.mjs \
//     --profile=.migration-artifacts/profile-…/profile.json \
//     [--out-dir=.migration-artifacts] \
//     [--only=news,users] \
//     [--allow-unprofiled]   # local dry-run only; NOT for cutover
//
// EXIT CODES
//   0  export written successfully
//   2  MONGODB_URI missing
//   3  unknown collection / bad args
//   4  unresolved profiler blockers
//   1  other runtime error

import { MongoClient } from 'mongodb';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveCollections } from './collections.mjs';
import {
  sanitizeConnectionUri,
  sanitizeRecord,
  isSecretField,
  estimateJsonBytes,
} from './lib/canonicalize.mjs';
import {
  createNdjsonWriter,
  loadProfileBlockers,
  hasUnresolvedBlockers,
  sha256Canonical,
  documentToNdjsonLine,
} from './lib/transforms/index.mjs';

const ENV_URI_KEYS = ['MONGODB_URI', 'MONGO_URL'];
const ENV_DB_KEYS = ['MONGODB_DB_NAME', 'DB_NAME'];

function parseArgs(argv) {
  const out = {
    outDir: '.migration-artifacts',
    only: '',
    profile: '',
    allowUnprofiled: false,
    help: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--out-dir=')) out.outDir = arg.slice('--out-dir='.length);
    else if (arg.startsWith('--only=')) out.only = arg.slice('--only='.length);
    else if (arg.startsWith('--profile=')) out.profile = arg.slice('--profile='.length);
    else if (arg === '--allow-unprofiled') out.allowUnprofiled = true;
  }
  return out;
}

const HELP = `Usage:
  MONGODB_URI='mongodb://...' node scripts/migration/export-mongodb.mjs [options]

Required environment:
  MONGODB_URI (or MONGO_URL)   MongoDB connection string (sanitized in logs).

Optional environment:
  MONGODB_DB_NAME (or DB_NAME) Database name (defaults to URI default db).

Options:
  --profile=<path>     Path to profile.json from profile-mongodb.mjs.
                       Export FAILS if blockers are unresolved.
  --allow-unprofiled   Skip profile gate (local dry-run ONLY — never cutover).
  --only=<a,b,c>       Only export these collections (must be known).
  --out-dir=<path>     Where to write export-<timestamp>/ (default .migration-artifacts).
  -h, --help           Show this help.

This exporter is strictly read-only against MongoDB. NDJSON artifacts contain
bcrypt password hashes and must be access-restricted / encrypted at rest.`;

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

/**
 * Redact secret fields for manifest sample previews. Full password hashes must
 * never appear in the manifest (they remain only in the NDJSON data files).
 */
function redactForManifest(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  return sanitizeRecord(doc);
}

function extractMinMaxDates(docs) {
  let min = null;
  let max = null;
  for (const doc of docs) {
    for (const key of ['createdAt', 'updatedAt', 'publishDate', 'date', 'tanggalSidang', 'tanggalPutusan']) {
      const v = doc?.[key];
      if (v == null || v === '') continue;
      const iso =
        v instanceof Date
          ? v.toISOString()
          : typeof v === 'string'
            ? v
            : null;
      if (!iso) continue;
      if (min === null || iso < min) min = iso;
      if (max === null || iso > max) max = iso;
    }
  }
  return { minDate: min, maxDate: max };
}

/**
 * Canonical content hash over ordered documents (business fields, secrets
 * replaced with a presence marker so the hash is stable without leaking).
 */
function collectionContentHash(docs) {
  const lines = docs.map((doc) => {
    const clone = {};
    for (const [k, v] of Object.entries(doc || {})) {
      if (k === '_id') {
        clone._id =
          v && typeof v === 'object' && typeof v.toHexString === 'function'
            ? v.toHexString()
            : v;
        continue;
      }
      if (isSecretField(k)) {
        clone[k] = '<present>';
        continue;
      }
      if (v instanceof Date) clone[k] = v.toISOString();
      else if (v && typeof v === 'object' && typeof v.toHexString === 'function') {
        clone[k] = v.toHexString();
      } else clone[k] = v;
    }
    return documentToNdjsonLine(clone);
  });
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

async function exportCollection(db, name, outDir) {
  const col = db.collection(name);
  const total = await col.countDocuments({});
  // Deterministic order by _id ascending.
  const docs = total === 0
    ? []
    : await col.find({}).sort({ _id: 1 }).toArray();

  const fileName = `${name}.ndjson`;
  const filePath = path.join(outDir, fileName);
  const writer = createNdjsonWriter(filePath);
  for (const doc of docs) {
    await writer.write(doc);
  }
  const fileStats = await writer.close();

  const { minDate, maxDate } = extractMinMaxDates(docs);
  const contentSha256 = collectionContentHash(docs);
  const estimatedBytes = docs.reduce((s, d) => s + estimateJsonBytes(d), 0);

  return {
    collection: name,
    count: docs.length,
    countDocuments: total,
    file: fileName,
    byteSize: fileStats.bytes,
    estimatedJsonBytes: estimatedBytes,
    fileSha256: fileStats.sha256,
    contentSha256,
    minDate,
    maxDate,
    // Tiny sanitized sample for operators (never includes real hashes).
    samplePreview: docs.slice(0, 1).map(redactForManifest),
  };
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
      '\nERROR: MONGODB_URI (or MONGO_URL) is required. Refusing to run without a source URI.',
      2,
    );
  }
  const dbName = ENV_DB_KEYS.map((k) => process.env[k]).find((v) => v && v.trim()) || '';

  // Blocker gate.
  const blockers = await loadProfileBlockers(args.profile || null, {
    required: !args.allowUnprofiled,
  });
  if (hasUnresolvedBlockers(blockers)) {
    console.error('ERROR: Unresolved profiler blockers — export aborted.');
    for (const b of blockers) {
      console.error(`  - [${b.kind}] ${b.message}`);
    }
    fail(
      '\nResolve blockers (or re-run profiler after cleanse) before exporting. ' +
        'Use --allow-unprofiled only for local dry-runs, never for cutover.',
      4,
    );
  }

  let collections;
  try {
    collections = resolveCollections({ only: args.only });
  } catch (err) {
    fail(err.message, 3);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outRoot = path.resolve(args.outDir, `export-${timestamp}`);
  await mkdir(outRoot, { recursive: true });

  const client = new MongoClient(uri);
  let db;
  try {
    await client.connect();
    db = dbName ? client.db(dbName) : client.db();
  } catch (err) {
    await client.close().catch(() => {});
    fail(
      `Unable to connect to MongoDB (${sanitizeConnectionUri(uri)}): ${err.message}`,
      1,
    );
  }

  const collectionManifests = [];
  try {
    for (const name of collections) {
      console.error(`  exporting ${name}…`);
      const entry = await exportCollection(db, name, outRoot);
      collectionManifests.push(entry);
      console.error(
        `    ${name}: count=${entry.count} bytes=${entry.byteSize} sha256=${entry.fileSha256.slice(0, 12)}…`,
      );
    }
  } finally {
    await client.close().catch(() => {});
  }

  const actualDbName = db.databaseName;
  const manifest = {
    version: 1,
    kind: 'mongodb-export',
    generatedAt: new Date().toISOString(),
    source: {
      // Sanitized — never log password.
      mongoUri: sanitizeConnectionUri(uri),
      dbName: actualDbName,
      clusterHint: (() => {
        try {
          const u = new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:'));
          return u.hostname || '<unknown>';
        } catch {
          return '<unknown>';
        }
      })(),
    },
    policy: {
      readOnly: true,
      orderedBy: '_id',
      format: 'ndjson-extended-json',
      secretsInNdjson: true,
      secretsInManifest: false,
      note:
        'NDJSON files contain bcrypt password hashes and must be access-restricted ' +
        'and encrypted at rest. Manifest never prints full password hashes.',
    },
    profile: {
      path: args.profile || null,
      allowUnprofiled: args.allowUnprofiled,
      blockersResolved: true,
    },
    collections: collectionManifests,
    totals: {
      collections: collectionManifests.length,
      documents: collectionManifests.reduce((s, c) => s + c.count, 0),
      bytes: collectionManifests.reduce((s, c) => s + c.byteSize, 0),
    },
  };
  manifest.manifestSha256 = sha256Canonical({
    generatedAt: manifest.generatedAt,
    source: manifest.source,
    collections: collectionManifests.map((c) => ({
      collection: c.collection,
      count: c.count,
      fileSha256: c.fileSha256,
      contentSha256: c.contentSha256,
    })),
  });

  const manifestPath = path.join(outRoot, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.error(`\nExport written:`);
  console.error(`  ${outRoot}`);
  console.error(`  manifest: ${manifestPath}`);
  console.error(`  source: ${sanitizeConnectionUri(uri)} / db=${actualDbName}`);
  console.error(
    `  collections=${manifest.totals.collections} documents=${manifest.totals.documents} bytes=${manifest.totals.bytes}`,
  );
  console.error(
    'WARNING: NDJSON artifacts contain password hashes. Restrict access and encrypt at rest.',
  );
}

main().catch((err) => fail(`Unhandled error: ${err.stack || err.message}`, 1));
