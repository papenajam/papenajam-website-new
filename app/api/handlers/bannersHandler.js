// Banners handler (Task 8: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET    /banners       -> 200 `{ items }` of active banners whose endDate
//     is null OR >= today (YYYY-MM-DD). Sort by order asc.
//     Established API also matched endDate:'' — empty string is normalised to null
//     on write so the Prisma filter only needs `endDate: null | gte today`.
//   - POST   /banners       -> 201 created row (auth); defaults isActive=true, order=0
//   - GET    /banners/all   -> 200 `{ items }` (auth); all rows, sort order asc
//   - PUT    /banners/:id   -> 200 post-update row | 200 null when missing
//   - DELETE /banners/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//
// Date-only: startDate / endDate. Empty string on write -> null (schema is
// DateTime? @db.Date; empty string is not a valid Date). serializeRecord emits
// null for null dates (legacy empty-string wire shape is only preserved when
// the source still carries ''; post-migration null is the canonical form and
// the contract fixtures use both null and '' so the public filter treats them
// equivalently via the null path after import).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { parseDateOnly, DateInputError } from '@/lib/api/dates.js';

/**
 * Parse optional date-only fields. Empty / null / whitespace -> null so a
 * client that still sends `endDate: ''` (legacy admin form default) lands as
 * SQL NULL, which the public filter treats as "no end date".
 */
function parseBannerDates(body) {
  const out = { ...body };
  if ('startDate' in out) {
    out.startDate = parseDateOnly(out.startDate, 'startDate');
  }
  if ('endDate' in out) {
    out.endDate = parseDateOnly(out.endDate, 'endDate');
  }
  return out;
}

/** Today as YYYY-MM-DD (UTC calendar day), matching the legacy ISO split. */
function todayYyyyMmDd() {
  return new Date().toISOString().split('T')[0];
}

export async function handleBanners(request, segments, method) {
  const [sub] = segments;

  if (!sub) {
    if (method === 'GET') {
      // Active list: isActive=true AND (endDate IS NULL OR endDate >= today).
      // Empty-string endDate was accepted by previous datastore; we store it as NULL on write
      // so the Prisma OR only needs the null branch for "no end date".
      const today = new Date(`${todayYyyyMmDd()}T00:00:00.000Z`);
      const rows = await prisma.banner.findMany({
        where: {
          isActive: true,
          OR: [
            { endDate: null },
            { endDate: { gte: today } },
          ],
        },
        orderBy: { order: 'asc' },
      });
      return NextResponse.json({ items: serializeList('Banner', rows) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      let data;
      try {
        data = parseBannerDates(body);
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
      const created = await prisma.banner.create({
        data: {
          ...rest,
          isActive: rest.isActive !== false,
          order: rest.order || 0,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('Banner', created), { status: 201 });
    }
  }

  if (sub === 'all' && method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rows = await prisma.banner.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ items: serializeList('Banner', rows) });
  }

  if (sub) {
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      let data;
      try {
        data = parseBannerDates(body);
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
      await prisma.banner.updateMany({
        where: { id: sub },
        data: { ...rest, updatedAt: new Date().toISOString() },
      });
      const row = await prisma.banner.findUnique({ where: { id: sub } });
      return NextResponse.json(serializeRecord('Banner', row));
    }
    if (method === 'DELETE') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await prisma.banner.deleteMany({ where: { id: sub } });
      return NextResponse.json({ message: 'Berhasil dihapus' });
    }
  }
  return null;
}
