// Achievements handler - penghargaan, predikat, SKM, prestasi
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';

export async function handleAchievements(request, segments, method) {
  const [sub] = segments;

  if (!sub || sub === 'all') {
    if (method === 'GET') {
      const url = new URL(request.url);
      const wantAll = url.searchParams.get('all') === 'true' || sub === 'all';
      if (wantAll) {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const rows = await prisma.achievement.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'desc' }] });
        return NextResponse.json({ items: serializeList('Achievement', rows) });
      }
      const category = url.searchParams.get('category');
      const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
      const limit = Number.isNaN(limitParam) ? 20 : Math.min(Math.max(limitParam, 1), 100);
      const where = { isActive: true };
      if (category) where.category = category;
      const rows = await prisma.achievement.findMany({ where, orderBy: [{ order: 'asc' }, { createdAt: 'desc' }], take: limit });
      return NextResponse.json({ items: serializeList('Achievement', rows) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const now = new Date().toISOString();
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body;
      if (!rest.title) return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 });
      const created = await prisma.achievement.create({
        data: { ...rest, order: typeof rest.order === 'number' ? rest.order : 0, isActive: rest.isActive !== false, createdAt: now, updatedAt: now },
      });
      return NextResponse.json(serializeRecord('Achievement', created), { status: 201 });
    }
  }

  if (sub && sub !== 'all') {
    if (method === 'GET') {
      const row = await prisma.achievement.findUnique({ where: { id: sub } });
      if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
      return NextResponse.json(serializeRecord('Achievement', row));
    }
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const { id: _id, createdAt: _c, ...rest } = body;
      await prisma.achievement.updateMany({ where: { id: sub }, data: { ...rest, updatedAt: new Date().toISOString() } });
      const row = await prisma.achievement.findUnique({ where: { id: sub } });
      return NextResponse.json(serializeRecord('Achievement', row));
    }
    if (method === 'DELETE') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await prisma.achievement.deleteMany({ where: { id: sub } });
      return NextResponse.json({ message: 'Berhasil dihapus' });
    }
  }
  return null;
}
