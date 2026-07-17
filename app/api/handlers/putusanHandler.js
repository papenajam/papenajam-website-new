// Putusan / Decision handler (Task 8: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET    /putusan?page&limit&search&public  -> 200 paginated envelope
//     search  -> OR of nomorPerkara / jenisPerkara contains + mode:'insensitive'
//     public  -> statusPublish=true
//     sort    -> createdAt desc
//   - POST   /putusan       -> 201 created row (auth)
//   - GET    /putusan/:id  -> 200 row | 404
//   - PUT    /putusan/:id  -> 200 post-update row | 200 null when missing
//   - DELETE /putusan/:id  -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//
// Prisma model is `Decision` (@@map("putusan")). Date-only: tanggalPutusan.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { parsePagination, paginationEnvelope } from '@/lib/api/query.js';
import { parseDateOnly, DateInputError } from '@/lib/api/dates.js';

function parsePutusanDates(body) {
  const out = { ...body };
  if ('tanggalPutusan' in out) {
    out.tanggalPutusan = parseDateOnly(out.tanggalPutusan, 'tanggalPutusan');
  }
  return out;
}

export async function handlePutusan(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const { page, limit, skip, take } = parsePagination(url, 'putusan');
      const search = url.searchParams.get('search') || '';
      const publicOnly = url.searchParams.get('public') === 'true';

      const where = {};
      if (search) {
        where.OR = [
          { nomorPerkara: { contains: search, mode: 'insensitive' } },
          { jenisPerkara: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (publicOnly) {
        where.statusPublish = true;
      }

      const [total, rows] = await Promise.all([
        prisma.decision.count({ where }),
        prisma.decision.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
      ]);

      return NextResponse.json(
        paginationEnvelope(serializeList('Decision', rows), total, page, limit),
      );
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      let data;
      try {
        data = parsePutusanDates(body);
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
      const created = await prisma.decision.create({
        data: {
          ...rest,
          statusPublish: rest.statusPublish === true || rest.statusPublish === false
            ? rest.statusPublish
            : false,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('Decision', created), { status: 201 });
    }
  }

  if (method === 'GET') {
    const row = await prisma.decision.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('Decision', row));
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    let data;
    try {
      data = parsePutusanDates(body);
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
    await prisma.decision.updateMany({
      where: { id },
      data: { ...rest, updatedAt: new Date().toISOString() },
    });
    const row = await prisma.decision.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('Decision', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.decision.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
