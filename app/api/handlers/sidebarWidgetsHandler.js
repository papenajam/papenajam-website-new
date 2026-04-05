import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleSidebarWidgets(request, segments, method) {
  const [sub] = segments;
  const col = await getCollection('sidebar_widgets');

  if (!sub) {
    if (method === 'GET') {
      const items = await col.find({ isActive: true }).sort({ order: 1 }).toArray();
      return NextResponse.json({ items });
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
    return NextResponse.json({ items: await col.find({}).sort({ order: 1 }).toArray() });
  }

  if (sub === 'bulk' && method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { items } = await request.json();
    if (!Array.isArray(items)) return NextResponse.json({ error: 'items harus array' }, { status: 400 });
    await col.deleteMany({});
    if (items.length > 0) {
      await col.insertMany(items.map(i => ({ ...i, id: i.id || uuidv4(), updatedAt: new Date().toISOString(), createdAt: i.createdAt || new Date().toISOString() })));
    }
    return NextResponse.json({ message: 'Sidebar widgets disimpan', count: items.length });
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
