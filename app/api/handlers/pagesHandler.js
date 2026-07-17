// Pages handler (Task 10: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET    /pages              -> 200 `{ items }` sorted createdAt desc
//   - POST   /pages              -> 201 created row (auth)
//     defaults: blocks=[], status='draft'; validates root blocks is an array
//     (does NOT restrict block types used by homepage / page builder)
//   - GET    /pages/slug/:slug   -> 200 row | 404 `{ error: 'Halaman tidak ditemukan' }`
//     public (no auth) requires status='published'; authenticated may see draft
//     Special slug `_homepage` is supported (no special casing beyond uniqueness)
//   - GET    /pages/:id          -> 200 row | 404 `{ error: 'Tidak ditemukan' }`
//   - PUT    /pages/:id          -> 200 post-update row | 200 null when missing
//     (updateMany + findUnique preserves the established API no-op baseline)
//   - DELETE /pages/:id          -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//     (deleteMany does not throw P2025)
//
// blocks is stored/read as whole JSONB via Prisma Json; serializeRecord('Page', …)
// preserves the blob verbatim. Slug uniqueness is enforced by the schema
// `@unique`; P2002 is mapped to 400 when create/update collides.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { mapError } from '@/lib/prisma-errors.js';

/**
 * Validate `blocks` for write paths.
 *
 * Plan / Task 10: root must be an array. Do NOT restrict block `type` values —
 * homepage and page builder freely invent types (`hero_home`, `accordion`, …).
 * When `blocks` is absent, treat as `[]` (legacy create default). When present
 * but not an array, reject with 400 so we never write a non-array into JSONB
 * (the importer also rejects non-array roots).
 *
 * @param {*} blocks
 * @param {{ required?: boolean }} [opts]
 * @returns {{ ok: true, blocks: Array } | { ok: false, response: Response }}
 */
function validateBlocks(blocks, opts = {}) {
  const { required = false } = opts;
  if (blocks === undefined || blocks === null) {
    if (required) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'blocks harus berupa array' },
          { status: 400 },
        ),
      };
    }
    return { ok: true, blocks: [] };
  }
  if (!Array.isArray(blocks)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'blocks harus berupa array' },
        { status: 400 },
      ),
    };
  }
  return { ok: true, blocks };
}

export async function handlePages(request, segments, method) {
  const [seg2, seg3] = segments;

  // ── Collection: GET list / POST create ────────────────────────────────────
  if (!seg2) {
    if (method === 'GET') {
      const rows = await prisma.page.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ items: serializeList('Page', rows) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const checked = validateBlocks(body.blocks);
      if (!checked.ok) return checked.response;

      const now = new Date().toISOString();
      // Do not let a client-supplied id / timestamps override Prisma defaults
      // or handler-owned timestamps. Prisma generates the UUID; we own createdAt.
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, blocks: _b, ...rest } = body;
      try {
        const created = await prisma.page.create({
          data: {
            ...rest,
            blocks: checked.blocks,
            status: rest.status || 'draft',
            createdAt: now,
            updatedAt: now,
          },
        });
        return NextResponse.json(serializeRecord('Page', created), { status: 201 });
      } catch (err) {
        // P2002 (slug unique) -> 400 with a page-specific message. Other Prisma
        // errors re-throw so the outer route can log them.
        const mapped = mapError(err, {
          duplicateBody: { error: 'Slug sudah digunakan' },
        });
        if (mapped.kind === 'duplicate') {
          return NextResponse.json(mapped.body, { status: mapped.status });
        }
        throw err;
      }
    }
  }

  // ── GET /api/pages/slug/:slug ─────────────────────────────────────────────
  if (seg2 === 'slug' && seg3 && method === 'GET') {
    const authUser = requireAuth(request);
    // Public requests only see published; authenticated may also see draft.
    // `_homepage` is just another unique slug — no special casing required.
    const where = authUser
      ? { slug: seg3 }
      : { slug: seg3, status: 'published' };
    const row = await prisma.page.findFirst({ where });
    if (!row) {
      return NextResponse.json(
        { error: 'Halaman tidak ditemukan' },
        { status: 404 },
      );
    }
    return NextResponse.json(serializeRecord('Page', row));
  }

  // ── /api/pages/:id ────────────────────────────────────────────────────────
  const id = seg2;
  if (method === 'GET') {
    const row = await prisma.page.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('Page', row));
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();

    // Only validate blocks when the client actually sends them. A partial PUT
    // that omits blocks must leave the existing JSONB untouched.
    let blocksPatch = {};
    if ('blocks' in body) {
      const checked = validateBlocks(body.blocks, { required: true });
      if (!checked.ok) return checked.response;
      blocksPatch = { blocks: checked.blocks };
    }

    const { id: _ignoreId, createdAt: _c, blocks: _b, ...rest } = body;
    try {
      // updateMany preserves the legacy "always 200" baseline: when the id is
      // missing the count is 0 (a no-op), then findUnique returns null and we
      // emit 200 `null` — matching the previous datastore contract exactly.
      await prisma.page.updateMany({
        where: { id },
        data: {
          ...rest,
          ...blocksPatch,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      // P2002 on slug reassignment. updateMany does not throw P2002 for
      // uniqueness in all Prisma versions / drivers, but singular update would;
      // we catch defensively so a future driver change does not 500.
      const mapped = mapError(err, {
        behavior: 'put',
        duplicateBody: { error: 'Slug sudah digunakan' },
      });
      if (mapped.kind === 'duplicate') {
        return NextResponse.json(mapped.body, { status: mapped.status });
      }
      throw err;
    }
    const row = await prisma.page.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('Page', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // deleteMany preserves "always 200 success" — it does not throw P2025 when
    // the row is absent, so the DELETE contract stays `{ message: 'Berhasil
    // dihapus' }` regardless of whether the id existed.
    await prisma.page.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
