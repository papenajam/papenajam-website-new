import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handlePages(request, segments, method) {
  const [seg2, seg3] = segments;
  const col = await getCollection('pages');

  if (!seg2) {
    if (method === 'GET') {
      const items = await col.find({}).sort({ createdAt: -1 }).toArray();
      return NextResponse.json({ items });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const item = {
        id: uuidv4(), ...body, blocks: body.blocks || [],
        status: body.status || 'draft',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      await col.insertOne(item);
      return NextResponse.json(item, { status: 201 });
    }
  }

  // GET /api/pages/slug/:slug
  if (seg2 === 'slug' && seg3 && method === 'GET') {
    const authUser = requireAuth(request);
    const query = authUser ? { slug: seg3 } : { slug: seg3, status: 'published' };
    const item = await col.findOne(query);
    if (!item) return NextResponse.json({ error: 'Halaman tidak ditemukan' }, { status: 404 });
    return NextResponse.json(item);
  }

  // /api/pages/:id
  const id = seg2;
  if (method === 'GET') {
    const item = await col.findOne({ id });
    if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(item);
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    await col.updateOne({ id }, { $set: { ...body, updatedAt: new Date().toISOString() } });
    return NextResponse.json(await col.findOne({ id }));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await col.deleteOne({ id });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
