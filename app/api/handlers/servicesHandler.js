// Services handler (Task 8: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET    /services       -> 200 `{ items }` (NOT paginated; sorted by order asc)
//   - POST   /services       -> 201 created row (auth)
//   - GET    /services/:id   -> 200 row | 404
//   - PUT    /services/:id   -> 200 post-update row | 200 null when missing
//   - DELETE /services/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//
// Public list does NOT filter by isActive (legacy contract; UI/seed carry the
// flag but the list endpoint returns every row ordered by `order`).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';

export async function handleServices(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method === 'GET') {
      const rows = await prisma.service.findMany({
        orderBy: { order: 'asc' },
      });
      return NextResponse.json({ items: serializeList('Service', rows) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const now = new Date().toISOString();
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = body;
      const created = await prisma.service.create({
        data: {
          ...rest,
          // Schema requires non-null Int/Boolean; defaults mirror seed/UI.
          order: typeof rest.order === 'number' ? rest.order : 0,
          isActive: rest.isActive === true || rest.isActive === false
            ? rest.isActive
            : true,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('Service', created), { status: 201 });
    }
  }

  if (method === 'GET') {
    const row = await prisma.service.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('Service', row));
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const { id: _ignoreId, createdAt: _c, ...rest } = body;
    await prisma.service.updateMany({
      where: { id },
      data: { ...rest, updatedAt: new Date().toISOString() },
    });
    const row = await prisma.service.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('Service', row));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await prisma.service.deleteMany({ where: { id } });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
