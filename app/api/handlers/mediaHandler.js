import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';

export async function handleMedia(request, segments, method) {
  const [id] = segments;
  const col = await getCollection('media');

  if (!id) {
    if (method !== 'GET') return null;
    const url = new URL(request.url);
    const page      = parseInt(url.searchParams.get('page')      || '1');
    const limit     = parseInt(url.searchParams.get('limit')     || '30');
    const search    = url.searchParams.get('search')    || '';
    const type      = url.searchParams.get('type')      || '';
    const sortField = url.searchParams.get('sortField') || 'createdAt';
    const sortDir   = url.searchParams.get('sortDir') === 'asc' ? 1 : -1;
    const query = {};
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { originalName: { $regex: search, $options: 'i' } },
    ];
    if (type && type !== 'all') query.type = type;
    const total = await col.countDocuments(query);
    const items = await col.find(query).sort({ [sortField]: sortDir }).skip((page-1)*limit).limit(limit).toArray();
    return NextResponse.json({ items, total, page, totalPages: Math.ceil(total/limit) });
  }

  if (method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const item = await col.findOne({ id });
    if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(item);
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const update = {};
    for (const k of ['title','alt']) { if (body[k] !== undefined) update[k] = body[k]; }
    update.updatedAt = new Date().toISOString();
    await col.updateOne({ id }, { $set: update });
    return NextResponse.json(await col.findOne({ id }));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const item = await col.findOne({ id });
    if (item) {
      try { await unlink(path.join(process.cwd(), 'public', item.url)); } catch {}
      await col.deleteOne({ id });
    }
    return NextResponse.json({ message: 'File berhasil dihapus' });
  }
  return null;
}
