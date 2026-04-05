import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleNews(request, segments, method) {
  const [id] = segments;
  const col = await getCollection('news');

  if (!id) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const page       = parseInt(url.searchParams.get('page')   || '1');
      const limit      = parseInt(url.searchParams.get('limit')  || '10');
      const search     = url.searchParams.get('search')  || '';
      const publicOnly = url.searchParams.get('public') === 'true';
      const query = {};
      if (search) query.title = { $regex: search, $options: 'i' };
      if (publicOnly) query.isPublished = true;
      const total = await col.countDocuments(query);
      const items = await col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
      return NextResponse.json({ items, total, page, totalPages: Math.ceil(total/limit) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const item = { id: uuidv4(), ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await col.insertOne(item);
      return NextResponse.json(item, { status: 201 });
    }
  }

  const item = await col.findOne({ id });
  if (method === 'GET') {
    if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(item);
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    await col.updateOne({ id }, { $set: { ...body, updatedAt: new Date().toISOString() } });
    return NextResponse.json({ ...item, ...body });
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await col.deleteOne({ id });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
