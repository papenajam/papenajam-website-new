// Validation tests for Task 4 — local PostgreSQL development/test environment.
//
// These tests assert the structural and safety invariants of the local/test
// PostgreSQL setup artifacts so they cannot regress silently:
//   - compose.db.yml pins postgres:16, exposes a healthcheck, and targets the
//     dev + test databases.
//   - .env.example contains ONLY placeholders (no real password/secret values).
//   - .gitignore ignores real .env files but explicitly tracks .env.example.
//   - The local/test-only reset scripts exist and refuse production-like names.
//
// These tests do NOT start any container and do NOT make any network
// connection. They read files and (for shell scripts) exercise the denylist
// logic with a mocked `psql` on PATH.

import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function readRepo(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// compose.db.yml
// ---------------------------------------------------------------------------

// Lightweight YAML structural parser for the subset we use. We do not pull in
// a YAML dependency for this single check; instead we parse indentation at
// the level of `services:` and the service body. This is intentionally
// forgiving — it only needs to detect the fields we assert on.
function parseComposeTopLevel(src) {
  const lines = src.split('\n');
  const top = {};
  let currentKey = null;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.search(/\S/);
    if (indent === 0 && /^[\w-]+:\s*$/.test(raw)) {
      currentKey = raw.slice(0, -1).trim();
      top[currentKey] = { _indent: 0, _raw: raw, _children: [] };
    } else if (currentKey && indent > 0) {
      top[currentKey]._children.push(raw);
    }
  }
  return top;
}

describe('compose.db.yml', () => {
  const COMPOSE_REL = 'compose.db.yml';
  const composeSrc = readRepo(COMPOSE_REL);

  test('file exists and is non-empty', () => {
    expect(composeSrc.trim().length).toBeGreaterThan(0);
  });

  test('pins postgres:16-alpine (no floating tag)', () => {
    expect(composeSrc).toMatch(/image:\s*postgres:16-alpine\b/);
    // Reject common floating forms that would break reproducibility.
    expect(composeSrc).not.toMatch(/postgres:\s*(latest|16$)/);
    expect(composeSrc).not.toMatch(/postgres:\s*17/);
    expect(composeSrc).not.toMatch(/postgres:\s*15/);
  });

  test('defines a healthcheck on the postgres service', () => {
    expect(composeSrc).toMatch(/healthcheck:/);
    expect(composeSrc).toMatch(/pg_isready/);
    // Healthcheck must use a non-zero retries/interval so dependents can wait.
    expect(composeSrc).toMatch(/retries:\s*\d+/);
    expect(composeSrc).toMatch(/interval:\s*\d+s/);
  });

  test('defines and references both dev and test databases', () => {
    // Two distinct DBs must be referenced. We assert both the env var names
    // and the default literal names so a rename cannot silently drop one.
    expect(composeSrc).toMatch(/POSTGRES_DEV_DB:/);
    expect(composeSrc).toMatch(/POSTGRES_TEST_DB:/);
    expect(composeSrc).toMatch(/pa_penajam_dev/);
    expect(composeSrc).toMatch(/pa_penajam_test/);
  });

  test('binds the published port to 127.0.0.1 only (no external exposure)', () => {
    expect(composeSrc).toMatch(/127\.0\.0\.1:5432:5432/);
    // No 0.0.0.0 / bare port mapping that would expose the DB externally.
    expect(composeSrc).not.toMatch(/0\.0\.0\.0:5432/);
    expect(composeSrc).not.toMatch(/^- \s*"5432:5432"/m);
  });

  test('mounts the init script that creates dev + test DBs', () => {
    expect(composeSrc).toMatch(/init-databases\.sh/);
    expect(composeSrc).toMatch(/docker-entrypoint-initdb\.d/);
  });

  test('uses a named volume for data persistence', () => {
    expect(composeSrc).toMatch(/postgres_data:/);
    expect(composeSrc).toMatch(/\/var\/lib\/postgresql\/data/);
  });

  test('structural parse: services key present with at least one service', () => {
    const top = parseComposeTopLevel(composeSrc);
    expect(top).toHaveProperty('services');
    expect(top.services._children.length).toBeGreaterThan(0);
  });

  test('declares local/test-only scope in a comment header', () => {
    expect(composeSrc).toMatch(/LOCAL AND TEST ONLY|LOCAL\/TEST ONLY/i);
  });
});

// ---------------------------------------------------------------------------
// .env.example — placeholders only, no real secrets
// ---------------------------------------------------------------------------

