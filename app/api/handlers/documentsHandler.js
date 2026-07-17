// Documents handler (Task 9: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET    /documents?page&limit&category&search
//     -> 200 `{ items, total, categories, totalPages }` (no `page` key)
//     public list always filters isActive=true; optional category equality;
//     search title contains + mode:'insensitive'; sort createdAt desc;
//     categories = distinct category for isActive=true rows
//   - POST   /documents       -> 201 created row (auth);
//     defaults isActive=true, downloadCount=0, order=0
//   - GET    /documents/download/:id
//     atomic downloadCount increment; returns `{ fileUrl, title }` even when
//     the id is missing (baseline body with undefined fields -> JSON `{}`);
//     never throws P2025
//   - GET    /documents/:id   -> 200 row | 404
//   - PUT    /documents/:id   -> 200 post-update row | 200 null when missing
//   - DELETE /documents/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//
// Prisma model is `Document` (@@map("documents")). Multilingual titleEn kept.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { parsePagination } from '@/lib/api/query.js';

/**
 * Distinct non-null categories for active documents, mirroring previous datastore
 * `col.distinct('category', { isActive: true })`. Prisma returns objects; we
 * map to a scalar array and drop nulls so the wire shape stays `string[]`.
 */
async function activeCategories() {
  const rows = await prisma.document.findMany({
    where: { isActive: true },
    distinct: ['category'],
    select: { category: true },
  });
  return rows.map((r) => r.category).filter((c) => c !== null && c !== undefined);
}

export async function handleDocuments(request, segments, method) {
  const [sub, subId] = segments;

  if (!sub) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const { limit, skip, take } = parsePagination(url, 'documents');
      const category = url.searchParams.get('category') || '';
      const search = url.searchParams.get('search') || '';

      const where = { isActive: true };
      if (category) where.category = category;
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      const [total, rows, categories] = await Promise.all([
        prisma.document.count({ where }),
        prisma.document.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        activeCategories(),
      ]);

      // Legacy envelope omits `page` (contract pins keys via expectExact).
      return NextResponse.json({
        items: serializeList('Document', rows),
        total,
        categories,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const now = new Date().toISOString();
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = body;
      const created = await prisma.document.create({
        data: {
          ...rest,
          // Legacy defaults: isActive !== false, downloadCount: 0.
          // Schema requires non-null `order`; default 0 when absent.
          isActive: rest.isActive !== false,
          downloadCount: 0,
          order: rest.order || 0,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('Document', created), { status: 201 });
    }
  }

  if (sub === 'download' && subId) {
    // Atomic increment via updateMany so a missing id is a silent no-op
    // (does NOT throw P2025 the way prisma.document.update would). Then
    // re-read; missing row yields `{ fileUrl: undefined, title: undefined }`
    // which JSON.stringify drops to `{}` — matching the previous datastore optional-chain
    // baseline `item?.fileUrl` / `item?.title`.
    await prisma.document.updateMany({
      where: { id: subId },
      data: { downloadCount: { increment: 1 } },
    });
    const item = await prisma.document.findUnique({ where: { id: subId } });
    return NextResponse.json({ fileUrl: item?.fileUrl, title: item?.title });
  }

  if (sub) {
    if (method === 'GET') {
      const row = await prisma.document.findUnique({ where: { id: sub } });
      if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
      return NextResponse.json(serializeRecord('Document', row));
    }
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const { id: _ignoreId, createdAt: _c, ...rest } = body;
      await prisma.document.updateMany({
        where: { id: sub },
        data: { ...rest, updatedAt: new Date().toISOString() },
      });
      const row = await prisma.document.findUnique({ where: { id: sub } });
      return NextResponse.json(serializeRecord('Document', row));
    }
    if (method === 'DELETE') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await prisma.document.deleteMany({ where: { id: sub } });
      return NextResponse.json({ message: 'Berhasil dihapus' });
    }
  }
  return null;
}
