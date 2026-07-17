// Users handler (Task 7: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract. The contract test
// (tests/contract/api-contract.test.js) pins every response shape:
//   - GET    /users       -> 200 `{ items: [{id,name,email,role,createdAt}] }`
//     (NOT paginated; the legacy handler returned the full list and the
//     contract asserts only the `items` key via expectExactItems).
//   - POST   /users       -> 201 `{id,name,email,role,createdAt}` (no updatedAt;
//     the previous datastore insertOne did not set updatedAt). 401 unauth. Duplicate email
//     -> 400 `{ error: 'Email sudah terdaftar' }`.
//   - PUT    /users/:id   -> 200 with the post-update row (includes updatedAt).
//     Missing id -> 200 `null` (established API updateOne no-op + findOne null).
//     The plan/Task 6 `mapError({ behavior: 'put' })` baseline encodes this.
//   - DELETE /users/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//     (legacy deleteOne is a no-op when the id is absent; we use deleteMany so
//     Prisma does not throw P2025 and we never auto-404).
//
// Mapping (plan lines 563-567):
//   - email normalised to lower-case on create AND on update (login lookup is
//     also lower-cased; see authHandler.js).
//   - password hashed with bcrypt (lib/auth.js hashPassword, unchanged).
//   - `select` excludes password on every read; the serializer drops it again
//     as defence-in-depth (lib/api/serialize.js MODELS_WITH_PASSWORD).
//   - createdAt/updatedAt set explicitly (schema has no @updatedAt; plan line
//     159: handlers own the timestamp writes).
//   - Unique violation on create is caught via mapError so the 400 body stays
//     exactly `{ error: 'Email sudah terdaftar' }`.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hashPassword } from '@/lib/auth';
import { serializeRecord } from '@/lib/api/serialize.js';
import { mapError } from '@/lib/prisma-errors.js';

// Prisma `select` that mirrors the established API `{ projection: { password: 0 } }`.
// We enumerate the columns explicitly so a future schema addition does not
// silently leak into the API (defence-in-depth on top of the serializer).
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

// Create response shape: the established API `insertOne` did NOT set updatedAt, so
// the POST response has exactly `{id,name,email,role,createdAt}`. The contract
// test asserts this exact key set via `expectKeys`, so we must omit updatedAt
// here (Prisma would otherwise return it as `null`).
const USER_SELECT_ON_CREATE = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

export async function handleUsers(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      // Legacy handler returned the full list (no pagination); the contract
      // test asserts only the `items` key, so we preserve that shape exactly.
      // The list select omits updatedAt because the established API `find` with
      // `{ projection: { password: 0 } }` returned whatever fields each doc
      // had, and the seeded admin has no updatedAt. The contract pins the list
      // item shape to exactly `{id,name,email,role,createdAt}`.
      const rows = await prisma.user.findMany({
        select: USER_SELECT_ON_CREATE,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ items: rows.map((r) => serializeRecord('User', r)) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      if (!body?.email || typeof body.email !== 'string' || !body.email.trim()) {
        return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 });
      }
      if (!body?.password || typeof body.password !== 'string') {
        return NextResponse.json({ error: 'Password wajib diisi' }, { status: 400 });
      }
      // Hash first so a duplicate-email error from Prisma is the only failure
      // mode that maps to 400 (matching the legacy ordering where the explicit
      // `exists` check produced the 400).
      const hashedPwd = await hashPassword(body.password);
      try {
        const created = await prisma.user.create({
          data: {
            name: body.name,
            email: body.email.toLowerCase(),
            password: hashedPwd,
            role: body.role || 'admin',
            createdAt: new Date().toISOString(),
          },
          select: USER_SELECT_ON_CREATE,
        });
        // Legacy insertOne did NOT set updatedAt, so the POST response has
        // exactly `{id,name,email,role,createdAt}`. USER_SELECT_ON_CREATE omits
        // updatedAt so Prisma does not return it; serializeRecord still drops
        // password as defence-in-depth.
        return NextResponse.json(serializeRecord('User', created), { status: 201 });
      } catch (err) {
        // P2002 -> 400 `{ error: 'Email sudah terdaftar' }`. Any other Prisma
        // error -> mapped per mapError's default (500). The original error is
        // attached non-enumerably as `cause` for logs without leaking it.
        const mapped = mapError(err);
        if (mapped.kind === 'duplicate') {
          return NextResponse.json(mapped.body, { status: mapped.status });
        }
        throw err;
      }
    }
  }

  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    if (!body?.email || typeof body.email !== 'string' || !body.email.trim()) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 });
    }
    const update = {
      name: body.name,
      email: body.email.toLowerCase(),
      role: body.role || 'admin',
      updatedAt: new Date().toISOString(),
    };
    if (body.password) update.password = await hashPassword(body.password);
    // updateMany preserves the legacy "always 200" baseline: when the id is
    // missing the count is 0 (a no-op), then findUnique returns null and we
    // emit 200 `null` — matching the previous datastore contract exactly.
    await prisma.user.updateMany({ where: { id }, data: update });
    const row = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    return NextResponse.json(serializeRecord('User', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // deleteMany preserves "always 200 success" — it does not throw P2025 when
    // the row is absent, so the DELETE contract stays `{ message: 'Berhasil
    // dihapus' }` regardless of whether the id existed.
    await prisma.user.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
