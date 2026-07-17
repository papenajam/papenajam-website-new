// FAQ handler (Task 8: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET    /faq?category  -> 200 `{ items, categories }`
//     public list always filters isActive=true; optional category equality;
//     sort order asc; categories = distinct category for isActive=true
//   - POST   /faq       -> 201 created row (auth); defaults isActive=true, order=0
//   - GET    /faq/all   -> 200 `{ items }` (auth); all rows, sort order asc
//   - PUT    /faq/:id   -> 200 post-update row | 200 null when missing
//   - DELETE /faq/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//
// Multilingual questionEn / answerEn preserved via body spread.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';

async function activeCategories() {
  const rows = await prisma.faq.findMany({
    where: { isActive: true },
    distinct: ['category'],
    select: { category: true },
  });
  return rows.map((r) => r.category).filter((c) => c !== null && c !== undefined);
}

export async function handleFaq(request, segments, method) {
  const [sub] = segments;

  if (!sub) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const category = url.searchParams.get('category') || '';

      const where = { isActive: true };
      if (category) where.category = category;

      const [rows, categories] = await Promise.all([
        prisma.faq.findMany({
          where,
          orderBy: { order: 'asc' },
        }),
        activeCategories(),
      ]);

      return NextResponse.json({
        items: serializeList('Faq', rows),
        categories,
      });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const now = new Date().toISOString();
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = body;
      const created = await prisma.faq.create({
        data: {
          ...rest,
          isActive: rest.isActive !== false,
          order: rest.order || 0,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('Faq', created), { status: 201 });
    }
  }

  if (sub === 'all' && method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rows = await prisma.faq.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ items: serializeList('Faq', rows) });
  }

  if (sub) {
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const { id: _ignoreId, createdAt: _c, ...rest } = body;
      await prisma.faq.updateMany({
        where: { id: sub },
        data: { ...rest, updatedAt: new Date().toISOString() },
      });
      const row = await prisma.faq.findUnique({ where: { id: sub } });
      return NextResponse.json(serializeRecord('Faq', row));
    }
    if (method === 'DELETE') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await prisma.faq.deleteMany({ where: { id: sub } });
      return NextResponse.json({ message: 'Berhasil dihapus' });
    }
  }
  return null;
}
