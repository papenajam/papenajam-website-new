import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleGallery(request, segments, method) {
  const [sub] = segments;
  const col = await getCollection('gallery');

  if (!sub) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const category = url.searchParams.get('category') || '';
      const limit    = parseInt(url.searchParams.get('limit') || '50');
      const query = { isActive: true };
      if (category) query.category = category;
      const items      = await col.find(query).sort({ order: 1, createdAt: -1 }).limit(limit).toArray();
      const categories = await col.distinct('category', { isActive: true });
      return NextResponse.json({ items, categories });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const item = { id: uuidv4(), ...body, isActive: body.isActive !== false, order: body.order || 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await col.insertOne(item);
      return NextResponse.json(item, { status: 201 });
    }
  }

  if (sub === 'all' && method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ items: await col.find({}).sort({ order: 1, createdAt: -1 }).toArray() });
  }

  if (sub) {
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      await col.updateOne({ id: sub }, { $set: { ...body, updatedAt: new Date().toISOString() } });
      return NextResponse.json(await col.findOne({ id: sub }));
    }
    if (method === 'DELETE') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await col.deleteOne({ id: sub });
      return NextResponse.json({ message: 'Berhasil dihapus' });
    }
  }
  return null;
}
