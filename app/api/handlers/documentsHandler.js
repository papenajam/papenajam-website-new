import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleDocuments(request, segments, method) {
  const [sub, subId] = segments;
  const col = await getCollection('documents');

  if (!sub) {
    if (method === 'GET') {
      const url      = new URL(request.url);
      const category = url.searchParams.get('category') || '';
      const search   = url.searchParams.get('search')   || '';
      const limit    = parseInt(url.searchParams.get('limit') || '20');
      const page     = parseInt(url.searchParams.get('page')  || '1');
      const query = { isActive: true };
      if (category) query.category = category;
      if (search)   query.title = { $regex: search, $options: 'i' };
      const total      = await col.countDocuments(query);
      const items      = await col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
      const categories = await col.distinct('category', { isActive: true });
      return NextResponse.json({ items, total, categories, totalPages: Math.ceil(total/limit) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const item = { id: uuidv4(), ...body, isActive: body.isActive !== false, downloadCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await col.insertOne(item);
      return NextResponse.json(item, { status: 201 });
    }
  }

  if (sub === 'download' && subId) {
    await col.updateOne({ id: subId }, { $inc: { downloadCount: 1 } });
    const item = await col.findOne({ id: subId });
    return NextResponse.json({ fileUrl: item?.fileUrl, title: item?.title });
  }

  if (sub) {
    if (method === 'GET') {
      const item = await col.findOne({ id: sub });
      if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
      return NextResponse.json(item);
    }
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
