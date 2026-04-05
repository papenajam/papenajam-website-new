import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleCases(request, segments, method) {
  const [id] = segments;
  const col = await getCollection('cases');

  if (!id) {
    if (method === 'GET') {
      const url = new URL(request.url);
      const page      = parseInt(url.searchParams.get('page')  || '1');
      const limit     = parseInt(url.searchParams.get('limit') || '10');
      const search    = url.searchParams.get('search')    || '';
      const tahun     = url.searchParams.get('tahun')     || '';
      const jenis     = url.searchParams.get('jenis')     || '';
      const namaPihak = url.searchParams.get('namaPihak') || '';
      const query = {};
      if (search) query.nomorPerkara = { $regex: search, $options: 'i' };
      if (tahun)  query.tahun = tahun;
      if (jenis)  query.jenisPerkara = { $regex: jenis, $options: 'i' };
      if (namaPihak) query.$or = [
        { pemohon:  { $regex: namaPihak, $options: 'i' } },
        { termohon: { $regex: namaPihak, $options: 'i' } },
      ];
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
