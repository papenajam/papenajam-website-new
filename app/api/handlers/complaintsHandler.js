import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleComplaints(request, segments, method) {
  const [id] = segments;
  const col = await getCollection('complaints');

  if (!id) {
    if (method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const url    = new URL(request.url);
      const page   = parseInt(url.searchParams.get('page')  || '1');
      const limit  = parseInt(url.searchParams.get('limit') || '20');
      const status = url.searchParams.get('status') || '';
      const query = {};
      if (status) query.status = status;
      const total = await col.countDocuments(query);
      const items = await col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
      return NextResponse.json({ items, total, totalPages: Math.ceil(total/limit) });
    }
    if (method === 'POST') {
      const body = await request.json();
      if (!body.name || !body.message) return NextResponse.json({ error: 'Nama dan pesan wajib diisi' }, { status: 400 });
      const item = { id: uuidv4(), ...body, status: 'baru', adminNotes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await col.insertOne(item);
      return NextResponse.json({ message: 'Pengaduan berhasil dikirim', id: item.id }, { status: 201 });
    }
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
