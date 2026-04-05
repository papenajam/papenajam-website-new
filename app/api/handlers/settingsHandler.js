import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function handleSettings(request, _segments, method) {
  const col = await getCollection('settings');

  if (method === 'GET') {
    const settings = await col.find({}).toArray();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    return NextResponse.json(result);
  }
  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      await col.updateOne({ key }, { $set: { key, value } }, { upsert: true });
    }
    return NextResponse.json({ message: 'Pengaturan berhasil disimpan' });
  }
  return null;
}
