// Announcements handler (Task 8: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour is byte-identical to the legacy Mongo handler:
//   - GET    /announcements?page&limit&search&public  -> 200 paginated envelope
//     search  -> title contains + mode:'insensitive'
//     public  -> isActive=true
//     sort    -> createdAt desc
//   - POST   /announcements       -> 201 created row (auth)
//   - GET    /announcements/:id   -> 200 row | 404
//   - PUT    /announcements/:id   -> 200 post-update row | 200 null when missing
//   - DELETE /announcements/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { parsePagination, paginationEnvelope } from '@/lib/api/query.js';
import { parseDateOnly, DateInputError } from '@/lib/api/dates.js';

function parseAnnouncementDates(body) {
  const out = { ...body };
  if ('publishDate' in out) {
    out.publishDate = parseDateOnly(out.publishDate, 'publishDate');
  }
  return out;
}

export async function handleAnnouncements(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const { page, limit, skip, take } = parsePagination(url, 'announcements');
      const search = url.searchParams.get('search') || '';
      const publicOnly = url.searchParams.get('public') === 'true';

      const where = {};
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }
      if (publicOnly) {
        where.isActive = true;
      }

      const [total, rows] = await Promise.all([
        prisma.announcement.count({ where }),
        prisma.announcement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
      ]);

      return NextResponse.json(
        paginationEnvelope(serializeList('Announcement', rows), total, page, limit),
      );
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      let data;
      try {
        data = parseAnnouncementDates(body);
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
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = data;
      const created = await prisma.announcement.create({
        data: {
          ...rest,
          isActive: rest.isActive === true || rest.isActive === false
            ? rest.isActive
            : true,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('Announcement', created), { status: 201 });
    }
  }

  if (method === 'GET') {
    const row = await prisma.announcement.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('Announcement', row));
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    let data;
    try {
      data = parseAnnouncementDates(body);
    } catch (err) {
      if (err instanceof DateInputError) {
        return NextResponse.json(
          { error: err.message, field: err.field },
          { status: 400 },
        );
      }
      throw err;
    }
    const { id: _ignoreId, createdAt: _c, ...rest } = data;
    await prisma.announcement.updateMany({
      where: { id },
      data: { ...rest, updatedAt: new Date().toISOString() },
    });
    const row = await prisma.announcement.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('Announcement', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.announcement.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
