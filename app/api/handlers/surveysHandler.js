import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleSurveys(request, segments, method) {
  const [sub] = segments;

  if (sub === 'config') {
    const col = await getCollection('survey_config');
    if (method === 'GET') {
      const config = await col.findOne({ id: 'main' });
      return NextResponse.json(config || { id: 'main', isActive: true, title: 'Survei Kepuasan', subtitle: 'Bantu kami meningkatkan pelayanan' });
    }
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      await col.updateOne({ id: 'main' }, { $set: { ...body, id: 'main', updatedAt: new Date().toISOString() } }, { upsert: true });
      return NextResponse.json({ message: 'Konfigurasi survei disimpan' });
    }
  }

  if (sub === 'submit' && method === 'POST') {
    const col  = await getCollection('survey_responses');
    const body = await request.json();
    await col.insertOne({ id: uuidv4(), ...body, createdAt: new Date().toISOString() });
    return NextResponse.json({ message: 'Terima kasih atas masukan Anda!' });
  }

  if (!sub && method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const col   = await getCollection('survey_responses');
    const url   = new URL(request.url);
    const page  = parseInt(url.searchParams.get('page')  || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const total = await col.countDocuments();
    const items = await col.find({}).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
    const all   = await col.find({}, { projection: { rating: 1 } }).toArray();
    const avg   = all.length ? (all.reduce((s, r) => s + (r.rating || 0), 0) / all.length).toFixed(1) : 0;
    return NextResponse.json({ items, total, totalPages: Math.ceil(total/limit), averageRating: parseFloat(avg), totalResponses: all.length });
  }
  return null;
}
