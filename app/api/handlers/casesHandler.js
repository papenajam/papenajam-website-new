// Cases handler (Task 9: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET    /cases?page&limit&search&tahun&jenis&namaPihak  -> 200 paginated
//     search     -> nomorPerkara contains + mode:'insensitive'
//     tahun      -> equality
//     jenis      -> jenisPerkara contains + mode:'insensitive'
//     namaPihak  -> OR of pemohon / termohon contains + mode:'insensitive'
//     sort       -> createdAt desc
//   - POST   /cases       -> 201 created row (auth)
//   - GET    /cases/:id   -> 200 row | 404 `{ error: 'Tidak ditemukan' }`
//   - PUT    /cases/:id   -> 200 post-update row | 200 null when missing
//     (updateMany + findUnique preserves the established API no-op baseline)
//   - DELETE /cases/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//     (deleteMany does not throw P2025)
//
// Prisma model is `CaseRecord` (@@map("cases")). Date-only: jadwalSidang.

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
function parseCaseDates(body) {
  const out = { ...body };
  if ('jadwalSidang' in out) {
    out.jadwalSidang = parseDateOnly(out.jadwalSidang, 'jadwalSidang');
  }
  return out;
}

export async function handleCases(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const { page, limit, skip, take } = parsePagination(url, 'cases');
      const search = url.searchParams.get('search') || '';
      const tahun = url.searchParams.get('tahun') || '';
      const jenis = url.searchParams.get('jenis') || '';
      const namaPihak = url.searchParams.get('namaPihak') || '';
      const status = url.searchParams.get('status') || '';

      const where = {};
      if (search) {
        where.nomorPerkara = { contains: search, mode: 'insensitive' };
      }
      if (tahun) {
        where.tahun = tahun;
      }
      if (jenis) {
        where.jenisPerkara = { contains: jenis, mode: 'insensitive' };
      }
      if (status) {
        where.status = status;
      }
      if (namaPihak) {
        where.OR = [
          { pemohon: { contains: namaPihak, mode: 'insensitive' } },
          { termohon: { contains: namaPihak, mode: 'insensitive' } },
        ];
      }

      const [total, rows] = await Promise.all([
        prisma.caseRecord.count({ where }),
        prisma.caseRecord.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
      ]);

      return NextResponse.json(
        paginationEnvelope(serializeList('CaseRecord', rows), total, page, limit),
      );
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      let data;
      try {
        data = parseCaseDates(body);
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
      const created = await prisma.caseRecord.create({
        data: {
          ...rest,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('CaseRecord', created), { status: 201 });
    }
  }

  if (method === 'GET') {
    const row = await prisma.caseRecord.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('CaseRecord', row));
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    let data;
    try {
      data = parseCaseDates(body);
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
    await prisma.caseRecord.updateMany({
      where: { id },
      data: { ...rest, updatedAt: new Date().toISOString() },
    });
    const row = await prisma.caseRecord.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('CaseRecord', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.caseRecord.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
