import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { generateToken, comparePassword, requireAuth } from '@/lib/auth';

export async function handleAuth(request, segments, method) {
  const [sub] = segments;

  if (sub === 'login' && method === 'POST') {
    const { email, password } = await request.json();
    const users = await getCollection('users');
    const user = await users.findOne({ email: email.toLowerCase() });
    if (!user) return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    const valid = await comparePassword(password, user.password);
    if (!valid) return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role || 'admin' });
    return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'admin' } });
  }

  if (sub === 'verify' && method === 'GET') {
    const user = requireAuth(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ user });
  }

  return null;
}
