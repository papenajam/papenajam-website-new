// Unit tests for lib/prisma-errors.js (Task 6).
//
// Covers the REQUIRED test cases from plan lines 540-548 + plan lines 300-306:
//   - P2002 (unique violation) -> 400 with the existing duplicate-email body
//     (mirrors usersHandler.js line 22 `{ error: 'Email sudah terdaftar' }`)
//   - P2025 (record not found) -> baseline semantics PRESERVED per endpoint:
//       GET single  -> 404 `{ error: 'Tidak ditemukan' }`
//       GET page    -> 404 `{ error: 'Halaman tidak ditemukan' }`
//       PUT         -> 200 `null` (established API updateOne no-op + findOne null)
//       DELETE      -> 200 `{ message: 'Berhasil dihapus' }`  (always 200)
//       DELETE media-> 200 `{ message: 'File berhasil dihapus' }`
//     Crucially: P2025 does NOT auto-become 404 for PUT/DELETE. That would
//     break the existing HTTP contract (plan line 305-306).
//   - P2034 / P2031 (transaction / write conflict) -> 409 with retry signal
//   - P2003 (FK violation) -> 400 (menus.parentId onDelete: Restrict)
//   - Unknown / non-Prisma error -> generic 500; original error attached
//     non-enumerably as `cause` so the stack never leaks to the client body.
//
// No DB connection needed. Tests construct plain Prisma error-shape objects.

import { describe, expect, test } from 'vitest';
import {
  DEFAULT_DUPLICATE_BODY,
  P2025_BEHAVIORS,
  isPrismaErrorCode,
  mapError,
} from '../../../lib/prisma-errors.js';

// Helper: build a PrismaClientKnownRequestError-like plain object. The mapper
// only reads `.code`, `.clientVersion`, and `.meta`, so tests do not need to
// import the real PrismaClient.
function prismaErr(code, extra = {}) {
  return Object.assign(new Error(`Prisma error ${code}`), {
    name: 'PrismaClientKnownRequestError',
    code,
    clientVersion: '7.8.0',
    meta: {},
    ...extra,
  });
}

describe('mapError: P2002 unique violation -> duplicate response', () => {
  test('default body mirrors usersHandler "Email sudah terdaftar"', () => {
    const out = mapError(prismaErr('P2002'));
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'Email sudah terdaftar' });
    expect(out.kind).toBe('duplicate');
  });

  test('DEFAULT_DUPLICATE_BODY is the right shape and frozen', () => {
    expect(DEFAULT_DUPLICATE_BODY).toEqual({ error: 'Email sudah terdaftar' });
    expect(Object.isFrozen(DEFAULT_DUPLICATE_BODY)).toBe(true);
  });

  test('duplicateBody option overrides per-endpoint', () => {
    // e.g. pages slug unique violation could surface a different message.
    const out = mapError(prismaErr('P2002'), {
      duplicateBody: { error: 'Slug sudah dipakai' },
    });
    expect(out.body).toEqual({ error: 'Slug sudah dipakai' });
  });

  test('returned body is a fresh clone, not the frozen default', () => {
    const out = mapError(prismaErr('P2002'));
    out.body.error = 'mutated';
    expect(DEFAULT_DUPLICATE_BODY.error).toBe('Email sudah terdaftar');
  });
});

describe('mapError: P2025 not-found semantics PRESERVED per endpoint', () => {
  // Plan line 302-306: many previous datastore update/delete endpoints return 200 even
  // when the id is missing. Prisma `update`/`delete` throw P2025 instead, so
  // a naive migration would change those to 404 and break the contract. The
  // mapper MUST preserve the baseline behaviour.
  test('behavior="get" -> 404 { error: "Tidak ditemukan" }', () => {
    const out = mapError(prismaErr('P2025'), { behavior: 'get' });
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
    expect(out.kind).toBe('not-found');
  });

  test('behavior="getPage" -> 404 { error: "Halaman tidak ditemukan" }', () => {
    const out = mapError(prismaErr('P2025'), { behavior: 'getPage' });
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Halaman tidak ditemukan' });
  });

  test('behavior="put" -> 200 with body null (legacy updateOne no-op shape)', () => {
    // previous datastore: `updateOne({id})` no-ops when id missing, then `findOne({id})`
    // returns null, so the legacy response is literally `null` at status 200.
    const out = mapError(prismaErr('P2025'), { behavior: 'put' });
    expect(out.status).toBe(200);
    expect(out.body).toBeNull();
    expect(out.kind).toBe('not-found');
  });

  test('behavior="delete" -> 200 { message: "Berhasil dihapus" }', () => {
    // previous datastore: deleteOne({id}) no-ops when id missing, then handler returns
    // 200 with the success message REGARDLESS. We must preserve that.
    const out = mapError(prismaErr('P2025'), { behavior: 'delete' });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Berhasil dihapus' });
    expect(out.kind).toBe('not-found');
  });

  test('behavior="deleteMedia" -> 200 { message: "File berhasil dihapus" }', () => {
    const out = mapError(prismaErr('P2025'), { behavior: 'deleteMedia' });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'File berhasil dihapus' });
  });

  test('default behavior is "get" (404 not found)', () => {
    const out = mapError(prismaErr('P2025'));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
  });

  test('unknown behavior falls back to GET 404', () => {
    const out = mapError(prismaErr('P2025'), { behavior: 'something-new' });
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
  });

  test('P2025_BEHAVIORS exposes all baselines', () => {
    expect(Object.keys(P2025_BEHAVIORS).sort()).toEqual(
      ['delete', 'deleteMedia', 'get', 'getPage', 'put'].sort(),
    );
  });

  test('P2025 body is a fresh clone (mutating output does not affect baseline)', () => {
    const out = mapError(prismaErr('P2025'), { behavior: 'get' });
    out.body.error = 'mutated';
    expect(P2025_BEHAVIORS.get.body.error).toBe('Tidak ditemukan');
  });
});

