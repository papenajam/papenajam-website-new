import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth, hashPassword } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleUsers(request, segments, method) {
  const [id] = segments;
  const col = await getCollection('users');

  if (!id) {
    if (method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const items = await col.find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray();
      return NextResponse.json({ items });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const exists = await col.findOne({ email: body.email.toLowerCase() });
      if (exists) return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 });
      const hashedPwd = await hashPassword(body.password);
      const item = {
        id: uuidv4(), name: body.name, email: body.email.toLowerCase(),
        password: hashedPwd, role: body.role || 'admin', createdAt: new Date().toISOString()
      };
      await col.insertOne(item);
      const { password: _, ...safeUser } = item;
      return NextResponse.json(safeUser, { status: 201 });
    }
  }

  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const update = { name: body.name, email: body.email, role: body.role || 'admin', updatedAt: new Date().toISOString() };
    if (body.password) update.password = await hashPassword(body.password);
    await col.updateOne({ id }, { $set: update });
    return NextResponse.json(await col.findOne({ id }, { projection: { password: 0 } }));
  }
  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await col.deleteOne({ id });
    return NextResponse.json({ message: 'Berhasil dihapus' });
  }
  return null;
}