describe('.env.example', () => {
  const ENV_REL = '.env.example';
  const envSrc = readRepo(ENV_REL);

  // Substrings that would indicate a real (non-placeholder) value has leaked
  // in. These are conservative: a placeholder should be an obvious marker.
  // We allow `CHANGE_ME` and `<...>` templates and short documented defaults.
  const REAL_SECRET_HINTS = [
    // Long base64-ish blobs that look like generated secrets/JWTs (>=32 chars,
    // no spaces). A real JWT or openssl-rand output would match this.
    /[A-Za-z0-9+/]{32,}={0,2}/,
  ];

  // Keys whose VALUES must be placeholders. We allow the documented local
  // defaults (`pa_penajam_dev`, `127.0.0.1`, port, `papenajam` role name,
  // `?schema=public`, and `CHANGE_ME` markers).
  const SENSITIVE_KEYS = [
    'POSTGRES_PASSWORD',
    'POSTGRES_APP_PASSWORD',
    'JWT_SECRET',
    'DATABASE_URL',
    'DATABASE_URL_DEV',
    'DATABASE_URL_TEST',
    'MONGO_URL',
  ];

  function parseEntries(text) {
    const out = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      out.push({ key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() });
    }
    return out;
  }

  test('contains the required variable keys', () => {
    const keys = new Set(parseEntries(envSrc).map(e => e.key));
    for (const k of [
      ...SENSITIVE_KEYS,
      'DB_NAME',
      'MONGO_DB_NAME',
      'UPLOAD_PATH',
      'POSTGRES_APP_USER',
      'POSTGRES_DEV_DB',
      'POSTGRES_TEST_DB',
    ]) {
      expect(keys, `expected ${k} in .env.example`).toContain(k);
    }
  });

  test('sensitive values are placeholders (no real secret material)', () => {
    const entries = parseEntries(envSrc);
    for (const { key, value } of entries) {
      if (!SENSITIVE_KEYS.includes(key)) continue;
      for (const hint of REAL_SECRET_HINTS) {
        // CHANGE_ME_... markers are intentionally long; exempt them.
        const stripped = value.replace(/CHANGE_ME[A-Za-z0-9_]*/g, '');
        expect(hint.test(stripped), `${key}=${value} looks like a real secret`).toBe(false);
      }
      // Every sensitive value must include a CHANGE_ME marker or a clearly
      // templated placeholder, EXCEPT connection strings where the password
      // segment must be CHANGE_ME.
      if (key.startsWith('DATABASE_URL') || key === 'MONGO_URL') {
        expect(value, `${key} must embed CHANGE_ME password placeholder`).toMatch(/CHANGE_ME/);
      } else {
        expect(value, `${key} must be a CHANGE_ME placeholder`).toMatch(/CHANGE_ME/);
      }
    }
  });

  test('documents MONGO_URL as migration-only', () => {
    // The header comment block near MONGO_URL must state migration-only scope.
    const idx = envSrc.indexOf('MONGO_URL=');
    expect(idx).toBeGreaterThan(-1);
    // Look at the preceding comments for the migration-only note. We scan a
    // generous window so the assertion is robust to section reordering.
    const preceding = envSrc.slice(Math.max(0, idx - 800), idx);
    expect(preceding).toMatch(/migration[\s-]*only/i);
  });

  test('documents upload path', () => {
    expect(envSrc).toMatch(/UPLOAD_PATH=/);
    expect(envSrc).toMatch(/public\/uploads/);
  });

  test('documents JWT secret', () => {
    expect(envSrc).toMatch(/JWT_SECRET=/);
  });
});

// ---------------------------------------------------------------------------
// .gitignore — real .env ignored, .env.example tracked
// ---------------------------------------------------------------------------

