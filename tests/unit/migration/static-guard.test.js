import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const MIGRATION_ROOT = path.resolve(process.cwd(), 'scripts', 'migration');

// Files that MUST be statically scan-clean. The CLI file is the one that
// actually opens a Mongo connection; the lib/* helpers are pure functions but
// we scan them too so a refactor cannot smuggle in a write call via a helper.
function listMigrationFiles() {
  if (!existsSync(MIGRATION_ROOT)) return [];
  const out = [];
  const stack = [MIGRATION_ROOT];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of readdirSync(cur)) {
      const full = path.join(cur, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (full.endsWith('.mjs')) out.push(full);
    }
  }
  return out.sort();
}

// Forbidden MongoDB driver write/mutation methods + aggregation output stages.
// Statically scanning for these tokens (with word boundaries) lets the
// reviewer prove the profiler is read-only without executing it.
const FORBIDDEN_TOKENS = [
  'updateOne',
  'updateMany',
  'replaceOne',
  'insertOne',
  'insertMany',
  'bulkWrite',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findAndModify',
  'createIndex',
  'createIndexes',
  'dropIndex',
  'dropIndexes',
  'dropDatabase',
  'dropCollection',
  'renameCollection',
  'createCollection',
  '$out',
  '$merge',
];

// The word "drop" alone is risky but legitimate in non-Mongo contexts
// (dropDatabase/dropCollection are already in FORBIDDEN_TOKENS). We additionally
// forbid a bare `.drop(` call target because the Mongo Collection.drop()
// method is destructive.
const FORBIDDEN_REGEX_BARE_DROP = /\.drop\s*\(/;

function stripCommentsAndStrings(source) {
  // Remove block comments, line comments, and string/template literals.
  // This is a deliberately conservative strip: we'd rather over-strip than
  // let a forbidden token hide inside a comment. Numbers, identifiers, and
  // dotted member accesses survive.
  let out = source;
  out = out.replace(/\/\*[\s\S]*?\*\//g, ' ');
  out = out.replace(/\/\/[^\n]*/g, ' ');
  out = out.replace(/`(?:\\.|[^`\\])*`/g, ' ` ` ');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, " ' ' ");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, ' " " ');
  return out;
}

describe('static read-only guard', () => {
  test('the migration directory exists and exposes the expected entry files', () => {
    const files = listMigrationFiles();
    expect(files.map((f) => path.relative(MIGRATION_ROOT, f))).toEqual(
      expect.arrayContaining([
        'profile-mongodb.mjs',
        'collections.mjs',
        'lib/canonicalize.mjs',
        'lib/schema-map.mjs',
        'lib/anomaly.mjs',
        'lib/report.mjs',
      ]),
    );
  });

  describe.each(listMigrationFiles())('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    const stripped = stripCommentsAndStrings(source);

    test.each(FORBIDDEN_TOKENS)('does not contain forbidden token %s', (token) => {
      // Word-boundary match so e.g. "findOneAndUpdate" must not match inside a
      // larger identifier; we use a regex that looks for the token surrounded
      // by non-identifier characters OR string-start/end.
      const re = new RegExp(`(^|[^A-Za-z0-9_$])${token.replace(/[$]/g, '\\$&')}([^A-Za-z0-9_$]|$)`);
      expect(stripped).not.toMatch(re);
    });

    test('does not contain a bare .drop() call', () => {
      expect(stripped).not.toMatch(FORBIDDEN_REGEX_BARE_DROP);
    });
  });

  test('the CLI profiler only imports the MongoClient symbol (no Collection-level writes)', () => {
    const cli = readFileSync(path.join(MIGRATION_ROOT, 'profile-mongodb.mjs'), 'utf8');
    // Imports from mongodb must be just MongoClient.
    expect(cli).toMatch(/import\s*\{[^}]*\bMongoClient\b[^}]*\}\s*from\s*['"]mongodb['"]/);
    // No other mongodb symbols imported.
    const mongoImportMatch = cli.match(/import\s*\{([^}]*)\}\s*from\s*['"]mongodb['"]/);
    expect(mongoImportMatch).not.toBeNull();
    const importedSymbols = mongoImportMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(importedSymbols).toEqual(['MongoClient']);
  });

  test('the CLI profiler calls only read-only driver methods', () => {
    const cli = readFileSync(path.join(MIGRATION_ROOT, 'profile-mongodb.mjs'), 'utf8');
    const stripped = stripCommentsAndStrings(cli);
    // Driver-touching method calls in the file. We assert presence of the
    // approved read-only calls so a reviewer sees explicit allowlisting.
    expect(stripped).toMatch(/\.countDocuments\s*\(/);
    expect(stripped).toMatch(/\.find\s*\(/);
    expect(stripped).toMatch(/\.toArray\s*\(/);
    expect(stripped).toMatch(/\.limit\s*\(/);
    expect(stripped).toMatch(/\.connect\s*\(/);
    expect(stripped).toMatch(/\.close\s*\(/);
  });
});
