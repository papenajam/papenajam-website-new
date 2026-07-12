// News handler (Task 8: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour is byte-identical to the legacy Mongo handler:
//   - GET    /news?page&limit&search&public  -> 200 paginated envelope
//     search  -> title contains + mode:'insensitive'
//     public  -> isPublished=true
//     sort    -> createdAt desc
//   - POST   /news       -> 201 created row (auth)
//   - GET    /news/:id   -> 200 row | 404 `{ error: 'Tidak ditemukan' }`
//   - PUT    /news/:id   -> 200 post-update row | 200 null when missing
//     (updateMany + findUnique preserves the legacy Mongo no-op baseline)
//   - DELETE /news/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//     (deleteMany does not throw P2025)
//
// Date-only: publishDate is parsed on write and serialised as YYYY-MM-DD on
// read via serializeRecord('News', …). Multilingual *En fields are preserved
// via body spread.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { parsePagination, paginationEnvelope } from '@/lib/api/query.js';
import { parseDateOnly, DateInputError } from '@/lib/api/dates.js';

/**
 * Pull date-only fields out of a request body and parse them. Empty / null /
 * whitespace becomes `null` (optional field). Invalid values throw
 * DateInputError which the handler maps to 400.
 */
function parseNewsDates(body) {
  const out = { ...body };
  if ('publishDate' in out) {
    out.publishDate = parseDateOnly(out.publishDate, 'publishDate');
  }
  return out;
}

export async function handleNews(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const { page, limit, skip, take } = parsePagination(url, 'news');
      const search = url.searchParams.get('search') || '';
      const publicOnly = url.searchParams.get('public') === 'true';

      const where = {};
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }
      if (publicOnly) {
        where.isPublished = true;
      }

      const [total, rows] = await Promise.all([
        prisma.news.count({ where }),
        prisma.news.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
      ]);

      return NextResponse.json(
        paginationEnvelope(serializeList('News', rows), total, page, limit),
      );
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      let data;
      try {
        data = parseNewsDates(body);
      } catch (err) {
        if (err instanceof DateInputError) {
          return NextResponse.json(
            { error: err.message, field: err.field },
            { status: 400 },
          );
        }
        throw err;
      }
      const now = new Date().toISOString();
      // Do not let a client-supplied id / timestamps override Prisma defaults
      // or handler-owned timestamps. Prisma generates the UUID; we own createdAt.
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = data;
      const created = await prisma.news.create({
        data: {
          ...rest,
          // Schema requires non-null booleans; default false when absent so a
          // partial body still inserts (legacy Mongo was schema-less).
          isPublished: rest.isPublished === true || rest.isPublished === false
            ? rest.isPublished
            : false,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('News', created), { status: 201 });
    }
  }

  if (method === 'GET') {
    const row = await prisma.news.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('News', row));
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    let data;
    try {
      data = parseNewsDates(body);
    } catch (err) {
      if (err instanceof DateInputError) {
        return NextResponse.json(
          { error: err.message, field: err.field },
          { status: 400 },
        );
      }
      throw err;
    }
    // Strip identity / createdAt so a PUT cannot reassign them. updatedAt is
    // always set by the handler (schema has no @updatedAt).
    const { id: _ignoreId, createdAt: _c, ...rest } = data;
    await prisma.news.updateMany({
      where: { id },
      data: { ...rest, updatedAt: new Date().toISOString() },
    });
    const row = await prisma.news.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('News', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.news.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