describe('.gitignore', () => {
  const GI_REL = '.gitignore';
  const giSrc = readRepo(GI_REL);

  test('ignores real .env files', () => {
    // A line that matches `.env` exactly and `.env.*` for variants.
    expect(giSrc).toMatch(/(^|\n)\.env(\n|$)/);
    expect(giSrc).toMatch(/\.env\.\*/);
  });

  test('explicitly un-ignores .env.example', () => {
    expect(giSrc).toMatch(/!\.env.example/);
  });

  test('does not contain leftover "-e " auto-commit cruft', () => {
    // The old file had many duplicated `-e ` lines (from buggy auto-commits).
    // They must not be present anymore.
    expect(giSrc).not.toMatch(/(^|\n)-e\s+(\n|$)/);
  });

  test('does not duplicate the env block repeatedly', () => {
    const matches = giSrc.match(/# Environment files/g) || [];
    // One clean block is fine; the old file had 10+ duplicates.
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  test('git actually sees .env.example as trackable (not ignored)', () => {
    // Use git check-ignore: exit 1 means NOT ignored (what we want).
    let ignored = true;
    try {
      execFileSync('git', ['check-ignore', '.env.example'], { cwd: REPO_ROOT, stdio: 'ignore' });
      ignored = true;
    } catch (e) {
      // Non-zero exit from check-ignore means the path is NOT ignored.
      ignored = false;
    }
    // git check-ignore returns 0 when a path IS ignored. We expect it to be
    // un-ignored. Note: when a negation rule matches, git check-ignore may
    // still return 0 and print the negation rule — so we additionally verify
    // via `git status --short` that the file is visible.
    const status = execFileSync('git', ['status', '--short', '--porcelain', '.env.example'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    // If the file were ignored, status would be empty. We expect a non-empty
    // entry (either `??` when untracked, or `A`/`M` when staged).
    expect(status.trim(), '.env.example must be visible to git (not ignored)').not.toBe('');
  });

  test('git ignores a real .env', () => {
    // git check-ignore returns exit 0 when the path IS ignored.
    let ignored = false;
    try {
      execFileSync('git', ['check-ignore', '.env'], { cwd: REPO_ROOT, stdio: 'ignore' });
      ignored = true;
    } catch (e) {
      ignored = false;
    }
    expect(ignored, 'a real .env must be gitignored').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Local/test-only reset scripts
// ---------------------------------------------------------------------------

describe('scripts/db reset helpers (LOCAL/TEST only)', () => {
  const SCRIPTS = ['scripts/db/reset-test-db.sh', 'scripts/db/reset-dev-db.sh'];

  for (const rel of SCRIPTS) {
    test(`${rel}: exists`, () => {
      expect(existsSync(path.join(REPO_ROOT, rel))).toBe(true);
    });

    test(`${rel}: declares LOCAL/TEST-only scope`, () => {
      const src = readRepo(rel);
      expect(src).toMatch(/LOCAL AND TEST ONLY|LOCAL\/TEST ONLY/i);
    });

    test(`${rel}: refuses production-like database names (denylist logic)`, () => {
      const src = readRepo(rel);
      // Must contain both a denylist and an allow-pattern.
      expect(src).toMatch(/DENYLIST=/);
      expect(src).toMatch(/ALLOWED=/);
      // Must guard with explicit production refusal messaging.
      expect(src).toMatch(/no production reset|production-like/i);
    });
  }

  // Exercise the denylist end-to-end with a mocked psql on PATH so we never
  // touch a real database. We only validate that the script EXITS NON-ZERO
  // for unsafe names and EXITS ZERO for the documented default.
  test('reset-test-db.sh refuses unsafe names and accepts the default (mocked psql)', () => {
    const bin = mkdtempSync(path.join(tmpdir(), 'fake-bin-'));
    // Mock psql + createdb so the script never reaches a real server.
    writeFileSync(path.join(bin, 'psql'), '#!/usr/bin/env bash\necho "mock $*" >/dev/null\n');
    writeFileSync(path.join(bin, 'createdb'), '#!/usr/bin/env bash\necho "mock $*" >/dev/null\n');
    execFileSync('chmod', ['+x', path.join(bin, 'psql'), path.join(bin, 'createdb')]);

    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

    const unsafeNames = ['production', 'prod', 'pa_penajam', 'postgres', 'mydb', 'pa_penajam_test_prod'];
    for (const name of unsafeNames) {
      let exited = 0;
      let err = null;
      try {
        execFileSync('bash', ['scripts/db/reset-test-db.sh', name], {
          cwd: REPO_ROOT,
          env,
          encoding: 'utf8',
          stdio: ['ignore', 'ignore', 'ignore'],
        });
      } catch (e) {
        exited = e.status ?? 1;
        err = e;
      }
      expect(exited, `unsafe name '${name}' must be refused (non-zero exit)`).not.toBe(0);
    }

    // Default name should be accepted and reach the mocked psql.
    let defaultOk = true;
    try {
      execFileSync('bash', ['scripts/db/reset-test-db.sh'], {
        cwd: REPO_ROOT,
        env,
        encoding: 'utf8',
      });
    } catch (e) {
      defaultOk = false;
    }
    expect(defaultOk, 'default pa_penajam_test must be accepted by reset-test-db.sh').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// init script
// ---------------------------------------------------------------------------

describe('db/init-databases.sh', () => {
  const INIT_REL = 'db/init-databases.sh';
  const src = readRepo(INIT_REL);

  test('creates both dev and test databases', () => {
    expect(src).toMatch(/POSTGRES_DEV_DB/);
    expect(src).toMatch(/POSTGRES_TEST_DB/);
    expect(src).toMatch(/pa_penajam_dev/);
    expect(src).toMatch(/pa_penajam_test/);
  });

  test('creates the non-root application role', () => {
    expect(src).toMatch(/POSTGRES_APP_USER/);
    expect(src).toMatch(/CREATE ROLE/);
  });

  test('declares LOCAL/TEST-only scope', () => {
    expect(src).toMatch(/LOCAL AND TEST ONLY|LOCAL\/TEST ONLY/i);
  });
});
