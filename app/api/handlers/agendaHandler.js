// Agenda handler (Task 9: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour is byte-identical to the legacy Mongo handler:
//   - GET    /agenda?page&limit&search&dateFrom&dateTo&status&public
//     search     -> nomorPerkara contains + mode:'insensitive'
//     status     -> equality (overwritten when public=true)
//     dateFrom   -> tanggalSidang gte (parsed date-only)
//     dateTo     -> tanggalSidang lte (parsed date-only)
//     public     -> status: { not: 'dibatalkan' }
//     sort       -> tanggalSidang asc, waktuSidang asc
//   - POST   /agenda       -> 201 created row (auth)
//   - GET    /agenda/:id   -> 200 row | 404
//   - PUT    /agenda/:id   -> 200 post-update row | 200 null when missing
//   - DELETE /agenda/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//
// Prisma model is `Agenda` (@@map("agenda")). Date-only: tanggalSidang.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { parsePagination, paginationEnvelope } from '@/lib/api/query.js';
import { parseDateOnly, DateInputError } from '@/lib/api/dates.js';

function parseAgendaDates(body) {
  const out = { ...body };
  if ('tanggalSidang' in out) {
    out.tanggalSidang = parseDateOnly(out.tanggalSidang, 'tanggalSidang');
  }
  return out;
}

export async function handleAgenda(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const { page, limit, skip, take } = parsePagination(url, 'agenda');
      const search = url.searchParams.get('search') || '';
      const dateFrom = url.searchParams.get('dateFrom') || '';
      const dateTo = url.searchParams.get('dateTo') || '';
      const status = url.searchParams.get('status') || '';
      const publicOnly = url.searchParams.get('public') === 'true';

      const where = {};
      if (search) {
        where.nomorPerkara = { contains: search, mode: 'insensitive' };
      }
      if (status) {
        where.status = status;
      }
      if (dateFrom || dateTo) {
        where.tanggalSidang = {};
        try {
          if (dateFrom) {
            where.tanggalSidang.gte = parseDateOnly(dateFrom, 'dateFrom');
          }
          if (dateTo) {
            where.tanggalSidang.lte = parseDateOnly(dateTo, 'dateTo');
          }
        } catch (err) {
          if (err instanceof DateInputError) {
            return NextResponse.json(
              { error: err.message, field: err.field },
              { status: 400 },
            );
          }
          throw err;
        }
      }
      // public=true overwrites any explicit status filter (legacy Mongo
      // assignment: query.status = { $ne: 'dibatalkan' }).
      if (publicOnly) {
        where.status = { not: 'dibatalkan' };
      }

      const [total, rows] = await Promise.all([
        prisma.agenda.count({ where }),
        prisma.agenda.findMany({
          where,
          orderBy: [{ tanggalSidang: 'asc' }, { waktuSidang: 'asc' }],
          skip,
          take,
        }),
      ]);

      return NextResponse.json(
        paginationEnvelope(serializeList('Agenda', rows), total, page, limit),
      );
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      let data;
      try {
        data = parseAgendaDates(body);
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
      const created = await prisma.agenda.create({
        data: {
          ...rest,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('Agenda', created), { status: 201 });
    }
  }

  if (method === 'GET') {
    const row = await prisma.agenda.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('Agenda', row));
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    let data;
    try {
      data = parseAgendaDates(body);
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
    await prisma.agenda.updateMany({
      where: { id },
      data: { ...rest, updatedAt: new Date().toISOString() },
    });
    const row = await prisma.agenda.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('Agenda', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.agenda.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