describe('mapError: P2034 / P2031 conflict -> retry signal', () => {
  test('P2034 returns 409 with retry=true', () => {
    const out = mapError(prismaErr('P2034'));
    expect(out.status).toBe(409);
    expect(out.body).toEqual({ error: 'Konflik data, silakan coba lagi' });
    expect(out.kind).toBe('conflict');
    expect(out.retry).toBe(true);
  });

  test('P2031 returns 409 with retry=true', () => {
    const out = mapError(prismaErr('P2031'));
    expect(out.status).toBe(409);
    expect(out.retry).toBe(true);
  });

  test('retry is ONLY present on conflict kind', () => {
    expect(mapError(prismaErr('P2002')).retry).toBeUndefined();
    expect(mapError(prismaErr('P2025')).retry).toBeUndefined();
    expect(mapError(prismaErr('P2034')).retry).toBe(true);
  });
});

describe('mapError: P2003 foreign-key violation', () => {
  test('menus.parentId Restrict -> 400 stable body', () => {
    const out = mapError(
      prismaErr('P2003', { meta: { field_name: 'menus_parentId_fkey' } }),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'Data terkait masih digunakan' });
    expect(out.kind).toBe('foreign-key');
  });
});

describe('mapError: unknown / non-Prisma errors', () => {
  test('generic Error -> 500 internal, body never includes the message', () => {
    const err = new Error('secret internals: connection refused at 10.0.0.1:5432');
    const out = mapError(err);
    expect(out.status).toBe(500);
    expect(out.kind).toBe('internal');
    expect(out.body).toEqual({ error: 'Terjadi kesalahan pada server' });
    // Critical: the secret internals MUST NOT leak into the client body.
    expect(JSON.stringify(out.body)).not.toContain('secret internals');
    expect(JSON.stringify(out.body)).not.toContain('10.0.0.1');
  });

  test('original error attached non-enumerably as `cause` for server logs', () => {
    const err = new Error('boom');
    const out = mapError(err);
    expect(out.cause).toBe(err);
    // Non-enumerable so JSON.stringify(out) does not include the stack.
    expect(JSON.stringify(out)).not.toContain('boom');
  });

  test('unknown Prisma code -> 500 internal', () => {
    const out = mapError(prismaErr('P9999'));
    expect(out.status).toBe(500);
    expect(out.kind).toBe('internal');
  });

  test('non-Error / null input -> 500 internal (defensive)', () => {
    expect(mapError(null).status).toBe(500);
    expect(mapError(undefined).status).toBe(500);
    expect(mapError('string error').status).toBe(500);
    expect(mapError({ code: 'P2002' }).status).toBe(400); // shape still works
  });
});

describe('mapError: handlers can build NextResponse from output', () => {
  // Sanity-check the shape NextResponse.json(body, { status }) expects. The
  // handler tasks (7+) will consume `out.body` and `out.status` directly.
  test('every kind returns a JSON-serializable body or null', () => {
    const errs = [
      prismaErr('P2002'),
      prismaErr('P2025'),
      prismaErr('P2034'),
      prismaErr('P2003'),
      new Error('generic'),
    ];
    for (const e of errs) {
      const out = mapError(e);
      expect(typeof out.status).toBe('number');
      expect(out.status).toBeGreaterThanOrEqual(200);
      expect(out.status).toBeLessThan(600);
      // body is null (PUT missing) or a plain JSON object.
      expect(out.body === null || typeof out.body === 'object').toBe(true);
      if (out.body !== null) {
        expect(() => JSON.stringify(out.body)).not.toThrow();
      }
    }
  });
});

describe('isPrismaErrorCode', () => {
  test('true only when err.code matches', () => {
    expect(isPrismaErrorCode(prismaErr('P2002'), 'P2002')).toBe(true);
    expect(isPrismaErrorCode(prismaErr('P2002'), 'P2025')).toBe(false);
    expect(isPrismaErrorCode(new Error('no code'), 'P2002')).toBe(false);
    expect(isPrismaErrorCode(null, 'P2002')).toBe(false);
    expect(isPrismaErrorCode(undefined, 'P2002')).toBe(false);
  });

  test('works with plain Prisma-shape objects', () => {
    expect(isPrismaErrorCode({ code: 'P2025' }, 'P2025')).toBe(true);
  });
});
