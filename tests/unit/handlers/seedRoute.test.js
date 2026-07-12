// Unit tests: public POST /api/seed is disabled (Task 15) and Mongo is gone
// from the request path (Task 14).
//
// Asserts via source scan (no full route import — that pulls every handler
// and the Prisma singleton). Runtime 404 for /api/seed is proven by the
// unmapped ROUTE_MAP key + the disabled seedHandler module.

import { describe, expect, test } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ROUTE_PATH = path.join(ROOT, 'app/api/[[...path]]/route.js');
const SEED_HANDLER_PATH = path.join(ROOT, 'app/api/handlers/seedHandler.js');
const DB_JS_PATH = path.join(ROOT, 'lib/db.js');

/** Strip block + line comments so token scans ignore documentation mentions. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

describe('POST /api/seed disabled', () => {
  test('lib/db.js is deleted (no runtime Mongo connector)', () => {
    expect(existsSync(DB_JS_PATH)).toBe(false);
  });

  test('route.js does not map seed and does not import seedHandler / lib/db', () => {
    const raw = readFileSync(ROUTE_PATH, 'utf8');
    const src = stripComments(raw);

    // No runtime import of the Mongo connector or seed handler.
    expect(src).not.toMatch(/from\s+['"]@\/lib\/db['"]/);
    expect(src).not.toMatch(/from\s+['"]mongodb['"]/);
    expect(src).not.toMatch(/handleSeed|seedHandler/);
    // seed key must not appear as a ROUTE_MAP entry.
    expect(src).not.toMatch(/\bseed\s*:/);
    // Comment in the raw file documents the intentional omission.
    expect(raw).toMatch(/intentionally omitted|seed is disabled|POST \/api\/seed/i);
  });

  test('seedHandler module always 404s and never seeds', async () => {
    expect(existsSync(SEED_HANDLER_PATH)).toBe(true);
    const { handleSeed } = await import(
      '../../../app/api/handlers/seedHandler.js'
    );
    const res = await handleSeed(
      { url: 'http://localhost/api/seed', json: async () => ({}) },
      [],
      'POST',
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/disabled|prisma db seed/i);
  });

  test('ROUTE_MAP in route.js has no seed key (static parse)', () => {
    const src = stripComments(readFileSync(ROUTE_PATH, 'utf8'));
    // Extract ROUTE_MAP object body roughly and assert no seed entry.
    const m = src.match(/const\s+ROUTE_MAP\s*=\s*\{([\s\S]*?)\};/);
    expect(m).toBeTruthy();
    const body = m[1];
    expect(body).not.toMatch(/\bseed\b/);
    // Sanity: known handlers still present.
    expect(body).toMatch(/\bsettings\s*:/);
    expect(body).toMatch(/\bsearch\s*:/);
    expect(body).toMatch(/\bauth\s*:/);
  });
});

describe('route.js no longer calls connectDB', () => {
  test('source has no connectDB call or lib/db / mongodb import (code only)', () => {
    const src = stripComments(readFileSync(ROUTE_PATH, 'utf8'));
    expect(src).not.toMatch(/\bconnectDB\b/);
    expect(src).not.toMatch(/from\s+['"]@\/lib\/db['"]/);
    expect(src).not.toMatch(/from\s+['"]mongodb['"]/);
    expect(src).not.toMatch(/MongoClient/);
    expect(src).not.toMatch(/getCollection/);
  });

  test('error envelope does not leak err.message / detail', () => {
    const src = readFileSync(ROUTE_PATH, 'utf8');
    // Legacy shape was `{ error, detail: err.message }` — must be gone.
    expect(src).not.toMatch(/detail:\s*err\.message/);
    expect(src).toMatch(/mapError/);
  });
});
