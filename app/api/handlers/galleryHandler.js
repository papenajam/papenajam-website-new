// Gallery handler (Task 8: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour is byte-identical to the legacy Mongo handler:
//   - GET    /gallery?category&limit  -> 200 `{ items, categories }`
//     public list always filters isActive=true; optional category equality;
//     sort order asc then createdAt desc; limit only (no page envelope)
//     categories = distinct category for isActive=true rows
//   - POST   /gallery       -> 201 created row (auth); defaults isActive=true, order=0
//   - GET    /gallery/all   -> 200 `{ items }` (auth); all rows, same sort
//   - PUT    /gallery/:id   -> 200 post-update row | 200 null when missing
//   - DELETE /gallery/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//
// Prisma model is `GalleryItem` (@@map("gallery")). Multilingual titleEn kept.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';

const PUBLIC_ORDER = [{ order: 'asc' }, { createdAt: 'desc' }];

/**
 * Distinct non-null categories for active gallery items, mirroring Mongo
 * `col.distinct('category', { isActive: true })`. Prisma returns objects; we
 * map to a scalar array and drop nulls so the wire shape stays `string[]`.
 */
async function activeCategories() {
  const rows = await prisma.galleryItem.findMany({
    where: { isActive: true },
    distinct: ['category'],
    select: { category: true },
  });
  return rows.map((r) => r.category).filter((c) => c !== null && c !== undefined);
}

export async function handleGallery(request, segments, method) {
  const [sub] = segments;

  if (!sub) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const category = url.searchParams.get('category') || '';
      // Legacy: parseInt(limit || '50'). parsePagination clamps NaN; we keep
      // the same default of 50 and only take a limit (no page envelope).
      const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10);
      const take = Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : rawLimit;

      const where = { isActive: true };
      if (category) where.category = category;

      const [rows, categories] = await Promise.all([
        prisma.galleryItem.findMany({
          where,
          orderBy: PUBLIC_ORDER,
          take,
        }),
        activeCategories(),
      ]);

      return NextResponse.json({
        items: serializeList('GalleryItem', rows),
        categories,
      });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const now = new Date().toISOString();
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = body;
      const created = await prisma.galleryItem.create({
        data: {
          ...rest,
          // Legacy defaults: isActive !== false (so undefined -> true), order || 0.
          isActive: rest.isActive !== false,
          order: rest.order || 0,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('GalleryItem', created), { status: 201 });
    }
  }

  if (sub === 'all' && method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rows = await prisma.galleryItem.findMany({
      orderBy: PUBLIC_ORDER,
    });
    return NextResponse.json({ items: serializeList('GalleryItem', rows) });
  }

  if (sub) {
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const { id: _ignoreId, createdAt: _c, ...rest } = body;
      await prisma.galleryItem.updateMany({
        where: { id: sub },
        data: { ...rest, updatedAt: new Date().toISOString() },
      });
      const row = await prisma.galleryItem.findUnique({ where: { id: sub } });
      return NextResponse.json(serializeRecord('GalleryItem', row));
    }
    if (method === 'DELETE') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await prisma.galleryItem.deleteMany({ where: { id: sub } });
      return NextResponse.json({ message: 'Berhasil dihapus' });
    }
  }
  return null;
}
