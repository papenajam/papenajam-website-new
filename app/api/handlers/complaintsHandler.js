// Complaints handler (Task 9: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour is byte-identical to the legacy Mongo handler:
//   - GET    /complaints?page&limit&status  -> 200 `{ items, total, totalPages }`
//     (auth required; envelope omits `page`)
//     optional status equality; sort createdAt desc
//   - POST   /complaints  -> 201 `{ message, id }`  **public, no auth**
//     requires name + message; defaults status='baru', adminNotes=''
//   - GET    /complaints/:id   -> 200 row | 404 (auth)
//   - PUT    /complaints/:id   -> 200 post-update row | 200 null when missing (auth)
//   - DELETE /complaints/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS (auth)
//
// Prisma model is `Complaint` (@@map("complaints")).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { parsePagination } from '@/lib/api/query.js';

export async function handleComplaints(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const url = new URL(request.url);
      const { limit, skip, take } = parsePagination(url, 'complaints');
      const status = url.searchParams.get('status') || '';

      const where = {};
      if (status) where.status = status;

      const [total, rows] = await Promise.all([
        prisma.complaint.count({ where }),
        prisma.complaint.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
      ]);

      // Legacy envelope omits `page` (contract pins keys via expectExact).
      return NextResponse.json({
        items: serializeList('Complaint', rows),
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      });
    }
    if (method === 'POST') {
      // Public create — intentionally no auth (citizens file complaints).
      const body = await request.json();
      if (!body.name || !body.message) {
        return NextResponse.json(
          { error: 'Nama dan pesan wajib diisi' },
          { status: 400 },
        );
      }
      const now = new Date().toISOString();
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = body;
      const created = await prisma.complaint.create({
        data: {
          ...rest,
          // Contract expects email:'' / phone:null / adminNotes:'' when absent.
          email: rest.email ?? '',
          phone: rest.phone ?? null,
          status: 'baru',
          adminNotes: '',
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(
        { message: 'Pengaduan berhasil dikirim', id: created.id },
        { status: 201 },
      );
    }
  }

  if (method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const row = await prisma.complaint.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('Complaint', row));
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const { id: _ignoreId, createdAt: _c, ...rest } = body;
    await prisma.complaint.updateMany({
      where: { id },
      data: { ...rest, updatedAt: new Date().toISOString() },
    });
    const row = await prisma.complaint.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('Complaint', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.complaint.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
